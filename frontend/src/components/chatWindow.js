import { renderMarkdown, escapeHtml } from "../utils/markdown.js";

function renderTyping() {
  return `<span class="typing" aria-label="正在生成回答"><span></span><span></span><span></span></span>`;
}

function renderSources(sources = []) {
  if (!sources.length) return "";
  return `
    <div class="source-list" aria-label="信息来源">
      ${sources
        .map(
          (source) => `
            <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
              <span>[${source.id}]</span>
              <strong>${escapeHtml(source.title)}</strong>
            </a>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderMessages(messages, streamingIndex) {
  return messages
    .map((message, index) => {
      const label = message.role === "user" ? "You" : "AnimalAgent";
      const isStreaming = index === streamingIndex && !message.content;
      return `
        <article class="message ${message.role}">
          <div class="message-label">${label}</div>
          <div class="bubble">
            ${isStreaming ? renderTyping() : renderMarkdown(message.content)}
            ${message.role === "assistant" ? renderSources(message.sources) : ""}
          </div>
        </article>
      `;
    })
    .join("");
}
