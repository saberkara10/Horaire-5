/**
 * Tests de ScenarioSimulator
 *
 * Ces tests couvrent la V1 du what-if read-only :
 * - la mutation reste strictement sur copie ;
 * - un scenario infaisable ne modifie rien ;
 * - les changements de salle et de professeur restent faisables ;
 * - la reevaluation de mode ne touche pas a l'horaire ;
 * - les contraintes dures restent preservees.
 */

import { describe, expect, jest, test } from "@jest/globals";
import { ScenarioSimulator } from "../src/services/scheduler/simulation/ScenarioSimulator.js";
import { ScheduleSnapshot } from "../src/services/scheduler/simulation/ScheduleSnapshot.js";
import { ScheduleMutationValidator } from "../src/services/scheduler/planning/ScheduleMutationValidator.js";

/**
 * Normalise un horaire en cles stables.
 *
 * @param {Object[]} placements - horaire a normaliser.
 *
 * @returns {string[]} Cles triees.
 */
function normalizePlacementKeys(placements) {
  return [...placements]
    .map((placement) =>
      [
        placement.id_affectation_cours,
        placement.id_cours,
        placement.id_professeur,
        placement.id_salle,
        placement.id_groupe,
        placement.date,
        placement.heure_debut,
        placement.heure_fin,
      ].join("|")
    )
    .sort((left, right) => left.localeCompare(right, "fr"));
}

/**
 * Construit un snapshot coherent pour les simulations unitaires.
 *
 * @returns {ScheduleSnapshot} Snapshot de test.
 */
function buildSnapshotFixture() {
  return ScheduleSnapshot.fromData({
    session: {
      id_session: 1,
      nom: "Automne 2026",
      date_debut: "2026-09-01",
      date_fin: "2026-09-30",
    },
    placements: [
      {
        id_affectation_cours: 1,
        id_cours: 101,
        code_cours: "INF101",
        nom_cours: "Programmation 1",
        programme_cours: "Informatique",
        etape_cours: "1",
        type_salle_cours: "Salle de cours",
        id_professeur: 10,
        nom_professeur: "Ada Lovelace",
        prenom_professeur: "Ada",
        id_salle: 1,
        code_salle: "S1",
        type_salle: "Salle de cours",
        capacite_salle: 30,
        id_groupe: 1,
        nom_groupe: "G1",
        date: "2026-09-07",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
        est_en_ligne: false,
        est_cours_cle: true,
        est_groupe_special: false,
      },
      {
        id_affectation_cours: 2,
        id_cours: 102,
        code_cours: "INF102",
        nom_cours: "Algorithmique",
        programme_cours: "Informatique",
        etape_cours: "1",
        type_salle_cours: "Salle de cours",
        id_professeur: 10,
        nom_professeur: "Ada Lovelace",
        prenom_professeur: "Ada",
        id_salle: 1,
        code_salle: "S1",
        type_salle: "Salle de cours",
        capacite_salle: 30,
        id_groupe: 1,
        nom_groupe: "G1",
        date: "2026-09-07",
        heure_debut: "17:00:00",
        heure_fin: "20:00:00",
        est_en_ligne: false,
        est_cours_cle: false,
        est_groupe_special: false,
      },
      {
        id_affectation_cours: 3,
        id_cours: 103,
        code_cours: "INF103",
        nom_cours: "BDD",
        programme_cours: "Informatique",
        etape_cours: "1",
        type_salle_cours: "Salle de cours",
        id_professeur: 20,
        nom_professeur: "Grace Hopper",
        prenom_professeur: "Grace",
        id_salle: 2,
        code_salle: "S2",
        type_salle: "Salle de cours",
        capacite_salle: 28,
        id_groupe: 2,
        nom_groupe: "G2",
        date: "2026-09-07",
        heure_debut: "11:00:00",
        heure_fin: "14:00:00",
        est_en_ligne: false,
        est_cours_cle: false,
        est_groupe_special: false,
      },
      {
        id_affectation_cours: 4,
        id_cours: 104,
        code_cours: "INF104",
        nom_cours: "Systemes",
        programme_cours: "Informatique",
        etape_cours: "1",
        type_salle_cours: "Salle de cours",
        id_professeur: 20,
        nom_professeur: "Grace Hopper",
        prenom_professeur: "Grace",
        id_salle: 2,
        code_salle: "S2",
        type_salle: "Salle de cours",
        capacite_salle: 28,
        id_groupe: 2,
        nom_groupe: "G2",
        date: "2026-09-08",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
        est_en_ligne: false,
        est_cours_cle: false,
        est_groupe_special: false,
      },
    ],
    courses: [
      {
        id_cours: 101,
        code: "INF101",
        nom: "Programmation 1",
        programme: "Informatique",
        etape_etude: "1",
        type_salle: "Salle de cours",
        est_en_ligne: 0,
      },
      {
        id_cours: 102,
        code: "INF102",
        nom: "Algorithmique",
        programme: "Informatique",
        etape_etude: "1",
        type_salle: "Salle de cours",
        est_en_ligne: 0,
      },
      {
        id_cours: 103,
        code: "INF103",
        nom: "BDD",
        programme: "Informatique",
        etape_etude: "1",
        type_salle: "Salle de cours",
        est_en_ligne: 0,
      },
      {
        id_cours: 104,
        code: "INF104",
        nom: "Systemes",
        programme: "Informatique",
        etape_etude: "1",
        type_salle: "Salle de cours",
        est_en_ligne: 0,
      },
    ],
    professors: [
      {
        id_professeur: 10,
        nom: "Lovelace",
        prenom: "Ada",
        specialite: "Informatique",
        cours_ids: [101, 102],
      },
      {
        id_professeur: 20,
        nom: "Hopper",
        prenom: "Grace",
        specialite: "Informatique",
        cours_ids: [101, 103, 104],
      },
    ],
    rooms: [
      { id_salle: 1, code: "S1", type: "Salle de cours", capacite: 30 },
      { id_salle: 2, code: "S2", type: "Salle de cours", capacite: 28 },
      { id_salle: 3, code: "S3", type: "Salle de cours", capacite: 32 },
    ],
    groups: [
      {
        id_groupes_etudiants: 1,
        nom_groupe: "G1",
        est_groupe_special: 0,
        programme: "Informatique",
        etape: "1",
        id_session: 1,
      },
      {
        id_groupes_etudiants: 2,
        nom_groupe: "G2",
        est_groupe_special: 0,
        programme: "Informatique",
        etape: "1",
        id_session: 1,
      },
    ],
    students: [
      { id_etudiant: 1, id_groupes_etudiants: 1, nom: "A", prenom: "Alpha" },
      { id_etudiant: 2, id_groupes_etudiants: 1, nom: "B", prenom: "Beta" },
      { id_etudiant: 3, id_groupes_etudiants: 1, nom: "C", prenom: "Gamma" },
      { id_etudiant: 4, id_groupes_etudiants: 2, nom: "D", prenom: "Delta" },
      { id_etudiant: 5, id_groupes_etudiants: 2, nom: "E", prenom: "Epsilon" },
    ],
    studentCourseAssignments: [],
    professorAvailabilities: [],
    professorAbsences: [],
    roomUnavailabilities: [],
  });
}

