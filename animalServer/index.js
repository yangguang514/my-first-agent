import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { handleApi } from "../backend/routes/apiRoutes.js";
import { loadEnvFile } from "../backend/config/env.js";

dotenv.config();
await loadEnvFile();

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = join(__dirname, "..", "animalClient");
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(clientDir));

app.use("/api", async (req, res) => {
  try {
    req.url = `/api${req.url}`;
    const handled = await handleApi(req, res);
    if (!handled && !res.headersSent) {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
});

app.get("*", async (_, res) => {
  const html = await readFile(join(clientDir, "index.html"), "utf8");
  res.type("html").send(html);
});

const port = Number(process.env.PORT || 3010);
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`AnimalAgent server listening on http://localhost:${port}`);
  });
}

export default app;
