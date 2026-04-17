/**
 * StudentScheduleAnalyzer
 *
 * Ce module mesure le confort etudiant a partir d'un horaire deja genere.
 */

import {
  buildDayTimeline,
  clamp,
  comparePlacementsByTime,
  getIsoWeekday,
  getWeekKey,
  mergeTotals,
  parseTimeToMinutes,
  round,
} from "./GroupScheduleAnalyzer.js";

function gapPenaltyMinutes(gapMinutes) {
  if (gapMinutes <= 60) {
    return 0;
  }

  if (gapMinutes <= 120) {
    return 4;
  }

  if (gapMinutes <= 180) {
    return 10;
  }

  return 18 + Math.ceil((gapMinutes - 180) / 60) * 6;
}

function activeDaysPenalty(activeDays) {
  if (activeDays === 3) {
    return 0;
  }

  if (activeDays === 4) {
    return 6;
  }

  if (activeDays === 5) {
    return 16;
  }

  if (activeDays === 2) {
    return 9;
  }

  if (activeDays === 1) {
    return 14;
  }

  return activeDays > 5 ? 24 + (activeDays - 5) * 8 : 0;
}

function classifySingleCourseDay(session) {
  const startMinutes = parseTimeToMinutes(session?.heure_debut);
  const endMinutes = parseTimeToMinutes(session?.heure_fin);

  if (startMinutes < 11 * 60) {
    return "debut";
  }

  if (startMinutes >= 14 * 60 || endMinutes >= 17 * 60) {
    return "fin";
  }

  return "milieu";
}

function initTotals() {
  return {
    regularSessions: 0,
    recoverySessions: 0,
    activeDays: 0,
    saturdayDays: 0,
    isolatedDays: 0,
    fragmentedDays: 0,
    overloadDays: 0,
    holeCount: 0,
    holeMinutes: 0,
    consecutiveBlocks: 0,
    compactDoubleDays: 0,
    dynamicBreaksRespected: 0,
    dynamicBreaksMissed: 0,
    pauseRespectedDays: 0,
    pauseMissedDays: 0,
    pauseRespectedCount: 0,
    pauseMissedCount: 0,
    lateSlotsOccupied: 0,
    lateCoursePenalty: 0,
    singleCourseEarlyDays: 0,
    singleCourseLateDays: 0,
    singleCourseMiddleDays: 0,
    recoveryDays: 0,
  };
}

function analyzeDay(dateValue, placements) {
  const timeline = buildDayTimeline(placements);
  const sessions = timeline.sessions;
  const totals = initTotals();
  let penalty = 0;
  let bonus = 0;

  totals.holeCount = timeline.holeCount;
  totals.holeMinutes = timeline.holeMinutes;
  totals.consecutiveBlocks = timeline.consecutiveBlocks;
  totals.lateSlotsOccupied = timeline.lateSlotsOccupied;
  totals.lateCoursePenalty = timeline.lateCoursePenalty;
  totals.pauseRespectedDays = timeline.pauseRespectedCount;
  totals.pauseMissedDays = timeline.pauseMissedCount;
  totals.pauseRespectedCount = timeline.pauseRespectedCount;
  totals.pauseMissedCount = timeline.pauseMissedCount;
  totals.dynamicBreaksRespected = timeline.pauseRespectedCount;
  totals.dynamicBreaksMissed = timeline.pauseMissedCount;

  for (const gapMinutes of timeline.positiveGaps) {
    penalty += gapPenaltyMinutes(gapMinutes);
  }

  if (getIsoWeekday(dateValue) === 6) {
    totals.saturdayDays = 1;
    penalty += 15;
  }

  if (sessions.length > 3) {
    totals.overloadDays = 1;
    penalty += 20 + (sessions.length - 3) * 12;
  }

  if (timeline.fragmentCount > 1) {
    totals.fragmentedDays = 1;
  }

  if (timeline.fragmentCount > 2) {
    penalty += (timeline.fragmentCount - 2) * 6;
  }

  if (sessions.length === 1) {
    totals.isolatedDays = 1;
    const singleCoursePlacement = classifySingleCourseDay(sessions[0]);
    if (singleCoursePlacement === "debut") {
      totals.singleCourseEarlyDays = 1;
      bonus += 4;
    } else if (singleCoursePlacement === "fin") {
      totals.singleCourseLateDays = 1;
      bonus += 2;
    } else {
      totals.singleCourseMiddleDays = 1;
      penalty += 8;
    }
  } else if (sessions.length === 2 && timeline.holeCount === 0) {
    totals.compactDoubleDays = 1;
    bonus += 4;
  }

  penalty += timeline.lateCoursePenalty;
  penalty += timeline.pauseMissedCount * 10;
  bonus += timeline.pauseRespectedCount * 6;

  return {
    penalty,
    bonus,
    totals,
  };
}

