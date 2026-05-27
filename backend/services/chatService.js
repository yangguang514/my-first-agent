import { conversationRepository, welcomeMessage } from "../repositories/conversationRepository.js";
import { completeChat, streamChat } from "./llmService.js";
import { searchWeb } from "./searchService.js";
import { generateLocalTitle } from "./titleService.js";

export async function listConversations() {
  return conversationRepository.list();
}

export async function createConversation() {
  return conversationRepository.create();
}

export async function importConversation(payload) {
  return conversationRepository.import(payload);
}

export async function getConversation(id) {
  return conversationRepository.get(id);
}

export async function deleteConversation(id) {
  return conversationRepository.delete(id);
}

export async function clearConversation(id) {
  const conversation = await conversationRepository.get(id);
  if (!conversation) return null;
  conversation.title = "新的动物对话";
  conversation.messages = [welcomeMessage()];
  return conversationRepository.save(conversation);
}

export async function askOnce(messages) {
  // 一次性问答也走同一套搜索计划，保证非流式和流式行为一致。
  const search = await searchWeb(messages);
  const answer = await completeChat(messages, search.sources, search);
  return {
    answer,
    sources: search.sources,
    search: { enabled: search.enabled, skipped: search.skipped, query: search.query, note: search.note, plan: search.plan }
  };
}

export async function appendUserMessageAndStream(conversationId, content, events) {
  let conversation = await conversationRepository.get(conversationId);
  if (!conversation) conversation = await conversationRepository.create();

  conversation.messages.push({ role: "user", content, sources: [] });
  conversation.title = generateLocalTitle(conversation.messages);
  conversation = await conversationRepository.save(conversation);

  events.status("正在判断是否需要联网检索...");
  // searchWeb 会先生成搜索计划；如果不需要联网，会返回 skipped=true。
  const search = await searchWeb(conversation.messages);
  events.sources({
    enabled: search.enabled,
    skipped: search.skipped,
    query: search.query,
    note: search.note,
    plan: search.plan,
    sources: search.sources
  });

  events.status("正在生成回答...");
  let answer = "";

  // 把搜索计划和来源一起传给模型，让回答阶段知道搜索是执行、跳过还是失败。
  answer = await streamChat(conversation.messages, search.sources, search, (delta) => {
    answer += delta;
    events.delta(delta);
  });

  if (!answer.trim()) {
    throw new Error("Model did not return a valid answer.");
  }

  conversation.messages.push({ role: "assistant", content: answer, sources: search.sources });
  conversation.title = generateLocalTitle(conversation.messages);
  conversation = await conversationRepository.save(conversation);
  return conversation;
}
