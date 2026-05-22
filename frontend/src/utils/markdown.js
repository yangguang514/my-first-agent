export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderTable(lines, startIndex) {
  const rows = [];
  let index = startIndex;
  while (index < lines.length && /^\|.+\|$/.test(lines[index].trim())) {
    rows.push(lines[index].trim());
    index += 1;
  }
  if (rows.length < 2) return null;
  const divider = rows[1].split("|").slice(1, -1).every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
  if (!divider) return null;

  const header = rows[0].split("|").slice(1, -1).map((cell) => renderInline(cell.trim()));
  const bodyRows = rows.slice(2).map((row) => row.split("|").slice(1, -1).map((cell) => renderInline(cell.trim())));
  const thead = `<thead><tr>${header.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return { html: `<table>${thead}${tbody}</table>`, nextIndex: index };
}

export function renderMarkdown(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const blocks = [];
  let list = null;

  const closeList = () => {
    if (!list) return;
    blocks.push(`<${list.type}>${list.items.map((item) => `<li>${item}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const table = renderTable(lines, index);
    if (table) {
      closeList();
      blocks.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith(">")) {
      closeList();
      blocks.push(`<blockquote>${renderInline(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.+)/);
    if (unordered) {
      if (!list || list.type !== "ul") {
        closeList();
        list = { type: "ul", items: [] };
      }
      list.items.push(renderInline(unordered[1]));
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.+)/);
    if (ordered) {
      if (!list || list.type !== "ol") {
        closeList();
        list = { type: "ol", items: [] };
      }
      list.items.push(renderInline(ordered[1]));
      continue;
    }
    closeList();
    blocks.push(`<p>${renderInline(line)}</p>`);
  }

  closeList();
  return blocks.join("");
}
