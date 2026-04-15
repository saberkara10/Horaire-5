/**
 * ScheduleScorer
 *
 * Ce module compose scoring_v1 a partir des analyseurs etudiant et professeur.
 *
 * Responsabilites principales :
 * - reconstruire des horaires lisibles par etudiant et par professeur ;
 * - calculer `scoreEtudiant`, `scoreProfesseur` et `scoreGlobal` ;
 * - exposer un format stable reutilisable par les rapports, l'optimisation et le what-if.
 *
 * Integration dans le systeme :
 * - SchedulerEngine l'utilise en lecture seule pour enrichir les rapports ;
 * - LocalSearchOptimizer et ScenarioSimulator s'appuient sur lui pour comparer des variantes ;
 * - `legacy` n'est pas un mode de scoring direct ici : il est mappe plus haut
 *   vers `equilibre` pour conserver un contrat unique de scoring_v1.
 */

import { ScoringProfiles } from "./ScoringProfiles.js";
import { StudentScheduleAnalyzer } from "./StudentScheduleAnalyzer.js";
import { TeacherScheduleAnalyzer } from "./TeacherScheduleAnalyzer.js";

/**
 * Borne une note entre 0 et 100.
 *
 * @param {number} value - valeur source.
 * @param {number} [min=0] - borne basse.
 * @param {number} [max=100] - borne haute.
 *
 * @returns {number} Valeur bornee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les valeurs hors bornes sont rabotees.
 */
function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Arrondit une valeur numerique.
 *
 * @param {number} value - valeur source.
 * @param {number} [digits=2] - nombre de decimales.
 *
 * @returns {number} Valeur arrondie.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `0` pour une valeur non numerique.
 */
function round(value, digits = 2) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

/**
 * Normalise les affectations etudiant -> groupe.
 *
 * @param {Map<number, string[]>|Object|Array} assignments - source brute.
 *
 * @returns {Map<number, string[]>} Affectations normalisees.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : accepte les formes Map, tableau de tuples ou objet simple.
 */
function normalizeStudentGroupAssignments(assignments) {
  if (assignments instanceof Map) {
    return assignments;
  }

  if (Array.isArray(assignments)) {
    return new Map(assignments);
  }

  if (assignments && typeof assignments === "object") {
    return new Map(
      Object.entries(assignments).map(([key, value]) => [Number(key), value])
    );
  }

  return new Map();
}

/**
 * Ajoute un placement a un index par cle.
 *
 * @param {Map<string, Object[]>} index - index cible.
 * @param {string|number|null} key - cle d'indexation.
 * @param {Object} placement - placement a enregistrer.
 *
 * @returns {void}
 *
 * Effets secondaires : modifie `index`.
 * Cas particuliers : ignore les cles vides.
 */
function appendIndexedPlacement(index, key, placement) {
  if (key == null || key === "") {
    return;
  }

  const normalizedKey = String(key).trim();
  if (normalizedKey === "") {
    return;
  }

  if (!index.has(normalizedKey)) {
    index.set(normalizedKey, []);
  }

  index.get(normalizedKey).push(placement);
}

/**
 * Construit une cle stable de placement.
 *
 * @param {Object} placement - placement source.
 *
 * @returns {string} Cle stable de deduplication.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : inclut le groupe pour distinguer les occurrences homonymes.
 */
function buildPlacementKey(placement) {
  return [
    placement?.date || "",
    placement?.heure_debut || "",
    placement?.heure_fin || "",
    placement?.id_cours || "",
    placement?.id_professeur || "",
    placement?.id_salle || "",
    placement?.id_groupe || placement?.nom_groupe || "",
  ].join("|");
}

/**
 * Trie des placements dans un ordre stable.
 *
 * @param {Object} a - placement de gauche.
 * @param {Object} b - placement de droite.
 *
 * @returns {number} Ordre chronologique stable.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : compare uniquement les dimensions utiles au score.
 */
function comparePlacements(a, b) {
  return (
    String(a?.date || "").localeCompare(String(b?.date || ""), "fr") ||
    String(a?.heure_debut || "").localeCompare(String(b?.heure_debut || ""), "fr") ||
    String(a?.heure_fin || "").localeCompare(String(b?.heure_fin || ""), "fr")
  );
}

