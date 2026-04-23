import { beforeEach, describe, expect, jest, test } from "@jest/globals";

function createPoolQueryMock() {
  const state = {
    columnsByTable: new Map([
      ["groupes_etudiants", new Set(["nom_groupe", "programme", "etape"])],
      [
        "affectation_etudiants",
        new Set([
          "id_affectation_etudiant",
          "id_etudiant",
          "id_groupes_etudiants",
          "id_cours",
          "id_session",
          "source_type",
          "id_cours_echoue",
        ]),
      ],
      ["cours_echoues", new Set(["id"])],
      ["affectation_cours", new Set(["id_affectation_cours", "id_plage_horaires"])],
    ]),
    indexesByTable: new Map(),
    constraintsByTable: new Map(),
  };

  return jest.fn(async (sql, params = []) => {
    const normalizedSql = String(sql).replace(/\s+/g, " ").trim();

    if (normalizedSql.includes("FROM information_schema.columns")) {
      const tableName = params[0];
      const columns = Array.from(state.columnsByTable.get(tableName) || []);
      return [columns.map((columnName) => ({ COLUMN_NAME: columnName }))];
    }

    if (normalizedSql.includes("FROM information_schema.statistics")) {
      const tableName = params[0];
      return [state.indexesByTable.get(tableName) || []];
    }

    if (normalizedSql.includes("FROM information_schema.table_constraints")) {
      const [tableName, constraintName] = params;
      const exists = state.constraintsByTable.get(tableName)?.has(constraintName);
      return [exists ? [{ CONSTRAINT_NAME: constraintName }] : []];
    }

    let match = normalizedSql.match(
      /^ALTER TABLE ([A-Za-z_][A-Za-z0-9_]*) ADD COLUMN ([A-Za-z_][A-Za-z0-9_]*) /
    );
    if (match) {
      const [, tableName, columnName] = match;
      if (!state.columnsByTable.has(tableName)) {
        state.columnsByTable.set(tableName, new Set());
      }
      state.columnsByTable.get(tableName).add(columnName);
      return [[]];
    }

    match = normalizedSql.match(
      /^CREATE (UNIQUE )?INDEX ([A-Za-z_][A-Za-z0-9_]*) ON ([A-Za-z_][A-Za-z0-9_]*) \((.+)\)$/
    );
    if (match) {
      const [, uniqueKeyword, indexName, tableName, rawColumns] = match;
      const rows = rawColumns.split(",").map((columnName, index) => ({
        index_name: indexName,
        non_unique: uniqueKeyword ? 0 : 1,
        seq_in_index: index + 1,
        column_name: columnName.trim(),
      }));
      state.indexesByTable.set(tableName, [
        ...(state.indexesByTable.get(tableName) || []),
        ...rows,
      ]);
      return [[]];
    }

    match = normalizedSql.match(
      /^ALTER TABLE ([A-Za-z_][A-Za-z0-9_]*) ADD CONSTRAINT ([A-Za-z_][A-Za-z0-9_]*) /
    );
    if (match) {
      const [, tableName, constraintName] = match;
      if (!state.constraintsByTable.has(tableName)) {
        state.constraintsByTable.set(tableName, new Set());
      }
      state.constraintsByTable.get(tableName).add(constraintName);
      return [[]];
    }

    return [[]];
  });
}

async function loadModuleWithPool(poolQueryMock) {
  jest.resetModules();
  await jest.unstable_mockModule("../db.js", () => ({
    default: {
      query: poolQueryMock,
    },
  }));

  return import("../src/services/academic-scheduler-schema.js");
}

describe("academic-scheduler-schema with default pool", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  test("memorise le bootstrap de schema sur le pool par defaut", async () => {
    const poolQueryMock = createPoolQueryMock();
    const { assurerSchemaSchedulerAcademique } = await loadModuleWithPool(
      poolQueryMock
    );

    await assurerSchemaSchedulerAcademique();
    const afterFirstCall = poolQueryMock.mock.calls.length;
    await assurerSchemaSchedulerAcademique();

    expect(afterFirstCall).toBeGreaterThan(0);
    expect(poolQueryMock.mock.calls.length).toBe(afterFirstCall);
  });

  test("reinitialise le cache si le bootstrap echoue puis autorise un retry", async () => {
    const error = new Error("schema casse");
    const poolQueryMock = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue([[]]);

    const { assurerSchemaSchedulerAcademique } = await loadModuleWithPool(
      poolQueryMock
    );

    await expect(assurerSchemaSchedulerAcademique()).rejects.toBe(error);
    const callsAfterFailure = poolQueryMock.mock.calls.length;
    await assurerSchemaSchedulerAcademique();

    expect(callsAfterFailure).toBe(1);
    expect(poolQueryMock.mock.calls.length).toBeGreaterThan(callsAfterFailure);
  });
});
