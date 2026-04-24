import { describe, expect, test } from "@jest/globals";
import {
  discoverMigrations,
  isRecordedChecksumAccepted,
  parseMigrationVersion,
} from "../Database/migration-engine.js";

describe("migration engine", () => {
  test("parseMigrationVersion extrait correctement la version", () => {
    expect(parseMigrationVersion("migration_v1.sql")).toBe(1);
    expect(parseMigrationVersion("migration_v16.sql")).toBe(16);
    expect(() => parseMigrationVersion("foo.sql")).toThrow(
      "Invalid migration filename"
    );
  });

  test("discoverMigrations retourne une sequence continue de v1 a v19", async () => {
    const migrations = await discoverMigrations();

    expect(migrations.map((migration) => migration.version)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
    expect(migrations.every((migration) => migration.checksum.length === 64)).toBe(
      true
    );
  });

  test("isRecordedChecksumAccepted accepte les anciens checksums documentaires connus", async () => {
    const migrations = await discoverMigrations();
    const migrationV1 = migrations.find((migration) => migration.version === 1);
    const migrationV12 = migrations.find((migration) => migration.version === 12);
    const migrationV13 = migrations.find((migration) => migration.version === 13);

    expect(
      isRecordedChecksumAccepted(
        migrationV1,
        "01dafc82ffc5f1663a182fd2c8bbad010d5ee5328050702cb1abe53b3593029a"
      )
    ).toBe(true);
    expect(
      isRecordedChecksumAccepted(
        migrationV12,
        "55873037be9631f4444820245736c730ed26cdb0796e1e6181f1de71dc6fde27"
      )
    ).toBe(true);
    expect(
      isRecordedChecksumAccepted(
        migrationV13,
        "41b5a3e9eea5294e3a20ac545bd3ef1cd9949a00f8e97e9371f9a31908aa25c4"
      )
    ).toBe(true);
    expect(isRecordedChecksumAccepted(migrationV1, "invalide")).toBe(false);
  });
});
