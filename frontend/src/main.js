import {
  clearConversation,
  createConversation,
  deleteConversation,
  getConversation,
  importConversation,
  listConversations,
  streamMessage
} from "./services/api.js";
import { renderMessages } from "./components/chatWindow.js";
import { renderSidebar } from "./components/sidebar.js";

const activeKey = "animal-agent-active-conversation-id";
const legacyStoreKey = "animal-agent-chat-store-v1";
const els = {
  list: document.querySelector("#conversationList"),
  messages: document.querySelector("#messages"),
  form: document.querySelector("#chatForm"),
  input: document.querySelector("#promptInput"),
  send: document.querySelector("#sendButton"),
  clear: document.querySelector("#clearChat"),
  create: document.querySelector("#newChat"),
  title: document.querySelector("#chatTitle"),
  examples: document.querySelectorAll(".examples button")
};

const state = {
  conversations: [],
  activeId: localStorage.getItem(activeKey) || "",
  activeConversation: null,
  streamingIndex: -1,
  busy: false
};

async function boot() {
  await migrateLegacyConversations();
  await refreshConversationList();
  if (!state.activeId || !state.conversations.some((item) => item.id === state.activeId)) {
    await createAndOpenConversation();
  } else {
    await openConversation(state.activeId);
  }
}

async function migrateLegacyConversations() {
  const raw = localStorage.getItem(legacyStoreKey);
  if (!raw) return;

  try {
    const legacy = JSON.parse(raw);
    const conversations = Array.isArray(legacy?.conversations) ? legacy.conversations : [];
    for (const conversation of conversations) {
      const messages = Array.isArray(conversation.messages)
        ? conversation.messages.filter((message) => message && ["user", "assistant"].includes(message.role))
        : [];
      if (messages.some((message) => message.role === "user")) {
        await importConversation({
          title: conversation.title || "已迁移的对话",
          messages
        });
      }
    }
    localStorage.removeItem(legacyStoreKey);
  } catch {
    localStorage.removeItem(legacyStoreKey);
  }
}

async function refreshConversationList() {
  const data = await listConversations();
  state.conversations = data.conversations || [];
  render();
}

async function createAndOpenConversation() {
  const data = await createConversation();
  await refreshConversationList();
  await openConversation(data.conversation.id);
}

async function openConversation(id) {
  if (state.busy) return;
  const data = await getConversation(id);
  state.activeId = data.conversation.id;
  state.activeConversation = data.conversation;
  localStorage.setItem(activeKey, state.activeId);
  render();
}

function render() {
  els.list.innerHTML = renderSidebar(state.conversations, state.activeId);
  const conversation = state.activeConversation;
  els.title.textContent = conversation?.title || "动物学问答";
  els.messages.innerHTML = renderMessages(conversation?.messages || [], state.streamingIndex);
  els.messages.scrollTop = els.messages.scrollHeight;
}

async function sendCurrentMessage(content) {
  const text = content.trim();
  if (!text || state.busy || !state.activeConversation) return;

  state.busy = true;
  els.send.disabled = true;
  els.input.value = "";

  state.activeConversation.messages.push({ role: "user", content: text, sources: [] });
  state.streamingIndex = state.activeConversation.messages.push({ role: "assistant", content: "", sources: [] }) - 1;
  render();

  try {
    await streamMessage(state.activeId, text, (eventName, data) => {
      const assistant = state.activeConversation.messages[state.streamingIndex];
      if (!assistant) return;

      if (eventName === "sources") assistant.sources = data.sources || [];
      if (eventName === "delta") assistant.content += data.content || "";
      if (eventName === "error") throw new Error(data.message || "流式响应失败");
      if (eventName === "done") {
        state.activeConversation = data.conversation;
        state.streamingIndex = -1;
      }
      render();
    });

    await refreshConversationList();
    await openConversation(state.activeId);
  } catch (error) {
    const assistant = state.activeConversation.messages[state.streamingIndex];
    if (assistant) {
      assistant.content = `**服务暂时不可用**\n\n${error.message}\n\n请检查 \`animalAgent/.env\` 中的模型 API Key、Search API Key、模型名和接口地址。`;
    }
  } finally {
    state.streamingIndex = -1;
    state.busy = false;
    els.send.disabled = false;
    render();
    els.input.focus();
  }
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendCurrentMessage(els.input.value);
});

els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.form.requestSubmit();
  }
});

els.create.addEventListener("click", createAndOpenConversation);

els.clear.addEventListener("click", async () => {
  if (!state.activeId || state.busy) return;
  const data = await clearConversation(state.activeId);
  state.activeConversation = data.conversation;
  await refreshConversationList();
  render();
});

els.list.addEventListener("click", async (event) => {
  const item = event.target.closest(".conversation-item");
  if (!item) return;

  if (event.target.closest(".conversation-delete")) {
    const target = state.conversations.find((conversation) => conversation.id === item.dataset.id);
    if (!target || !confirm(`删除“${target.title}”？此操作不会影响其他对话。`)) return;
    await deleteConversation(item.dataset.id);
    await refreshConversationList();
    if (item.dataset.id === state.activeId) {
      const next = state.conversations[0];
      if (next) await openConversation(next.id);
      else await createAndOpenConversation();
    }
    return;
  }

  await openConversation(item.dataset.id);
});

els.examples.forEach((button) => {
  button.addEventListener("click", () => {
    els.input.value = button.textContent;
    els.input.focus();
  });
});

boot().catch((error) => {
  els.messages.innerHTML = `<article class="message assistant"><div class="message-label">AnimalAgent</div><div class="bubble"><p>${error.message}</p></div></article>`;
});
