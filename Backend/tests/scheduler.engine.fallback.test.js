import { beforeEach, describe, expect, test } from "@jest/globals";
import { ConstraintMatrix } from "../src/services/scheduler/ConstraintMatrix.js";
import { SchedulerEngine } from "../src/services/scheduler/SchedulerEngine.js";

function createIndexes() {
  return {
    chargeSeriesParProf: new Map(),
    chargeSeriesParJour: new Map(),
    chargeSeriesParGroupeJour: new Map(),
    chargeSeriesParProfJour: new Map(),
    slotsParGroupeJour: new Map(),
    slotsParProfJour: new Map(),
  };
}

function createBaseFixture() {
  return {
    cours: {
      id_cours: 101,
      code: "INF101",
      nom: "Programmation",
      programme: "Programmation informatique",
      etape_etude: "1",
      type_salle: "Laboratoire",
      est_cours_cle: 1,
      est_en_ligne: 0,
      duree: 3,
    },
    groupe: {
      nomGroupe: "GPI-E1-1",
      programme: "Programmation informatique",
      etape: 1,
      etudiants: [1, 2, 3],
      etudiants_par_cours: { 101: [1, 2, 3] },
    },
    idGroupe: 1,
    professeurs: [
      { id_professeur: 10, nom: "Tremblay", prenom: "Sophie", specialite: "Programmation informatique" },
    ],
    salles: [
      { id_salle: 5, code: "LAB201", type: "Laboratoire", capacite: 30 },
    ],
    datesParJourSemaine: new Map([[1, ["2026-09-07", "2026-09-14"]]]),
    creneaux: [{ debut: "08:00:00", fin: "11:00:00", slotStartIndex: 0, slotEndIndex: 3 }],
    matrix: new ConstraintMatrix(),
    dispParProf: new Map(),
    absencesParProf: new Map(),
    indispoParSalle: new Map(),
  };
}

