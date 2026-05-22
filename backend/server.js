import { createServer } from "node:http";
import { getServerConfig, loadEnvFile } from "./config/env.js";
import { handleApi } from "./routes/apiRoutes.js";
import { serveStatic } from "./utils/static.js";

await loadEnvFile();

const server = createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  await serveStatic(req, res);
});

const { port, storageProvider } = getServerConfig();
server.listen(port, () => {
  console.log(`AnimalAgent listening on http://localhost:${port}`);
  console.log(`Storage provider: ${storageProvider}`);
});
