/**
 * Tests de ScheduleModificationService
 *
 * Ces tests couvrent l'orchestration metier de la replanification :
 * - simulation obligatoire avant toute ecriture ;
 * - gestion des portees sur occurrence et serie ;
 * - blocage des conflits remontees par le what-if ;
 * - rollback transactionnel si l'application echoue.
 */

import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { ScheduleModificationService } from "../src/services/scheduler/planning/ScheduleModificationService.js";
import { ScenarioSimulator } from "../src/services/scheduler/simulation/ScenarioSimulator.js";
import { ScheduleSnapshot } from "../src/services/scheduler/simulation/ScheduleSnapshot.js";

/**
 * Construit un snapshot avec une serie hebdomadaire de trois occurrences.
 *
 * @returns {ScheduleSnapshot} Snapshot de test.
 */
function buildSeriesSnapshot() {
  return ScheduleSnapshot.fromData({
    session: {
      id_session: 1,
      nom: "Automne 2026",
      date_debut: "2026-09-01",
      date_fin: "2026-12-31",
    },
    placements: [
      {
        id_affectation_cours: 201,
        id_plage_horaires: 1001,
        id_planification_serie: 10,
        id_cours: 501,
        id_professeur: 10,
        nom_professeur: "Ada Lovelace",
        prenom_professeur: "Ada",
        id_salle: 1,
        code_salle: "S1",
        type_salle: "Salle de cours",
        capacite_salle: 30,
        id_groupe: 1,
        nom_groupe: "G1",
        date: "2026-09-07",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
      },
      {
        id_affectation_cours: 202,
        id_plage_horaires: 1002,
        id_planification_serie: 10,
        id_cours: 501,
        id_professeur: 10,
        nom_professeur: "Ada Lovelace",
        prenom_professeur: "Ada",
        id_salle: 1,
        code_salle: "S1",
        type_salle: "Salle de cours",
        capacite_salle: 30,
        id_groupe: 1,
        nom_groupe: "G1",
        date: "2026-09-14",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
      },
      {
        id_affectation_cours: 203,
        id_plage_horaires: 1003,
        id_planification_serie: 10,
        id_cours: 501,
        id_professeur: 10,
        nom_professeur: "Ada Lovelace",
        prenom_professeur: "Ada",
        id_salle: 1,
        code_salle: "S1",
        type_salle: "Salle de cours",
        capacite_salle: 30,
        id_groupe: 1,
        nom_groupe: "G1",
        date: "2026-09-21",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
      },
    ],
    courses: [
      {
        id_cours: 501,
        code: "INF501",
        nom: "Architecture",
        programme: "Informatique",
        etape_etude: "1",
        type_salle: "Salle de cours",
        est_en_ligne: 0,
      },
    ],
    professors: [
      {
        id_professeur: 10,
        nom: "Lovelace",
        prenom: "Ada",
        cours_ids: [501],
      },
      {
        id_professeur: 20,
        nom: "Hopper",
        prenom: "Grace",
        cours_ids: [501],
      },
    ],
    rooms: [
      { id_salle: 1, code: "S1", type: "Salle de cours", capacite: 30 },
      { id_salle: 3, code: "S3", type: "Salle de cours", capacite: 32 },
    ],
    groups: [
      {
        id_groupes_etudiants: 1,
        nom_groupe: "G1",
        est_groupe_special: 0,
        programme: "Informatique",
        etape: "1",
        id_session: 1,
      },
    ],
    students: [
      { id_etudiant: 1, id_groupes_etudiants: 1, nom: "A", prenom: "Alpha" },
      { id_etudiant: 2, id_groupes_etudiants: 1, nom: "B", prenom: "Beta" },
    ],
    studentCourseAssignments: [
      {
        id_etudiant: 99,
        id_groupes_etudiants: 1,
        id_cours: 501,
        id_session: 1,
        source_type: "reprise",
      },
    ],
    professorAvailabilities: [],
    professorAbsences: [],
    roomUnavailabilities: [],
  });
}

/**
 * Cree un rapport de simulation faisable minimal.
 *
 * @returns {Object} Rapport what-if.
 */
