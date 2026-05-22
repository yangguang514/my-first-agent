import { escapeHtml } from "../utils/markdown.js";

export function renderSidebar(conversations, activeId) {
  if (!conversations.length) return "";

  return conversations
    .map((conversation) => {
      const active = conversation.id === activeId ? " active" : "";
      const date = new Date(conversation.updatedAt).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });

      return `
        <div class="conversation-item${active}" data-id="${conversation.id}">
          <button class="conversation-open" type="button" title="${escapeHtml(conversation.title)}">
            <span class="conversation-title">${escapeHtml(conversation.title)}</span>
            <span class="conversation-meta">${date}</span>
          </button>
          <button class="conversation-delete" type="button" title="删除对话" aria-label="删除对话">x</button>
        </div>
      `;
    })
    .join("");
}
