/**
 * Boite a outils partagee pour les migrations JS.
 *
 * Role:
 * - inspecte les tables, colonnes, index et contraintes
 * - ajoute ou retire des elements de schema de facon conditionnelle
 * - encapsule les etapes sensibles dans des transactions
 * - normalise la detection des erreurs SQL de doublon ou d'absence
 *
 * Impact sur le projet:
 * - ce fichier n'ajoute aucun changement de schema a lui seul
 * - il rend les migrations plus sures et plus idempotentes
 */
import fs from "node:fs/promises";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;

function assertIdentifier(identifier, label = "identifier") {
  if (!IDENTIFIER_PATTERN.test(String(identifier || ""))) {
    throw new Error(`Invalid ${label}: ${identifier}`);
  }
}

export function escapeIdentifier(identifier) {
  assertIdentifier(identifier);
  return `\`${identifier}\``;
}

export async function readSqlFile(sqlPath) {
  return fs.readFile(sqlPath, "utf8");
}

export async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?
     LIMIT 1`,
    [tableName]
  );

  return rows.length > 0;
}

export async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  return rows.length > 0;
}

export async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [tableName, indexName]
  );

  return rows.length > 0;
}

export async function getIndexes(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT index_name,
            non_unique,
            seq_in_index,
            column_name
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
     ORDER BY index_name ASC, seq_in_index ASC`,
    [tableName]
  );

  return rows.map((row) => ({
    index_name: String(row.index_name || ""),
    non_unique: Number(row.non_unique || 0),
    seq_in_index: Number(row.seq_in_index || 0),
    column_name: String(row.column_name || ""),
  }));
}

export function findIndex(indexes, indexName) {
  const lignes = indexes.filter((index) => index.index_name === indexName);

  if (lignes.length === 0) {
    return null;
  }

  return {
    name: indexName,
    unique: Number(lignes[0]?.non_unique || 0) === 0,
    columns: lignes
      .sort((ligneA, ligneB) => ligneA.seq_in_index - ligneB.seq_in_index)
      .map((ligne) => ligne.column_name),
  };
}

export async function constraintExists(connection, tableName, constraintName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.table_constraints
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND constraint_name = ?
     LIMIT 1`,
    [tableName, constraintName]
  );

  return rows.length > 0;
}

export async function getConstraintNames(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT constraint_name
     FROM information_schema.table_constraints
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );

  return rows.map((row) => String(row.constraint_name || ""));
}

export async function addColumnIfMissing(
  connection,
  tableName,
  columnName,
  definitionSql
) {
  if (await columnExists(connection, tableName, columnName)) {
    return false;
  }

  await connection.query(
    `ALTER TABLE ${escapeIdentifier(tableName)}
     ADD COLUMN ${escapeIdentifier(columnName)} ${definitionSql}`
  );

  return true;
}

export async function addIndexIfMissing(
  connection,
  tableName,
  indexName,
  createSql
) {
  if (await indexExists(connection, tableName, indexName)) {
    return false;
  }

  await connection.query(createSql);
  return true;
}

export async function dropIndexIfExists(connection, tableName, indexName) {
  if (!(await indexExists(connection, tableName, indexName))) {
    return false;
  }

  await connection.query(
    `ALTER TABLE ${escapeIdentifier(tableName)}
     DROP INDEX ${escapeIdentifier(indexName)}`
  );

  return true;
}

export async function addConstraintIfMissing(
  connection,
  tableName,
  constraintName,
  alterSql
) {
  if (await constraintExists(connection, tableName, constraintName)) {
    return false;
  }

  await connection.query(alterSql);
  return true;
}

export async function withTransaction(connection, handler) {
  await connection.beginTransaction();

  try {
    const result = await handler();
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Le rollback ne doit jamais masquer l'erreur initiale.
    }

    throw error;
  }
}

export function isDuplicateLikeError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");

  return (
    code === "ER_DUP_FIELDNAME" ||
    code === "ER_DUP_KEYNAME" ||
    code === "ER_DUP_ENTRY" ||
    code === "ER_TABLE_EXISTS_ERROR" ||
    code === "ER_FK_DUP_NAME" ||
    message.includes("duplicate") ||
    message.includes("already exists")
  );
}

export function isMissingLikeError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");

  return (
    code === "ER_CANT_DROP_FIELD_OR_KEY" ||
    code === "ER_BAD_FIELD_ERROR" ||
    code === "ER_NO_SUCH_TABLE" ||
    message.includes("doesn't exist") ||
    message.includes("unknown column") ||
    message.includes("unknown table") ||
    message.includes("can't drop")
  );
}
