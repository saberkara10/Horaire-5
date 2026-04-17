import { describe, expect, test } from "@jest/globals";
import { SchedulerDataBootstrap } from "../src/services/scheduler/SchedulerDataBootstrap.js";
import { buildAcademicTargetKey } from "../src/services/scheduler/AcademicCatalog.js";

describe("SchedulerDataBootstrap", () => {
  test("n'injecte des etudiants bootstrap que si la base est vide", () => {
    expect(SchedulerDataBootstrap._peutInjecterEtudiantsBootstrap([])).toBe(true);
    expect(
      SchedulerDataBootstrap._peutInjecterEtudiantsBootstrap([
        { matricule: "MAT-001" },
      ])
    ).toBe(false);
  });

  test("dimensionne les professeurs sur les groupes operationnels deja persistes", () => {
    const programme = "Programmation informatique";
    const etape = "1";
    const sessionMetadata = { saison: "Automne", annee: 2026 };
    const activeSession = { id_session: 42 };
    const etudiants = Array.from({ length: 112 }, (_, index) => ({
      id_etudiant: index + 1,
      programme,
      etape: 1,
      session: "Automne",
    }));
    const groupes = [
      ...Array.from({ length: 5 }, (_, index) => ({
        nom_groupe: `GPI-E1-${index + 1}`,
        programme,
        etape: 1,
        id_session: 42,
        est_groupe_special: 0,
      })),
      {
        nom_groupe: "SRC-Programmation informati-E1",
        programme,
        etape: 1,
        id_session: 42,
        est_groupe_special: 0,
      },
      {
        nom_groupe: "GS-INF105-1",
        programme,
        etape: 1,
        id_session: 42,
        est_groupe_special: 1,
      },
      {
        nom_groupe: "GPI-E1-ARCHIVE",
        programme,
        etape: 1,
        id_session: 7,
        est_groupe_special: 0,
      },
    ];
    const salles = [
      { type: "Laboratoire", capacite: 32 },
      { type: "Salle de cours", capacite: 40 },
    ];

    const requiredGroupsByProgram = SchedulerDataBootstrap._buildRequiredGroupsByProgram(
      etudiants,
      groupes,
      salles,
      sessionMetadata,
      activeSession
    );

    expect(
      requiredGroupsByProgram.get(buildAcademicTargetKey(programme, etape))
    ).toBe(5);
  });

  test("dimensionne les groupes sur les donnees reelles quand des etudiants existent deja", () => {
    const programme = "Programmation informatique";
    const etape = "1";
    const sessionMetadata = { saison: "Automne", annee: 2026 };
    const activeSession = { id_session: 42 };
    const etudiants = Array.from({ length: 50 }, (_, index) => ({
      id_etudiant: index + 1,
      programme,
      etape: 1,
      session: "Automne",
    }));
    const groupes = [];
    const salles = [
      { type: "Laboratoire", capacite: 32 },
      { type: "Salle de cours", capacite: 40 },
    ];

    const requiredGroupsByProgram = SchedulerDataBootstrap._buildRequiredGroupsByProgram(
      etudiants,
      groupes,
      salles,
      sessionMetadata,
      activeSession,
      { useAcademicTargets: false }
    );

    expect(
      requiredGroupsByProgram.get(buildAcademicTargetKey(programme, etape))
    ).toBe(2);
  });

  test("derive une reserve de 2 programmes max a partir du dernier rapport", async () => {
    const executor = {
      async query(sql) {
        expect(sql).toContain("FROM rapports_generation");
        return [[
          {
            details: JSON.stringify({
              non_planifies: [
                {
                  code: "INF104",
                  programme: "Programmation informatique",
                  groupe: "GPI-E1-2",
                  raison_code: "PROFESSEURS_SATURES",
                },
                {
                  code: "DAT205",
                  programme: "Analyse de donnees",
                  groupe: "GAD-E2-4",
                  raison_code: "GROUPE_SATURE",
                },
                {
                  code: "DAT205",
                  programme: "Analyse de donnees",
                  groupe: "GAD-E2-4",
                  raison_code: "GARANTIE_GROUPE_SATURE",
                },
                {
                  code: "DAT306",
                  programme: "Analyse de donnees",
                  groupe: "GAD-E3-5",
                  raison_code: "PROFESSEURS_SATURES",
                },
              ],
            }),
          },
        ]];
      },
    };

    const reserveCourseDemands =
      await SchedulerDataBootstrap._loadReserveCourseDemands(executor, {
        id_session: 3,
      });

    expect(reserveCourseDemands).toEqual([
      {
        code: "DAT205",
        programme: "Analyse de donnees",
        load: 1,
      },
      {
        code: "DAT306",
        programme: "Analyse de donnees",
        load: 1,
      },
      {
        code: "INF104",
        programme: "Programmation informatique",
        load: 1,
      },
    ]);
  });
});
