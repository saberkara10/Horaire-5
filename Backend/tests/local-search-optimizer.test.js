/**
 * Tests de LocalSearchOptimizer
 *
 * Ces tests verifient que l'optimisation locale :
 * - n'introduit pas de conflit
 * - ameliore bien le score sur des cas simples
 * - reste neutre en mode legacy
 */

import { describe, expect, test } from "@jest/globals";
import { ConstraintMatrix } from "../src/services/scheduler/ConstraintMatrix.js";
import { LocalSearchOptimizer } from "../src/services/scheduler/optimization/LocalSearchOptimizer.js";

/**
 * Construit un placement de test.
 *
 * @param {Object} overrides - valeurs a surcharger.
 * @returns {Object} Placement complet.
 */
function buildPlacement(overrides = {}) {
  return {
    id_cours: 101,
    code_cours: "INF101",
    nom_cours: "Intro",
    id_professeur: 10,
    nom_professeur: "Jane Doe",
    id_salle: 1,
    code_salle: "S1",
    id_groupe: 1,
    nom_groupe: "G1",
    date: "2026-09-07",
    heure_debut: "08:00:00",
    heure_fin: "11:00:00",
    est_en_ligne: false,
    est_cours_cle: true,
    est_groupe_special: false,
    ...overrides,
  };
}

/**
 * Construit le jeu de donnees minimal pour l'optimiseur local.
 *
 * @returns {Object} Jeu de test coherent.
 */
function buildOptimizationFixture() {
  const placements = [
    buildPlacement({ id_cours: 101, code_cours: "INF101", date: "2026-09-07" }),
    buildPlacement({ id_cours: 101, code_cours: "INF101", date: "2026-09-14" }),
    buildPlacement({
      id_cours: 102,
      code_cours: "INF102",
      nom_cours: "Algo",
      date: "2026-09-07",
      heure_debut: "17:00:00",
      heure_fin: "20:00:00",
    }),
    buildPlacement({
      id_cours: 102,
      code_cours: "INF102",
      nom_cours: "Algo",
      date: "2026-09-14",
      heure_debut: "17:00:00",
      heure_fin: "20:00:00",
    }),
    buildPlacement({
      id_cours: 103,
      code_cours: "INF103",
      nom_cours: "BDD",
      date: "2026-09-09",
    }),
    buildPlacement({
      id_cours: 103,
      code_cours: "INF103",
      nom_cours: "BDD",
      date: "2026-09-16",
    }),
  ];

  const courses = [
    { id_cours: 101, code: "INF101", nom: "Intro", type_salle: "Salle de cours", est_en_ligne: false },
    { id_cours: 102, code: "INF102", nom: "Algo", type_salle: "Salle de cours", est_en_ligne: false },
    { id_cours: 103, code: "INF103", nom: "BDD", type_salle: "Salle de cours", est_en_ligne: false },
  ];
  const students = [1, 2, 3];
  const matrix = new ConstraintMatrix();

  for (const placement of placements) {
    matrix.reserver(
      placement.id_salle,
      placement.id_professeur,
      placement.id_groupe,
      placement.id_cours,
      placement.date,
      placement.heure_debut,
      placement.heure_fin,
      { studentIds: students }
    );
  }

  return {
    placements,
    courses,
    matrix,
    groupesFormes: [
      {
        id_groupe: 1,
        nomGroupe: "G1",
        etudiants: students,
        effectif_regulier: students.length,
        charge_estimee_par_cours: {},
      },
    ],
    affectationsEtudiantGroupe: new Map(students.map((studentId) => [studentId, ["G1"]])),
    affectationsReprises: [],
    salles: [
      { id_salle: 1, code: "S1", type: "Salle de cours", capacite: 30 },
      { id_salle: 2, code: "S2", type: "Salle de cours", capacite: 32 },
    ],
    datesParJourSemaine: new Map([
      [1, ["2026-09-07", "2026-09-14"]],
      [2, ["2026-09-08", "2026-09-15"]],
      [3, ["2026-09-09", "2026-09-16"]],
      [4, ["2026-09-10", "2026-09-17"]],
      [5, ["2026-09-11", "2026-09-18"]],
    ]),
    dispParProf: new Map(),
    absencesParProf: new Map(),
    indispoParSalle: new Map(),
    students,
  };
}

/**
 * Verifie qu'un horaire reste faisable pour un groupe et un professeur.
 *
 * @param {Object[]} placements - horaire a verifier.
 * @param {number[]} students - etudiants du groupe.
 */
