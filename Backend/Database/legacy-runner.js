import { runMigrations } from "./migration-engine.js";

export async function runDeprecatedMigrationScript(scriptName) {
  try {
    await runMigrations({
      deprecationSource: scriptName,
    });
    process.exitCode = 0;
  } catch (error) {
    console.error(`[migrate] ${error.message || error}`);
    process.exitCode = 1;
  }
}
