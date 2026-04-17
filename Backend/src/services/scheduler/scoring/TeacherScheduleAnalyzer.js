/**
 * Analyseur de confort horaire pour les professeurs.
 *
 * Ce module mesure la qualité du planning d'un professeur en calculant un score
 * de confort sur 100. Un score élevé = planning agréable pour l'enseignant.
 * Un score bas = planning fragmenté, surchargé ou avec de longs trous.
 *
 * Métriques analysées par jour :
 *  - Trous (holeCount) : cours non consécutifs le même jour
 *  - Amplitude (amplitudeMinutes) : durée entre le premier et dernier cours
 *  - Surcharge (overloadDays) : journées avec plus de 3 cours
 *  - Jours fragmentés : au moins 1 trou dans la journée
 *
 * Pénalités appliquées :
 *  - Trou court (1–60 min) : 0 points (pause acceptable)
 *  - Trou moyen (61–120 min) : 3 points
 *  - Trou long (121–180 min) : 8 points
 *  - Trou très long (>180 min) : 14 + 5*(durée-3h)/h
 *  - Amplitude > 9h : 5 points par heure supplémentaire
 *  - Plus de 3 cours/jour : 12 + 10 par cours supplémentaire
 *  - Trous multiples : 4 points par trou supplémentaire au-delà du premier
 *  - Pause manquée : 8 points
 *  - Cours tardifs : transmis depuis buildDayTimeline
 *
 * Bonus accordés :
 *  - Journée avec 1 seul cours : +1 point
 *  - Journée avec 2 cours consécutifs (aucun trou) : +3 points
 *  - Pause respectée : +4 points
 *  - Répartition correcte sur 4–5 jours (avec ≥4 cours) : +2 points
 *
 * @module services/scheduler/scoring/TeacherScheduleAnalyzer
 */

import {
  buildDayTimeline,
  clamp,
  comparePlacementsByTime,
  getWeekKey,
  mergeTotals,
  round,
} from "./GroupScheduleAnalyzer.js";

/**
 * Calcule la pénalité pour un trou entre deux cours.
 *
 * Un court trou (≤ 60 min = pause réglementaire) n'est pas pénalisé.
 * Au-delà, plus le trou est long, plus la pénalité est grande.
 *
 * Barème :
 *  - 0 à 60 min  : 0 point (pause normale)
 *  - 61 à 120 min : 3 points
 *  - 121 à 180 min : 8 points
 *  - > 180 min   : 14 + 5 par heure supplémentaire au-delà de 3h
 *
 * @param {number} gapMinutes - Durée du trou en minutes
 * @returns {number} La pénalité à appliquer
 */
function gapPenaltyMinutes(gapMinutes) {
  if (gapMinutes <= 60) {
    return 0; // Trou court = pause acceptable, pas de pénalité
  }

  if (gapMinutes <= 120) {
    return 3; // Trou de 1h à 2h = inconfort léger
  }

  if (gapMinutes <= 180) {
    return 8; // Trou de 2h à 3h = inconfort notable
  }

  // Au-delà de 3h : pénalité progressive par heure supplémentaire
  return 14 + Math.ceil((gapMinutes - 180) / 60) * 5;
}

/**
 * Calcule la pénalité pour le nombre de jours travaillés dans la semaine.
 *
 * Objectif : encourager une répartition équilibrée des cours dans la semaine.
 * Pénalise les situations extrêmes :
 *  - Plus de 5 jours de travail par semaine
 *  - Trop de cours concentrés sur trop peu de jours
 *
 * @param {number} workingDays - Nombre de jours avec au moins 1 cours cette semaine
 * @param {number} totalSessions - Nombre total de séances cette semaine
 * @returns {number} La pénalité à appliquer
 */
function workingDaysPenalty(workingDays, totalSessions) {
  if (workingDays > 5) {
    // Travail le week-end ou sur 6+ jours → très pénalisé
    return (workingDays - 5) * 6;
  }

  if (totalSessions >= 8 && workingDays <= 3) {
    // Beaucoup de cours concentrés sur 3 jours ou moins → surcharge
    return 6;
  }

  if (totalSessions >= 6 && workingDays <= 2) {
    // 6+ cours sur 2 jours → surcharge extrême
    return 8;
  }

  return 0;
}

