import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

import { assurerSchemaSchedulerAcademique } from "../src/services/academic-scheduler-schema.js";

function createExecutorState(overrides = {}) {
  return {
    columnsByTable: new Map(
      Object.entries({
        groupes_etudiants: ["nom_groupe", "programme", "etape"],
        affectation_etudiants: [
          "id_affectation_etudiant",
          "id_etudiant",
          "id_groupes_etudiants",
          "id_cours",
          "id_session",
          "source_type",
          "id_cours_echoue",
        ],
        cours_echoues: ["id"],
        affectation_cours: ["id_affectation_cours", "id_plage_horaires"],
        rapports_generation: [],
        ...(overrides.columnsByTable || {}),
      }).map(([table, columns]) => [table, new Set(columns)])
    ),
    indexesByTable: new Map(
      Object.entries(overrides.indexesByTable || {}).map(([table, indexes]) => [
        table,
        indexes.map((index) => ({ ...index })),
      ])
    ),
    constraintsByTable: new Map(
      Object.entries(overrides.constraintsByTable || {}).map(
        ([table, constraints]) => [table, new Set(constraints)]
      )
    ),
    executedSql: [],
  };
}

function createSchemaExecutor(state) {
  return {
    async query(sql, params = []) {
      const normalizedSql = String(sql).replace(/\s+/g, " ").trim();
      state.executedSql.push({ sql: normalizedSql, params });

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
        const exists = state.constraintsByTable
          .get(tableName)
          ?.has(constraintName);
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
        const columns = rawColumns.split(",").map((column) => column.trim());
        const rows = columns.map((columnName, index) => ({
          index_name: indexName,
          non_unique: uniqueKeyword ? 0 : 1,
          seq_in_index: index + 1,
          column_name: columnName,
        }));

        if (!state.indexesByTable.has(tableName)) {
          state.indexesByTable.set(tableName, []);
        }

        state.indexesByTable.set(tableName, [
          ...(state.indexesByTable.get(tableName) || []).filter(
            (row) => row.index_name !== indexName
          ),
          ...rows,
        ]);
        return [[]];
      }

      match = normalizedSql.match(
        /^ALTER TABLE ([A-Za-z_][A-Za-z0-9_]*) DROP INDEX ([A-Za-z_][A-Za-z0-9_]*)$/
      );
      if (match) {
        const [, tableName, indexName] = match;
        state.indexesByTable.set(
          tableName,
          (state.indexesByTable.get(tableName) || []).filter(
            (row) => row.index_name !== indexName
          )
        );
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
    },
  };
}

