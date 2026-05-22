import { loadEnvFile } from "../backend/config/env.js";
import { handleApi } from "../backend/routes/apiRoutes.js";
import { sendJson } from "../backend/utils/http.js";

let envLoaded = false;

async function ensureEnv() {
  if (envLoaded) return;
  await loadEnvFile();
  envLoaded = true;
}

export default async function handler(req, res) {
  await ensureEnv();

  if (!req.url?.startsWith("/api/")) {
    const path = Array.isArray(req.query?.path) ? req.query.path.join("/") : req.query?.path || "";
    req.url = `/api/${path}`;
  }

  const handled = await handleApi(req, res);
  if (!handled && !res.writableEnded) {
    sendJson(res, 404, { error: "Not found" });
  }
}
