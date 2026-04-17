/**
 * Compositeur du score global d'un planning académique.
 *
 * Ce module est le point d'entrée principal du système de scoring.
 * Il orchestre les trois analyseurs spécialisés et compose un score global
 * pondéré selon le profil de scoring choisi.
 *
 * Architecture du scoring :
 *
 *   ScheduleScorer
 *     ├─ StudentScheduleAnalyzer  → score de confort des ÉTUDIANTS
 *     ├─ TeacherScheduleAnalyzer  → score de confort des PROFESSEURS
 *     └─ GroupScheduleAnalyzer    → score de qualité des GROUPES
 *
 * Le score global est une moyenne pondérée des trois sous-scores.
 * Les pondérations dépendent du mode de scoring (via ScoringProfiles) :
 *  - "etudiant"   : étudiant × 0.7 + professeur × 0.15 + groupe × 0.15
 *  - "professeur" : étudiant × 0.15 + professeur × 0.7 + groupe × 0.15
 *  - "equilibre"  : étudiant × 0.4 + professeur × 0.35 + groupe × 0.25
 *
 * Format du payload attendu en entrée :
 *  {
 *    placements:               object[]  - Toutes les séances planifiées
 *    affectationsEtudiantGroupe: Map|object - Map<id_etudiant, groupes[]>
 *    affectationsReprises:     object[]  - Cours de reprise des étudiants
 *    participantsParAffectation: Map     - Map<id_affectation_cours, id_etudiant[]>
 *    nonPlanifies:             object[]  - Cours qui n'ont pas pu être planifiés
 *    nbConflitsEvites:         number    - Nombre de conflits évités par le scheduler
 *  }
 *
 * @module services/scheduler/scoring/ScheduleScorer
 */

import { GroupScheduleAnalyzer, comparePlacementsByTime, round } from "./GroupScheduleAnalyzer.js";
import { ScoringProfiles } from "./ScoringProfiles.js";
import { StudentScheduleAnalyzer } from "./StudentScheduleAnalyzer.js";
import { TeacherScheduleAnalyzer } from "./TeacherScheduleAnalyzer.js";

/**
 * Fixe une valeur numérique dans l'intervalle [min, max].
 *
 * @param {number} value - La valeur à limiter
 * @param {number} [min=0] - Borne inférieure
 * @param {number} [max=100] - Borne supérieure
 * @returns {number} La valeur dans l'intervalle [min, max]
 */
function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalise les affectations étudiant → groupe vers une Map<number, *>.
 *
 * Accepte trois formats d'entrée :
 *  - Map native
 *  - Tableau de paires [clé, valeur]
 *  - Objet JavaScript ordinaire (les clés string sont converties en nombres)
 *
 * @param {Map|Array|object} assignments - Les affectations à normaliser
 * @returns {Map<number, *>} Map normalisée
 */
function normalizeStudentGroupAssignments(assignments) {
  if (assignments instanceof Map) {
    return assignments;
  }

  if (Array.isArray(assignments)) {
    return new Map(assignments);
  }

  if (assignments && typeof assignments === "object") {
    // Objectclassique → Map avec clés numériques
    return new Map(
      Object.entries(assignments).map(([key, value]) => [Number(key), value])
    );
  }

  return new Map();
}

/**
 * Normalise la Map participants par affectation vers un format strictement typé.
 *
 * Garantit que :
 *  - Les clés sont des entiers positifs (ID d'affectation)
 *  - Les valeurs sont des arrays d'entiers positifs (ID d'étudiants)
 *  - Les doublons d'IDs étudiant sont supprimés (Set)
 *  - Les IDs invalides (NaN, 0, négatifs) sont filtrés
 *
 * @param {Map|Array|object} assignments - Les participants par affectation
 * @returns {Map<number, number[]>} Map normalisée id_affectation → ids_etudiant[]
 */
function normalizeParticipantsByAssignment(assignments) {
  if (assignments instanceof Map) {
    return new Map(
      [...assignments.entries()]
        .map(([key, value]) => [
          Number(key),
          [...new Set(
            (Array.isArray(value) ? value : [])
              .map((studentId) => Number(studentId))
              .filter((studentId) => Number.isInteger(studentId) && studentId > 0)
          )].sort((left, right) => left - right), // Tri pour la reproductibilité
        ])
        .filter(([assignmentId]) => Number.isInteger(assignmentId) && assignmentId > 0)
    );
  }

  if (Array.isArray(assignments)) {
    return normalizeParticipantsByAssignment(new Map(assignments));
  }

  if (assignments && typeof assignments === "object") {
    return normalizeParticipantsByAssignment(
      new Map(Object.entries(assignments).map(([key, value]) => [Number(key), value]))
    );
  }

  return new Map();
}

