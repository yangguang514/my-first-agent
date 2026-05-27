import { getLlmConfig } from "../config/env.js";
import { animalSystemPrompt } from "../prompts/animalSystemPrompt.js";

// 根据搜索阶段的结果，给模型补一段“可引用资料/跳过搜索/搜索失败”的上下文。
function formatSearchContext(sources, search = {}) {
  if (sources.length) {
    const blocks = sources
      .map(
        (source) => `[${source.id}] ${source.title}
URL: ${source.url}
摘要: ${source.snippet || "无摘要"}`
      )
      .join("\n\n");

    return `# Web Search Context
本次回答前已根据搜索计划联网检索。
搜索问题: ${search.query || search.plan?.query || ""}
搜索原因: ${search.note || search.plan?.reason || ""}

下面是可引用资料。你必须只引用这些编号，不要虚构来源编号。
${blocks}`;
  }

  if (search.skipped) {
    return `# Web Search Context
本次搜索计划判断无需联网检索。
原因: ${search.note || search.plan?.reason || "当前问题不需要外部资料。"}
请直接回答，不要添加虚构的网页引用或“信息来源”列表。`;
  }

  if (search.plan?.shouldSearch) {
    return `# Web Search Context
搜索计划判断这个问题适合联网检索，但当前没有获得可引用来源。
原因: ${search.note || "搜索未返回可用资料。"}
如回答涉及事实性结论，请明确说明“当前未获得可引用的联网来源”，并谨慎作答。`;
  }

  return `# Web Search Context
本次没有可用联网资料。不要编造来源编号；如需要事实支撑，请说明当前未获得可引用的联网来源。`;
}

// 所有回答都统一经过系统角色、搜索上下文、历史消息三层输入。
function buildMessages(messages, sources, search = {}) {
  return [
    { role: "system", content: animalSystemPrompt },
    { role: "system", content: formatSearchContext(sources, search) },
    ...messages.map(({ role, content }) => ({ role, content }))
  ];
}

function sourceListMarkdown(sources) {
  return sources.map((source) => `[${source.id}] ${source.title} - ${source.url}`).join("\n");
}

// 如果模型忘了列出来源，这里在回答末尾补上前面检索到的来源清单。
function ensureSourceList(answer, sources) {
  if (!sources.length || /信息来源/.test(answer)) return answer;
  return `${answer.trim()}\n\n**信息来源**\n${sourceListMarkdown(sources)}`;
}

// 非流式回答入口，兼容 /api/chat 这类一次性返回的调用方。
export async function completeChat(messages, sources = [], search = {}) {
  const config = getLlmConfig();
  if (!config.key) {
    throw new Error("缺少 ANIMAL_AGENT_API_KEY、DEEPSEEK_API_KEY 或 OPENAI_API_KEY。请在 animalAgent/.env 中配置。");
  }

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}` },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      messages: buildMessages(messages, sources, search)
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `模型接口请求失败：HTTP ${response.status}`);
  const answer = data?.choices?.[0]?.message?.content;
  if (!answer) throw new Error("模型没有返回有效回答。");
  return ensureSourceList(answer, sources);
}

// 流式回答入口，逐段解析 SSE data，并把增量内容推给前端。
export async function streamChat(messages, sources, search = {}, onDelta) {
  const config = getLlmConfig();
  if (!config.key) {
    throw new Error("缺少 ANIMAL_AGENT_API_KEY、DEEPSEEK_API_KEY 或 OPENAI_API_KEY。请在 animalAgent/.env 中配置。");
  }

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}` },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      stream: true,
      messages: buildMessages(messages, sources, search)
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || `模型接口请求失败：HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("模型接口没有返回可读流。");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullAnswer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const dataLines = part
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""));

      for (const dataLine of dataLines) {
        if (dataLine === "[DONE]") {
          if (sources.length && !/信息来源/.test(fullAnswer)) {
            const sourceList = `\n\n**信息来源**\n${sourceListMarkdown(sources)}`;
            fullAnswer += sourceList;
            onDelta(sourceList);
          }
          return fullAnswer;
        }

        const chunk = JSON.parse(dataLine);
        const content = chunk?.choices?.[0]?.delta?.content || "";
        if (content) {
          fullAnswer += content;
          onDelta(content);
        }
      }
    }
  }

  if (sources.length && !/信息来源/.test(fullAnswer)) {
    const sourceList = `\n\n**信息来源**\n${sourceListMarkdown(sources)}`;
    fullAnswer += sourceList;
    onDelta(sourceList);
  }
  return fullAnswer;
}