/**
 * Retourne la cle groupe d'une reprise.
 *
 * @param {Object} recoveryAssignment - affectation de reprise.
 *
 * @returns {string|null} Cle de groupe lisible par le scorer.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : prefere l'identifiant groupe, sinon le nom de groupe.
 */
function getRecoveryGroupKey(recoveryAssignment) {
  const idGroup = Number(recoveryAssignment?.id_groupe);
  if (Number.isInteger(idGroup) && idGroup > 0) {
    return String(idGroup);
  }

  const groupName = String(recoveryAssignment?.nom_groupe || "").trim();
  return groupName || null;
}

export class ScheduleScorer {
  /**
   * Score un horaire sur un mode unique.
   *
   * @param {Object} [payload={}] - snapshot read-only de scoring.
   * @param {string} [mode="equilibre"] - mode de scoring voulu.
   *
   * @returns {Object} Score compose avec details.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : les details etudiant/professeur sont toujours retournes.
   */
  static scoreSchedule(payload = {}, mode = "equilibre") {
    const analyses = ScheduleScorer._analyze(payload);
    return ScheduleScorer._composeScore(analyses, mode);
  }

  /**
   * Score un horaire sur tous les modes de scoring_v1.
   *
   * @param {Object} [payload={}] - snapshot read-only de scoring.
   *
   * @returns {Object} Ensemble des scores par mode.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : retourne une structure stable exploitable telle quelle dans les rapports.
   */
  static scoreAllModes(payload = {}) {
    const analyses = ScheduleScorer._analyze(payload);

    return {
      version: "v1",
      readOnly: true,
      modes: Object.fromEntries(
        ScoringProfiles.list().map((mode) => [
          mode,
          ScheduleScorer._composeModeSummary(analyses, mode),
        ])
      ),
      details: {
        etudiant: analyses.studentAnalysis,
        professeur: analyses.teacherAnalysis,
      },
    };
  }

  /**
   * Compose un score detaille pour un mode donne.
   *
   * @param {Object} analyses - resultats des analyseurs.
   * @param {string} mode - mode de scoring.
   *
   * @returns {Object} Score complet avec details.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : reutilise les memes details pour tous les modes.
   */
  static _composeScore(analyses, mode) {
    return {
      ...ScheduleScorer._composeModeSummary(analyses, mode),
      details: {
        etudiant: analyses.studentAnalysis,
        professeur: analyses.teacherAnalysis,
      },
    };
  }

  /**
   * Compose le resume de score d'un mode.
   *
   * @param {Object} analyses - resultats des analyseurs.
   * @param {string} mode - mode de scoring.
   *
   * @returns {Object} Resume `scoreGlobal/Etudiant/Professeur`.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : toute valeur inconnue retombe sur le profil `equilibre`.
   */
  static _composeModeSummary(analyses, mode) {
    const profile = ScoringProfiles.get(mode);
    const scoreEtudiant = round(analyses.studentAnalysis.score);
    const scoreProfesseur = round(analyses.teacherAnalysis.score);

    return {
      mode: profile.mode,
      scoreGlobal: round(
        clamp(
          scoreEtudiant * profile.weights.etudiant +
            scoreProfesseur * profile.weights.professeur
        )
      ),
      scoreEtudiant,
      scoreProfesseur,
    };
  }

  /**
   * Lance les deux analyseurs de scoring_v1.
   *
   * @param {Object} [payload={}] - snapshot read-only de scoring.
   *
   * @returns {Object} Resultats bruts des analyseurs.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : reconstruit les horaires cibles avant analyse.
   */
  static _analyze(payload = {}) {
    return {
      studentAnalysis: StudentScheduleAnalyzer.analyze(
        ScheduleScorer._buildStudentSchedules(payload)
      ),
      teacherAnalysis: TeacherScheduleAnalyzer.analyze(
        ScheduleScorer._buildTeacherSchedules(payload)
      ),
    };
  }

