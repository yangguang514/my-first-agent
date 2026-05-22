export async function listConversations() {
  const response = await fetch("/api/conversations");
  return parseJson(response);
}

export async function createConversation() {
  const response = await fetch("/api/conversations", { method: "POST" });
  return parseJson(response);
}

export async function importConversation({ title, messages }) {
  const response = await fetch("/api/conversations/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, messages })
  });
  return parseJson(response);
}

export async function getConversation(id) {
  const response = await fetch(`/api/conversations/${id}`);
  return parseJson(response);
}

export async function clearConversation(id) {
  const response = await fetch(`/api/conversations/${id}/clear`, { method: "POST" });
  return parseJson(response);
}

export async function deleteConversation(id) {
  const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
  return parseJson(response);
}

async function parseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

export async function streamMessage(conversationId, content, onEvent) {
  const response = await fetch(`/api/conversations/${conversationId}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "请求失败");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    buffer = parseSse(buffer, onEvent);
  }
}

function parseSse(buffer, onEvent) {
  const events = buffer.split("\n\n");
  const rest = events.pop() || "";

  for (const eventText of events) {
    const lines = eventText.split("\n");
    const eventName = lines.find((line) => line.startsWith("event:"))?.replace(/^event:\s?/, "") || "message";
    const dataText = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s?/, ""))
      .join("\n");

    if (dataText) onEvent(eventName, JSON.parse(dataText));
  }

  return rest;
}
