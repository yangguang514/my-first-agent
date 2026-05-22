import { getLlmConfig } from "../config/env.js";
import { animalSystemPrompt } from "../prompts/animalSystemPrompt.js";

function formatSearchContext(sources) {
  if (!sources.length) {
    return "# Web Search Context\n本次没有可用联网资料。请明确说明“当前未获得可引用的联网来源”，并谨慎回答。";
  }

  const blocks = sources
    .map(
      (source) => `[${source.id}] ${source.title}
URL: ${source.url}
摘要: ${source.snippet || "无摘要"}`
    )
    .join("\n\n");

  return `# Web Search Context
下面是回答前检索到的资料。你必须只引用这些编号，不要虚构来源编号。

${blocks}`;
}

function buildMessages(messages, sources) {
  return [
    { role: "system", content: animalSystemPrompt },
    { role: "system", content: formatSearchContext(sources) },
    ...messages.map(({ role, content }) => ({ role, content }))
  ];
}

function sourceListMarkdown(sources) {
  return sources.map((source) => `[${source.id}] ${source.title} - ${source.url}`).join("\n");
}

function ensureSourceList(answer, sources) {
  if (!sources.length || /信息来源/.test(answer)) return answer;
  return `${answer.trim()}\n\n**信息来源**\n${sourceListMarkdown(sources)}`;
}

export async function completeChat(messages, sources = []) {
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
      messages: buildMessages(messages, sources)
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `模型接口请求失败，HTTP ${response.status}`);
  const answer = data?.choices?.[0]?.message?.content;
  if (!answer) throw new Error("模型没有返回有效回答。");
  return ensureSourceList(answer, sources);
}

export async function streamChat(messages, sources, onDelta) {
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
      messages: buildMessages(messages, sources)
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || `模型接口请求失败，HTTP ${response.status}`);
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
