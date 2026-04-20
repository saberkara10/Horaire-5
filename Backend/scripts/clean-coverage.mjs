import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const coverageDir = resolve(currentDir, "../coverage");

rmSync(coverageDir, { recursive: true, force: true });
