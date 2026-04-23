import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ResourceDayPlacementIndex } from "../src/services/scheduler/constraints/ResourceDayPlacementIndex.js";
import { SchedulerEngine } from "../src/services/scheduler/SchedulerEngine.js";
import { LocalSearchOptimizer } from "../src/services/scheduler/optimization/LocalSearchOptimizer.js";
import { ScheduleScorer } from "../src/services/scheduler/scoring/ScheduleScorer.js";

describe("SchedulerEngine helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("_enregistrerMeilleurCandidatSerie garde le meilleur score", () => {
    const initial = SchedulerEngine._enregistrerMeilleurCandidatSerie({
      meilleurCandidat: null,
      score: 12,
      payload: { id: "A" },
    });
    const retained = SchedulerEngine._enregistrerMeilleurCandidatSerie({
      meilleurCandidat: initial,
      score: 15,
      payload: { id: "B" },
    });
    const replaced = SchedulerEngine._enregistrerMeilleurCandidatSerie({
      meilleurCandidat: retained,
      score: 11,
      payload: { id: "C" },
    });

    expect(initial).toEqual({ score: 12, payload: { id: "A" } });
    expect(retained).toEqual({ score: 15, payload: { id: "B" } });
    expect(replaced).toBe(retained);
  });

  test("_lireEtudiantsCours fusionne et deduplique les etudiants", () => {
    expect(
      SchedulerEngine._lireEtudiantsCours(
        {
          etudiants: [1, "2", 2, null, -4],
          etudiants_par_cours: {
            15: [2, "3", 4, 0],
          },
        },
        15
      )
    ).toEqual([1, 2, 3, 4]);
  });

  test("_normaliserCreneauCandidate fournit un fallback coherent", () => {
    expect(SchedulerEngine._normaliserCreneauCandidate(null, 3)).toEqual({
      debut: "",
      fin: "",
      heure_debut: "",
      heure_fin: "",
      slotStartIndex: 3,
      slotEndIndex: 4,
      dureeHeures: 1,
    });
  });

  test("_normaliserCreneauCandidate derive les index et heures depuis la grille", () => {
    const creneau = SchedulerEngine._normaliserCreneauCandidate({
      debut: "08:00:00",
      fin: "11:00:00",
    });

    expect(creneau.heure_debut).toBe("08:00:00");
    expect(creneau.heure_fin).toBe("11:00:00");
    expect(creneau.slotEndIndex).toBeGreaterThan(creneau.slotStartIndex);
    expect(creneau.dureeHeures).toBeGreaterThanOrEqual(1);
  });

  test("_normaliserCreneauxCours reutilise les creneaux donnes quand ils sont complets", () => {
    const creneaux = SchedulerEngine._normaliserCreneauxCours(
      { duree: 3 },
      [
        {
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          slotStartIndex: 0,
          slotEndIndex: 3,
        },
      ]
    );

    expect(creneaux).toHaveLength(1);
    expect(creneaux[0].slotEndIndex).toBe(3);
  });

  test("_progress appelle le callback si present", () => {
    const callback = jest.fn();

    SchedulerEngine._progress(callback, "phase-x", "message", 55);
    SchedulerEngine._progress(null, "phase-y", "ignored", 0);

    expect(callback).toHaveBeenCalledWith({
      phase: "phase-x",
      message: "message",
      pct: 55,
    });
  });

  test("_indexerDatesParJourSemaine groupe les dates par jour ISO", () => {
    const index = SchedulerEngine._indexerDatesParJourSemaine([
      "2026-09-07",
      "2026-09-08",
      "2026-09-14",
    ]);

    expect(index.get(1)).toEqual(["2026-09-07", "2026-09-14"]);
    expect(index.get(2)).toEqual(["2026-09-08"]);
  });

  test("_incrementerChargeJour, _lireChargeJour et _compterJoursActifs cooperent", () => {
    const index = new Map();

    SchedulerEngine._incrementerChargeJour(index, 10, 1);
    SchedulerEngine._incrementerChargeJour(index, 10, 1);
    SchedulerEngine._incrementerChargeJour(index, 10, 3);

    expect(SchedulerEngine._lireChargeJour(index, 10, 1)).toBe(2);
    expect(SchedulerEngine._lireChargeJour(index, 10, 2)).toBe(0);
    expect(SchedulerEngine._compterJoursActifs(index, 10)).toBe(2);
  });

  test("_ordonnerJoursPourGroupe privilegie les jours peu charges", () => {
    const chargeSeriesParJour = new Map([
      [1, 4],
      [2, 1],
      [3, 2],
    ]);
    const chargeSeriesParGroupeJour = new Map([
      ["G1", new Map([[1, 1]])],
    ]);

    const ordered = SchedulerEngine._ordonnerJoursPourGroupe({
      datesParJourSemaine: new Map([
        [1, ["2026-09-07"]],
        [2, ["2026-09-08"]],
        [3, ["2026-09-09"]],
      ]),
      idGroupe: "G1",
      chargeSeriesParJour,
      chargeSeriesParGroupeJour,
    });

    expect(ordered[0]).toBe(1);
    expect(ordered).toContain(2);
    expect(ordered).toContain(3);
  });

  test("_memoriserSlotJour et _lireSlotsJour conservent les index de slots", () => {
    const index = new Map();

    SchedulerEngine._memoriserSlotJour(index, "G1", 1, 2, 5);

    expect([...SchedulerEngine._lireSlotsJour(index, "G1", 1)]).toEqual([2, 3, 4]);
  });

  test("_ordonnerCreneauxPourGroupeJour rapproche les creneaux existants", () => {
    const slotsParGroupeJour = new Map([
      ["G1", new Map([[1, new Set([2])]])],
    ]);

    const ordered = SchedulerEngine._ordonnerCreneauxPourGroupeJour(
      [
        { debut: "14:00:00", fin: "17:00:00", slotStartIndex: 4, slotEndIndex: 7 },
        { debut: "11:00:00", fin: "14:00:00", slotStartIndex: 2, slotEndIndex: 5 },
      ],
      slotsParGroupeJour,
      "G1",
      1
    );

    expect(ordered[0].slotStartIndex).toBe(2);
    expect(ordered[1].slotStartIndex).toBe(4);
  });

  test("_ordonnerCreneauxPourProfesseurJour rapproche les creneaux existants", () => {
    const slotsParProfJour = new Map([
      ["10", new Map([[2, new Set([4])]])],
    ]);

    const ordered = SchedulerEngine._ordonnerCreneauxPourProfesseurJour(
      [
        { debut: "08:00:00", fin: "11:00:00", slotStartIndex: 0, slotEndIndex: 3 },
        { debut: "14:00:00", fin: "17:00:00", slotStartIndex: 4, slotEndIndex: 7 },
      ],
      [],
      slotsParProfJour,
      10,
      2
    );

    expect(ordered[0].slotStartIndex).toBe(4);
    expect(ordered[1].slotStartIndex).toBe(0);
  });

  test("_respectePauseRessources et _memoriserPlacementsRessources collaborent", () => {
    const resourcePlacementIndex = new ResourceDayPlacementIndex();
    const placements = [
      {
        date: "2026-09-07",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
      },
      {
        date: "2026-09-07",
        heure_debut: "14:00:00",
        heure_fin: "17:00:00",
      },
    ];

    SchedulerEngine._memoriserPlacementsRessources({
      resourcePlacementIndex,
      placements,
      professeurId: 10,
      groupeId: 1,
      studentIds: [101],
    });

    const respects = SchedulerEngine._respectePauseRessources({
      resourcePlacementIndex,
      proposedPlacement: {
        date: "2026-09-07",
        heure_debut: "11:00:00",
        heure_fin: "14:00:00",
      },
      professeurId: 10,
      groupeId: 1,
      studentIds: [101],
    });

    expect(respects).toBe(false);
    expect(
      resourcePlacementIndex.get({
        resourceType: "professeur",
        resourceId: 10,
        date: "2026-09-07",
      })
    ).toHaveLength(2);
  });

  test("_safeNum et _construireSnapshotRapportMetier produisent un snapshot lisible", () => {
    expect(SchedulerEngine._safeNum("12")).toBe(12);
    expect(SchedulerEngine._safeNum("x", 7)).toBe(7);

    const snapshot = SchedulerEngine._construireSnapshotRapportMetier({
      etudiants: [
        { id_etudiant: 1, matricule: "E-1", nom: "Diallo", prenom: "Aya" },
      ],
      affectationsEtudiantGroupe: new Map([[1, ["G-INF-01"]]]),
      groupesFormes: [{ nomGroupe: "G-INF-01", programme: "INF", etape: 1 }],
      nonPlanifies: [
        {
          id_cours: 5,
          code: "INF205",
          nom: "Reseaux",
          groupe: "G-INF-01",
          raison_code: "PROFESSEURS_SATURES",
          raison: "Charge max",
        },
      ],
      conflitsReprises: [
        {
          id_etudiant: 1,
          code_cours: "MAT201",
          nom_cours: "Stats",
          raison_code: "CONFLIT_HORAIRE",
          raison: "Collision",
        },
      ],
    });

    expect(snapshot.reprises_non_resolues[0]).toMatchObject({
      matricule: "E-1",
      groupe_principal: "G-INF-01",
      code_cours: "MAT201",
    });
    expect(snapshot.cours_non_planifies[0]).toMatchObject({
      programme: "INF",
      etape: 1,
      code: "INF205",
    });
  });

  test("_calculerScoringLectureSeule et _executerOptimisationLocaleLectureSeule couvrent le chemin nominal", () => {
    const scoreSpy = jest
      .spyOn(ScheduleScorer, "scoreAllModes")
      .mockReturnValue({ version: "v1", modes: { equilibre: { scoreGlobal: 80 } } });
    const optimizeSpy = jest
      .spyOn(LocalSearchOptimizer, "optimize")
      .mockReturnValue({
        placementsOptimises: [{ id: 1 }],
        scoringBefore: { version: "v1" },
        scoringAfter: { version: "v1" },
        improvements: [],
        improvementsRetained: 0,
        gains: {},
      });

    try {
      expect(SchedulerEngine._calculerScoringLectureSeule({ placements: [] })).toEqual({
        version: "v1",
        modes: { equilibre: { scoreGlobal: 80 } },
      });

      const result = SchedulerEngine._executerOptimisationLocaleLectureSeule({
        placements: [{ id: 1 }],
      });

      expect(result.fallbackLectureSeule).toBe(false);
      expect(result.error).toBeNull();
      expect(result.placementsOptimises).toEqual([{ id: 1 }]);
    } finally {
      scoreSpy.mockRestore();
      optimizeSpy.mockRestore();
    }
  });

  test("_chargerSession retourne la session ou null", async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id_session: 4, nom: "Automne 2026" }]])
        .mockResolvedValueOnce([[]]),
    };

    await expect(SchedulerEngine._chargerSession(4, executor)).resolves.toEqual({
      id_session: 4,
      nom: "Automne 2026",
    });
    await expect(SchedulerEngine._chargerSession(7, executor)).resolves.toBeNull();
  });

  test("_persisterGroupes met a jour ou cree les groupes", async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id_groupes_etudiants: 12 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 99 }]),
    };

    const result = await SchedulerEngine._persisterGroupes(
      [
        {
          nomGroupe: "G-INF-01",
          taille_max: 28,
          est_groupe_special: false,
          programme: "INF",
          etape: 1,
        },
        {
          nomGroupe: "G-INF-02",
          taille_max: 30,
          est_groupe_special: true,
          programme: "INF",
          etape: 2,
        },
      ],
      4,
      connection
    );

    expect(result.get("G-INF-01")).toBe(12);
    expect(result.get("G-INF-02")).toBe(99);
  });

  test("_attacherGroupesAuxPlacements persiste les groupes supplementaires puis rattache les placements", async () => {
    const connection = { query: jest.fn() };
    const persisterSpy = jest
      .spyOn(SchedulerEngine, "_persisterGroupes")
      .mockResolvedValue(new Map([["G-INF-NEW", 55]]));

    try {
      const placements = [
        {
          nom_groupe: "G-INF-OLD",
          id_groupe: null,
          groupe_a_persister: { nomGroupe: "G-INF-NEW" },
        },
        {
          nom_groupe: "G-INF-OLD",
          id_groupe: null,
        },
      ];
      const idGroupeParNom = new Map([["G-INF-OLD", 22]]);

      await SchedulerEngine._attacherGroupesAuxPlacements(
        placements,
        idGroupeParNom,
        4,
        connection
      );

      expect(placements[0].id_groupe).toBe(55);
      expect(placements[1].id_groupe).toBe(22);
    } finally {
      persisterSpy.mockRestore();
    }
  });

  test("_mettreAJourGroupesEtudiants met a jour le groupe principal des etudiants", async () => {
    const connection = { query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };

    await SchedulerEngine._mettreAJourGroupesEtudiants(
      new Map([
        [1, ["G-INF-01"]],
        [2, []],
      ]),
      new Map([["G-INF-01", 44]]),
      connection
    );

    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE etudiants"),
      [44, 1]
    );
  });

  test("_detacherEtudiantsHorsSession saute si les parametres sont incomplets", async () => {
    const connection = { query: jest.fn() };

    await SchedulerEngine._detacherEtudiantsHorsSession(null, "Automne", connection);
    await SchedulerEngine._detacherEtudiantsHorsSession(4, "", connection);

    expect(connection.query).not.toHaveBeenCalled();
  });

  test("_supprimerHoraireSession execute le nettoyage sans echouer sur warning", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockRejectedValueOnce(new Error("delete fail")),
    };

    try {
      await SchedulerEngine._supprimerHoraireSession(4, connection);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("_supprimerGroupesVidesSession injecte la clause de preservation des noms", async () => {
    const connection = { query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };

    await SchedulerEngine._supprimerGroupesVidesSession(4, ["G-INF-01"], connection);

    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining("NOT IN (?)"),
      [4, "G-INF-01"]
    );
  });

  test("_persisterAffectationsIndividuellesReprises ignore les lignes invalides et persiste les valides", async () => {
    const connection = { query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };

    await SchedulerEngine._persisterAffectationsIndividuellesReprises(
      [
        { id_cours_echoue: 0, id_etudiant: 1, id_groupe: 2, id_cours: 3 },
        { id_cours_echoue: 7, id_etudiant: 1, id_groupe: 2, id_cours: 3 },
      ],
      4,
      connection
    );

    expect(connection.query).toHaveBeenCalledTimes(2);
  });

  test("_marquerCoursEchouesEnResolutionManuelle couvre les deux formes de resolution", async () => {
    const connection = { query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };

    await SchedulerEngine._marquerCoursEchouesEnResolutionManuelle(
      [
        { id_cours_echoue: 9 },
        { cours: { id_cours: 4 }, etudiants: [1, 2] },
        { cours: { id_cours: null }, etudiants: [] },
      ],
      4,
      connection
    );

    expect(connection.query).toHaveBeenCalledTimes(2);
    expect(connection.query.mock.calls[1][1]).toEqual([4, 4, 1, 2]);
  });

  test("_passeDeGarantieGroupes ajoute des placements via la passe assouplie", () => {
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    const assouplieSpy = jest
      .spyOn(SchedulerEngine, "_trouverSerieAssouplie")
      .mockReturnValue({
        placements: [
          {
            id_cours: 2,
            code: "INF102",
            id_groupe: 44,
            nom_groupe: "G-INF-01",
            date: "2026-09-08",
            heure_debut: "12:00:00",
            heure_fin: "15:00:00",
          },
        ],
      });

    try {
      const result = SchedulerEngine._passeDeGarantieGroupes({
        solution: [
          {
            id_cours: 1,
            id_groupe: 44,
            nom_groupe: "G-INF-01",
          },
        ],
        cours: [
          { id_cours: 1, code: "INF101", programme: "INF", etape_etude: "1" },
          { id_cours: 2, code: "INF102", programme: "INF", etape_etude: "1" },
        ],
        groupesFormes: [
          {
            nomGroupe: "G-INF-01",
            programme: "INF",
            etape: 1,
            etudiants: [1, 2],
          },
        ],
        idGroupeParNom: new Map([["G-INF-01", 44]]),
        professeurs: [],
        salles: [],
        datesParJourSemaine: new Map([[2, ["2026-09-08"]]]),
        creneaux: [{ debut: "12:00:00", fin: "15:00:00" }],
        matrix: {},
        dispParProf: new Map(),
        absencesParProf: new Map(),
        indispoParSalle: new Map(),
        chargeSeriesParProf: new Map(),
        chargeSeriesParJour: new Map(),
        chargeSeriesParGroupeJour: new Map(),
        chargeSeriesParProfJour: new Map(),
        slotsParGroupeJour: new Map(),
        slotsParProfJour: new Map(),
      });

      expect(result.placementsGarantie).toHaveLength(1);
      expect(result.diagnosticsGarantie).toHaveLength(0);
      expect(assouplieSpy).toHaveBeenCalled();
    } finally {
      infoSpy.mockRestore();
      assouplieSpy.mockRestore();
    }
  });

  test("_passeDeGarantieGroupes remonte un diagnostic quand aucun placement n'est possible", () => {
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const assouplieSpy = jest
      .spyOn(SchedulerEngine, "_trouverSerieAssouplie")
      .mockReturnValue(null);
    const diagnosticSpy = jest
      .spyOn(SchedulerEngine, "_diagnosticPrecis")
      .mockReturnValue({
        raison: "Professeurs satures.",
        raison_code: "PROFESSEURS_SATURES",
        suggestion: "Ajouter un professeur.",
      });

    try {
      const result = SchedulerEngine._passeDeGarantieGroupes({
        solution: [],
        cours: [
          { id_cours: 1, code: "INF101", nom: "Algo", programme: "INF", etape_etude: "1" },
        ],
        groupesFormes: [
          {
            nomGroupe: "G-INF-01",
            programme: "INF",
            etape: 1,
            etudiants: [1, 2],
          },
        ],
        idGroupeParNom: new Map([["G-INF-01", 44]]),
        professeurs: [],
        salles: [],
        datesParJourSemaine: new Map([[2, ["2026-09-08"]]]),
        creneaux: [{ debut: "12:00:00", fin: "15:00:00" }],
        matrix: {},
        dispParProf: new Map(),
        absencesParProf: new Map(),
        indispoParSalle: new Map(),
        chargeSeriesParProf: new Map(),
        chargeSeriesParJour: new Map(),
        chargeSeriesParGroupeJour: new Map(),
        chargeSeriesParProfJour: new Map(),
        slotsParGroupeJour: new Map(),
        slotsParProfJour: new Map(),
      });

      expect(result.placementsGarantie).toHaveLength(0);
      expect(result.diagnosticsGarantie[0]).toMatchObject({
        id_cours: 1,
        code: "INF101",
        groupe: "G-INF-01",
        raison_code: "GARANTIE_PROFESSEURS_SATURES",
      });
      expect(warnSpy).toHaveBeenCalled();
      expect(diagnosticSpy).toHaveBeenCalled();
    } finally {
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      assouplieSpy.mockRestore();
      diagnosticSpy.mockRestore();
    }
  });
});
