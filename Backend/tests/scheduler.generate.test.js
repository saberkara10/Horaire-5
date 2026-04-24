import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const queryMock = jest.fn();
const poolQueryMock = jest.fn();
const beginTransactionMock = jest.fn(async () => {});
const commitMock = jest.fn(async () => {});
const rollbackMock = jest.fn(async () => {});
const releaseMock = jest.fn(() => {});
const pingMock = jest.fn(async () => {});
const getConnectionMock = jest.fn(() => ({
  query: queryMock,
  beginTransaction: beginTransactionMock,
  commit: commitMock,
  rollback: rollbackMock,
  release: releaseMock,
  ping: pingMock,
}));

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    getConnection: getConnectionMock,
    query: poolQueryMock,
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
const { ContextLoader } = await import(
  "../src/services/scheduler/ContextLoader.js"
);
const { GroupFormer } = await import(
  "../src/services/scheduler/GroupFormer.js"
);
const { AvailabilityChecker } = await import(
  "../src/services/scheduler/AvailabilityChecker.js"
);
const { FailedCourseEngine } = await import(
  "../src/services/scheduler/FailedCourseEngine.js"
);
const { CandidatePrecomputer } = await import(
  "../src/services/scheduler/optimization/CandidatePrecomputer.js"
);
const { CoursePrioritySorter } = await import(
  "../src/services/scheduler/optimization/CoursePrioritySorter.js"
);

