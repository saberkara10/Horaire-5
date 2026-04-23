import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const genererRapportMock = jest.fn();

await jest.unstable_mockModule(
  "../src/services/scheduler/FailedCourseDebugService.js",
  () => ({
    FailedCourseDebugService: {
      genererRapport: genererRapportMock,
    },
  })
);

const { SchedulerReportService } = await import(
  "../src/services/scheduler/SchedulerReportService.js"
);

describe("SchedulerReportService helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("listerRapports construit un resume scoring et metier", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue([
        [
          {
            id: 8,
            id_session: 4,
            nb_cours_non_planifies: 2,
            details: JSON.stringify({
              non_planifies: [
                { raison_code: "PROFESSEURS_SATURES" },
                { raison_code: "PROFESSEURS_SATURES" },
                { raison_code: "SALLES_SATUREES" },
              ],
              resolutions_manuelles: [
                { raison_code: "CONFLIT_HORAIRE" },
                { raison_code: "AUCUN_GROUPE_REEL" },
              ],
              scoring_v1: {
                modes: {
                  equilibre: {
                    scoreGlobal: 81,
                    scoreEtudiant: 83,
                    scoreProfesseur: 79,
                    scoreGroupe: 80,
                  },
                },
              },
            }),
          },
        ],
      ]),
    };

    const reports = await SchedulerReportService.listerRapports(executor);

    expect(reports).toHaveLength(1);
    expect(reports[0].resume_scoring_v1.modes.equilibre.scoreGlobal).toBe(81);
    expect(reports[0].resume_metier.raisons_non_planifiees).toEqual([
      { code: "PROFESSEURS_SATURES", total: 2 },
      { code: "SALLES_SATUREES", total: 1 },
    ]);
    expect(reports[0].resume_metier.raisons_reprises).toEqual([
      { code: "AUCUN_GROUPE_REEL", total: 1 },
      { code: "CONFLIT_HORAIRE", total: 1 },
    ]);
  });

  test("_parsePayload rattache scoring_v1 legacy dans details", () => {
    const payload = SchedulerReportService._parsePayload(
      JSON.stringify({
        scoring_v1: {
          version: "v1",
        },
      })
    );

    expect(payload.details.scoring_v1).toEqual({ version: "v1" });
  });

  test("_extractResolutionsManuelles lit le fallback details.reprises.conflits_details", () => {
    expect(
      SchedulerReportService._extractResolutionsManuelles({
        details: {
          reprises: {
            conflits_details: [{ id_etudiant: 1 }],
          },
        },
      })
    ).toEqual([{ id_etudiant: 1 }]);
  });

  test("_chargerCours retourne une map indexee par id", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue([
        [
          { id_cours: 4, code: "INF104", nom: "Algo" },
          { id_cours: 9, code: "MAT201", nom: "Stats" },
        ],
      ]),
    };

    const index = await SchedulerReportService._chargerCours(
      [{ id_cours: 4 }, { id_cours: 9 }, { id_cours: 4 }],
      executor
    );

    expect(index.get(4)).toMatchObject({ code: "INF104" });
    expect(index.get(9)).toMatchObject({ nom: "Stats" });
  });

  test("_chargerGroupes retourne une map vide sans noms de groupes", async () => {
    const executor = { query: jest.fn() };

    const index = await SchedulerReportService._chargerGroupes(
      1,
      [{ groupe: "" }],
      [],
      executor
    );

    expect(index).toEqual(new Map());
    expect(executor.query).not.toHaveBeenCalled();
  });

  test("_chargerProfesseursCompatibles regroupe et ordonne les professeurs par cours", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue([
        [
          {
            id_cours: 6,
            id_professeur: 2,
            matricule: "P-02",
            nom: "Dupont",
            prenom: "Lea",
            series_actives: 1,
            groupes_actifs: 1,
          },
          {
            id_cours: 6,
            id_professeur: 3,
            matricule: "P-03",
            nom: "Martin",
            prenom: "Nora",
            series_actives: 2,
            groupes_actifs: 2,
          },
        ],
      ]),
    };

    const index = await SchedulerReportService._chargerProfesseursCompatibles(
      4,
      [{ id_cours: 6 }],
      executor
    );

    expect(index.get(6)).toEqual([
      {
        id_professeur: 2,
        matricule: "P-02",
        nom_complet: "Lea Dupont",
        series_actives: 1,
        groupes_actifs: 1,
      },
      {
        id_professeur: 3,
        matricule: "P-03",
        nom_complet: "Nora Martin",
        series_actives: 2,
        groupes_actifs: 2,
      },
    ]);
  });

  test("_chargerSallesCompatibles filtre les salles par type attendu", async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          [
            { id_cours: 11, type_salle: "Laboratoire" },
            { id_cours: 12, type_salle: "Classe" },
          ],
        ])
        .mockResolvedValueOnce([
          [
            { id_salle: 1, code: "LAB-1", type: "Laboratoire", capacite: 24 },
            { id_salle: 2, code: "B-204", type: "Classe", capacite: 40 },
            { id_salle: 3, code: "LAB-2", type: "Laboratoire", capacite: 28 },
          ],
        ]),
    };

    const index = await SchedulerReportService._chargerSallesCompatibles(
      [{ id_cours: 11 }, { id_cours: 12 }],
      executor
    );

    expect(index.get(11)).toEqual([
      { id_salle: 1, code: "LAB-1", capacite: 24 },
      { id_salle: 3, code: "LAB-2", capacite: 28 },
    ]);
    expect(index.get(12)).toEqual([{ id_salle: 2, code: "B-204", capacite: 40 }]);
  });

  test("_enrichirResolutionsManuelles ajoute les donnees etudiant et les suggestions", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue([
        [
          {
            id_etudiant: 10,
            matricule: "E-10",
            nom: "Diallo",
            prenom: "Aya",
            programme: "INF",
            etape: 2,
            groupe_principal: "G-INF-02",
          },
        ],
      ]),
    };
    genererRapportMock.mockResolvedValue({
      diagnostics: [
        {
          conclusion: "Verifier le conflit",
          groupes_candidats: [
            {
              id_groupe: 3,
              nom_groupe: "G-INF-03",
              place_disponible: true,
              compatibilite_horaire: false,
              conflits: [
                {
                  conflit_avec: {
                    code_cours: "INF201",
                    groupe_source: "G-INF-02",
                    date: "2026-09-14",
                    heure_debut: "08:00:00",
                    heure_fin: "11:00:00",
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await SchedulerReportService._enrichirResolutionsManuelles({
      idSession: 4,
      resolutionsManuelles: [
        {
          id_etudiant: 10,
          code_cours: "MAT201",
          nom_cours: "Statistiques",
          raison_code: "CONFLIT_HORAIRE",
          groupes_tentes: [],
        },
      ],
      groupesIndex: new Map(),
      executor,
    });

    expect(result[0].etudiant).toMatchObject({
      matricule: "E-10",
      nom: "Diallo",
      prenom: "Aya",
    });
    expect(result[0].groupes_candidats).toHaveLength(1);
    expect(result[0].solutions_manuelles[0]).toContain("Verifier manuellement");
    expect(result[0].solutions_manuelles[1]).toContain("INF201");
  });

  test("_enrichirResolutionsManuelles retombe sur les groupes tentes si le debug echoue", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue([[]]),
    };
    genererRapportMock.mockRejectedValue(new Error("debug off"));

    const result = await SchedulerReportService._enrichirResolutionsManuelles({
      idSession: 4,
      resolutionsManuelles: [
        {
          id_etudiant: 99,
          code_cours: "INF301",
          raison_code: "AUCUN_GROUPE_REEL",
          groupes_tentes: [
            {
              id_groupe: 8,
              nom_groupe: "G-INF-08",
              raison_code: "AUCUNE_PLACE",
              raison: "Complet",
            },
          ],
        },
      ],
      groupesIndex: new Map([["G-INF-08", { nom_groupe: "G-INF-08" }]]),
      executor,
    });

    expect(result[0].groupes_candidats[0]).toMatchObject({
      id_groupe: 8,
      nom_groupe: "G-INF-08",
      decision: "REJETE",
    });
    expect(result[0].solutions_manuelles[0]).toContain("Regenerer");
  });

  test("_enrichirNonPlanifies enrichit les cours, groupes et suggestions", () => {
    const result = SchedulerReportService._enrichirNonPlanifies({
      nonPlanifies: [
        {
          id_cours: 5,
          code: "INF205",
          groupe: "G-INF-02",
          raison_code: "PROFESSEURS_SATURES",
          raison: "Charge max",
        },
      ],
      coursIndex: new Map([
        [
          5,
          {
            id_cours: 5,
            code: "INF205",
            nom: "Reseaux",
            programme: "INF",
            etape_etude: "2",
            type_salle: "Laboratoire",
          },
        ],
      ]),
      groupesIndex: new Map([
        [
          "G-INF-02",
          {
            id_groupes_etudiants: 2,
            nom_groupe: "G-INF-02",
            programme: "INF",
            etape: 2,
          },
        ],
      ]),
      professeursCompatibles: new Map([
        [
          5,
          [
            {
              nom_complet: "Lea Dupont",
              series_actives: 2,
            },
          ],
        ],
      ]),
      sallesCompatibles: new Map([
        [
          5,
          [{ code: "LAB-1", capacite: 24 }],
        ],
      ]),
    });

    expect(result[0].cours).toMatchObject({ nom: "Reseaux", type_salle: "Laboratoire" });
    expect(result[0].groupe).toMatchObject({ id_groupe: 2, nom_groupe: "G-INF-02" });
    expect(result[0].solutions_manuelles[0]).toContain("Lea Dupont");
    expect(result[0].professeurs_compatibles).toHaveLength(1);
  });
});