/**
 * Construit un snapshot ou un groupe a deja 3 seances sur la meme journee.
 *
 * Ce fixture verrouille un angle mort critique du what-if : la simulation doit
 * reutiliser les garde-fous durs du moteur historique, et donc refuser une 4e
 * seance de groupe sur la meme journee meme en dry-run.
 *
 * @returns {ScheduleSnapshot} Snapshot de test.
 */
function buildGroupDailyLoadSnapshot() {
  return ScheduleSnapshot.fromData({
    session: {
      id_session: 1,
      nom: "Automne 2026",
      date_debut: "2026-09-01",
      date_fin: "2026-09-30",
    },
    placements: [
      {
        id_affectation_cours: 1,
        id_cours: 201,
        code_cours: "INF201",
        nom_cours: "Cours 1",
        programme_cours: "Informatique",
        etape_cours: "1",
        type_salle_cours: "Salle de cours",
        id_professeur: 10,
        nom_professeur: "Ada Lovelace",
        prenom_professeur: "Ada",
        id_salle: 1,
        code_salle: "S1",
        type_salle: "Salle de cours",
        capacite_salle: 30,
        id_groupe: 1,
        nom_groupe: "G1",
        date: "2026-09-07",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
        est_en_ligne: false,
      },
      {
        id_affectation_cours: 2,
        id_cours: 202,
        code_cours: "INF202",
        nom_cours: "Cours 2",
        programme_cours: "Informatique",
        etape_cours: "1",
        type_salle_cours: "Salle de cours",
        id_professeur: 10,
        nom_professeur: "Ada Lovelace",
        prenom_professeur: "Ada",
        id_salle: 2,
        code_salle: "S2",
        type_salle: "Salle de cours",
        capacite_salle: 30,
        id_groupe: 1,
        nom_groupe: "G1",
        date: "2026-09-07",
        heure_debut: "11:00:00",
        heure_fin: "14:00:00",
        est_en_ligne: false,
      },
      {
        id_affectation_cours: 3,
        id_cours: 203,
        code_cours: "INF203",
        nom_cours: "Cours 3",
        programme_cours: "Informatique",
        etape_cours: "1",
        type_salle_cours: "Salle de cours",
        id_professeur: 20,
        nom_professeur: "Grace Hopper",
        prenom_professeur: "Grace",
        id_salle: 3,
        code_salle: "S3",
        type_salle: "Salle de cours",
        capacite_salle: 30,
        id_groupe: 1,
        nom_groupe: "G1",
        date: "2026-09-07",
        heure_debut: "14:00:00",
        heure_fin: "17:00:00",
        est_en_ligne: false,
      },
      {
        id_affectation_cours: 4,
        id_cours: 204,
        code_cours: "INF204",
        nom_cours: "Cours 4",
        programme_cours: "Informatique",
        etape_cours: "1",
        type_salle_cours: "Salle de cours",
        id_professeur: 20,
        nom_professeur: "Grace Hopper",
        prenom_professeur: "Grace",
        id_salle: 1,
        code_salle: "S1",
        type_salle: "Salle de cours",
        capacite_salle: 30,
        id_groupe: 1,
        nom_groupe: "G1",
        date: "2026-09-08",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
        est_en_ligne: false,
      },
    ],
    courses: [
      {
        id_cours: 201,
        code: "INF201",
        nom: "Cours 1",
        programme: "Informatique",
        etape_etude: "1",
        type_salle: "Salle de cours",
        est_en_ligne: 0,
      },
      {
        id_cours: 202,
        code: "INF202",
        nom: "Cours 2",
        programme: "Informatique",
        etape_etude: "1",
        type_salle: "Salle de cours",
        est_en_ligne: 0,
      },
      {
        id_cours: 203,
        code: "INF203",
        nom: "Cours 3",
        programme: "Informatique",
        etape_etude: "1",
        type_salle: "Salle de cours",
        est_en_ligne: 0,
      },
      {
        id_cours: 204,
        code: "INF204",
        nom: "Cours 4",
        programme: "Informatique",
        etape_etude: "1",
        type_salle: "Salle de cours",
        est_en_ligne: 0,
      },
    ],
    professors: [
      {
        id_professeur: 10,
        nom: "Lovelace",
        prenom: "Ada",
        specialite: "Informatique",
        cours_ids: [201, 202],
      },
      {
        id_professeur: 20,
        nom: "Hopper",
        prenom: "Grace",
        specialite: "Informatique",
        cours_ids: [203, 204],
      },
    ],
    rooms: [
      { id_salle: 1, code: "S1", type: "Salle de cours", capacite: 30 },
      { id_salle: 2, code: "S2", type: "Salle de cours", capacite: 30 },
      { id_salle: 3, code: "S3", type: "Salle de cours", capacite: 30 },
    ],
    groups: [
      {
        id_groupes_etudiants: 1,
        nom_groupe: "G1",
        est_groupe_special: 0,
        programme: "Informatique",
        etape: "1",
        id_session: 1,
      },
    ],
    students: [
      { id_etudiant: 1, id_groupes_etudiants: 1, nom: "A", prenom: "Alpha" },
      { id_etudiant: 2, id_groupes_etudiants: 1, nom: "B", prenom: "Beta" },
      { id_etudiant: 3, id_groupes_etudiants: 1, nom: "C", prenom: "Gamma" },
    ],
    studentCourseAssignments: [],
    professorAvailabilities: [],
    professorAbsences: [],
    roomUnavailabilities: [],
  });
}

