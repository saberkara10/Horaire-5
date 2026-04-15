import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import * as migrationTools from "./migration-tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_PATH = path.join(__dirname, "../.env");
const MIGRATION_FILE_PATTERN = /^migration_v(\d+)\.sql$/i;
const LOCK_NAME = "gdh5_schema_migrations_lock";
const moduleCache = new Map();

dotenv.config({
  path: ENV_PATH,
  quiet: true,
});

function getConnectionConfig() {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "gdh5",
    port: Number(process.env.DB_PORT || 3306),
  };
}

function logInfo(message) {
  console.log(`[migrate] ${message}`);
}

function logWarn(message) {
  console.warn(`[migrate] ${message}`);
}

export function parseMigrationVersion(fileName) {
  const match = String(fileName || "").match(MIGRATION_FILE_PATTERN);

  if (!match) {
    throw new Error(`Invalid migration filename: ${fileName}`);
  }

  return Number(match[1]);
}

async function hashFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function discoverMigrations(migrationsDir = __dirname) {
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
      modulePath: (await fileExists(modulePath)) ? modulePath : null,
      checksum: await hashFile(sqlPath),
    });
  }

  migrations.sort((migrationA, migrationB) => migrationA.version - migrationB.version);

  const versions = new Set();
  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version detected: v${migration.version}`);
    }
    versions.add(migration.version);
  }

  for (let index = 0; index < migrations.length; index += 1) {
    const expectedVersion = index + 1;
    if (migrations[index].version !== expectedVersion) {
      throw new Error(
        `Migration sequence must be contiguous. Missing migration_v${expectedVersion}.sql.`
      );
    }
  }

  return migrations;
}

async function loadMigrationModule(migration) {
  if (!migration.modulePath) {
    return null;
  }

  if (!moduleCache.has(migration.modulePath)) {
    moduleCache.set(
      migration.modulePath,
      import(pathToFileURL(migration.modulePath).href)
    );
  }

  return moduleCache.get(migration.modulePath);
}

async function createServerConnection(config) {
  return mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
    multipleStatements: true,
  });
}

async function ensureDatabase(connection, databaseName) {
  const escapedName = migrationTools.escapeIdentifier(databaseName);

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${escapedName}
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci`
  );
  await connection.query(`USE ${escapedName}`);
}

async function acquireMigrationLock(connection) {
  const [rows] = await connection.query(
    "SELECT GET_LOCK(?, 30) AS lock_state",
    [LOCK_NAME]
  );

  if (Number(rows[0]?.lock_state || 0) !== 1) {
    throw new Error("Unable to acquire the migration lock within 30 seconds.");
  }
}

async function releaseMigrationLock(connection) {
  try {
    await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]);
  } catch {
    // La liberation du verrou ne doit pas casser la fermeture.
  }
}