describe("SchedulerEngine fallback paths", () => {
  let previousOnlineEnv;

  beforeEach(() => {
    previousOnlineEnv = process.env.ENABLE_ONLINE_COURSES;
    delete process.env.ENABLE_ONLINE_COURSES;
  });

  afterEach(() => {
    if (previousOnlineEnv === undefined) {
      delete process.env.ENABLE_ONLINE_COURSES;
    } else {
      process.env.ENABLE_ONLINE_COURSES = previousOnlineEnv;
    }
  });

  test("_trouverSerieAssouplie retourne null pour un cours en ligne si l'option est desactivee", () => {
    const fixture = createBaseFixture();
    process.env.ENABLE_ONLINE_COURSES = "false";

    const result = SchedulerEngine._trouverSerieAssouplie({
      ...fixture,
      cours: { ...fixture.cours, est_en_ligne: 1 },
      ...createIndexes(),
      effectifGroupe: 3,
    });

    expect(result).toBeNull();
  });

  test("_trouverSerieAssouplie ne convertit plus un cours presentiel en cours en ligne", () => {
    const fixture = createBaseFixture();

    const result = SchedulerEngine._trouverSerieAssouplie({
      ...fixture,
      salles: [],
      ...createIndexes(),
      effectifGroupe: 3,
    });

    expect(result).toBeNull();
  });

  test("_reserverSerie reserve les ressources et met a jour les index", () => {
    const fixture = createBaseFixture();
    const indexes = createIndexes();

    const result = SchedulerEngine._reserverSerie({
      cours: fixture.cours,
      groupe: fixture.groupe,
      idGroupe: fixture.idGroupe,
      professeur: fixture.professeurs[0],
      salle: fixture.salles[0],
      datesSerie: ["2026-09-07", "2026-09-14"],
      creneau: fixture.creneaux[0],
      matrix: fixture.matrix,
      ...indexes,
      jourSemaine: 1,
    });

    expect(result.placements).toHaveLength(2);
    expect(indexes.chargeSeriesParProf.get(10)).toBe(1);
    expect(indexes.chargeSeriesParJour.get(1)).toBe(1);
    expect(fixture.matrix.profLibre(10, "2026-09-07", "08:00:00", "11:00:00")).toBe(false);
  });

  test("_reserverSerieFallback cree des placements en ligne si necessaire", () => {
    const fixture = createBaseFixture();
    const indexes = createIndexes();

    const result = SchedulerEngine._reserverSerieFallback({
      cours: fixture.cours,
      groupe: fixture.groupe,
      idGroupe: fixture.idGroupe,
      prof: fixture.professeurs[0],
      datesSerie: ["2026-09-07"],
      creneau: fixture.creneaux[0],
      matrix: fixture.matrix,
      salle: fixture.salles[0],
      estEnLigne: true,
      ...indexes,
      jourSemaine: 1,
      slotIdx: 0,
    });

    expect(result.placements[0]).toMatchObject({
      code_salle: "EN LIGNE",
      est_en_ligne: true,
    });
  });

  test("_reserverCandidatAssoupli delegue au mode uniforme", () => {
    const fixture = createBaseFixture();
    const indexes = createIndexes();

    const result = SchedulerEngine._reserverCandidatAssoupli({
      reservationType: "uniforme",
      cours: fixture.cours,
      groupe: fixture.groupe,
      idGroupe: fixture.idGroupe,
      prof: fixture.professeurs[0],
      datesSerie: ["2026-09-07"],
      creneau: fixture.creneaux[0],
      matrix: fixture.matrix,
      salle: fixture.salles[0],
      estEnLigne: false,
      ...indexes,
      jourSemaine: 1,
      slotIdx: 0,
    });

    expect(result.placements).toHaveLength(1);
    expect(result.placements[0].code_salle).toBe("LAB201");
  });

  test("_reserverCandidatAssoupli reserve un payload a placements preconstruits", () => {
    const fixture = createBaseFixture();
    const indexes = createIndexes();

    const placements = [
      {
        id_cours: fixture.cours.id_cours,
        code_cours: fixture.cours.code,
        nom_cours: fixture.cours.nom,
        id_professeur: 10,
        id_salle: null,
        id_groupe: 1,
        date: "2026-09-07",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
        slotStartIndex: 0,
        slotEndIndex: 3,
      },
    ];

    const result = SchedulerEngine._reserverCandidatAssoupli({
      reservationType: "placements",
      placements,
      professeur: fixture.professeurs[0],
      salle: null,
      jourSemaine: 1,
      matrix: fixture.matrix,
      ...indexes,
      slotIdx: 0,
      cours: fixture.cours,
      groupe: fixture.groupe,
    });

    expect(result.placements).toEqual(placements);
    expect(indexes.chargeSeriesParProf.get(10)).toBe(1);
    expect(indexes.chargeSeriesParJour.get(1)).toBe(1);
  });

  test("_diagnosticPrecis detecte l'absence de professeur compatible", () => {
    const fixture = createBaseFixture();

    const diagnostic = SchedulerEngine._diagnosticPrecis({
      ...fixture,
      professeurs: [],
    });

    expect(diagnostic.raison_code).toBe("AUCUN_PROFESSEUR_COMPATIBLE");
  });

  test("_diagnosticPrecis detecte l'absence de salle compatible", () => {
    const fixture = createBaseFixture();

    const diagnostic = SchedulerEngine._diagnosticPrecis({
      ...fixture,
      salles: [],
    });

    expect(diagnostic.raison_code).toBe("SALLE_INSUFFISANTE");
  });

  test("_diagnosticPrecis detecte des etudiants occupes", () => {
    const fixture = createBaseFixture();
    fixture.matrix.reserver(
      20,
      99,
      "GX",
      201,
      "2026-09-07",
      "08:00:00",
      "11:00:00",
      { studentIds: [1, 2, 3] }
    );
    fixture.matrix.reserver(
      20,
      99,
      "GY",
      201,
      "2026-09-14",
      "08:00:00",
      "11:00:00",
      { studentIds: [1, 2, 3] }
    );

    const diagnostic = SchedulerEngine._diagnosticPrecis(fixture);

    expect(diagnostic.raison_code).toBe("ETUDIANTS_OCCUPES");
  });

  test("_diagnosticPrecis detecte des professeurs occupes sur tous les creneaux", () => {
    const fixture = createBaseFixture();
    fixture.matrix.reserver(
      20,
      10,
      "GX",
      201,
      "2026-09-07",
      "08:00:00",
      "11:00:00",
      { studentIds: [] }
    );
    fixture.matrix.reserver(
      20,
      10,
      "GY",
      201,
      "2026-09-14",
      "08:00:00",
      "11:00:00",
      { studentIds: [] }
    );

    const diagnostic = SchedulerEngine._diagnosticPrecis(fixture);

    expect(diagnostic.raison_code).toBe("PROFESSEURS_SATURES");
  });

  test("_diagnosticPrecis detecte des salles occupees sur tous les creneaux", () => {
    const fixture = createBaseFixture();
    fixture.matrix.reserver(
      5,
      99,
      "GX",
      201,
      "2026-09-07",
      "08:00:00",
      "11:00:00",
      { studentIds: [] }
    );
    fixture.matrix.reserver(
      5,
      99,
      "GY",
      201,
      "2026-09-14",
      "08:00:00",
      "11:00:00",
      { studentIds: [] }
    );

    const diagnostic = SchedulerEngine._diagnosticPrecis(fixture);

    expect(diagnostic.raison_code).toBe("SALLES_SATUREES");
  });
});