describe("academic-scheduler-schema", () => {
  let originalNodeEnv;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test("ne fait rien en environnement de test", async () => {
    process.env.NODE_ENV = "test";

    const executor = {
      query: jest.fn(),
    };

    await assurerSchemaSchedulerAcademique(executor);

    expect(executor.query).not.toHaveBeenCalled();
  });

  test("cree les colonnes, indexes et contraintes manquants avec un executor personnalise", async () => {
    process.env.NODE_ENV = "development";

    const state = createExecutorState();
    const executor = createSchemaExecutor(state);

    await assurerSchemaSchedulerAcademique(executor);

    expect(state.columnsByTable.get("groupes_etudiants").has("id_session")).toBe(
      true
    );
    expect(
      state.columnsByTable.get("affectation_etudiants").has("id_echange_cours")
    ).toBe(true);
    expect(
      state.columnsByTable.get("cours_echoues").has("id_groupe_reprise")
    ).toBe(true);
    expect(
      state.columnsByTable.get("affectation_cours").has("id_planification_serie")
    ).toBe(true);
    expect(
      state.columnsByTable.get("rapports_generation").has("nb_resolutions_manuelles")
    ).toBe(true);
    expect(state.columnsByTable.get("rapports_generation").has("details")).toBe(true);

    expect(
      state.constraintsByTable.get("groupes_etudiants")?.has("fk_groupes_session")
    ).toBe(true);
    expect(
      state.constraintsByTable
        .get("affectation_etudiants")
        ?.has("fk_affectation_etudiants_echange_cours")
    ).toBe(true);
    expect(
      state.constraintsByTable
        .get("cours_echoues")
        ?.has("fk_cours_echoues_groupe_reprise")
    ).toBe(true);
    expect(
      state.constraintsByTable.get("rapports_generation")?.has("fk_rg_session")
    ).toBe(true);
    expect(
      state.constraintsByTable.get("rapports_generation")?.has("fk_rg_user")
    ).toBe(true);

    const groupesIndexes = state.indexesByTable.get("groupes_etudiants") || [];
    expect(
      groupesIndexes.some(
        (row) =>
          row.index_name === "idx_groupes_id_session" &&
          row.column_name === "id_session"
      )
    ).toBe(true);
    expect(
      groupesIndexes.some(
        (row) =>
          row.index_name === "uniq_groupes_session_nom" &&
          row.column_name === "id_session"
      )
    ).toBe(true);

    expect(
      state.executedSql.some(({ sql }) =>
        sql.startsWith("CREATE TABLE IF NOT EXISTS affectation_etudiants")
      )
    ).toBe(true);
    expect(
      state.executedSql.some(({ sql }) =>
        sql.startsWith(
          "CREATE TABLE IF NOT EXISTS journal_modifications_affectations_scheduler"
        )
      )
    ).toBe(true);
    expect(
      state.executedSql.some(({ sql }) =>
        sql.startsWith("CREATE TABLE IF NOT EXISTS rapports_generation")
      )
    ).toBe(true);
    expect(
      state.executedSql.some(({ sql }) => sql.includes("DROP INDEX"))
    ).toBe(false);
  });

  test("supprime l'ancien index global des groupes et saute les elements deja presents", async () => {
    process.env.NODE_ENV = "development";

    const state = createExecutorState({
      columnsByTable: {
        groupes_etudiants: ["nom_groupe", "programme", "etape", "id_session"],
        affectation_etudiants: [
          "id_affectation_etudiant",
          "id_etudiant",
          "id_groupes_etudiants",
          "id_cours",
          "id_session",
          "source_type",
          "id_cours_echoue",
          "id_echange_cours",
        ],
        cours_echoues: ["id", "id_groupe_reprise"],
        affectation_cours: [
          "id_affectation_cours",
          "id_plage_horaires",
          "id_planification_serie",
        ],
        rapports_generation: [
          "id_session",
          "genere_par",
          "date_generation",
          "score_qualite",
          "nb_cours_planifies",
          "nb_cours_non_planifies",
          "nb_cours_echoues_traites",
          "nb_cours_en_ligne_generes",
          "nb_groupes_speciaux",
          "nb_resolutions_manuelles",
          "details",
        ],
      },
      indexesByTable: {
        groupes_etudiants: [
          {
            index_name: "uniq_groupes_nom_groupe_global",
            non_unique: 0,
            seq_in_index: 1,
            column_name: "nom_groupe",
          },
          {
            index_name: "idx_groupes_id_session",
            non_unique: 1,
            seq_in_index: 1,
            column_name: "id_session",
          },
          {
            index_name: "uniq_groupes_session_nom",
            non_unique: 0,
            seq_in_index: 1,
            column_name: "id_session",
          },
          {
            index_name: "uniq_groupes_session_nom",
            non_unique: 0,
            seq_in_index: 2,
            column_name: "nom_groupe",
          },
        ],
        affectation_etudiants: [
          {
            index_name: "idx_affectation_etudiants_echange_cours",
            non_unique: 1,
            seq_in_index: 1,
            column_name: "id_echange_cours",
          },
        ],
        cours_echoues: [
          {
            index_name: "idx_cours_echoues_groupe_reprise",
            non_unique: 1,
            seq_in_index: 1,
            column_name: "id_groupe_reprise",
          },
        ],
        affectation_cours: [
          {
            index_name: "idx_affectation_cours_planification_serie",
            non_unique: 1,
            seq_in_index: 1,
            column_name: "id_planification_serie",
          },
        ],
      },
      constraintsByTable: {
        groupes_etudiants: ["fk_groupes_session"],
        affectation_etudiants: ["fk_affectation_etudiants_echange_cours"],
        cours_echoues: ["fk_cours_echoues_groupe_reprise"],
        affectation_cours: ["fk_affectation_cours_planification_serie"],
        rapports_generation: ["fk_rg_session", "fk_rg_user"],
      },
    });
    const executor = createSchemaExecutor(state);

    await assurerSchemaSchedulerAcademique(executor);

    const dropQueries = state.executedSql.filter(({ sql }) =>
      sql.includes("DROP INDEX uniq_groupes_nom_groupe_global")
    );
    expect(dropQueries).toHaveLength(1);
    expect(
      (state.indexesByTable.get("groupes_etudiants") || []).some(
        (row) => row.index_name === "uniq_groupes_nom_groupe_global"
      )
    ).toBe(false);

    expect(
      state.executedSql.some(({ sql }) =>
        sql.includes("ADD COLUMN id_session INT NULL AFTER etape")
      )
    ).toBe(false);
    expect(
      state.executedSql.some(({ sql }) =>
        sql.includes("ADD CONSTRAINT fk_groupes_session")
      )
    ).toBe(false);
  });
});