function expectScheduleToStayFeasible(placements, students) {
  const matrix = new ConstraintMatrix();

  for (const placement of placements) {
    expect(
      matrix.profLibre(
        placement.id_professeur,
        placement.date,
        placement.heure_debut,
        placement.heure_fin
      )
    ).toBe(true);
    expect(
      matrix.groupeLibre(
        placement.id_groupe,
        placement.date,
        placement.heure_debut,
        placement.heure_fin
      )
    ).toBe(true);
    expect(
      matrix.etudiantsLibres(
        students,
        placement.date,
        placement.heure_debut,
        placement.heure_fin
      )
    ).toBe(true);

    matrix.reserver(
      placement.id_salle,
      placement.id_professeur,
      placement.id_groupe,
      placement.id_cours,
      placement.date,
      placement.heure_debut,
      placement.heure_fin,
      { studentIds: students }
    );
  }
}

/**
 * Normalise un horaire en sequence de cles stables.
 *
 * @param {Object[]} placements - horaire a normaliser.
 * @returns {string[]} Cles triees.
 */
function normalizePlacementKeys(placements) {
  return [...placements]
    .map(
      (placement) =>
        [
          placement.id_cours,
          placement.date,
          placement.heure_debut,
          placement.heure_fin,
          placement.id_professeur,
          placement.id_groupe,
          placement.id_salle,
        ].join("|")
    )
    .sort((left, right) => left.localeCompare(right, "fr"));
}

describe("LocalSearchOptimizer", () => {
  test("ameliore un horaire etudiant fragmente sans introduire de conflit", () => {
    const fixture = buildOptimizationFixture();

    const result = LocalSearchOptimizer.optimize({
      placements: fixture.placements,
      cours: fixture.courses,
      groupesFormes: fixture.groupesFormes,
      affectationsEtudiantGroupe: fixture.affectationsEtudiantGroupe,
      affectationsReprises: fixture.affectationsReprises,
      salles: fixture.salles,
      datesParJourSemaine: fixture.datesParJourSemaine,
      matrix: fixture.matrix,
      dispParProf: fixture.dispParProf,
      absencesParProf: fixture.absencesParProf,
      indispoParSalle: fixture.indispoParSalle,
      optimizationMode: "etudiant",
    });

    expect(result.improvementsRetained).toBeGreaterThan(0);
    expect(
      result.scoringAfter.modes.etudiant.scoreGlobal
    ).toBeGreaterThan(result.scoringBefore.modes.etudiant.scoreGlobal);
    expectScheduleToStayFeasible(result.placementsOptimises, fixture.students);
  });

  test("ameliore aussi le confort professeur sur une amplitude excessive", () => {
    const fixture = buildOptimizationFixture();

    const result = LocalSearchOptimizer.optimize({
      placements: fixture.placements,
      cours: fixture.courses,
      groupesFormes: fixture.groupesFormes,
      affectationsEtudiantGroupe: fixture.affectationsEtudiantGroupe,
      affectationsReprises: fixture.affectationsReprises,
      salles: fixture.salles,
      datesParJourSemaine: fixture.datesParJourSemaine,
      matrix: fixture.matrix,
      dispParProf: fixture.dispParProf,
      absencesParProf: fixture.absencesParProf,
      indispoParSalle: fixture.indispoParSalle,
      optimizationMode: "professeur",
    });

    expect(result.improvementsRetained).toBeGreaterThan(0);
    expect(
      result.scoringAfter.modes.professeur.scoreGlobal
    ).toBeGreaterThan(result.scoringBefore.modes.professeur.scoreGlobal);
    expect(result.gains.reductionLonguesAmplitudesProfesseurs).toBeGreaterThanOrEqual(0);
  });

  test("reste neutre en mode legacy", () => {
    const fixture = buildOptimizationFixture();

    const result = LocalSearchOptimizer.optimize({
      placements: fixture.placements,
      cours: fixture.courses,
      groupesFormes: fixture.groupesFormes,
      affectationsEtudiantGroupe: fixture.affectationsEtudiantGroupe,
      affectationsReprises: fixture.affectationsReprises,
      salles: fixture.salles,
      datesParJourSemaine: fixture.datesParJourSemaine,
      matrix: fixture.matrix,
      dispParProf: fixture.dispParProf,
      absencesParProf: fixture.absencesParProf,
      indispoParSalle: fixture.indispoParSalle,
      optimizationMode: "legacy",
    });

    expect(result.improvementsRetained).toBe(0);
    expect(normalizePlacementKeys(result.placementsOptimises)).toEqual(
      normalizePlacementKeys(fixture.placements)
    );
  });
});
