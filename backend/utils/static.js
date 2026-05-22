import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { frontendDir, publicDir } from "../config/env.js";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function isInside(childPath, parentPath) {
  return childPath === parentPath || childPath.startsWith(`${parentPath}\\`) || childPath.startsWith(`${parentPath}/`);
}

export async function serveStatic(req, res) {
  const rawPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const safePath = normalize(rawPath === "/" ? "/index.html" : rawPath).replace(/^(\.\.[/\\])+/, "");
  const baseDir = safePath.startsWith("\\src") || safePath.startsWith("/src") ? frontendDir : publicDir;
  const relativePath = safePath.replace(/^[/\\]src[/\\]?/, "");
  const filePath = join(baseDir, relativePath);

  if (!isInside(filePath, baseDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}
