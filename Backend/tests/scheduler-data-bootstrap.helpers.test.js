import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { SchedulerDataBootstrap } from "../src/services/scheduler/SchedulerDataBootstrap.js";
import { buildAcademicTargetKey } from "../src/services/scheduler/AcademicCatalog.js";

describe("SchedulerDataBootstrap helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("_buildRequiredGroupsByProgram garde zero sans cibles academiques ni groupes", () => {
    const result = SchedulerDataBootstrap._buildRequiredGroupsByProgram(
      [],
      [],
      [],
      { saison: "Automne", annee: 2026 },
      { id_session: 3 },
      { useAcademicTargets: false }
    );

    expect(
      result.get(buildAcademicTargetKey("Programmation informatique", "1"))
    ).toBe(0);
  });

  test("_loadReserveCourseDemands retourne vide sans session active valide", async () => {
    const executor = { query: jest.fn() };

    await expect(
      SchedulerDataBootstrap._loadReserveCourseDemands(executor, { id_session: null })
    ).resolves.toEqual([]);
    expect(executor.query).not.toHaveBeenCalled();
  });

  test("_loadReserveCourseDemands retourne vide sans rapport historique", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue([[]]),
    };

    await expect(
      SchedulerDataBootstrap._loadReserveCourseDemands(executor, { id_session: 4 })
    ).resolves.toEqual([]);
  });

  test("_loadReserveCourseDemands ignore les entrees incompletes et les raisons non reserve", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue([
        [
          {
            details: JSON.stringify({
              non_planifies: [
                { code: "INF101", programme: "Programmation informatique", groupe: "", raison_code: "PROFESSEURS_SATURES" },
                { code: "INF101", programme: "Programmation informatique", groupe: "G1", raison_code: "AUTRE" },
                { code: "", programme: "Programmation informatique", groupe: "G1", raison_code: "GROUPE_SATURE" },
              ],
            }),
          },
        ],
      ]),
    };

    await expect(
      SchedulerDataBootstrap._loadReserveCourseDemands(executor, { id_session: 4 })
    ).resolves.toEqual([]);
  });

  test("_loadSalles, _loadCours, _loadProfesseurs, _loadEtudiants et _loadGroupes relaient les lignes SQL", async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id_salle: 1 }]])
        .mockResolvedValueOnce([[{ id_cours: 2 }]])
        .mockResolvedValueOnce([[{ id_professeur: 3 }]])
        .mockResolvedValueOnce([[{ id_etudiant: 4 }]])
        .mockResolvedValueOnce([[{ id_groupes_etudiants: 5 }]]),
    };

    await expect(SchedulerDataBootstrap._loadSalles(executor)).resolves.toEqual([{ id_salle: 1 }]);
    await expect(SchedulerDataBootstrap._loadCours(executor)).resolves.toEqual([{ id_cours: 2 }]);
    await expect(SchedulerDataBootstrap._loadProfesseurs(executor)).resolves.toEqual([{ id_professeur: 3 }]);
    await expect(SchedulerDataBootstrap._loadEtudiants(executor)).resolves.toEqual([{ id_etudiant: 4 }]);
    await expect(SchedulerDataBootstrap._loadGroupes(executor)).resolves.toEqual([
      { id_groupes_etudiants: 5 },
    ]);
  });

  test("_ensureProfessorCourseTable et _ensureProfessorAvailabilityTable creent les tables si besoin", async () => {
    const executor = { query: jest.fn().mockResolvedValue([{}]) };

    await SchedulerDataBootstrap._ensureProfessorCourseTable(executor);
    await SchedulerDataBootstrap._ensureProfessorAvailabilityTable(executor);

    expect(executor.query).toHaveBeenCalledTimes(2);
    expect(executor.query.mock.calls[0][0]).toContain(
      "CREATE TABLE IF NOT EXISTS professeur_cours"
    );
    expect(executor.query.mock.calls[1][0]).toContain(
      "CREATE TABLE IF NOT EXISTS disponibilites_professeurs"
    );
  });
});
