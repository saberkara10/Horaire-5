import { runMigrations } from "./migration-engine.js";

try {
  await runMigrations();
  process.exitCode = 0;
} catch (error) {
  console.error(`[migrate] ${error.message || error}`);
  process.exitCode = 1;
}
