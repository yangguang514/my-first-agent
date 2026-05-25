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
  const search = await searchWeb(messages);
  const answer = await completeChat(messages, search.sources);
  return {
    answer,
    sources: search.sources,
    search: { enabled: search.enabled, query: search.query, note: search.note }
  };
}

export async function appendUserMessageAndStream(conversationId, content, events) {
  let conversation = await conversationRepository.get(conversationId);
  if (!conversation) conversation = await conversationRepository.create();

  conversation.messages.push({ role: "user", content, sources: [] });
  conversation.title = generateLocalTitle(conversation.messages);
  conversation = await conversationRepository.save(conversation);

  events.status("正在联网检索资料...");
  const search = await searchWeb(conversation.messages);
  events.sources({
    enabled: search.enabled,
    query: search.query,
    note: search.note,
    sources: search.sources
  });

  events.status("正在生成回答...");
  let answer = "";

  answer = await streamChat(conversation.messages, search.sources, (delta) => {
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