  /**
   * Reconstruit les horaires par etudiant.
   *
   * @param {Object} [payload={}] - snapshot read-only de scoring.
   *
   * @returns {Object[]} Horaires par etudiant.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - les reprises sont marquees `isRecovery` ;
   * - elles restent visibles dans les details mais ne doivent pas dominer le score principal ;
   * - une deduplication evite de doubler des occurrences equivalentes.
   */
  static _buildStudentSchedules(payload = {}) {
    const placements = Array.isArray(payload?.placements) ? payload.placements : [];
    const assignments = normalizeStudentGroupAssignments(payload?.affectationsEtudiantGroupe);
    const recoveryAssignments = Array.isArray(payload?.affectationsReprises)
      ? payload.affectationsReprises
      : [];
    const placementsByGroup = new Map();

    for (const placement of placements) {
      appendIndexedPlacement(placementsByGroup, placement?.nom_groupe, placement);

      const idGroup = Number(placement?.id_groupe);
      if (Number.isInteger(idGroup) && idGroup > 0) {
        appendIndexedPlacement(placementsByGroup, idGroup, placement);
      }
    }

    const schedules = new Map();
    const seenKeysByStudent = new Map();

    const ensureStudent = (studentId) => {
      const normalizedId = Number(studentId);
      if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
        return null;
      }

      if (!schedules.has(normalizedId)) {
        schedules.set(normalizedId, {
          id_etudiant: normalizedId,
          placements: [],
        });
      }

      if (!seenKeysByStudent.has(normalizedId)) {
        seenKeysByStudent.set(normalizedId, new Set());
      }

      return schedules.get(normalizedId);
    };

    const appendPlacement = (studentId, placement, isRecovery) => {
      const schedule = ensureStudent(studentId);
      if (!schedule) {
        return;
      }

      const dedupeKey = `${buildPlacementKey(placement)}|${isRecovery ? "R" : "N"}`;
      const seenKeys = seenKeysByStudent.get(Number(studentId));
      if (seenKeys.has(dedupeKey)) {
        return;
      }

      seenKeys.add(dedupeKey);
      schedule.placements.push({
        ...placement,
        isRecovery,
      });
    };

    for (const [studentId, groupAssignments] of assignments.entries()) {
      const normalizedAssignments = Array.isArray(groupAssignments)
        ? groupAssignments
        : [groupAssignments];

      for (const groupAssignment of normalizedAssignments) {
        const groupKey = String(groupAssignment || "").trim();
        if (groupKey === "") {
          continue;
        }

        for (const placement of placementsByGroup.get(groupKey) || []) {
          appendPlacement(studentId, placement, false);
        }
      }
    }

    for (const recoveryAssignment of recoveryAssignments) {
      const studentId = Number(recoveryAssignment?.id_etudiant);
      const idCours = Number(recoveryAssignment?.id_cours);
      const groupKey = getRecoveryGroupKey(recoveryAssignment);

      if (!Number.isInteger(studentId) || studentId <= 0 || !groupKey) {
        continue;
      }

      const matchingPlacements = (placementsByGroup.get(groupKey) || []).filter(
        (placement) => Number(placement?.id_cours) === idCours
      );

      for (const placement of matchingPlacements) {
        appendPlacement(studentId, placement, true);
      }
    }

    return [...schedules.values()].map((schedule) => ({
      ...schedule,
      placements: [...schedule.placements].sort(comparePlacements),
    }));
  }

  /**
   * Reconstruit les horaires par professeur.
   *
   * @param {Object} [payload={}] - snapshot read-only de scoring.
   *
   * @returns {Object[]} Horaires par professeur.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : ignore les placements sans professeur exploitable.
   */
  static _buildTeacherSchedules(payload = {}) {
    const placements = Array.isArray(payload?.placements) ? payload.placements : [];
    const schedules = new Map();

    for (const placement of placements) {
      const teacherId = Number(placement?.id_professeur);
      if (!Number.isInteger(teacherId) || teacherId <= 0) {
        continue;
      }

      if (!schedules.has(teacherId)) {
        schedules.set(teacherId, {
          id_professeur: teacherId,
          nom_professeur: placement?.nom_professeur || null,
          placements: [],
        });
      }

      schedules.get(teacherId).placements.push(placement);
    }

    return [...schedules.values()].map((schedule) => ({
      ...schedule,
      placements: [...schedule.placements].sort(comparePlacements),
    }));
  }
}