export class StudentScheduleAnalyzer {
  static analyze(studentSchedules = []) {
    let studentsTotal = 0;
    let studentsAnalyzed = 0;
    let studentsWithRecovery = 0;
    let studentsRecoveryOnly = 0;
    let studentsUsingRealParticipants = 0;
    let weeksAnalyzed = 0;
    let scoreSum = 0;
    let totalEffectivePenalty = 0;
    const totals = initTotals();

    for (const studentSchedule of Array.isArray(studentSchedules) ? studentSchedules : []) {
      studentsTotal += 1;

      const placements = Array.isArray(studentSchedule?.placements)
        ? studentSchedule.placements
        : [];
      const regularPlacements = placements
        .filter((placement) => !placement?.isRecovery)
        .sort(comparePlacementsByTime);
      const recoveryPlacements = placements
        .filter((placement) => Boolean(placement?.isRecovery))
        .sort(comparePlacementsByTime);

      if (recoveryPlacements.length > 0) {
        studentsWithRecovery += 1;
      }

      if (placements.some((placement) => placement?.isRealParticipantPlacement)) {
        studentsUsingRealParticipants += 1;
      }

      totals.recoverySessions += recoveryPlacements.length;
      totals.recoveryDays += new Set(
        recoveryPlacements
          .map((placement) => String(placement?.date || "").trim())
          .filter((dayKey) => dayKey !== "")
      ).size;

      if (regularPlacements.length === 0) {
        if (recoveryPlacements.length > 0) {
          studentsRecoveryOnly += 1;
        }
        continue;
      }

      studentsAnalyzed += 1;

      const weeks = new Map();
      for (const placement of regularPlacements) {
        const weekKey = getWeekKey(placement?.date);
        const dayKey = String(placement?.date || "").trim();
        if (!weekKey || !dayKey) {
          continue;
        }

        if (!weeks.has(weekKey)) {
          weeks.set(weekKey, new Map());
        }
        if (!weeks.get(weekKey).has(dayKey)) {
          weeks.get(weekKey).set(dayKey, []);
        }
        weeks.get(weekKey).get(dayKey).push(placement);
      }

      const entityTotals = initTotals();
      entityTotals.regularSessions = regularPlacements.length;
      let entityPenalty = 0;
      let entityBonus = 0;
      let entityWeekCount = 0;

      for (const daysMap of weeks.values()) {
        const activeDays = daysMap.size;
        entityWeekCount += 1;
        entityTotals.activeDays += activeDays;
        entityPenalty += activeDaysPenalty(activeDays);

        for (const [dayKey, dayPlacements] of daysMap.entries()) {
          const dayAnalysis = analyzeDay(dayKey, dayPlacements);
          entityPenalty += dayAnalysis.penalty;
          entityBonus += dayAnalysis.bonus;
          mergeTotals(entityTotals, dayAnalysis.totals);
        }
      }

      const maxBonus = entityWeekCount * 12;
      const effectivePenalty = Math.max(
        0,
        entityPenalty - Math.min(entityBonus, maxBonus)
      );
      const entityScore =
        entityWeekCount > 0
          ? clamp(100 - effectivePenalty / entityWeekCount)
          : 100;

      weeksAnalyzed += entityWeekCount;
      totalEffectivePenalty += effectivePenalty;
      scoreSum += entityScore;
      mergeTotals(totals, entityTotals);
    }

    return {
      score: studentsAnalyzed > 0 ? round(scoreSum / studentsAnalyzed) : 100,
      studentsTotal,
      studentsAnalyzed,
      studentsWithRecovery,
      studentsRecoveryOnly,
      studentsUsingRealParticipants,
      weeksAnalyzed,
      coverage: {
        recoveryExcludedFromPrincipalScore: true,
        realParticipantsIncluded: studentsUsingRealParticipants > 0,
      },
      totals: {
        regularSessions: totals.regularSessions,
        recoverySessions: totals.recoverySessions,
        activeDays: totals.activeDays,
        saturdayDays: totals.saturdayDays,
        isolatedDays: totals.isolatedDays,
        fragmentedDays: totals.fragmentedDays,
        overloadDays: totals.overloadDays,
        holeCount: totals.holeCount,
        holeHours: round(totals.holeMinutes / 60),
        consecutiveBlocks: totals.consecutiveBlocks,
        compactDoubleDays: totals.compactDoubleDays,
        dynamicBreaksRespected: totals.dynamicBreaksRespected,
        dynamicBreaksMissed: totals.dynamicBreaksMissed,
        pauseRespectedDays: totals.pauseRespectedDays,
        pauseMissedDays: totals.pauseMissedDays,
        pauseRespectedCount: totals.pauseRespectedCount,
        pauseMissedCount: totals.pauseMissedCount,
        lateSlotsOccupied: totals.lateSlotsOccupied,
        lateCoursePenalty: totals.lateCoursePenalty,
        singleCourseEarlyDays: totals.singleCourseEarlyDays,
        singleCourseLateDays: totals.singleCourseLateDays,
        singleCourseMiddleDays: totals.singleCourseMiddleDays,
        recoveryDays: totals.recoveryDays,
      },
      averages: {
        regularSessionsPerWeek:
          weeksAnalyzed > 0 ? round(totals.regularSessions / weeksAnalyzed) : 0,
        recoverySessionsPerWeek:
          weeksAnalyzed > 0 ? round(totals.recoverySessions / weeksAnalyzed) : 0,
        activeDaysPerWeek: weeksAnalyzed > 0 ? round(totals.activeDays / weeksAnalyzed) : 0,
        holeCountPerWeek: weeksAnalyzed > 0 ? round(totals.holeCount / weeksAnalyzed) : 0,
        holeHoursPerWeek:
          weeksAnalyzed > 0 ? round(totals.holeMinutes / 60 / weeksAnalyzed) : 0,
        saturdayDaysPerWeek:
          weeksAnalyzed > 0 ? round(totals.saturdayDays / weeksAnalyzed) : 0,
        isolatedDaysPerWeek:
          weeksAnalyzed > 0 ? round(totals.isolatedDays / weeksAnalyzed) : 0,
        fragmentedDaysPerWeek:
          weeksAnalyzed > 0 ? round(totals.fragmentedDays / weeksAnalyzed) : 0,
        overloadDaysPerWeek:
          weeksAnalyzed > 0 ? round(totals.overloadDays / weeksAnalyzed) : 0,
        lateCoursePenaltyPerWeek:
          weeksAnalyzed > 0 ? round(totals.lateCoursePenalty / weeksAnalyzed) : 0,
        effectivePenaltyPerWeek:
          weeksAnalyzed > 0 ? round(totalEffectivePenalty / weeksAnalyzed) : 0,
      },
    };
  }
}