function buildSuccessfulSimulation() {
  return {
    faisable: true,
    conflitsCrees: 0,
    modeScoringAvant: "equilibre",
    modeScoringApres: "equilibre",
    scoreAvant: {
      mode: "equilibre",
      scoreGlobal: 72,
      scoreEtudiant: 74,
      scoreProfesseur: 68,
      scoreGroupe: 70,
      metrics: {
        pausesEtudiantsRespectees: 1,
        pausesEtudiantsManquees: 0,
        pausesProfesseursRespectees: 1,
        pausesProfesseursManquees: 0,
        pausesGroupesRespectees: 1,
        pausesGroupesManquees: 0,
        nbCoursNonPlanifies: 0,
        nbConflitsEvites: 0,
      },
    },
    scoreApres: {
      mode: "equilibre",
      scoreGlobal: 76,
      scoreEtudiant: 79,
      scoreProfesseur: 70,
      scoreGroupe: 74,
      metrics: {
        pausesEtudiantsRespectees: 1,
        pausesEtudiantsManquees: 0,
        pausesProfesseursRespectees: 1,
        pausesProfesseursManquees: 0,
        pausesGroupesRespectees: 1,
        pausesGroupesManquees: 0,
        nbCoursNonPlanifies: 0,
        nbConflitsEvites: 1,
      },
    },
    difference: {
      scoreGlobal: 4,
      scoreEtudiant: 5,
      scoreProfesseur: 2,
      scoreGroupe: 4,
      metrics: {
        pausesEtudiantsRespectees: 0,
        pausesEtudiantsManquees: 0,
        pausesProfesseursRespectees: 0,
        pausesProfesseursManquees: 0,
        pausesGroupesRespectees: 0,
        pausesGroupesManquees: 0,
        nbCoursNonPlanifies: 0,
        nbConflitsEvites: 1,
      },
    },
    impact: {
      etudiants: {
        idsImpactes: [1, 2, 99],
      },
    },
  };
}

/**
 * Cree une simulation bloquee par un code de conflit.
 *
 * @param {string} code - code de blocage.
 * @returns {Object} Rapport infaisable.
 */
function buildBlockedSimulation(code) {
  return {
    faisable: false,
    conflitsCrees: 0,
    validation: {
      raisonsBlocage: [
        {
          code,
          message: `Blocage ${code}`,
        },
      ],
    },
    impact: {
      etudiants: {
        idsImpactes: [99],
      },
    },
  };
}

/**
 * Construit un pool transactionnel de test.
 *
 * @param {Object} options - options de simulation SQL.
 * @returns {Object} Pool, connexion et journal d'appels.
 */