/**
 * Calcule un bonus pour une bonne répartition des jours de travail.
 *
 * @param {number} workingDays - Nombre de jours travaillés dans la semaine
 * @param {number} totalSessions - Nombre de séances dans la semaine
 * @returns {number} Le bonus à accorder
 */
function workingDaysBonus(workingDays, totalSessions) {
  if (totalSessions >= 4 && workingDays >= 4 && workingDays <= 5) {
    // Bonne répartition : 4+ cours sur 4-5 jours → planning équilibré
    return 2;
  }

  return 0;
}

/**
 * Initialise un objet de totaux pour accumuler les métriques.
 *
 * @returns {object} Objet totaux avec toutes les propriétés à zéro
 */
function initTotals() {
  return {
    sessions: 0,              // Nombre total de séances analysées
    workingDays: 0,           // Nombre total de jours avec au moins 1 cours
    overloadDays: 0,          // Jours avec > 3 cours
    fragmentedDays: 0,        // Jours avec au moins 1 trou entre cours
    holeCount: 0,             // Nombre total de trous dans les plannings
    holeMinutes: 0,           // Durée totale des trous en minutes
    amplitudeHours: 0,        // Amplitude cumulée en heures (premier cours → dernier cours)
    longAmplitudeDays: 0,     // Jours avec amplitude > 9 heures
    pauseRespectedDays: 0,    // Jours où la règle de pause a été respectée
    pauseMissedDays: 0,       // Jours où la règle de pause a été violée
    pauseRespectedCount: 0,   // Nombre de pauses respectées
    pauseMissedCount: 0,      // Nombre de pauses manquées
    singleSessionDays: 0,     // Jours avec exactement 1 cours
    compactDoubleDays: 0,     // Jours avec 2 cours consécutifs (sans trou)
    lateSlotsOccupied: 0,     // Nombre de créneaux tardifs occupés (pénalité)
    lateCoursePenalty: 0,     // Pénalité totale pour les cours tardifs
  };
}

/**
 * Analyse le planning d'une journée et calcule ses pénalités et bonus.
 *
 * Délègue la construction de la "timeline" à GroupScheduleAnalyzer.buildDayTimeline()
 * qui calcule les trous, l'amplitude, les pauses, etc.
 *
 * Applique ensuite les règles spécifiques aux professeurs :
 *  - Pénalités pour trous, surcharge, amplitude excessive
 *  - Bonus pour jours simples ou jours compacts à 2 cours
 *
 * @param {object[]} placements - Liste des cours du professeur ce jour-là
 * @returns {{ penalty: number, bonus: number, totals: object }} Résultat journalier
 */
function analyzeDay(placements) {
  const timeline = buildDayTimeline(placements);
  const sessions = timeline.sessions;
  const totals = initTotals();
  let penalty = 0;
  let bonus = 0;

  // Récupérer les métriques calculées par la timeline
  totals.holeCount = timeline.holeCount;
  totals.holeMinutes = timeline.holeMinutes;
  totals.amplitudeHours = timeline.amplitudeMinutes / 60;
  totals.pauseRespectedDays = timeline.pauseRespectedCount;
  totals.pauseMissedDays = timeline.pauseMissedCount;
  totals.pauseRespectedCount = timeline.pauseRespectedCount;
  totals.pauseMissedCount = timeline.pauseMissedCount;
  totals.lateSlotsOccupied = timeline.lateSlotsOccupied;
  totals.lateCoursePenalty = timeline.lateCoursePenalty;

  // Pénalité pour chaque trou positif dans la journée (trous > 0 min)
  for (const gapMinutes of timeline.positiveGaps) {
    penalty += gapPenaltyMinutes(gapMinutes);
  }

  // Journée fragmentée : au moins 1 trou
  if (timeline.holeCount > 0) {
    totals.fragmentedDays = 1;
  }

  // Surcharge : plus de 3 cours en une journée
  if (sessions.length > 3) {
    totals.overloadDays = 1;
    penalty += 12 + (sessions.length - 3) * 10; // Base + 10 par cours de trop
  }

  // Amplitude trop longue : premier cours → dernier cours > 9 heures
  if (timeline.amplitudeMinutes > 9 * 60) {
    totals.longAmplitudeDays = 1;
    penalty += Math.ceil((timeline.amplitudeMinutes - 9 * 60) / 60) * 5; // 5 pts/h supplémentaire
  }

  // Trous multiples dans une journée : pénalité supplémentaire par trou au-delà du premier
  if (timeline.holeCount > 1) {
    penalty += (timeline.holeCount - 1) * 4;
  }

  // Bonus pour journées légères ou bien structurées
  if (sessions.length === 1) {
    totals.singleSessionDays = 1;
    bonus += 1; // Journée simple : petit bonus
  } else if (sessions.length === 2 && timeline.holeCount === 0) {
    totals.compactDoubleDays = 1;
    bonus += 3; // Deux cours consécutifs sans trou : meilleure structure
  }

  // Pénalités et bonus de pauses (transmis depuis la timeline)
  penalty += timeline.lateCoursePenalty;    // Cours très tardifs (après 20h ou 21h)
  penalty += timeline.pauseMissedCount * 8; // Pause obligatoire manquée
  bonus += timeline.pauseRespectedCount * 4; // Pause bien respectée

  return {
    penalty,
    bonus,
    totals,
  };
}

