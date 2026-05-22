import { getSearchConfig } from "../config/env.js";

function latestQuestion(messages) {
  return [...messages].reverse().find((message) => message.role === "user")?.content || "";
}

function buildQuery(messages) {
  return `${latestQuestion(messages)} animal zoology scientific name IUCN habitat behavior ecology`;
}

function normalizeSource(item, index) {
  return {
    id: index + 1,
    title: String(item.title || item.name || `来源 ${index + 1}`).trim(),
    url: String(item.url || item.link || "").trim(),
    snippet: String(item.snippet || item.content || item.description || item.text || "")
      .trim()
      .slice(0, 900)
  };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchWithTavily(query, config) {
  const response = await fetchWithTimeout(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.key,
        query,
        max_results: config.maxResults,
        search_depth: process.env.TAVILY_SEARCH_DEPTH || "basic",
        include_answer: false
      })
    },
    config.timeoutMs
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Tavily search failed: HTTP ${response.status}`);
  return Array.isArray(data.results) ? data.results : [];
}

async function searchWithSerper(query, config) {
  const response = await fetchWithTimeout(
    "https://google.serper.dev/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": config.key },
      body: JSON.stringify({ q: query, num: config.maxResults })
    },
    config.timeoutMs
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Serper search failed: HTTP ${response.status}`);
  return Array.isArray(data.organic) ? data.organic : [];
}

async function searchWithBrave(query, config) {
  const params = new URLSearchParams({ q: query, count: String(config.maxResults) });
  const response = await fetchWithTimeout(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    { headers: { Accept: "application/json", "X-Subscription-Token": config.key } },
    config.timeoutMs
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Brave search failed: HTTP ${response.status}`);
  return Array.isArray(data?.web?.results) ? data.web.results : [];
}

export async function searchWeb(messages) {
  const config = getSearchConfig();
  if (config.provider === "off") {
    return { enabled: false, query: "", note: "未配置 Search API，已跳过联网检索。", sources: [] };
  }
  if (!config.key) {
    return {
      enabled: false,
      query: "",
      note: `已设置 SEARCH_PROVIDER=${config.provider}，但缺少对应 Search API Key。`,
      sources: []
    };
  }

  const query = buildQuery(messages);
  let rawResults = [];
  if (config.provider === "tavily") rawResults = await searchWithTavily(query, config);
  else if (config.provider === "serper") rawResults = await searchWithSerper(query, config);
  else if (config.provider === "brave") rawResults = await searchWithBrave(query, config);
  else throw new Error(`Unsupported SEARCH_PROVIDER: ${config.provider}`);

  const seen = new Set();
  const sources = rawResults
    .map(normalizeSource)
    .filter((source) => source.url && !seen.has(source.url) && seen.add(source.url))
    .slice(0, config.maxResults);

  return { enabled: true, query, note: "", sources };
}
