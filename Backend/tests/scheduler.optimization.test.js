/**
 * Tests d'integration legere pour les modes d'optimisation du scheduler.
 *
 * Objectif :
 * - verifier que les nouveaux modes restent compatibles avec la generation
 * - verrouiller des invariants raisonnables sans dependre d'une generation DB complete
 */

import { describe, expect, test, jest } from "@jest/globals";
import { ACADEMIC_WEEKDAY_TIME_SLOTS } from "../src/services/scheduler/AcademicCatalog.js";
import { ConstraintMatrix } from "../src/services/scheduler/ConstraintMatrix.js";
import { SchedulerEngine } from "../src/services/scheduler/SchedulerEngine.js";
import { LocalSearchOptimizer } from "../src/services/scheduler/optimization/LocalSearchOptimizer.js";

/**
 * Construit un contexte minimal pour la recherche hebdomadaire.
 *
 * @returns {Object} Contexte reutilisable par les tests.
 */
function buildWeeklySearchFixture() {
  return {
    cours: {
      id_cours: 101,
      code: "INF101",
      nom: "Intro",
      programme: "Programmation informatique",
      est_cours_cle: true,
      est_en_ligne: false,
    },
    groupe: {
      nomGroupe: "G1",
      etudiants: [1, 2, 3],
      effectif_regulier: 3,
      charge_estimee_par_cours: {},
    },
    profsCompatibles: [
      {
        id_professeur: 10,
        nom: "Doe",
        prenom: "Jane",
      },
    ],
    sallesCompatibles: [
      {
        id_salle: 1,
        code: "S1",
        capacite: 30,
      },
    ],
    datesParJourSemaine: new Map([
      [1, ["2026-09-07", "2026-09-14"]],
      [2, ["2026-09-08", "2026-09-15"]],
      [3, ["2026-09-09", "2026-09-16"]],
    ]),
    creneaux: ACADEMIC_WEEKDAY_TIME_SLOTS,
    dispParProf: new Map(),
    absencesParProf: new Map(),
    indispoParSalle: new Map(),
    preferencesStabilite: new Map(),
  };
}

/**
 * Construit les index vides attendus par SchedulerEngine.
 *
 * @returns {Object} Index de charge et de slots.
 */
function buildEmptyIndexes() {
  return {
    chargeSeriesParProf: new Map(),
    chargeSeriesParJour: new Map(),
    chargeSeriesParGroupeJour: new Map(),
    chargeSeriesParProfJour: new Map(),
    slotsParGroupeJour: new Map(),
    slotsParProfJour: new Map(),
  };
}

describe("scheduler optimization modes", () => {
  test.each(["legacy", "etudiant", "professeur", "equilibre"])(
    "trouve un motif hebdomadaire faisable en mode %s",
    (optimizationMode) => {
      const fixture = buildWeeklySearchFixture();
      const indexes = buildEmptyIndexes();
      const matrix = new ConstraintMatrix();

      const result = SchedulerEngine._trouverSerieHebdomadaire({
        cours: fixture.cours,
        groupe: fixture.groupe,
        idGroupe: 1,
        profsCompatibles: fixture.profsCompatibles,
        sallesCompatibles: fixture.sallesCompatibles,
        datesParJourSemaine: fixture.datesParJourSemaine,
        creneaux: fixture.creneaux,
        matrix,
        dispParProf: fixture.dispParProf,
        absencesParProf: fixture.absencesParProf,
        indispoParSalle: fixture.indispoParSalle,
        chargeSeriesParProf: indexes.chargeSeriesParProf,
        chargeSeriesParJour: indexes.chargeSeriesParJour,
        chargeSeriesParGroupeJour: indexes.chargeSeriesParGroupeJour,
        chargeSeriesParProfJour: indexes.chargeSeriesParProfJour,
        slotsParGroupeJour: indexes.slotsParGroupeJour,
        slotsParProfJour: indexes.slotsParProfJour,
        numeroSeance: 1,
        preferencesStabilite: fixture.preferencesStabilite,
        optimizationMode,
      });

      expect(result).not.toBeNull();
      expect(result.placements).toHaveLength(2);
      expect(
        result.placements.every((placement) => placement.id_professeur === 10)
      ).toBe(true);
      expect(
        result.placements.every((placement) => placement.id_groupe === 1)
      ).toBe(true);
    }
  );

  test("l'optimisation locale reste non bloquante si l'optimiseur echoue", () => {
    const optimizeSpy = jest
      .spyOn(LocalSearchOptimizer, "optimize")
      .mockImplementation(() => {
        throw new Error("OPTIMIZER_FAILURE");
      });

    try {
      const placements = [
        {
          id_affectation_cours: 1,
          id_cours: 101,
          id_professeur: 10,
          nom_professeur: "Jane Doe",
          id_salle: 1,
          id_groupe: 1,
          nom_groupe: "G1",
          date: "2026-09-07",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
        },
      ];

      const result = SchedulerEngine._executerOptimisationLocaleLectureSeule({
        placements,
        affectationsEtudiantGroupe: new Map([[1, ["G1"]]]),
        affectationsReprises: [],
      });

      expect(result.placementsOptimises).toEqual(placements);
      expect(result.fallbackLectureSeule).toBe(true);
      expect(result.error).toBe("OPTIMIZER_FAILURE");
      expect(result.improvementsRetained).toBe(0);
      expect(result.scoringBefore).toEqual(result.scoringAfter);
    } finally {
      optimizeSpy.mockRestore();
    }
  });
});