/**
 * Analyseur de qualité d'horaire pour les professeurs.
 *
 * Calcule un score global de confort pour l'ensemble des professeurs.
 * Chaque professeur est analysé semaine par semaine, puis ses scores
 * sont agrégés pour obtenir un score global du planning total.
 */
export class TeacherScheduleAnalyzer {
  /**
   * Analyse la qualité du planning de tous les professeurs.
   *
   * Algorithme :
   *  1. Pour chaque professeur → regrouper ses cours par semaine puis par jour
   *  2. Pour chaque journée → calculer pénalités et bonus via analyzeDay()
   *  3. Pour chaque semaine → ajouter la pénalité de répartition workingDaysPenalty()
   *  4. Calculer le score du professeur : clamp(100 - pénalité_effective / nb_semaines)
   *  5. Agréger les scores de tous les professeurs en une moyenne
   *
   * Score retourné :
   *  - 100 : planning parfait (cours bien répartis, sans trous, sans surcharge)
   *  - < 70 : planning inconfortable (à améliorer)
   *  - 0 : planning catastrophique (tous les critères violés)
   *
   * @param {object[]} teacherSchedules - Liste des horaires, un par professeur
   * @param {number} teacherSchedules[n].id_professeur - ID du professeur
   * @param {object[]} teacherSchedules[n].placements - Placements triés chronologiquement
   * @returns {{
   *   score: number,        - Score global 0-100
   *   teachersTotal: number,
   *   teachersAnalyzed: number,
   *   weeksAnalyzed: number,
   *   totals: object,       - Métriques agrégées
   *   averages: object      - Moyennes par semaine
   * }}
   */
  static analyze(teacherSchedules = []) {
    let teachersTotal = 0;       // Tous les professeurs (même ceux sans cours)
    let teachersAnalyzed = 0;    // Professeurs avec au moins 1 cours
    let weeksAnalyzed = 0;       // Semaines analysées en tout
    let scoreSum = 0;            // Somme des scores individuels (pour la moyenne)
    let totalEffectivePenalty = 0;
    const totals = initTotals();

    for (const teacherSchedule of Array.isArray(teacherSchedules) ? teacherSchedules : []) {
      teachersTotal += 1;

      const placements = Array.isArray(teacherSchedule?.placements)
        ? teacherSchedule.placements
        : [];

      if (placements.length === 0) {
        continue; // Professeur sans cours → pas d'analyse possible
      }

      teachersAnalyzed += 1;

      // Regrouper les placements par semaine puis par jour
      const weeks = new Map(); // Map<weekKey, Map<dayKey, placement[]>>

      for (const placement of placements.sort(comparePlacementsByTime)) {
        const weekKey = getWeekKey(placement?.date);   // Ex: "2025-W03"
        const dayKey = String(placement?.date || "").trim(); // Ex: "2025-01-15"

        if (!weekKey || !dayKey) {
          continue; // Placement sans date → ignoré
        }

        if (!weeks.has(weekKey)) {
          weeks.set(weekKey, new Map());
        }
        if (!weeks.get(weekKey).has(dayKey)) {
          weeks.get(weekKey).set(dayKey, []);
        }

        weeks.get(weekKey).get(dayKey).push(placement);
      }

      // Analyser chaque semaine
      const entityTotals = initTotals();
      entityTotals.sessions = placements.length;
      let entityPenalty = 0;
      let entityBonus = 0;
      let entityWeekCount = 0;

      for (const daysMap of weeks.values()) {
        const workingDays = daysMap.size;
        const sessionsThisWeek = [...daysMap.values()].reduce(
          (sum, dayPlacements) => sum + dayPlacements.length,
          0
        );

        entityWeekCount += 1;
        entityTotals.workingDays += workingDays;

        // Pénalité pour la répartition dans la semaine
        entityPenalty += workingDaysPenalty(workingDays, sessionsThisWeek);
        entityBonus += workingDaysBonus(workingDays, sessionsThisWeek);

        // Analyse journalière
        for (const dayPlacements of daysMap.values()) {
          const dayAnalysis = analyzeDay(dayPlacements);
          entityPenalty += dayAnalysis.penalty;
          entityBonus += dayAnalysis.bonus;
          mergeTotals(entityTotals, dayAnalysis.totals);
        }
      }

      // Le bonus est plafonné à 8 points par semaine pour éviter les abus
      const maxBonus = entityWeekCount * 8;

      // Pénalité effective = pénalité brute - bonus (capped)
      const effectivePenalty = Math.max(
        0,
        entityPenalty - Math.min(entityBonus, maxBonus)
      );

      // Score du professeur : retranche la pénalité moyenne par semaine
      const entityScore =
        entityWeekCount > 0
          ? clamp(100 - effectivePenalty / entityWeekCount)
          : 100; // Pas de semaines analysées → score parfait par défaut

      weeksAnalyzed += entityWeekCount;
      totalEffectivePenalty += effectivePenalty;
      scoreSum += entityScore;
      mergeTotals(totals, entityTotals);
    }

    return {
      // Score global = moyenne des scores individuels
      score: teachersAnalyzed > 0 ? round(scoreSum / teachersAnalyzed) : 100,
      teachersTotal,
      teachersAnalyzed,
      weeksAnalyzed,
      totals: {
        sessions: totals.sessions,
        workingDays: totals.workingDays,
        overloadDays: totals.overloadDays,
        fragmentedDays: totals.fragmentedDays,
        holeCount: totals.holeCount,
        holeHours: round(totals.holeMinutes / 60),
        averageAmplitudeHours:
          totals.workingDays > 0 ? round(totals.amplitudeHours / totals.workingDays) : 0,
        longAmplitudeDays: totals.longAmplitudeDays,
        pauseRespectedDays: totals.pauseRespectedDays,
        pauseMissedDays: totals.pauseMissedDays,
        pauseRespectedCount: totals.pauseRespectedCount,
        pauseMissedCount: totals.pauseMissedCount,
        singleSessionDays: totals.singleSessionDays,
        compactDoubleDays: totals.compactDoubleDays,
        lateSlotsOccupied: totals.lateSlotsOccupied,
        lateCoursePenalty: totals.lateCoursePenalty,
      },
      averages: {
        sessionsPerWeek: weeksAnalyzed > 0 ? round(totals.sessions / weeksAnalyzed) : 0,
        workingDaysPerWeek: weeksAnalyzed > 0 ? round(totals.workingDays / weeksAnalyzed) : 0,
        holeCountPerWeek: weeksAnalyzed > 0 ? round(totals.holeCount / weeksAnalyzed) : 0,
        holeHoursPerWeek:
          weeksAnalyzed > 0 ? round(totals.holeMinutes / 60 / weeksAnalyzed) : 0,
        fragmentedDaysPerWeek:
          weeksAnalyzed > 0 ? round(totals.fragmentedDays / weeksAnalyzed) : 0,
        overloadDaysPerWeek:
          weeksAnalyzed > 0 ? round(totals.overloadDays / weeksAnalyzed) : 0,
        longAmplitudeDaysPerWeek:
          weeksAnalyzed > 0 ? round(totals.longAmplitudeDays / weeksAnalyzed) : 0,
        lateCoursePenaltyPerWeek:
          weeksAnalyzed > 0 ? round(totals.lateCoursePenalty / weeksAnalyzed) : 0,
        effectivePenaltyPerWeek:
          weeksAnalyzed > 0 ? round(totalEffectivePenalty / weeksAnalyzed) : 0,
      },
    };
  }
}
