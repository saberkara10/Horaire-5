import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "@jest/globals";

import { discoverMigrations } from "../Database/migration-engine.js";

const tempDirs = [];

async function createTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gdh5-migrations-"));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) =>
      fs.rm(tempDir, { recursive: true, force: true })
    )
  );
});

describe("migration-engine extra", () => {
  test("discoverMigrations lit un repertoire personnalise et ignore les fichiers hors pattern", async () => {
    const tempDir = await createTempDir();
    await fs.writeFile(path.join(tempDir, "migration_v1.sql"), "-- migration 1");
    await fs.writeFile(path.join(tempDir, "README.txt"), "ignore");

    const migrations = await discoverMigrations(tempDir);

    expect(migrations).toHaveLength(1);
    expect(migrations[0].version).toBe(1);
    expect(migrations[0].fileName).toBe("migration_v1.sql");
    expect(migrations[0].modulePath).toBeNull();
    expect(migrations[0].checksum).toHaveLength(64);
  });

  test("discoverMigrations reference le module JS quand il existe", async () => {
    const tempDir = await createTempDir();
    await fs.writeFile(path.join(tempDir, "migration_v1.sql"), "-- migration 1");
    await fs.writeFile(path.join(tempDir, "migration_v1.js"), "export const ok = true;");

    const migrations = await discoverMigrations(tempDir);

    expect(migrations[0].modulePath).toBe(path.join(tempDir, "migration_v1.js"));
  });

  test("discoverMigrations rejette une sequence incomplete", async () => {
    const tempDir = await createTempDir();
    await fs.writeFile(path.join(tempDir, "migration_v1.sql"), "-- migration 1");
    await fs.writeFile(path.join(tempDir, "migration_v3.sql"), "-- migration 3");

    await expect(discoverMigrations(tempDir)).rejects.toThrow(
      "Migration sequence must be contiguous. Missing migration_v2.sql."
    );
  });
});