function createTransactionalPool({
  lockedAssignmentIds = [201],
  failOnSql = null,
  eventLog = null,
} = {}) {
  let nextSeriesId = 700;
  let nextTimeSlotId = 9000;
  let nextHistoryId = 1200;

  const connection = {
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn(() => {}),
    query: jest.fn(async (sql, params = []) => {
      eventLog?.push(`query:${sql.split("\n")[0].trim()}`);

      if (failOnSql && sql.includes(failOnSql)) {
        throw new Error("DB_FAILURE");
      }

      if (sql.includes("MIN(ge.id_session) AS id_session")) {
        return [[
          {
            id_affectation_cours: 201,
            id_planification_serie: 10,
            id_session: 1,
          },
        ]];
      }

      if (sql.includes("FOR UPDATE")) {
        return [lockedAssignmentIds.map((assignmentId, index) => ({
          id_affectation_cours: assignmentId,
          id_plage_horaires: 1001 + index,
          id_planification_serie: 10,
        }))];
      }

      if (sql.includes("INSERT INTO planification_series")) {
        return [{ insertId: nextSeriesId++ }];
      }

      if (sql.includes("INSERT INTO plages_horaires")) {
        return [{ insertId: nextTimeSlotId++ }];
      }

      if (sql.includes("UPDATE affectation_cours")) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes("UPDATE planification_series")) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes("DELETE ps")) {
        return [{ affectedRows: 0 }];
      }

      if (sql.includes("DELETE ph")) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes("INSERT INTO journal_modifications_affectations_scheduler")) {
        return [{ insertId: nextHistoryId++ }];
      }

      throw new Error(`SQL non simule: ${sql}`);
    }),
  };

  return {
    pool: {
      getConnection: jest.fn(async () => connection),
      query: jest.fn(),
    },
    connection,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ScheduleModificationService", () => {
  test("applique une modification simple sur THIS_OCCURRENCE apres simulation obligatoire", async () => {
    const snapshot = buildSeriesSnapshot();
    const { pool, connection } = createTransactionalPool({
      lockedAssignmentIds: [201],
    });
    const loadSpy = jest.spyOn(ScheduleSnapshot, "load").mockResolvedValue(snapshot);
    const simulateSpy = jest
      .spyOn(ScenarioSimulator, "simulatePlacementMutations")
      .mockReturnValue(buildSuccessfulSimulation());

    const result = await ScheduleModificationService.modifyAssignment(
      {
        idSeance: 201,
        modifications: {
          id_professeur: 20,
          id_salle: 3,
          date: "2026-09-09",
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
        },
        portee: "THIS_OCCURRENCE",
        modeOptimisation: "equilibre",
        confirmerDegradationScore: true,
        idUtilisateur: 7,
      },
      pool
    );

    expect(loadSpy).toHaveBeenCalled();
    expect(simulateSpy).toHaveBeenCalledTimes(1);
    expect(connection.beginTransaction).toHaveBeenCalled();
    expect(connection.commit).toHaveBeenCalled();
    expect(result.simulationObligatoireExecutee).toBe(true);
    expect(result.result.historique.id_journal_modification_affectation).toBeGreaterThan(0);
    expect(
      connection.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO planification_series"))
    ).toBe(true);

    const journalInsertCall = connection.query.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO journal_modifications_affectations_scheduler")
    );
    const detailsJson = JSON.parse(journalInsertCall[1][10]);

    expect(detailsJson.scoring_v1.score_avant.scoreGroupe).toBe(70);
    expect(detailsJson.scoring_v1.difference.scoreGroupe).toBe(4);
  });

  test("previsualise une modification intelligente sans aucune ecriture SQL", async () => {
    const snapshot = buildSeriesSnapshot();
    const { connection } = createTransactionalPool();
    jest.spyOn(ScheduleSnapshot, "load").mockResolvedValue(snapshot);
    jest
      .spyOn(ScenarioSimulator, "simulatePlacementMutations")
      .mockReturnValue(buildSuccessfulSimulation());

    const result = await ScheduleModificationService.previewAssignmentModification(
      {
        idSeance: 201,
        modifications: {
          id_professeur: 20,
          id_salle: 3,
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
        },
        portee: "THIS_OCCURRENCE",
        modeOptimisation: "legacy",
      },
      connection
    );

    expect(result.simulationObligatoireExecutee).toBe(true);
    expect(result.faisable).toBe(true);
    expect(result.validation.scope).toBe("THIS_OCCURRENCE");
    expect(
      connection.query.mock.calls.some(([sql]) => sql.includes("UPDATE affectation_cours"))
    ).toBe(false);
    expect(
      connection.query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO journal_modifications_affectations_scheduler")
      )
    ).toBe(false);
  });

  test("decoupe la serie sur THIS_AND_FOLLOWING et applique uniquement les occurrences suivantes", async () => {
    const snapshot = buildSeriesSnapshot();
    const { pool, connection } = createTransactionalPool({
      lockedAssignmentIds: [202, 203],
    });
    jest.spyOn(ScheduleSnapshot, "load").mockResolvedValue(snapshot);
    jest
      .spyOn(ScenarioSimulator, "simulatePlacementMutations")
      .mockReturnValue(buildSuccessfulSimulation());

    const result = await ScheduleModificationService.modifyAssignment(
      {
        idSeance: 202,
        modifications: {
          id_salle: 3,
          date: "2026-09-16",
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
        },
        portee: "THIS_AND_FOLLOWING",
        modeOptimisation: "etudiant",
        confirmerDegradationScore: true,
      },
      pool
    );

    const updateCalls = connection.query.mock.calls.filter(([sql]) =>
      sql.includes("UPDATE affectation_cours")
    );

    expect(updateCalls).toHaveLength(2);
    expect(
      connection.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO planification_series"))
    ).toBe(true);
    expect(result.result.portee).toBe("THIS_AND_FOLLOWING");
    expect(result.result.occurrences_modifiees).toHaveLength(2);
  });

  test("gere une modification combinee sur ALL_OCCURRENCES sans recreer de serie", async () => {
    const snapshot = buildSeriesSnapshot();
    const { pool, connection } = createTransactionalPool({
      lockedAssignmentIds: [201, 202, 203],
    });
    jest.spyOn(ScheduleSnapshot, "load").mockResolvedValue(snapshot);
    jest
      .spyOn(ScenarioSimulator, "simulatePlacementMutations")
      .mockReturnValue(buildSuccessfulSimulation());

    const result = await ScheduleModificationService.modifyAssignment(
      {
        idSeance: 202,
        modifications: {
          id_professeur: 20,
          id_salle: 3,
          date: "2026-09-09",
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
        },
        portee: "ALL_OCCURRENCES",
        modeOptimisation: "professeur",
        confirmerDegradationScore: true,
      },
      pool
    );

    const seriesInsertCalls = connection.query.mock.calls.filter(([sql]) =>
      sql.includes("INSERT INTO planification_series")
    );
    const updateCalls = connection.query.mock.calls.filter(([sql]) =>
      sql.includes("UPDATE affectation_cours")
    );

    expect(seriesInsertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(3);
    expect(result.result.professeurs_impactes).toContain(20);
    expect(result.result.salles_impactees).toContain(3);
  });

  test("supporte DATE_RANGE sur une sous-plage de serie et ne modifie que les occurrences incluses", async () => {
    const snapshot = buildSeriesSnapshot();
    const { pool, connection } = createTransactionalPool({
      lockedAssignmentIds: [202, 203],
    });
    jest.spyOn(ScheduleSnapshot, "load").mockResolvedValue(snapshot);
    jest
      .spyOn(ScenarioSimulator, "simulatePlacementMutations")
      .mockReturnValue(buildSuccessfulSimulation());

    const result = await ScheduleModificationService.modifyAssignment(
      {
        idSeance: 202,
        modifications: {
          id_salle: 3,
          date: "2026-09-17",
          heure_debut: "13:00:00",
          heure_fin: "16:00:00",
        },
        portee: {
          mode: "DATE_RANGE",
          dateDebut: "2026-09-14",
          dateFin: "2026-09-21",
        },
        modeOptimisation: "equilibre",
        confirmerDegradationScore: true,
      },
      pool
    );

    const updateCalls = connection.query.mock.calls.filter(([sql]) =>
      sql.includes("UPDATE affectation_cours")
    );

    expect(updateCalls).toHaveLength(2);
    expect(result.result.portee).toBe("DATE_RANGE");
    expect(result.result.occurrences_modifiees).toHaveLength(2);
  });

  test.each([
    ["GROUP_TIME_CONFLICT"],
    ["PROFESSOR_TIME_CONFLICT"],
    ["ROOM_TIME_CONFLICT"],
    ["STUDENT_TIME_CONFLICT"],
  ])("bloque la modification quand la simulation remonte %s", async (conflictCode) => {
    const snapshot = buildSeriesSnapshot();
    const { pool, connection } = createTransactionalPool({
      lockedAssignmentIds: [201],
    });
    jest.spyOn(ScheduleSnapshot, "load").mockResolvedValue(snapshot);
    jest
      .spyOn(ScenarioSimulator, "simulatePlacementMutations")
      .mockReturnValue(buildBlockedSimulation(conflictCode));

    await expect(
      ScheduleModificationService.modifyAssignment(
        {
          idSeance: 201,
          modifications: {
            id_salle: 3,
            heure_debut: "11:00:00",
            heure_fin: "14:00:00",
          },
          portee: "THIS_OCCURRENCE",
        },
        pool
      )
    ).rejects.toMatchObject({
      code: "MODIFICATION_BLOCKED_BY_SIMULATION",
      statusCode: 409,
      details: {
        simulation: {
          validation: {
            raisonsBlocage: [
              {
                code: conflictCode,
              },
            ],
          },
        },
      },
    });

    expect(connection.rollback).toHaveBeenCalled();
    expect(
      connection.query.mock.calls.some(([sql]) => sql.includes("UPDATE affectation_cours"))
    ).toBe(false);
  });

  test("rollback la transaction si une ecriture SQL echoue", async () => {
    const snapshot = buildSeriesSnapshot();
    const { pool, connection } = createTransactionalPool({
      lockedAssignmentIds: [201],
      failOnSql: "INSERT INTO journal_modifications_affectations_scheduler",
    });
    jest.spyOn(ScheduleSnapshot, "load").mockResolvedValue(snapshot);
    jest
      .spyOn(ScenarioSimulator, "simulatePlacementMutations")
      .mockReturnValue(buildSuccessfulSimulation());

    await expect(
      ScheduleModificationService.modifyAssignment(
        {
          idSeance: 201,
          modifications: {
            id_professeur: 20,
            heure_debut: "11:00:00",
            heure_fin: "14:00:00",
          },
          portee: "THIS_OCCURRENCE",
          confirmerDegradationScore: true,
        },
        pool
      )
    ).rejects.toThrow("DB_FAILURE");

    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test("exige une confirmation explicite quand la simulation degrade fortement le score", async () => {
    const snapshot = buildSeriesSnapshot();
    const { pool, connection } = createTransactionalPool({
      lockedAssignmentIds: [201],
    });
    jest.spyOn(ScheduleSnapshot, "load").mockResolvedValue(snapshot);
    jest.spyOn(ScenarioSimulator, "simulatePlacementMutations").mockReturnValue({
      ...buildSuccessfulSimulation(),
      difference: {
        scoreGlobal: -8,
        scoreEtudiant: -6,
        scoreProfesseur: -4,
      },
    });

    await expect(
      ScheduleModificationService.modifyAssignment(
        {
          idSeance: 201,
          modifications: {
            id_salle: 3,
            heure_debut: "11:00:00",
            heure_fin: "14:00:00",
          },
          portee: "THIS_OCCURRENCE",
        },
        pool
      )
    ).rejects.toMatchObject({
      code: "SCORE_DEGRADATION_CONFIRMATION_REQUIRED",
      statusCode: 412,
      details: {
        warnings: [
          expect.objectContaining({
            code: "SCORE_STRONG_DEGRADATION",
          }),
        ],
      },
    });

    expect(connection.rollback).toHaveBeenCalled();
    expect(
      connection.query.mock.calls.some(([sql]) => sql.includes("UPDATE affectation_cours"))
    ).toBe(false);
  });

  test("execute la simulation avant la premiere mise a jour SQL reelle", async () => {
    const snapshot = buildSeriesSnapshot();
    const eventLog = [];
    const { pool } = createTransactionalPool({
      lockedAssignmentIds: [201],
      eventLog,
    });
    jest.spyOn(ScheduleSnapshot, "load").mockResolvedValue(snapshot);
    jest
      .spyOn(ScenarioSimulator, "simulatePlacementMutations")
      .mockImplementation(() => {
        eventLog.push("simulate");
        return buildSuccessfulSimulation();
      });

    await ScheduleModificationService.modifyAssignment(
      {
        idSeance: 201,
        modifications: {
          id_salle: 3,
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
        },
        portee: "THIS_OCCURRENCE",
        confirmerDegradationScore: true,
      },
      pool
    );

    const simulationIndex = eventLog.indexOf("simulate");
    const firstUpdateIndex = eventLog.findIndex((event) =>
      event.includes("UPDATE affectation_cours")
    );

    expect(simulationIndex).toBeGreaterThanOrEqual(0);
    expect(firstUpdateIndex).toBeGreaterThan(simulationIndex);
  });
});
