import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicSource = join(root, "public");
const frontendSource = join(root, "frontend", "src");
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(publicSource, dist, { recursive: true });
await rm(join(dist, "src"), { recursive: true, force: true });
await cp(frontendSource, join(dist, "src"), { recursive: true });

console.log("Built static frontend -> dist");