/**
 * Ajoute un placement à une Map d'index par clé.
 *
 * Si la clé n'existe pas encore, crée un tableau vide.
 * Utilisée pour construire les index placementsByGroup et placementsByAssignment.
 *
 * @param {Map} index - La Map d'index à mettre à jour
 * @param {*} key - La clé d'indexation (groupe, ID, etc.)
 * @param {object} placement - Le placement à ajouter
 */
function appendIndexedPlacement(index, key, placement) {
  if (key == null || key === "") {
    return; // Clé invalide → ignorer
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
 * Construit une clé unique pour un placement.
 *
 * Utilisée pour la déduplication des placements dans les horaires étudiants.
 * Un même cours planifié deux fois (via groupe et via reprise par exemple) ne doit
 * apparaître qu'une seule fois dans l'horaire d'un étudiant.
 *
 * @param {object} placement - Le placement dont on construit la clé
 * @returns {string} Clé unique représentant cette séance
 */
function buildPlacementKey(placement) {
  return [
    placement?.id_affectation_cours || "",
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
 * Extrait la clé de groupe d'une affectation de reprise.
 *
 * Préfère l'ID numérique du groupe à son nom pour la fiabilité.
 *
 * @param {object} recoveryAssignment - L'affectation de reprise
 * @returns {string|null} La clé de groupe (ID numérique ou nom), ou null
 */
function getRecoveryGroupKey(recoveryAssignment) {
  const idGroup = Number(recoveryAssignment?.id_groupe);
  if (Number.isInteger(idGroup) && idGroup > 0) {
    return String(idGroup);
  }

  const groupName = String(recoveryAssignment?.nom_groupe || "").trim();
  return groupName || null;
}

/**
 * Vérifie si un placement de reprise correspond à un étudiant et un cours donnés.
 *
 * Une reprise est une situation où un étudiant a manqué un cours dans son groupe
 * d'origine et doit le rattraper dans un autre groupe. Cette fonction identifie
 * si un placement donné correspond à la session de rattrapage d'un étudiant.
 *
 * @param {number} studentId - ID de l'étudiant
 * @param {object} placement - Le placement à vérifier
 * @param {object} recoveryAssignment - L'affectation de reprise
 * @returns {boolean} true si ce placement est la reprise de cet étudiant
 */
function matchesRecoveryAssignment(studentId, placement, recoveryAssignment) {
  // Vérifier que c'est bien cet étudiant
  if (Number(recoveryAssignment?.id_etudiant) !== Number(studentId)) {
    return false;
  }

  // Vérifier que c'est bien ce cours
  if (Number(recoveryAssignment?.id_cours) !== Number(placement?.id_cours)) {
    return false;
  }

  const recoveryGroupKey = getRecoveryGroupKey(recoveryAssignment);
  if (!recoveryGroupKey) {
    return false;
  }

  // Vérifier que c'est bien dans le groupe de rattrapage prévu
  const placementGroupId = Number(placement?.id_groupe);
  if (Number.isInteger(placementGroupId) && placementGroupId > 0) {
    return recoveryGroupKey === String(placementGroupId);
  }

  return recoveryGroupKey === String(placement?.nom_groupe || "").trim();
}

/**
 * Lit une valeur numérique depuis un champ ou retourne 0 si invalide.
 *
 * @param {*} value - La valeur à lire
 * @returns {number} La valeur numérique ou 0
 */
function readMetricValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

/**
 * Classe principale du système de scoring.
 *
 * Toutes les méthodes sont statiques (pas d'état interne) pour permettre
 * une utilisation sans instanciation.
 */
export class ScheduleScorer {
  /**
   * Calcule le score complet d'un planning dans un mode donné.
   *
   * @param {object} [payload={}] - Les données du planning (voir format en en-tête de module)
   * @param {string} [mode="equilibre"] - Le profil de scoring ("etudiant", "professeur", "equilibre")
   * @returns {{
   *   mode: string,
   *   scoreGlobal: number,
   *   scoreEtudiant: number,
   *   scoreProfesseur: number,
   *   scoreGroupe: number,
   *   metrics: object,
   *   details: object
   * }} Le rapport de score complet
   */
  static scoreSchedule(payload = {}, mode = "equilibre") {
    const analyses = ScheduleScorer._analyze(payload);
    return ScheduleScorer._composeScore(analyses, payload, mode);
  }

  /**
   * Calcule le score du planning dans TOUS les modes disponibles simultanément.
   *
   * Utile pour le tableau de bord qui affiche les scores en parallèle pour
   * permettre à l'administrateur de comparer les priorités.
   *
   * @param {object} [payload={}] - Les données du planning
   * @returns {{
   *   version: string,
   *   readOnly: boolean,
   *   modes: object,   - Un score par mode de scoring
   *   metrics: object, - Métriques brutes communes à tous les modes
   *   details: object  - Détails des analyses par couche
   * }}
   */
  static scoreAllModes(payload = {}) {
    const analyses = ScheduleScorer._analyze(payload);
    const metrics = ScheduleScorer._buildMetrics(analyses, payload);

    return {
      version: "v1",
      readOnly: true, // Le score est en lecture seule : il ne modifie pas le planning
      modes: Object.fromEntries(
        ScoringProfiles.list().map((mode) => [
          mode,
          ScheduleScorer._composeModeSummary(analyses, mode),
        ])
      ),
      metrics,
      details: {
        etudiant: analyses.studentAnalysis,
        professeur: analyses.teacherAnalysis,
        groupe: analyses.groupAnalysis,
      },
    };
  }

  /**
   * Compose le résultat complet d'un scoring pour un mode donné.
   * Combine le résumé de mode avec les métriques brutes et les détails d'analyse.
   *
   * @private
   */
  static _composeScore(analyses, payload, mode) {
    return {
      ...ScheduleScorer._composeModeSummary(analyses, mode),
      metrics: ScheduleScorer._buildMetrics(analyses, payload),
      details: {
        etudiant: analyses.studentAnalysis,
        professeur: analyses.teacherAnalysis,
        groupe: analyses.groupAnalysis,
      },
    };
  }

  /**
   * Calcule le score pondéré pour un mode de scoring spécifique.
   *
   * Applique les poids du profil (via ScoringProfiles) aux trois sous-scores.
   * La formule est : scoreGlobal = Σ(sous-score × poids) avec clamp [0, 100].
   *
   * @private
   */
  static _composeModeSummary(analyses, mode) {
    const profile = ScoringProfiles.get(mode);

    // Utiliser globalWeights si disponible, sinon weights (rétrocompat)
    const globalWeights = profile.globalWeights || profile.weights;

    // Arrondir chaque sous-score à 2 décimales
    const scoreEtudiant = round(analyses.studentAnalysis.score);
    const scoreProfesseur = round(analyses.teacherAnalysis.score);
    const scoreGroupe = round(analyses.groupAnalysis.score);

    return {
      mode: profile.mode,
      // Score pondéré final, clampé dans [0, 100]
      scoreGlobal: round(
        clamp(
          scoreEtudiant * readMetricValue(globalWeights?.etudiant) +
            scoreProfesseur * readMetricValue(globalWeights?.professeur) +
            scoreGroupe * readMetricValue(globalWeights?.groupe)
        )
      ),
      scoreEtudiant,
      scoreProfesseur,
      scoreGroupe,
    };
  }

  /**
   * Lance les trois analyses (étudiant, professeur, groupe) sur le payload.
   *
   * Chaque analyseur reçoit ses données sous une forme adaptée,
   * construite par les méthodes _build*Schedules().
   *
   * @private
   */
  static _analyze(payload = {}) {
    return {
      studentAnalysis: StudentScheduleAnalyzer.analyze(
        ScheduleScorer._buildStudentSchedules(payload)
      ),
      teacherAnalysis: TeacherScheduleAnalyzer.analyze(
        ScheduleScorer._buildTeacherSchedules(payload)
      ),
      groupAnalysis: GroupScheduleAnalyzer.analyze(
        ScheduleScorer._buildGroupSchedules(payload)
      ),
    };
  }

  /**
   * Agrège les métriques brutes des trois analyses en un objet unifié.
   *
   * Ces métriques sont indépendantes du mode de scoring et représentent
   * des faits objectifs sur le planning (pauses respectées, cours non planifiés...).
   *
   * @private
   */
  static _buildMetrics(analyses, payload = {}) {
    const studentTotals = analyses.studentAnalysis?.totals || {};
    const teacherTotals = analyses.teacherAnalysis?.totals || {};
    const groupTotals = analyses.groupAnalysis?.totals || {};

    // Cours non planifiés : chercher dans plusieurs formats de payload
    const nonPlannedCourses = Array.isArray(payload?.nonPlanifies)
      ? payload.nonPlanifies.length
      : Array.isArray(payload?.non_planifies)
        ? payload.non_planifies.length
        : readMetricValue(payload?.nbCoursNonPlanifies ?? payload?.nb_cours_non_planifies);

    return {
      pausesEtudiantsRespectees: readMetricValue(
        studentTotals.pauseRespectedCount ?? studentTotals.dynamicBreaksRespected
      ),
      pausesEtudiantsManquees: readMetricValue(
        studentTotals.pauseMissedCount ?? studentTotals.dynamicBreaksMissed
      ),
      pausesProfesseursRespectees: readMetricValue(teacherTotals.pauseRespectedCount),
      pausesProfesseursManquees: readMetricValue(teacherTotals.pauseMissedCount),
      pausesGroupesRespectees: readMetricValue(groupTotals.pauseRespectedCount),
      pausesGroupesManquees: readMetricValue(groupTotals.pauseMissedCount),
      nbCoursNonPlanifies: nonPlannedCourses,
      nbConflitsEvites: readMetricValue(
        payload?.nbConflitsEvites ?? payload?.nb_conflits_evites ?? payload?.conflitsEvites
      ),
      penaliteCoursTardifsEtudiants: readMetricValue(studentTotals.lateCoursePenalty),
      penaliteCoursTardifsProfesseurs: readMetricValue(teacherTotals.lateCoursePenalty),
      penaliteCoursTardifsGroupes: readMetricValue(groupTotals.lateCoursePenalty),
      // Total des pénalités tardives sur toutes les couches
      penaliteCoursTardifsTotale:
        readMetricValue(studentTotals.lateCoursePenalty) +
        readMetricValue(teacherTotals.lateCoursePenalty) +
        readMetricValue(groupTotals.lateCoursePenalty),
    };
  }

  /**
   * Construit les horaires individuels de chaque étudiant pour l'analyse.
   *
   * Ce traitement est le plus complexe car :
   *  - Un étudiant peut être dans plusieurs groupes (reprises)
   *  - Le même cours peut apparaître via groupe ET via reprise → déduplication nécessaire
   *  - Deux modes possibles selon les données disponibles :
   *      A. participantsParAffectation (précis, données réelles)
   *      B. affectationsEtudiantGroupe (approximatif, basé sur les groupes)
   *
   * @private
   */
  static _buildStudentSchedules(payload = {}) {
    const placements = Array.isArray(payload?.placements) ? payload.placements : [];
    const assignments = normalizeStudentGroupAssignments(payload?.affectationsEtudiantGroupe);
    const recoveryAssignments = Array.isArray(payload?.affectationsReprises)
      ? payload.affectationsReprises
      : [];
    const participantsByAssignment = normalizeParticipantsByAssignment(
      payload?.participantsParAffectation
    );

    // Index des placements par groupe (ID numérique OU nom de groupe)
    const placementsByGroup = new Map();
    const schedules = new Map(); // Map<id_etudiant, { id_etudiant, placements[] }>
    const seenKeysByStudent = new Map(); // Map<id_etudiant, Set<dedupeKey>>

    // Construire l'index des placements par groupe
    for (const placement of placements) {
      appendIndexedPlacement(placementsByGroup, placement?.nom_groupe, placement);

      const idGroup = Number(placement?.id_groupe);
      if (Number.isInteger(idGroup) && idGroup > 0) {
        appendIndexedPlacement(placementsByGroup, idGroup, placement);
      }
    }

    /**
     * S'assure qu'un étudiant a une entrée dans schedules et seenKeysByStudent.
     * Retourne null si l'ID étudiant est invalide.
     */
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

    /**
     * Ajoute un placement à l'horaire d'un étudiant, avec déduplication.
     * Le flag isRecovery distingue les reprises des cours normaux.
     */
    const appendPlacement = (studentId, placement, flags = {}) => {
      const schedule = ensureStudent(studentId);
      if (!schedule) {
        return;
      }

      // Clé de déduplication : contenu du placement + flag reprise
      const dedupeKey = `${buildPlacementKey(placement)}|${flags.isRecovery ? "R" : "N"}`;
      const seenKeys = seenKeysByStudent.get(Number(studentId));

      if (seenKeys.has(dedupeKey)) {
        return; // Déjà ajouté → ignorer
      }

      seenKeys.add(dedupeKey);
      schedule.placements.push({
        ...placement,
        isRecovery: Boolean(flags.isRecovery),
        isRealParticipantPlacement: Boolean(flags.isRealParticipantPlacement),
      });
    };

    // S'assurer que tous les étudiants concernés ont une entrée (même sans placements)
    for (const studentId of assignments.keys()) {
      ensureStudent(studentId);
    }
    for (const recoveryAssignment of recoveryAssignments) {
      ensureStudent(recoveryAssignment?.id_etudiant);
    }
    for (const participantIds of participantsByAssignment.values()) {
      for (const studentId of participantIds) {
        ensureStudent(studentId);
      }
    }

    // Mode A : données précises (participantsParAffectation disponible)
    if (participantsByAssignment.size > 0) {
      for (const placement of placements) {
        const assignmentId = Number(placement?.id_affectation_cours);
        if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
          continue;
        }

        for (const studentId of participantsByAssignment.get(assignmentId) || []) {
          appendPlacement(studentId, placement, {
            isRecovery: recoveryAssignments.some((recoveryAssignment) =>
              matchesRecoveryAssignment(studentId, placement, recoveryAssignment)
            ),
            isRealParticipantPlacement: true,
          });
        }
      }
    } else {
      // Mode B : approximatif (basé sur les affectations groupe)
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
            appendPlacement(studentId, placement, {
              isRecovery: false,
              isRealParticipantPlacement: false,
            });
          }
        }
      }
    }

    // Ajouter les placements de reprise (cours rattrapés dans un autre groupe)
    for (const recoveryAssignment of recoveryAssignments) {
      const studentId = Number(recoveryAssignment?.id_etudiant);
      const groupKey = getRecoveryGroupKey(recoveryAssignment);
      const courseId = Number(recoveryAssignment?.id_cours);

      if (!Number.isInteger(studentId) || studentId <= 0 || !groupKey) {
        continue;
      }

      const matchingPlacements = (placementsByGroup.get(groupKey) || []).filter(
        (placement) => Number(placement?.id_cours) === courseId
      );

      for (const placement of matchingPlacements) {
        appendPlacement(studentId, placement, {
          isRecovery: true,
          isRealParticipantPlacement: participantsByAssignment.size > 0,
        });
      }
    }

    // Trier les placements de chaque étudiant chronologiquement
    return [...schedules.values()].map((schedule) => ({
      ...schedule,
      placements: [...schedule.placements].sort(comparePlacementsByTime),
    }));
  }

  /**
   * Construit les horaires individuels de chaque professeur pour l'analyse.
   *
   * Plus simple que _buildStudentSchedules : chaque placement contient directement
   * l'ID du professeur affecté (id_professeur).
   *
   * @private
   */
  static _buildTeacherSchedules(payload = {}) {
    const placements = Array.isArray(payload?.placements) ? payload.placements : [];
    const schedules = new Map(); // Map<id_professeur, { id_professeur, nom_professeur, placements[] }>

    for (const placement of placements) {
      const teacherId = Number(placement?.id_professeur);
      if (!Number.isInteger(teacherId) || teacherId <= 0) {
        continue; // Placement sans professeur (cours en ligne ?) → ignorer
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
      placements: [...schedule.placements].sort(comparePlacementsByTime),
    }));
  }

  /**
   * Construit les horaires de chaque groupe d'étudiants pour l'analyse.
   *
   * La clé d'index est construite par priorité : ID numérique > nom du groupe.
   * Cette approche gère le cas où les placements de différentes sources
   * utilisent tantôt l'ID tantôt le nom.
   *
   * @private
   */
  static _buildGroupSchedules(payload = {}) {
    const placements = Array.isArray(payload?.placements) ? payload.placements : [];
    const schedules = new Map();

    for (const placement of placements) {
      const groupId = Number(placement?.id_groupe);
      const groupName = String(placement?.nom_groupe || "").trim();

      // Clé interne : préférer l'ID numérique pour la cohérence
      const scheduleKey =
        Number.isInteger(groupId) && groupId > 0 ? `id:${groupId}` : `nom:${groupName}`;

      if (!scheduleKey || scheduleKey === "nom:") {
        continue; // Pas de groupe identifiable → ignorer
      }

      if (!schedules.has(scheduleKey)) {
        schedules.set(scheduleKey, {
          id_groupe: Number.isInteger(groupId) && groupId > 0 ? groupId : null,
          nom_groupe: groupName || null,
          placements: [],
        });
      }

      schedules.get(scheduleKey).placements.push(placement);
    }

    return [...schedules.values()].map((schedule) => ({
      ...schedule,
      placements: [...schedule.placements].sort(comparePlacementsByTime),
    }));
  }
}