describe("SchedulerEngine.generer", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    let nextPlageId = 700;
    let nextAffectationId = 900;

    queryMock.mockImplementation(async (sql, params = []) => {
      const normalizedSql = String(sql).replace(/\s+/g, " ").trim();

      if (normalizedSql.startsWith("INSERT IGNORE INTO plages_horaires")) {
        return [{ affectedRows: 1 }];
      }

      if (normalizedSql.includes("SELECT id_plage_horaires")) {
        const rows = [];
        for (let index = 0; index < params.length; index += 3) {
          nextPlageId += 1;
          rows.push({
            id_plage_horaires: nextPlageId,
            date: params[index],
            heure_debut: params[index + 1],
            heure_fin: params[index + 2],
          });
        }
        return [rows];
      }

      if (normalizedSql.startsWith("INSERT INTO affectation_cours")) {
        nextAffectationId += 1;
        return [{ insertId: nextAffectationId }];
      }

      if (normalizedSql.startsWith("INSERT IGNORE INTO affectation_groupes")) {
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Unexpected query in test: ${normalizedSql}`);
    });

    poolQueryMock.mockImplementation(async (sql) => {
      const normalizedSql = String(sql).replace(/\s+/g, " ").trim();

      if (normalizedSql.startsWith("INSERT INTO rapports_generation")) {
        return [{ insertId: 33 }];
      }

      throw new Error(`Unexpected pool query in test: ${normalizedSql}`);
    });
  });

  test("orchestre la generation complete et persiste le rapport final", async () => {
    const onProgress = jest.fn();
    const session = {
      id_session: 9,
      nom: "Automne 2026",
      date_debut: "2026-09-01",
      date_fin: "2026-12-20",
    };
    const cours = [
      {
        id_cours: 1,
        code: "INF101",
        nom: "Programmation",
        duree: 3,
        programme: "INF",
        etape_etude: "1",
        type_salle: "Classe",
        est_cours_cle: 1,
        est_en_ligne: 0,
        max_etudiants_par_groupe: 30,
        min_etudiants_par_groupe: 1,
        sessions_par_semaine: 1,
        archive: 0,
      },
    ];
    const groupe = {
      nomGroupe: "G-INF-01",
      programme: "INF",
      etape: 1,
      etudiants: [101, 102],
      resume_reprises: [],
    };
    const affectationsEtudiantGroupe = new Map([
      [101, ["G-INF-01"]],
      [102, ["G-INF-01"]],
    ]);
    const placementPrincipal = {
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
      id_professeur: 11,
      id_salle: 5,
      id_groupe: 44,
      nom_groupe: "G-INF-01",
      date: "2026-09-07",
      heure_debut: "08:00:00",
      heure_fin: "11:00:00",
      est_en_ligne: false,
    };
    const placementGarantie = {
      ...placementPrincipal,
      date: "2026-09-14",
    };

    jest.spyOn(ContextLoader, "charger").mockResolvedValue({
      session,
      sessionSaison: "Automne",
      cours,
      professeurs: [
        { id_professeur: 11, matricule: "P-11", cours_ids: [1], nom: "Diallo" },
      ],
      salles: [{ id_salle: 5, code: "A-101", type: "Classe", capacite: 35 }],
      etudiants: [
        { id_etudiant: 101, matricule: "E-101", nom: "Diallo", prenom: "Aya" },
        { id_etudiant: 102, matricule: "E-102", nom: "Benali", prenom: "Youssef" },
      ],
      dispParProf: new Map(),
      absencesParProf: new Map(),
      indispoParSalle: new Map(),
      affectationsExistantes: [],
      echouesParEtudiant: new Map([[101, [{ id_cours: 1 }]]]),
    });
    jest.spyOn(GroupFormer, "formerGroupes").mockReturnValue({
      groupesFormes: [groupe],
      affectationsEtudiantGroupe,
    });
    jest.spyOn(GroupFormer, "lireEffectifProjeteMax").mockReturnValue(2);
    jest
      .spyOn(AvailabilityChecker, "genererJours")
      .mockReturnValue(["2026-09-07", "2026-09-14"]);
    jest
      .spyOn(CandidatePrecomputer, "buildCourseTimeCandidates")
      .mockReturnValue([{ debut: "08:00:00", fin: "11:00:00" }]);
    jest
      .spyOn(CoursePrioritySorter, "sortCoursesMostConstrainedFirst")
      .mockReturnValue(cours);
    jest.spyOn(SchedulerEngine, "_persisterGroupes").mockResolvedValue(
      new Map([["G-INF-01", 44]])
    );
    jest
      .spyOn(SchedulerEngine, "_detacherEtudiantsHorsSession")
      .mockResolvedValue();
    jest
      .spyOn(SchedulerEngine, "_mettreAJourGroupesEtudiants")
      .mockResolvedValue();
    jest.spyOn(SchedulerEngine, "_supprimerHoraireSession").mockResolvedValue();
    jest
      .spyOn(SchedulerEngine, "_supprimerGroupesVidesSession")
      .mockResolvedValue();
    jest
      .spyOn(SchedulerEngine, "_trouverSerieHebdomadaire")
      .mockReturnValue({ placements: [placementPrincipal] });
    jest
      .spyOn(SchedulerEngine, "_passeDeGarantieGroupes")
      .mockReturnValue({
        placementsGarantie: [placementGarantie],
        diagnosticsGarantie: [{ id_cours: 2, code: "INF102", raison: "Conflit" }],
      });
    jest
      .spyOn(FailedCourseEngine, "rattacherCoursEchoues")
      .mockReturnValue({
        affectations: [{ id_cours_echoue: 7, id_etudiant: 101, id_groupe: 44, id_cours: 1 }],
        conflits: [{ id_cours_echoue: 9, cours: { id_cours: 3 }, etudiants: [101] }],
        stats: { rattaches: 1, conflits: 1 },
      });
    jest
      .spyOn(SchedulerEngine, "_executerOptimisationLocaleLectureSeule")
      .mockReturnValue({
        placementsOptimises: [placementPrincipal, placementGarantie],
        scoringBefore: { modes: { equilibre: { scoreGlobal: 72 } } },
        scoringAfter: { modes: { equilibre: { scoreGlobal: 79 } } },
        improvementsRetained: 1,
        gains: { scoreGlobal: 7 },
        improvements: [{ type: "swap" }],
        fallbackLectureSeule: false,
        error: null,
      });
    jest
      .spyOn(SchedulerEngine, "_calculerScoreQualite")
      .mockReturnValue({ score: 93 });
    jest
      .spyOn(SchedulerEngine, "_persisterAffectationsIndividuellesReprises")
      .mockResolvedValue();
    jest
      .spyOn(SchedulerEngine, "_marquerCoursEchouesEnResolutionManuelle")
      .mockResolvedValue();
    jest
      .spyOn(SchedulerEngine, "_construireSnapshotRapportMetier")
      .mockReturnValue({ resume: "ok" });

    const rapport = await SchedulerEngine.generer({
      idSession: 9,
      idUtilisateur: 3,
      optimizationMode: "equilibre",
      onProgress,
    });

    expect(rapport.session).toEqual(session);
    expect(rapport.nb_cours_planifies).toBe(2);
    expect(rapport.nb_cours_non_planifies).toBe(1);
    expect(rapport.nb_cours_echoues_traites).toBe(1);
    expect(rapport.nb_resolutions_manuelles).toBe(1);
    expect(rapport.affectations).toHaveLength(2);
    expect(rapport.details.optimisation_locale.scoreApresOptimisationLocale).toBe(79);
    expect(onProgress).toHaveBeenCalledWith({
      phase: "DONE",
      message: "Generation terminee.",
      pct: 100,
    });
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO rapports_generation"),
      expect.any(Array)
    );
    const insertedPayload = JSON.parse(poolQueryMock.mock.calls[0][1][9]);
    expect(insertedPayload.rapport_metier).toEqual({ resume: "ok" });
    expect(insertedPayload.details.rapport_metier).toBeUndefined();
    expect(insertedPayload.details.reprises.conflits_details).toBeUndefined();
    expect(insertedPayload.resolutions_manuelles).toEqual([
      {
        id_cours_echoue: 9,
        id_etudiant: null,
        id_cours: null,
        code_cours: null,
        nom_cours: null,
        groupe_principal: null,
        nom_groupe: null,
        raison_code: null,
        raison: null,
        recommandation: null,
        groupes_tentes: [],
      },
    ]);
    expect(commitMock).toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalled();
  });

  test("ne fait pas echouer la generation si la persistance du rapport final casse", async () => {
    const session = {
      id_session: 9,
      nom: "Automne 2026",
      date_debut: "2026-09-01",
      date_fin: "2026-12-20",
    };
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    try {
      jest.spyOn(ContextLoader, "charger").mockResolvedValue({
        session,
        sessionSaison: "Automne",
        cours: [
          {
            id_cours: 1,
            code: "INF101",
            nom: "Programmation",
            duree: 3,
            programme: "INF",
            etape_etude: "1",
            type_salle: "Classe",
            est_cours_cle: 1,
            est_en_ligne: 0,
            max_etudiants_par_groupe: 30,
            min_etudiants_par_groupe: 1,
            sessions_par_semaine: 1,
            archive: 0,
          },
        ],
        professeurs: [{ id_professeur: 11, matricule: "P-11", cours_ids: [1], nom: "Diallo" }],
        salles: [{ id_salle: 5, code: "A-101", type: "Classe", capacite: 35 }],
        etudiants: [{ id_etudiant: 101, matricule: "E-101", nom: "Diallo", prenom: "Aya" }],
        dispParProf: new Map(),
        absencesParProf: new Map(),
        indispoParSalle: new Map(),
        affectationsExistantes: [],
        echouesParEtudiant: new Map(),
      });
      jest.spyOn(GroupFormer, "formerGroupes").mockReturnValue({
        groupesFormes: [{ nomGroupe: "G-INF-01", programme: "INF", etape: 1, etudiants: [101] }],
        affectationsEtudiantGroupe: new Map([[101, ["G-INF-01"]]]),
      });
      jest.spyOn(GroupFormer, "lireEffectifProjeteMax").mockReturnValue(1);
      jest.spyOn(AvailabilityChecker, "genererJours").mockReturnValue(["2026-09-07"]);
      jest
        .spyOn(CandidatePrecomputer, "buildCourseTimeCandidates")
        .mockReturnValue([{ debut: "08:00:00", fin: "11:00:00" }]);
      jest
        .spyOn(CoursePrioritySorter, "sortCoursesMostConstrainedFirst")
        .mockReturnValue([
          {
            id_cours: 1,
            code: "INF101",
            nom: "Programmation",
            duree: 3,
            programme: "INF",
            etape_etude: "1",
            type_salle: "Classe",
            est_cours_cle: 1,
            est_en_ligne: 0,
            max_etudiants_par_groupe: 30,
            min_etudiants_par_groupe: 1,
            sessions_par_semaine: 1,
            archive: 0,
          },
        ]);
      jest.spyOn(SchedulerEngine, "_persisterGroupes").mockResolvedValue(
        new Map([["G-INF-01", 44]])
      );
      jest
        .spyOn(SchedulerEngine, "_detacherEtudiantsHorsSession")
        .mockResolvedValue();
      jest
        .spyOn(SchedulerEngine, "_mettreAJourGroupesEtudiants")
        .mockResolvedValue();
      jest.spyOn(SchedulerEngine, "_supprimerHoraireSession").mockResolvedValue();
      jest
        .spyOn(SchedulerEngine, "_supprimerGroupesVidesSession")
        .mockResolvedValue();
      jest
        .spyOn(SchedulerEngine, "_trouverSerieHebdomadaire")
        .mockReturnValue({
          placements: [
            {
              id_cours: 1,
              code: "INF101",
              nom: "Programmation",
              id_professeur: 11,
              id_salle: 5,
              id_groupe: 44,
              nom_groupe: "G-INF-01",
              date: "2026-09-07",
              heure_debut: "08:00:00",
              heure_fin: "11:00:00",
              est_en_ligne: false,
            },
          ],
        });
      jest.spyOn(SchedulerEngine, "_passeDeGarantieGroupes").mockReturnValue({
        placementsGarantie: [],
        diagnosticsGarantie: [],
      });
      jest.spyOn(FailedCourseEngine, "rattacherCoursEchoues").mockReturnValue({
        affectations: [],
        conflits: [],
        stats: {},
      });
      jest
        .spyOn(SchedulerEngine, "_executerOptimisationLocaleLectureSeule")
        .mockReturnValue({
          placementsOptimises: [
            {
              id_cours: 1,
              code: "INF101",
              nom: "Programmation",
              id_professeur: 11,
              id_salle: 5,
              id_groupe: 44,
              nom_groupe: "G-INF-01",
              date: "2026-09-07",
              heure_debut: "08:00:00",
              heure_fin: "11:00:00",
              est_en_ligne: false,
            },
          ],
          scoringBefore: { modes: { equilibre: { scoreGlobal: 72 } } },
          scoringAfter: { modes: { equilibre: { scoreGlobal: 79 } } },
          improvementsRetained: 0,
          gains: { scoreGlobalDelta: 7 },
          improvements: [],
          fallbackLectureSeule: false,
          error: null,
        });
      jest
        .spyOn(SchedulerEngine, "_calculerScoreQualite")
        .mockReturnValue({ score: 93 });
      jest
        .spyOn(SchedulerEngine, "_persisterAffectationsIndividuellesReprises")
        .mockResolvedValue();
      jest
        .spyOn(SchedulerEngine, "_persisterAffectationsIndividuellesDernierRecours")
        .mockResolvedValue();
      jest
        .spyOn(SchedulerEngine, "_marquerCoursEchouesEnResolutionManuelle")
        .mockResolvedValue();
      jest
        .spyOn(SchedulerEngine, "_construireSnapshotRapportMetier")
        .mockReturnValue({ resume: "ok" });
      poolQueryMock.mockRejectedValueOnce(new Error("read ECONNRESET"));

      const rapport = await SchedulerEngine.generer({
        idSession: 9,
        idUtilisateur: 3,
        optimizationMode: "equilibre",
      });

      expect(rapport.nb_cours_planifies).toBe(1);
      expect(rapport.details.avertissement_persistance_rapport).toBe("read ECONNRESET");
      expect(commitMock).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("annule la transaction quand aucun cours actif n'est disponible", async () => {
    jest.spyOn(ContextLoader, "charger").mockResolvedValue({
      session: {
        id_session: 1,
        nom: "Automne 2026",
        date_debut: "2026-09-01",
        date_fin: "2026-12-20",
      },
      sessionSaison: "Automne",
      cours: [],
      professeurs: [{ id_professeur: 11 }],
      salles: [],
      etudiants: [],
      dispParProf: new Map(),
      absencesParProf: new Map(),
      indispoParSalle: new Map(),
      affectationsExistantes: [],
      echouesParEtudiant: new Map(),
    });

    await expect(SchedulerEngine.generer()).rejects.toThrow(
      "Aucun cours actif. Ajoutez d'abord les cours de la session."
    );

    expect(rollbackMock).toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalled();
    expect(commitMock).not.toHaveBeenCalled();
  });
});
