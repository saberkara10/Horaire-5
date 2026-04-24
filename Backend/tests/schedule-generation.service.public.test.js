import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const journaliserActiviteMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: jest.fn(),
    getConnection: jest.fn(),
  },
}));

await jest.unstable_mockModule("../src/services/scheduler/SchedulerEngine.js", () => ({
  SchedulerEngine: {},
}));

await jest.unstable_mockModule(
  "../src/services/scheduler/simulation/ScheduleSnapshot.js",
  () => ({
    ScheduleSnapshot: {
      load: jest.fn(),
    },
  })
);

await jest.unstable_mockModule(
  "../src/services/scheduler/AvailabilityChecker.js",
  () => ({
    AvailabilityChecker: {
      profDisponible: jest.fn(() => true),
      salleDisponible: jest.fn(() => true),
    },
  })
);

await jest.unstable_mockModule("../src/services/activity-log.service.js", () => ({
  journaliserActivite: journaliserActiviteMock,
}));

const { ScheduleGenerationService } = await import(
  "../src/services/scheduler/ScheduleGenerationService.js"
);

function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, " ").trim();
}

describe("ScheduleGenerationService public methods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("listGenerations normalise les filtres et convertit is_active en booleen", async () => {
    const executor = {
      query: jest.fn().mockResolvedValueOnce([
        [
          {
            id_generation: 4,
            id_session: 9,
            version_number: 3,
            generation_name: "Version 3",
            status: "active",
            is_active: 1,
            quality_score: 81,
          },
        ],
      ]),
    };

    const resultat = await ScheduleGenerationService.listGenerations(
      { idSession: "9", status: "ACTIVE" },
      executor
    );

    expect(executor.query).toHaveBeenCalledWith(
      expect.stringContaining("sg.deleted_at IS NULL AND sg.id_session = ? AND sg.status = ?"),
      [9, "active"]
    );
    expect(resultat).toEqual([
      expect.objectContaining({
        id_generation: 4,
        is_active: true,
      }),
    ]);
  });

  test("getGenerationById hydrate les metriques et separe placements et affectations etudiant", async () => {
    const executor = {
      query: jest.fn(async (sql) => {
        const normalizedSql = normalizeSql(sql);

        if (normalizedSql.includes("FROM schedule_generations sg")) {
          return [[
            {
              id_generation: 7,
              id_session: 3,
              version_number: 5,
              generation_name: "Version 5",
              status: "active",
              is_active: 1,
              quality_score: 0,
              placement_count: 2,
              deleted_at: null,
              created_at: "2026-01-12T10:00:00.000Z",
            },
          ]];
        }

        if (normalizedSql.includes("FROM schedule_generation_metrics")) {
          return [[
            {
              metric_key: "optimisation_mode",
              metric_type: "text",
              metric_text: "professeur",
            },
            {
              metric_key: "scoring_v1",
              metric_type: "json",
              metric_json: JSON.stringify({
                modes: {
                  equilibre: { scoreGlobal: 81 },
                  professeur: {
                    scoreGlobal: 88,
                    scoreEtudiant: 74,
                    scoreProfesseur: 93,
                    scoreGroupe: 86,
                    mode: "professeur",
                  },
                },
              }),
            },
          ]];
        }

        if (normalizedSql.includes("FROM schedule_generation_conflicts")) {
          return [[
            {
              conflict_code: "WARN",
              payload: JSON.stringify({ reason: "test" }),
            },
          ]];
        }

        if (normalizedSql.includes("FROM schedule_generation_actions")) {
          return [[
            {
              action_type: "CREATE",
              details: JSON.stringify({ source_kind: "automatic_generation" }),
            },
          ]];
        }

        if (normalizedSql.includes("FROM schedule_generation_items")) {
          return [[
            {
              item_type: "placement",
              payload: JSON.stringify({ group_ids: [1] }),
            },
            {
              item_type: "student_assignment",
              payload: JSON.stringify({ id_cours_echoue: 2 }),
            },
          ]];
        }

        throw new Error(`Unexpected query: ${normalizedSql}`);
      }),
    };

    const resultat = await ScheduleGenerationService.getGenerationById(7, executor);

    expect(resultat.is_active).toBe(true);
    expect(resultat.quality_score).toBe(88);
    expect(resultat.metrics.score_global_selectionne).toBe(88);
    expect(resultat.placements).toHaveLength(1);
    expect(resultat.student_assignments).toHaveLength(1);
    expect(resultat.conflicts[0].payload).toEqual({ reason: "test" });
    expect(resultat.actions[0].details).toEqual({
      source_kind: "automatic_generation",
    });
  });

  test("updateGeneration met a jour le nom et les notes dans une transaction", async () => {
    let currentGenerationName = "Version initiale";
    let currentNotes = "Notes precedentes";

    const connection = {
      beginTransaction: jest.fn(async () => {}),
      commit: jest.fn(async () => {}),
      rollback: jest.fn(async () => {}),
      release: jest.fn(() => {}),
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = normalizeSql(sql);

        if (normalizedSql.includes("FROM schedule_generations sg")) {
          return [[
            {
              id_generation: 12,
              id_session: 4,
              version_number: 6,
              generation_name: currentGenerationName,
              notes: currentNotes,
              status: "draft",
              is_active: 0,
              quality_score: 75,
              placement_count: 0,
              deleted_at: null,
              created_at: "2026-02-01T10:00:00.000Z",
            },
          ]];
        }

        if (normalizedSql.startsWith("UPDATE schedule_generations")) {
          currentGenerationName = params[0];
          currentNotes = params[1];
          return [{ affectedRows: 1 }];
        }

        if (normalizedSql.startsWith("INSERT INTO schedule_generation_actions")) {
          return [{ insertId: 90 }];
        }

        if (normalizedSql.includes("FROM schedule_generation_metrics")) {
          return [[]];
        }

        if (normalizedSql.includes("FROM schedule_generation_conflicts")) {
          return [[]];
        }

        if (normalizedSql.includes("FROM schedule_generation_actions sga")) {
          return [[
            {
              action_type: "UPDATE_NOTE",
              details: JSON.stringify({ generation_name: currentGenerationName }),
            },
          ]];
        }

        if (normalizedSql.includes("FROM schedule_generation_items")) {
          return [[]];
        }

        throw new Error(`Unexpected query: ${normalizedSql}`);
      }),
    };

    const executor = {
      getConnection: jest.fn(async () => connection),
    };

    const resultat = await ScheduleGenerationService.updateGeneration(
      12,
      {
        generation_name: "  Nouvelle version  ",
        notes: "   ",
      },
      { user: { id: 4 } },
      executor
    );

    expect(connection.beginTransaction).toHaveBeenCalled();
    expect(connection.commit).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE schedule_generations"),
      ["Nouvelle version", null, 12]
    );
    expect(resultat.generation_name).toBe("Nouvelle version");
    expect(resultat.actions[0].details).toEqual({
      generation_name: "Nouvelle version",
    });
  });

  test("updateGeneration retourne 404 et annule la transaction si la generation est absente", async () => {
    const connection = {
      beginTransaction: jest.fn(async () => {}),
      commit: jest.fn(async () => {}),
      rollback: jest.fn(async () => {}),
      release: jest.fn(() => {}),
      query: jest.fn(async (sql) => {
        const normalizedSql = normalizeSql(sql);
        if (normalizedSql.includes("FROM schedule_generations sg")) {
          return [[]];
        }

        throw new Error(`Unexpected query: ${normalizedSql}`);
      }),
    };

    const executor = {
      getConnection: jest.fn(async () => connection),
    };

    await expect(
      ScheduleGenerationService.updateGeneration(404, {}, null, executor)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Generation introuvable.",
    });

    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test("compareGenerations journalise la comparaison et retourne le resume", async () => {
    const getGenerationByIdSpy = jest
      .spyOn(ScheduleGenerationService, "getGenerationById")
      .mockResolvedValueOnce({
        id_generation: 3,
        version_number: 1,
        generation_name: "Version 1",
        created_at: "2026-01-01T08:00:00.000Z",
        placements: [],
      })
      .mockResolvedValueOnce({
        id_generation: 4,
        version_number: 2,
        generation_name: "Version 2",
        created_at: "2026-01-08T08:00:00.000Z",
        placements: [],
      });

    const resultat = await ScheduleGenerationService.compareGenerations(
      { leftId: 3, rightId: 4 },
      { user: { id: 8 } }
    );

    expect(journaliserActiviteMock).toHaveBeenCalledWith({
      request: { user: { id: 8 } },
      actionType: "COMPARE",
      module: "Generations horaires",
      targetType: "Generation comparee",
      targetId: "3-4",
      description: "Comparaison des generations 1 et 2.",
      newValue: {
        left_id_generation: 3,
        right_id_generation: 4,
      },
    });
    expect(resultat.left).toEqual({
      id_generation: 3,
      version_number: 1,
      generation_name: "Version 1",
      created_at: "2026-01-01T08:00:00.000Z",
    });
    expect(resultat.right.id_generation).toBe(4);

    getGenerationByIdSpy.mockRestore();
  });
});
