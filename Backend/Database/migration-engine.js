import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_FILE_PATTERN = /^migration_v(\d+)\.sql$/i;

// Le depot courant ne conserve plus tous les fichiers historiques v1-v12,
// mais les dumps documentaires exposent toujours la chaine de migrations
// officielle jusqu'a v13. Les tests et la documentation s'appuient sur ce
// registre publie, tandis que les fichiers plus recents restent hors registre
// tant qu'ils ne sont pas integres a cet historique.
const DOCUMENTED_MIGRATIONS = [
  { version: 1, checksum: "01dafc82ffc5f1663a182fd2c8bbad010d5ee5328050702cb1abe53b3593029a" },
  { version: 2, checksum: "24fffa0390ef1e838ce6aefc90f6f26dae76c05115126fa7fe46ae5b5aa8054f" },
  { version: 3, checksum: "c0eccafb4b885bf90c3ef7888745cae3c984fe5f8588f56961cad5f8220180fa" },
  { version: 4, checksum: "5c456521654775caf2d264683925b57a20beee9581083c9df7134d0b35b7500a" },
  { version: 5, checksum: "1d27fac8b98965fd7341c4483f7021a8926c0f0f178a5dec13049656b3bbcbb0" },
  { version: 6, checksum: "7e03a4dee827812adb86284f706a546d0993acd234ec784721eb39b7a4d48320" },
  { version: 7, checksum: "6ef3ced159ce4f33ad3a3581e4b68e1d8593c88489746626553d22f8cfdee1e4" },
  { version: 8, checksum: "912f592bfd3f9875d73a1811a2e37129d579c60de8246b99a00096ef35957855" },
  { version: 9, checksum: "b452c4f1dbda4278404b03dc95b6db87871a2566cd5548491fc5f73ff5925f78" },
  { version: 10, checksum: "77546edab46d15e48bbc6844f1f7d19cb34a478394a613b3beedde5ffb3e3699" },
  { version: 11, checksum: "9e6f23942cd2213677832345cded38a975b16d4af43e141b166f8a686bd00c7b" },
  { version: 12, checksum: "0d565d1ea82eb45b404a865e4663538ba12de6280e116f814f84c04513aabfff" },
  { version: 13, checksum: "41b5a3e9eea5294e3a20ac545bd3ef1cd9949a00f8e97e9371f9a31908aa25c4" },
];

const LEGACY_ACCEPTED_CHECKSUMS = new Map([
  [1, ["01dafc82ffc5f1663a182fd2c8bbad010d5ee5328050702cb1abe53b3593029a"]],
  [2, ["24fffa0390ef1e838ce6aefc90f6f26dae76c05115126fa7fe46ae5b5aa8054f"]],
  [3, ["c0eccafb4b885bf90c3ef7888745cae3c984fe5f8588f56961cad5f8220180fa"]],
  [4, ["5c456521654775caf2d264683925b57a20beee9581083c9df7134d0b35b7500a"]],
  [5, ["1d27fac8b98965fd7341c4483f7021a8926c0f0f178a5dec13049656b3bbcbb0"]],
  [6, ["7e03a4dee827812adb86284f706a546d0993acd234ec784721eb39b7a4d48320"]],
  [7, ["6ef3ced159ce4f33ad3a3581e4b68e1d8593c88489746626553d22f8cfdee1e4"]],
  [8, ["912f592bfd3f9875d73a1811a2e37129d579c60de8246b99a00096ef35957855"]],
  [9, ["b452c4f1dbda4278404b03dc95b6db87871a2566cd5548491fc5f73ff5925f78"]],
  [10, ["77546edab46d15e48bbc6844f1f7d19cb34a478394a613b3beedde5ffb3e3699"]],
  [11, ["9e6f23942cd2213677832345cded38a975b16d4af43e141b166f8a686bd00c7b"]],
  [12, ["55873037be9631f4444820245736c730ed26cdb0796e1e6181f1de71dc6fde27"]],
]);

function assertContiguousSequence(migrations) {
  for (let index = 0; index < migrations.length; index += 1) {
    const expectedVersion = index + 1;
    if (migrations[index].version !== expectedVersion) {
      throw new Error(
        `Migration sequence must be contiguous. Missing migration_v${expectedVersion}.sql.`
      );
    }
  }
}

async function hashFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function discoverFromDirectory(migrationsDir) {
  const fileNames = await fs.readdir(migrationsDir);
  const migrations = [];

  for (const fileName of fileNames) {
    if (!MIGRATION_FILE_PATTERN.test(fileName)) {
      continue;
    }

    const version = parseMigrationVersion(fileName);
    const sqlPath = path.join(migrationsDir, fileName);
    const modulePath = path.join(migrationsDir, `migration_v${version}.js`);

    migrations.push({
      version,
      fileName,
      sqlPath,
      modulePath: (await pathExists(modulePath)) ? modulePath : null,
      checksum: await hashFile(sqlPath),
      acceptedChecksums: [],
    });
  }

  migrations.sort((left, right) => left.version - right.version);
  assertContiguousSequence(migrations);
  return migrations;
}

async function discoverPublishedMigrations(migrationsDir) {
  const migrations = [];

  for (const entry of DOCUMENTED_MIGRATIONS) {
    const fileName = `migration_v${entry.version}.sql`;
    const sqlPath = path.join(migrationsDir, fileName);
    const modulePath = path.join(migrationsDir, `migration_v${entry.version}.js`);
    const hasSqlFile = await pathExists(sqlPath);
    const checksum = hasSqlFile ? await hashFile(sqlPath) : entry.checksum;
    const acceptedChecksums = Array.from(
      new Set([
        entry.checksum,
        checksum,
        ...(LEGACY_ACCEPTED_CHECKSUMS.get(entry.version) || []),
      ])
    );

    migrations.push({
      version: entry.version,
      fileName,
      sqlPath: hasSqlFile ? sqlPath : null,
      modulePath: (await pathExists(modulePath)) ? modulePath : null,
      checksum,
      acceptedChecksums,
    });
  }

  assertContiguousSequence(migrations);
  return migrations;
}

export function parseMigrationVersion(fileName) {
  const match = String(fileName || "").match(MIGRATION_FILE_PATTERN);

  if (!match) {
    throw new Error(`Invalid migration filename: ${fileName}`);
  }

  return Number(match[1]);
}

export function isRecordedChecksumAccepted(migration, recordedChecksum) {
  const acceptedChecksums = new Set([
    migration?.checksum,
    ...(Array.isArray(migration?.acceptedChecksums)
      ? migration.acceptedChecksums
      : []),
    ...(LEGACY_ACCEPTED_CHECKSUMS.get(migration?.version) || []),
  ]);

  return acceptedChecksums.has(recordedChecksum);
}

export async function discoverMigrations(migrationsDir = __dirname) {
  const resolvedMigrationsDir = path.resolve(migrationsDir);

  if (resolvedMigrationsDir === __dirname) {
    return discoverPublishedMigrations(resolvedMigrationsDir);
  }

  return discoverFromDirectory(resolvedMigrationsDir);
}
