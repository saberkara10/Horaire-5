import { describe, expect, test } from "@jest/globals";
import { ScenarioComparator } from "../src/services/scheduler/simulation/ScenarioComparator.js";

function buildSnapshot(placements, participants = {}) {
  return {
    clonePlacements: () => placements,
    getParticipantsForAssignment: (assignmentId) => participants[assignmentId] || [],
  };
}

describe("ScenarioComparator", () => {
  test("collectConflicts detecte les conflits de salle, professeur, groupe et etudiant", () => {
    const placements = [
      {
        id_affectation_cours: 1,
        id_cours: 101,
        id_professeur: 10,
        id_salle: 1,
        id_groupe: 1,
        date: "2026-09-07",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
      },
      {
        id_affectation_cours: 2,
        id_cours: 102,
        id_professeur: 10,
        id_salle: 1,
        id_groupe: 1,
        date: "2026-09-07",
        heure_debut: "10:00:00",
        heure_fin: "13:00:00",
      },
    ];

    const conflicts = ScenarioComparator.collectConflicts(
      buildSnapshot(placements, {
        1: [7, 8],
        2: [8, 9],
      })
    );

    expect(conflicts.roomConflicts).toHaveLength(1);
    expect(conflicts.professorConflicts).toHaveLength(1);
    expect(conflicts.groupConflicts).toHaveLength(1);
    expect(conflicts.studentConflicts[0]).toMatchObject({
      type: "student",
      id_etudiants: [8],
    });
    expect(conflicts.keySet.size).toBe(4);
  });

  test("compare produit un resume infaisable quand la validation bloque", () => {
    const beforeConflicts = {
      all: [],
      keySet: new Set(),
    };

    const report = ScenarioComparator.compare({
      scenarioType: "DEPLACER_SEANCE",
      modeOptimisation: "equilibre",
      modeScoringAvant: "equilibre",
      modeScoringApres: "equilibre",
      beforeScore: { scoreGlobal: 50 },
      afterScore: null,
      beforeConflicts,
      afterConflicts: beforeConflicts,
      feasible: false,
      mutationApplied: false,
      validation: {
        reasons: [{ code: "ROOM_CONFLICT", message: "Salle occupee." }],
        participantIds: [4, 2, 4],
      },
    });

    expect(report.faisable).toBe(false);
    expect(report.scoreApres).toBeNull();
    expect(report.impact.etudiants.idsImpactes).toEqual([2, 4]);
    expect(report.resume).toBe("Simulation infaisable : Salle occupee.");
  });

  test("compare distingue les conflits crees et resolus sur une mutation faisable", () => {
    const beforeConflicts = {
      all: [{ key: "room|1|2", type: "room" }],
      keySet: new Set(["room|1|2"]),
    };
    const afterConflicts = {
      all: [{ key: "professor|1|3", type: "professor" }],
      keySet: new Set(["professor|1|3"]),
    };

    const report = ScenarioComparator.compare({
      scenarioType: "CHANGER_SALLE",
      modeOptimisation: "equilibre",
      modeScoringAvant: "equilibre",
      modeScoringApres: "equilibre",
      originalPlacement: { id_professeur: 10, id_salle: 1, id_groupe: 1 },
      proposedPlacement: { id_professeur: 10, id_salle: 2, id_groupe: 1 },
      beforeScore: {
        scoreGlobal: 50,
        scoreEtudiant: 10,
        scoreProfesseur: 15,
        scoreGroupe: 12,
        metrics: { nbCoursNonPlanifies: 2 },
      },
      afterScore: {
        scoreGlobal: 55,
        scoreEtudiant: 12,
        scoreProfesseur: 16,
        scoreGroupe: 13,
        metrics: { nbCoursNonPlanifies: 1 },
      },
      beforeConflicts,
      afterConflicts,
      feasible: true,
      mutationApplied: true,
      validation: {
        reasons: [],
        participantIds: [1, 2],
      },
    });

    expect(report.conflitsCrees).toBe(1);
    expect(report.conflitsResolus).toBe(1);
    expect(report.difference).toMatchObject({
      scoreGlobal: 5,
      scoreEtudiant: 2,
      scoreProfesseur: 1,
      scoreGroupe: 1,
    });
    expect(report.resume).toContain("1 conflit(s) resolu(s)");
    expect(report.resume).toContain("1 conflit(s) cree(s)");
  });

  test("compareBatch agrege les impacts multi-occurrences", () => {
    const report = ScenarioComparator.compareBatch({
      scenarioType: "MODIFIER_AFFECTATION",
      scope: "ALL_OCCURRENCES",
      modeOptimisation: "equilibre",
      modeScoringAvant: "equilibre",
      modeScoringApres: "equilibre",
      originalPlacements: [
        { id_affectation_cours: 1, id_professeur: 10, id_salle: 1, id_groupe: 1 },
        { id_affectation_cours: 2, id_professeur: 20, id_salle: 2, id_groupe: 2 },
      ],
      proposedPlacements: [
        { id_affectation_cours: 1, id_professeur: 10, id_salle: 3, id_groupe: 1 },
        { id_affectation_cours: 2, id_professeur: 30, id_salle: 2, id_groupe: 2 },
      ],
      beforeScore: { scoreGlobal: 50 },
      afterScore: { scoreGlobal: 52 },
      beforeConflicts: { all: [], keySet: new Set() },
      afterConflicts: { all: [{ key: "room|1|2", type: "room" }], keySet: new Set(["room|1|2"]) },
      feasible: true,
      mutationApplied: true,
      validation: {
        reasons: [],
        participantIds: [4, 3, 4],
        detailsByAssignment: [{ id_affectation_cours: 1, feasible: true, reasons: [] }],
      },
    });

    expect(report.affectationsCiblees).toEqual([1, 2]);
    expect(report.impact.professeurs.idsImpactes).toEqual([10, 20, 30]);
    expect(report.impact.salles.idsImpactees).toEqual([1, 2, 3]);
    expect(report.resume).toContain("ALL_OCCURRENCES");
    expect(report.conflitsCrees).toBe(1);
  });
});
