import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const queryMock = jest.fn();
const beginTransactionMock = jest.fn(async () => {});
const commitMock = jest.fn(async () => {});
const rollbackMock = jest.fn(async () => {});
const releaseMock = jest.fn(() => {});
const getConnectionMock = jest.fn(() => ({
  query: queryMock,
  beginTransaction: beginTransactionMock,
  commit: commitMock,
  rollback: rollbackMock,
  release: releaseMock,
}));

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    getConnection: getConnectionMock,
  },
}));

await jest.unstable_mockModule(
  "../src/services/academic-scheduler-schema.js",
  () => ({
    assurerSchemaSchedulerAcademique: jest.fn(async () => {}),
  })
);

const { SchedulerEngine } = await import(
  "../src/services/scheduler/SchedulerEngine.js"
);

describe("SchedulerEngine.genererGroupe", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    queryMock.mockImplementation(async (sql) => {
      const normalizedSql = String(sql).replace(/\s+/g, " ").trim();

      if (normalizedSql.includes("FROM sessions")) {
        return [[{
          id_session: 1,
          nom: "Hiver 2026",
          date_debut: "2026-01-01",
          date_fin: "2026-04-24",
        }]];
      }

      if (
        normalizedSql.includes("FROM groupes_etudiants ge") &&
        normalizedSql.includes("WHERE ge.id_groupes_etudiants = ?")
      ) {
        return [[{
          id_groupes_etudiants: 12,
          nom_groupe: "GPI-E4-2",
          programme: "Programmation informatique",
          etape: "4",
        }]];
      }

      if (
        normalizedSql.includes("FROM etudiants") &&
        normalizedSql.includes("WHERE id_groupes_etudiants = ?")
      ) {
        return [[
          {
            id_etudiant: 101,
            matricule: "MAT101",
            nom: "Diallo",
            prenom: "Aya",
            programme: "Programmation informatique",
            etape: 4,
            session: "Hiver",
          },
          {
            id_etudiant: 102,
            matricule: "MAT102",
            nom: "Benali",
            prenom: "Youssef",
            programme: "Programmation informatique",
            etape: 4,
            session: "Hiver",
          },
        ]];
      }

      if (
        normalizedSql.includes("FROM affectation_etudiants ae") &&
        normalizedSql.includes("source_type = 'reprise'")
      ) {
        return [[]];
      }

      if (normalizedSql.startsWith("DELETE ag FROM affectation_groupes ag")) {
        return [{ affectedRows: 0 }];
      }

      if (normalizedSql.includes("FROM cours c")) {
        return [[
          {
            id_cours: 401,
            code: "INF401",
            nom: "Architecture logicielle et integration",
            duree: 3,
            programme: "Programmation informatique",
            etape_etude: "4",
            type_salle: "Laboratoire",
            est_cours_cle: 1,
            est_en_ligne: 0,
            max_etudiants_par_groupe: 30,
            min_etudiants_par_groupe: 1,
            sessions_par_semaine: 1,
            archive: 0,
          },
        ]];
      }

      if (normalizedSql.includes("FROM professeurs p")) {
        return [[
          {
            id_professeur: 10,
            matricule: "PROF1001",
            nom: "Tremblay",
            prenom: "Sophie",
            specialite: "Programmation informatique",
            cours_ids: "401",
          },
        ]];
      }

      if (normalizedSql.includes("FROM salles ORDER BY")) {
        return [[
          {
            id_salle: 5,
            code: "LAB201",
            type: "Laboratoire",
            capacite: 32,
          },
        ]];
      }

      if (normalizedSql.includes("FROM disponibilites_professeurs")) {
        return [[
          {
            id_professeur: 10,
            jour_semaine: 1,
            heure_debut: "08:00:00",
            heure_fin: "17:00:00",
            date_debut_effet: "2026-01-01",
            date_fin_effet: "2026-04-24",
          },
        ]];
      }

      if (normalizedSql.includes("FROM absences_professeurs")) {
        return [[]];
      }

      if (normalizedSql.includes("FROM salles_indisponibles")) {
        return [[]];
      }

      if (
        normalizedSql.includes("FROM affectation_cours ac") &&
        normalizedSql.includes("ag.id_groupes_etudiants != ?")
      ) {
        return [[]];
      }

      if (normalizedSql.includes("FROM ( SELECT e.id_etudiant,")) {
        return [[]];
      }

      if (normalizedSql.startsWith("INSERT IGNORE INTO plages_horaires")) {
        return [{ affectedRows: 1 }];
      }

      if (normalizedSql.includes("SELECT id_plage_horaires FROM plages_horaires")) {
        return [[{ id_plage_horaires: 77 }]];
      }

      if (normalizedSql.startsWith("INSERT INTO affectation_cours")) {
        return [{ insertId: 88 }];
      }

      if (normalizedSql.startsWith("INSERT IGNORE INTO affectation_groupes")) {
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Unexpected query in test: ${normalizedSql}`);
    });
  });

  test("genere un groupe sans ReferenceError sur courseTimeCandidateMap", async () => {
    const weeklyPlacement = {
      id_cours: 401,
      code: "INF401",
      nom: "Architecture logicielle et integration",
      id_professeur: 10,
      nom_professeur: "Sophie Tremblay",
      id_salle: 5,
      code_salle: "LAB201",
      id_groupe: 12,
      nom_groupe: "GPI-E4-2",
      date: "2026-01-05",
      heure_debut: "08:00:00",
      heure_fin: "11:00:00",
    };
    const serieSpy = jest
      .spyOn(SchedulerEngine, "_trouverSerieHebdomadaire")
      .mockReturnValue({ placements: [weeklyPlacement] });
    const optimisationSpy = jest
      .spyOn(SchedulerEngine, "_executerOptimisationLocaleLectureSeule")
      .mockImplementation(({ placements }) => ({
        placementsOptimises: placements,
        scoringBefore: {
          modes: {
            equilibre: { scoreGlobal: 80 },
          },
        },
        scoringAfter: {
          modes: {
            equilibre: { scoreGlobal: 82 },
          },
        },
        improvementsRetained: 0,
        gains: {},
        improvements: [],
        fallbackLectureSeule: false,
        error: null,
      }));
    const scoreSpy = jest
      .spyOn(SchedulerEngine, "_calculerScoreQualite")
      .mockReturnValue({ score: 95 });

    try {
      const rapport = await SchedulerEngine.genererGroupe({
        idGroupe: 12,
        optimizationMode: "equilibre",
      });

      expect(rapport.nb_cours_planifies).toBe(1);
      expect(rapport.nb_cours_non_planifies).toBe(0);
      expect(rapport.details.modeOptimisationUtilise).toBe("equilibre");
      expect(rapport.affectations).toHaveLength(1);
      expect(commitMock).toHaveBeenCalled();
      expect(serieSpy).toHaveBeenCalled();
      expect(optimisationSpy).toHaveBeenCalled();
      expect(scoreSpy).toHaveBeenCalled();
    } finally {
      serieSpy.mockRestore();
      optimisationSpy.mockRestore();
      scoreSpy.mockRestore();
    }
  });
});
