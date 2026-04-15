/**
 * Tests de PlacementEvaluator
 *
 * Ces tests verrouillent les invariants critiques du nouveau classificateur :
 * - le mode legacy reste aligne sur le comportement historique
 * - les modes etudiant et professeur priorisent bien le confort local attendu
 * - le tri des candidats reste deterministe
 */

import { describe, expect, test } from "@jest/globals";
import { PlacementEvaluator } from "../src/services/scheduler/optimization/PlacementEvaluator.js";
import { SchedulerEngine } from "../src/services/scheduler/SchedulerEngine.js";

/**
 * Construit un contexte d'evaluation proche de celui du moteur.
 *
 * @returns {Object} Context de charge et de slots.
 */
function buildEvaluationContext() {
  return {
    chargeSeriesParJour: new Map([[1, 1], [2, 0]]),
    chargeSeriesParGroupeJour: new Map([["1", new Map([[1, 1]])]]),
    chargeSeriesParProfJour: new Map([
      ["10", new Map([[1, 1]])],
      ["20", new Map([[1, 1]])],
    ]),
    slotsParGroupeJour: new Map([["1", new Map([[1, new Set([0])]])]]),
    slotsParProfJour: new Map([
      ["10", new Map([[1, new Set([0])]])],
      ["20", new Map([[1, new Set([0])]])],
    ]),
  };
}

/**
 * Construit un candidat de test.
 *
 * @param {Object} overrides - valeurs a surcharger.
 * @returns {Object} Candidat complet.
 */
function buildCandidate(overrides = {}) {
  return {
    cours: {
      id_cours: 101,
      code: "INF101",
      nom: "Intro",
    },
    groupe: {
      nomGroupe: "G1",
      etudiants: [1, 2, 3],
      effectif_regulier: 3,
    },
    idGroupe: 1,
    professeur: {
      id_professeur: 10,
      nom: "Doe",
      prenom: "Jane",
    },
    salle: {
      id_salle: 1,
      code: "S1",
      capacite: 30,
    },
    jourSemaine: 1,
    creneau: {
      debut: "11:00:00",
      fin: "14:00:00",
    },
    slotIndex: 1,
    indexStrategie: 0,
    indexProfesseur: 0,
    indexCreneau: 1,
    indexSalle: 0,
    coverageRatio: 1,
    roomCoverageRatio: 1,
    ...overrides,
  };
}

describe("PlacementEvaluator", () => {
  test("le mode legacy reste aligne avec _scoreCandidatSerie historique", () => {
    const context = buildEvaluationContext();
    const candidate = buildCandidate();

    const legacyScore = PlacementEvaluator.evaluateCandidate({
      mode: "legacy",
      phase: "weekly",
      candidate,
      context,
    }).score;

    const engineScore = SchedulerEngine._scoreCandidatSerie({
      ...candidate,
      chargeSeriesParJour: context.chargeSeriesParJour,
      chargeSeriesParGroupeJour: context.chargeSeriesParGroupeJour,
      chargeSeriesParProfJour: context.chargeSeriesParProfJour,
      slotsParGroupeJour: context.slotsParGroupeJour,
      slotsParProfJour: context.slotsParProfJour,
    });

    expect(legacyScore).toBe(engineScore);
  });

  test("le mode etudiant prefere un slot adjacent sur un jour deja actif", () => {
    const context = buildEvaluationContext();
    const adjacentCandidate = buildCandidate();
    const fragmentedCandidate = buildCandidate({
      jourSemaine: 2,
      indexStrategie: 1,
    });

    const adjacentScore = PlacementEvaluator.evaluateCandidate({
      mode: "etudiant",
      phase: "weekly",
      candidate: adjacentCandidate,
      context,
    }).score;
    const fragmentedScore = PlacementEvaluator.evaluateCandidate({
      mode: "etudiant",
      phase: "weekly",
      candidate: fragmentedCandidate,
      context,
    }).score;

    expect(adjacentScore).toBeGreaterThan(fragmentedScore);
  });

  test("le mode professeur penalise davantage une amplitude trop large", () => {
    const context = buildEvaluationContext();
    const compactCandidate = buildCandidate({
      slotIndex: 1,
      creneau: { debut: "11:00:00", fin: "14:00:00" },
    });
    const wideAmplitudeCandidate = buildCandidate({
      slotIndex: 3,
      creneau: { debut: "17:00:00", fin: "20:00:00" },
      indexCreneau: 3,
    });

    const compactScore = PlacementEvaluator.evaluateCandidate({
      mode: "professeur",
      phase: "weekly",
      candidate: compactCandidate,
      context,
    }).score;
    const wideScore = PlacementEvaluator.evaluateCandidate({
      mode: "professeur",
      phase: "weekly",
      candidate: wideAmplitudeCandidate,
      context,
    }).score;

    expect(compactScore).toBeGreaterThan(wideScore);
  });

  test("le tri fallback legacy conserve la priorite du premier faisable historique", () => {
    const context = buildEvaluationContext();
    const rankedCandidates = PlacementEvaluator.rankCandidates({
      mode: "legacy",
      phase: "fallback",
      context,
      candidates: [
        buildCandidate({ indexJour: 1, fallbackTypeIndex: 1 }),
        buildCandidate({ indexJour: 0, fallbackTypeIndex: 0 }),
        buildCandidate({ indexJour: 2, fallbackTypeIndex: 2 }),
      ],
    });

    expect(rankedCandidates[0].candidate.indexJour).toBe(0);
    expect(rankedCandidates[0].candidate.fallbackTypeIndex).toBe(0);
  });
});