describe("ScenarioSimulator", () => {
  test("deplace une seance uniquement sur copie et ameliore le score etudiant", () => {
    const snapshot = buildSnapshotFixture();
    const beforeKeys = normalizePlacementKeys(snapshot.clonePlacements());

    const result = ScenarioSimulator.simulate({
      snapshot,
      optimizationMode: "etudiant",
      scenario: {
        type: "DEPLACER_SEANCE",
        id_affectation_cours: 2,
        date: "2026-09-07",
        heure_debut: "11:00:00",
        heure_fin: "14:00:00",
      },
    });

    expect(result.faisable).toBe(true);
    expect(result.mutationAppliquee).toBe(true);
    expect(result.modeOptimisationUtilise).toBe("etudiant");
    expect(result.scoreApres.scoreGlobal).toBeGreaterThan(result.scoreAvant.scoreGlobal);
    expect(result.scoreAvant.scoreGroupe).toBeDefined();
    expect(result.scoreApres.scoreGroupe).toBeDefined();
    expect(result.difference.scoreGroupe).toBeGreaterThan(0);
    expect(result.difference.metrics.nbConflitsEvites).toBe(0);
    expect(result.impact.groupes.idsImpactes).toEqual([1]);
    expect(result.scoreAvant.details.groupe.totals.lateCoursePenalty).toBeGreaterThan(
      result.scoreApres.details.groupe.totals.lateCoursePenalty
    );
    expect(result.conflitsCrees).toBe(0);
    expect(normalizePlacementKeys(snapshot.clonePlacements())).toEqual(beforeKeys);
  });

  test("un scenario infaisable ne modifie rien et expose les raisons de blocage", () => {
    const snapshot = buildSnapshotFixture();
    const beforeKeys = normalizePlacementKeys(snapshot.clonePlacements());

    const result = ScenarioSimulator.simulate({
      snapshot,
      optimizationMode: "equilibre",
      scenario: {
        type: "DEPLACER_SEANCE",
        id_affectation_cours: 2,
        date: "2026-09-07",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
      },
    });

    expect(result.faisable).toBe(false);
    expect(result.mutationAppliquee).toBe(false);
    expect(result.scoreApres).toBeNull();
    expect(result.validation.raisonsBlocage.length).toBeGreaterThan(0);
    expect(normalizePlacementKeys(snapshot.clonePlacements())).toEqual(beforeKeys);
  });

  test("CHANGER_SALLE fonctionne si le changement reste faisable", () => {
    const snapshot = buildSnapshotFixture();

    const result = ScenarioSimulator.simulate({
      snapshot,
      optimizationMode: "equilibre",
      scenario: {
        type: "CHANGER_SALLE",
        id_affectation_cours: 3,
        id_salle: 3,
      },
    });

    expect(result.faisable).toBe(true);
    expect(result.impact.salles.idsImpactees).toEqual([2, 3]);
    expect(result.conflitsCrees).toBe(0);
    expect(result.resume).toContain("Scenario faisable");
  });

  test("CHANGER_PROF fonctionne si le professeur cible est compatible et libre", () => {
    const snapshot = buildSnapshotFixture();

    const result = ScenarioSimulator.simulate({
      snapshot,
      optimizationMode: "professeur",
      scenario: {
        type: "CHANGER_PROF",
        id_affectation_cours: 1,
        id_professeur: 20,
      },
    });

    expect(result.faisable).toBe(true);
    expect(result.impact.professeurs.idsImpactes).toEqual([10, 20]);
    expect(result.scoreApres).not.toBeNull();
  });

  test("REEVALUER_MODE compare les scores sans aucune mutation d'horaire", () => {
    const snapshot = buildSnapshotFixture();
    const beforeKeys = normalizePlacementKeys(snapshot.clonePlacements());

    const result = ScenarioSimulator.simulate({
      snapshot,
      optimizationMode: "etudiant",
      scenario: {
        type: "REEVALUER_MODE",
        mode_cible: "professeur",
      },
    });

    expect(result.faisable).toBe(true);
    expect(result.mutationAppliquee).toBe(false);
    expect(result.modeScoringAvant).toBe("etudiant");
    expect(result.modeScoringApres).toBe("professeur");
    expect(result.scoreAvant.mode).toBe("etudiant");
    expect(result.scoreApres.mode).toBe("professeur");
    expect(normalizePlacementKeys(snapshot.clonePlacements())).toEqual(beforeKeys);
  });

  test("une mutation faisable preserve les contraintes dures", () => {
    const snapshot = buildSnapshotFixture();

    const result = ScenarioSimulator.simulate({
      snapshot,
      optimizationMode: "equilibre",
      scenario: {
        type: "DEPLACER_SEANCE",
        id_affectation_cours: 2,
        date: "2026-09-08",
        heure_debut: "11:00:00",
        heure_fin: "14:00:00",
      },
    });

    expect(result.faisable).toBe(true);
    expect(result.validation.raisonsBlocage).toEqual([]);
    expect(result.conflitsCrees).toBe(0);
    expect(result.detailsConflits.crees).toEqual([]);
  });

  test("refuse un deplacement qui depasse la charge journaliere maximale d'un groupe", () => {
    const snapshot = buildGroupDailyLoadSnapshot();
    const beforeKeys = normalizePlacementKeys(snapshot.clonePlacements());

    const result = ScenarioSimulator.simulate({
      snapshot,
      optimizationMode: "equilibre",
      scenario: {
        type: "DEPLACER_SEANCE",
        id_affectation_cours: 4,
        date: "2026-09-07",
        heure_debut: "17:00:00",
        heure_fin: "20:00:00",
      },
    });

    expect(result.faisable).toBe(false);
    expect(result.mutationAppliquee).toBe(false);
    expect(
      result.validation.raisonsBlocage.some(
        (reason) => reason.code === "GROUP_DAILY_LOAD_EXCEEDED"
      )
    ).toBe(true);
    expect(normalizePlacementKeys(snapshot.clonePlacements())).toEqual(beforeKeys);
  });

  test("rejette un type de scenario non supporte", () => {
    const snapshot = buildSnapshotFixture();

    expect(() =>
      ScenarioSimulator.simulate({
        snapshot,
        scenario: {
          type: "MUTATION_EXOTIQUE",
        },
      })
    ).toThrow("Le type de scenario demande n'est pas supporte en V1.");
  });

  test("CHANGER_SALLE echoue si la salle cible est absente", () => {
    const snapshot = buildSnapshotFixture();

    expect(() =>
      ScenarioSimulator.simulate({
        snapshot,
        scenario: {
          type: "CHANGER_SALLE",
          id_affectation_cours: 1,
          id_salle: 999,
        },
      })
    ).toThrow("La salle cible est introuvable.");
  });

  test("CHANGER_PROF exige un professeur cible valide", () => {
    const snapshot = buildSnapshotFixture();

    expect(() =>
      ScenarioSimulator.simulate({
        snapshot,
        scenario: {
          type: "CHANGER_PROF",
          id_affectation_cours: 1,
        },
      })
    ).toThrow("Le scenario CHANGER_PROF exige un professeur cible valide.");
  });

  test("simulatePlacementMutations applique plusieurs mutations faisables", () => {
    const snapshot = buildSnapshotFixture();
    const validateSpy = jest
      .spyOn(ScheduleMutationValidator, "validate")
      .mockReturnValue({
        feasible: true,
        reasons: [],
        participantIds: [1, 2],
      });

    try {
      const result = ScenarioSimulator.simulatePlacementMutations({
        snapshot,
        optimizationMode: "equilibre",
        scope: "ALL_OCCURRENCES",
        placementsByAssignmentId: {
          1: {
            id_professeur: 10,
            id_salle: 3,
            id_groupe: 1,
            date: "2026-09-07",
            heure_debut: "08:00:00",
            heure_fin: "11:00:00",
          },
        },
      });

      expect(result.faisable).toBe(true);
      expect(result.mutationAppliquee).toBe(true);
      expect(result.portee).toBe("ALL_OCCURRENCES");
      expect(result.mutations.avant).toHaveLength(1);
      expect(result.mutations.apres).toHaveLength(1);
      expect(result.validation.detailsParAffectation).toHaveLength(1);
    } finally {
      validateSpy.mockRestore();
    }
  });

  test("simulatePlacementMutations retourne un rapport infaisable a la premiere occurrence bloquee", () => {
    const snapshot = buildSnapshotFixture();

    const result = ScenarioSimulator.simulatePlacementMutations({
      snapshot,
      optimizationMode: "equilibre",
      scope: "THIS_OCCURRENCE",
      placementsByAssignmentId: {
        1: {
          id_professeur: 10,
          id_salle: 1,
          id_groupe: 1,
          date: "2026-09-07",
          heure_debut: "17:00:00",
          heure_fin: "20:00:00",
        },
      },
    });

    expect(result.faisable).toBe(false);
    expect(result.mutationAppliquee).toBe(false);
    expect(result.scoreApres).toBeNull();
    expect(result.validation.detailsParAffectation[0].id_affectation_cours).toBe(1);
  });

  test("simulateOfficialScenario charge le snapshot puis delegue a simulate", async () => {
    const snapshot = buildSnapshotFixture();
    const loadSpy = jest
      .spyOn(ScheduleSnapshot, "load")
      .mockResolvedValue(snapshot);
    const simulateSpy = jest
      .spyOn(ScenarioSimulator, "simulate")
      .mockReturnValue({ faisable: true, resume: "ok" });

    try {
      const result = await ScenarioSimulator.simulateOfficialScenario({
        idSession: 7,
        scenario: { type: "REEVALUER_MODE", mode_cible: "professeur" },
      });

      expect(result).toEqual({ faisable: true, resume: "ok" });
      expect(loadSpy).toHaveBeenCalledWith({ idSession: 7 }, expect.anything());
      expect(simulateSpy).toHaveBeenCalledWith({
        snapshot,
        scenario: { type: "REEVALUER_MODE", mode_cible: "professeur" },
        optimizationMode: "legacy",
      });
    } finally {
      loadSpy.mockRestore();
      simulateSpy.mockRestore();
    }
  });
});
