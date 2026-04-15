import { describe, expect, test } from "@jest/globals";
import {
  discoverMigrations,
  parseMigrationVersion,
} from "../Database/migration-engine.js";

describe("migration engine", () => {
  test("parseMigrationVersion extrait correctement la version", () => {
    expect(parseMigrationVersion("migration_v1.sql")).toBe(1);
    expect(parseMigrationVersion("migration_v12.sql")).toBe(12);
    expect(() => parseMigrationVersion("foo.sql")).toThrow(
      "Invalid migration filename"
    );
  });

  test("discoverMigrations retourne une sequence continue de v1 a v12", async () => {
    const migrations = await discoverMigrations();

    expect(migrations.map((migration) => migration.version)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(migrations.every((migration) => migration.checksum.length === 64)).toBe(
      true
    );
  });
});