async function ensureMigrationsTable(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS migrations (
      id BIGINT NOT NULL AUTO_INCREMENT,
      version INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_migrations_version (version),
      UNIQUE KEY uniq_migrations_file_name (file_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function readRecordedMigrations(connection) {
  const [rows] = await connection.query(
    `SELECT version, file_name, checksum, executed_at
     FROM migrations
     ORDER BY version ASC`
  );

  return rows.map((row) => ({
    version: Number(row.version),
    file_name: String(row.file_name || ""),
    checksum: String(row.checksum || ""),
    executed_at: row.executed_at,
  }));
}

function validateRecordedMigrations(migrations, recordedMigrations) {
  const migrationsByVersion = new Map(
    migrations.map((migration) => [migration.version, migration])
  );

  for (const recordedMigration of recordedMigrations) {
    const sourceMigration = migrationsByVersion.get(recordedMigration.version);

    if (!sourceMigration) {
      throw new Error(
        `Database contains migration v${recordedMigration.version}, but the file is missing locally.`
      );
    }

    if (recordedMigration.file_name !== sourceMigration.fileName) {
      throw new Error(
        `Migration v${recordedMigration.version} filename mismatch: database=${recordedMigration.file_name}, code=${sourceMigration.fileName}.`
      );
    }

    if (recordedMigration.checksum !== sourceMigration.checksum) {
      throw new Error(
        `Migration v${recordedMigration.version} checksum mismatch. The SQL file was modified after execution.`
      );
    }
  }
}

async function hasApplicationTables(connection) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name <> 'migrations'`
  );

  return Number(rows[0]?.total || 0) > 0;
}

function createMigrationContext(connection, migration) {
  return {
    version: migration.version,
    fileName: migration.fileName,
    sqlPath: migration.sqlPath,
    connection,
    tools: migrationTools,
    log(message) {
      logInfo(`v${migration.version} ${message}`);
    },
    async executeSqlFile() {
      const sql = await migrationTools.readSqlFile(migration.sqlPath);
      await connection.query(sql);
    },
    async recordAsApplied() {
      await connection.query(
        `INSERT INTO migrations (version, file_name, checksum)
         VALUES (?, ?, ?)`,
        [migration.version, migration.fileName, migration.checksum]
      );
    },
  };
}

async function adoptLegacyMigrations(connection, migrations, recordedMigrations) {
  if (recordedMigrations.length > 0) {
    return [];
  }

  if (!(await hasApplicationTables(connection))) {
    return [];
  }

  const adopted = [];

  for (const migration of migrations) {
    const module = await loadMigrationModule(migration);
    const context = createMigrationContext(connection, migration);

    if (!module?.isApplied) {
      break;
    }

    const applied = await module.isApplied(context);
    if (!applied) {
      break;
    }

    adopted.push(migration);
  }

  if (adopted.length === 0) {
    return [];
  }

  logWarn(
    `Legacy schema detected with no migration history. Adopting versions v1 to v${adopted.at(-1).version}.`
  );

  for (const migration of adopted) {
    const context = createMigrationContext(connection, migration);
    await context.recordAsApplied();
  }

  return adopted;
}

async function executeMigration(connection, migration) {
  const module = await loadMigrationModule(migration);
  const context = createMigrationContext(connection, migration);
  const startedAt = Date.now();

  logInfo(`Applying v${migration.version} (${migration.fileName})`);

  try {
    if (module?.up) {
      await module.up(context);
    } else {
      await context.executeSqlFile();
    }

    await context.recordAsApplied();

    logInfo(
      `Applied v${migration.version} in ${Date.now() - startedAt} ms`
    );
  } catch (error) {
    throw new Error(
      `Migration v${migration.version} failed: ${error.message || error}`
    );
  }
}

export async function runMigrations(options = {}) {
  const config = getConnectionConfig();
  const migrations = await discoverMigrations();
  const connection = await createServerConnection(config);

  try {
    await ensureDatabase(connection, config.database);
    await acquireMigrationLock(connection);
    await ensureMigrationsTable(connection);

    const recordedBeforeAdoption = await readRecordedMigrations(connection);
    validateRecordedMigrations(migrations, recordedBeforeAdoption);

    const adopted = await adoptLegacyMigrations(
      connection,
      migrations,
      recordedBeforeAdoption
    );

    const recordedAfterAdoption = await readRecordedMigrations(connection);
    validateRecordedMigrations(migrations, recordedAfterAdoption);

    const executedVersions = new Set(
      recordedAfterAdoption.map((migration) => migration.version)
    );
    const pendingMigrations = migrations.filter(
      (migration) => !executedVersions.has(migration.version)
    );

    if (options.deprecationSource) {
      logWarn(
        `${options.deprecationSource} is deprecated. Use "npm run migrate" instead.`
      );
    }

    if (pendingMigrations.length === 0) {
      logInfo("Database is already up to date.");
      return {
        adoptedVersions: adopted.map((migration) => migration.version),
        executedVersions: [],
      };
    }

    for (const migration of pendingMigrations) {
      await executeMigration(connection, migration);
    }

    return {
      adoptedVersions: adopted.map((migration) => migration.version),
      executedVersions: pendingMigrations.map((migration) => migration.version),
    };
  } finally {
    await releaseMigrationLock(connection);
    await connection.end();
  }
}
