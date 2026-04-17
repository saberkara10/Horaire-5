/**
 * GroupScheduleAnalyzer
 *
 * Ce module mesure la lisibilite des horaires de groupe a partir d'un horaire
 * deja genere, en reutilisant une base temporelle commune multi-slots.
 */

import {
  buildSlotMetadataFromTimeRange,
  normalizeTimeString,
} from "../time/TimeSlotUtils.js";

const LATE_SLOT_START_INDEX = 10;
const LATE_SLOT_END_INDEX = 13;
const MIN_BREAK_AFTER_TWO_CONSECUTIVE_MINUTES = 60;

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function round(value, digits = 2) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

export function parseTimeToMinutes(timeValue) {
  const normalized = normalizeTimeString(timeValue);
  const [hours = "0", minutes = "0"] = String(normalized || "0:0:0").split(":");
  const hourValue = Number(hours);
  const minuteValue = Number(minutes);

  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) {
    return 0;
  }

  return hourValue * 60 + minuteValue;
}

export function parseDateUtc(dateValue) {
  const [year, month, day] = String(dateValue || "")
    .split("-")
    .map((part) => Number(part));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year <= 0 ||
    month <= 0 ||
    day <= 0
  ) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function getIsoWeekday(dateValue) {
  const date = parseDateUtc(dateValue);
  if (!date) {
    return null;
  }

  const weekday = date.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function getWeekKey(dateValue) {
  const date = parseDateUtc(dateValue);
  if (!date) {
    return null;
  }

  const weekday = getIsoWeekday(dateValue);
  date.setUTCDate(date.getUTCDate() - ((weekday || 1) - 1));
  return date.toISOString().slice(0, 10);
}

export function comparePlacementsByTime(a, b) {
  const dateCompare = String(a?.date || "").localeCompare(String(b?.date || ""), "fr");
  if (dateCompare !== 0) {
    return dateCompare;
  }

  const startCompare =
    parseTimeToMinutes(a?.heure_debut) - parseTimeToMinutes(b?.heure_debut);
  if (startCompare !== 0) {
    return startCompare;
  }

  return parseTimeToMinutes(a?.heure_fin) - parseTimeToMinutes(b?.heure_fin);
}

function resolveSlotMetadata(placement) {
  const derivedFromTimeRange = buildSlotMetadataFromTimeRange(
    placement?.heure_debut,
    placement?.heure_fin
  );

  if (derivedFromTimeRange) {
    return derivedFromTimeRange;
  }

  const startIndex = Number(placement?.slotStartIndex);
  const endIndex = Number(placement?.slotEndIndex);
  const durationHours = Number(placement?.dureeHeures);
  const normalizedStartTime = normalizeTimeString(placement?.heure_debut);
  const normalizedEndTime = normalizeTimeString(placement?.heure_fin);

  if (
    Number.isInteger(startIndex) &&
    Number.isInteger(endIndex) &&
    endIndex > startIndex
  ) {
    return {
      heure_debut: normalizedStartTime,
      heure_fin: normalizedEndTime,
      dureeHeures:
        durationHours > 0 ? durationHours : Math.max(1, endIndex - startIndex),
      slotStartIndex: startIndex,
      slotEndIndex: endIndex,
    };
  }

  if (normalizedStartTime && normalizedEndTime) {
    const totalMinutes =
      parseTimeToMinutes(normalizedEndTime) - parseTimeToMinutes(normalizedStartTime);
    return {
      heure_debut: normalizedStartTime,
      heure_fin: normalizedEndTime,
      dureeHeures: totalMinutes > 0 ? totalMinutes / 60 : Math.max(durationHours, 1),
      slotStartIndex: Number.isInteger(startIndex) ? startIndex : null,
      slotEndIndex: Number.isInteger(endIndex) ? endIndex : null,
    };
  }

  return {
    heure_debut: normalizedStartTime,
    heure_fin: normalizedEndTime,
    dureeHeures: durationHours > 0 ? durationHours : 0,
    slotStartIndex: Number.isInteger(startIndex) ? startIndex : null,
    slotEndIndex: Number.isInteger(endIndex) ? endIndex : null,
  };
}

export function normalizePlacementTiming(placement = {}) {
  const slotMetadata = resolveSlotMetadata(placement);
  const normalizedWeekday =
    Number.isInteger(Number(placement?.jourSemaine)) &&
    Number(placement?.jourSemaine) >= 1 &&
    Number(placement?.jourSemaine) <= 7
      ? Number(placement?.jourSemaine)
      : getIsoWeekday(placement?.date);

  return {
    ...placement,
    heure_debut: slotMetadata.heure_debut || normalizeTimeString(placement?.heure_debut),
    heure_fin: slotMetadata.heure_fin || normalizeTimeString(placement?.heure_fin),
    dureeHeures:
      Number(slotMetadata.dureeHeures) > 0
        ? Number(slotMetadata.dureeHeures)
        : Number(placement?.dureeHeures || 0),
    slotStartIndex:
      Number.isInteger(Number(slotMetadata.slotStartIndex)) &&
      Number(slotMetadata.slotStartIndex) >= 0
        ? Number(slotMetadata.slotStartIndex)
        : null,
    slotEndIndex:
      Number.isInteger(Number(slotMetadata.slotEndIndex)) &&
      Number(slotMetadata.slotEndIndex) > Number(slotMetadata.slotStartIndex)
        ? Number(slotMetadata.slotEndIndex)
        : null,
    jourSemaine: normalizedWeekday,
  };
}

export function mergeTotals(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    target[key] += value;
  }
}

function computeLatePenalty(placement) {
  const normalizedPlacement = normalizePlacementTiming(placement);
  let lateSlotsOccupied = 0;
  let lateCoursePenalty = 0;

  if (
    Number.isInteger(normalizedPlacement.slotStartIndex) &&
    Number.isInteger(normalizedPlacement.slotEndIndex) &&
    normalizedPlacement.slotEndIndex > normalizedPlacement.slotStartIndex
  ) {
    for (
      let slotIndex = normalizedPlacement.slotStartIndex;
      slotIndex < normalizedPlacement.slotEndIndex;
      slotIndex += 1
    ) {
      if (slotIndex < LATE_SLOT_START_INDEX || slotIndex > LATE_SLOT_END_INDEX) {
        continue;
      }

      lateSlotsOccupied += 1;
      lateCoursePenalty += slotIndex - 9;
    }
  }

  return {
    lateSlotsOccupied,
    lateCoursePenalty,
  };
}

export function buildDayTimeline(placements = []) {
  const sessions = [...(Array.isArray(placements) ? placements : [])]
    .map((placement) => normalizePlacementTiming(placement))
    .sort(comparePlacementsByTime);
  const positiveGaps = [];
  const gaps = [];
  const consecutiveBlockLengths = [];
  let currentBlockLength = sessions.length > 0 ? 1 : 0;
  let pauseRespectedCount = 0;
  let pauseMissedCount = 0;
  let lateSlotsOccupied = 0;
  let lateCoursePenalty = 0;

  for (const session of sessions) {
    const latePenalty = computeLatePenalty(session);
    lateSlotsOccupied += latePenalty.lateSlotsOccupied;
    lateCoursePenalty += latePenalty.lateCoursePenalty;
  }

  for (let index = 1; index < sessions.length; index += 1) {
    const previousEnd = parseTimeToMinutes(sessions[index - 1].heure_fin);
    const currentStart = parseTimeToMinutes(sessions[index].heure_debut);
    const gapMinutes = Math.max(0, currentStart - previousEnd);

    gaps.push(gapMinutes);

    if (gapMinutes === 0) {
      currentBlockLength += 1;
      if (currentBlockLength >= 3) {
        pauseMissedCount += 1;
      }
      continue;
    }

    positiveGaps.push(gapMinutes);

    if (currentBlockLength >= 2) {
      if (gapMinutes >= MIN_BREAK_AFTER_TWO_CONSECUTIVE_MINUTES) {
        pauseRespectedCount += 1;
      } else {
        pauseMissedCount += 1;
      }
    }

    consecutiveBlockLengths.push(currentBlockLength);
    currentBlockLength = 1;
  }

  if (currentBlockLength > 0) {
    consecutiveBlockLengths.push(currentBlockLength);
  }

  return {
    sessions,
    gaps,
    positiveGaps,
    holeCount: positiveGaps.length,
    holeMinutes: positiveGaps.reduce((sum, gapMinutes) => sum + gapMinutes, 0),
    consecutiveBlockLengths,
    fragmentCount: consecutiveBlockLengths.length,
    consecutiveBlocks: consecutiveBlockLengths.filter((blockLength) => blockLength >= 2)
      .length,
    amplitudeMinutes:
      sessions.length > 0
        ? parseTimeToMinutes(sessions[sessions.length - 1].heure_fin) -
          parseTimeToMinutes(sessions[0].heure_debut)
        : 0,
    pauseRespectedCount,
    pauseMissedCount,
    lateSlotsOccupied,
    lateCoursePenalty,
  };
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

function activeDaysPenalty(activeDays) {
  if (activeDays === 3 || activeDays === 4) {
    return 0;
  }

  if (activeDays === 5) {
    return 8;
  }

  if (activeDays === 2) {
    return 6;
  }

  if (activeDays === 1) {
    return 14;
  }

  return activeDays > 5 ? 18 + (activeDays - 5) * 8 : 0;
}

function gapPenaltyMinutes(gapMinutes) {
  if (gapMinutes <= 60) {
    return 0;
  }

  if (gapMinutes <= 120) {
    return 3;
  }

  if (gapMinutes <= 180) {
    return 8;
  }

  return 14 + Math.ceil((gapMinutes - 180) / 60) * 5;
}

function initTotals() {
  return {
    sessions: 0,
    activeDays: 0,
    saturdayDays: 0,
    isolatedDays: 0,
    fragmentedDays: 0,
    overloadDays: 0,
    holeCount: 0,
    holeMinutes: 0,
    consecutiveBlocks: 0,
    compactDoubleDays: 0,
    pauseRespectedDays: 0,
    pauseMissedDays: 0,
    pauseRespectedCount: 0,
    pauseMissedCount: 0,
    lateSlotsOccupied: 0,
    lateCoursePenalty: 0,
    singleCourseEarlyDays: 0,
    singleCourseLateDays: 0,
    singleCourseMiddleDays: 0,
  };
}

function analyzeDay(dateValue, placements) {
  const timeline = buildDayTimeline(placements);
  const totals = initTotals();
  const sessions = timeline.sessions;
  let penalty = 0;
  let bonus = 0;

  totals.sessions = sessions.length;
  totals.holeCount = timeline.holeCount;
  totals.holeMinutes = timeline.holeMinutes;
  totals.consecutiveBlocks = timeline.consecutiveBlocks;
  totals.lateSlotsOccupied = timeline.lateSlotsOccupied;
  totals.lateCoursePenalty = timeline.lateCoursePenalty;
  totals.pauseRespectedDays = timeline.pauseRespectedCount;
  totals.pauseMissedDays = timeline.pauseMissedCount;
  totals.pauseRespectedCount = timeline.pauseRespectedCount;
  totals.pauseMissedCount = timeline.pauseMissedCount;

  for (const gapMinutes of timeline.positiveGaps) {
    penalty += gapPenaltyMinutes(gapMinutes);
  }

  if (getIsoWeekday(dateValue) === 6) {
    totals.saturdayDays = 1;
    penalty += 12;
  }

  if (sessions.length > 3) {
    totals.overloadDays = 1;
    penalty += 18 + (sessions.length - 3) * 10;
  }

  if (timeline.fragmentCount > 1) {
    totals.fragmentedDays = 1;
    penalty += (timeline.fragmentCount - 1) * 5;
  }

  if (sessions.length === 1) {
    totals.isolatedDays = 1;
    const singleCoursePlacement = classifySingleCourseDay(sessions[0]);

    if (singleCoursePlacement === "debut") {
      totals.singleCourseEarlyDays = 1;
      bonus += 2;
    } else if (singleCoursePlacement === "fin") {
      totals.singleCourseLateDays = 1;
      bonus += 1;
    } else {
      totals.singleCourseMiddleDays = 1;
      penalty += 4;
    }
  } else if (sessions.length === 2 && timeline.holeCount === 0) {
    totals.compactDoubleDays = 1;
    bonus += 3;
  }

  penalty += timeline.lateCoursePenalty;
  penalty += timeline.pauseMissedCount * 10;
  bonus += timeline.pauseRespectedCount * 4;

  return {
    penalty,
    bonus,
    totals,
  };
}

export class GroupScheduleAnalyzer {
  static analyze(groupSchedules = []) {
    let groupsTotal = 0;
    let groupsAnalyzed = 0;
    let weeksAnalyzed = 0;
    let scoreSum = 0;
    let totalEffectivePenalty = 0;
    const totals = initTotals();

    for (const groupSchedule of Array.isArray(groupSchedules) ? groupSchedules : []) {
      groupsTotal += 1;

      const placements = Array.isArray(groupSchedule?.placements)
        ? groupSchedule.placements
        : [];
      if (placements.length === 0) {
        continue;
      }

      groupsAnalyzed += 1;

      const weeks = new Map();
      for (const placement of placements.sort(comparePlacementsByTime)) {
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
      entityTotals.sessions = placements.length;
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

      const maxBonus = entityWeekCount * 8;
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
      score: groupsAnalyzed > 0 ? round(scoreSum / groupsAnalyzed) : 100,
      groupsTotal,
      groupsAnalyzed,
      weeksAnalyzed,
      totals: {
        sessions: totals.sessions,
        activeDays: totals.activeDays,
        saturdayDays: totals.saturdayDays,
        isolatedDays: totals.isolatedDays,
        fragmentedDays: totals.fragmentedDays,
        overloadDays: totals.overloadDays,
        holeCount: totals.holeCount,
        holeHours: round(totals.holeMinutes / 60),
        consecutiveBlocks: totals.consecutiveBlocks,
        compactDoubleDays: totals.compactDoubleDays,
        pauseRespectedDays: totals.pauseRespectedDays,
        pauseMissedDays: totals.pauseMissedDays,
        pauseRespectedCount: totals.pauseRespectedCount,
        pauseMissedCount: totals.pauseMissedCount,
        lateSlotsOccupied: totals.lateSlotsOccupied,
        lateCoursePenalty: totals.lateCoursePenalty,
        singleCourseEarlyDays: totals.singleCourseEarlyDays,
        singleCourseLateDays: totals.singleCourseLateDays,
        singleCourseMiddleDays: totals.singleCourseMiddleDays,
      },
      averages: {
        sessionsPerWeek: weeksAnalyzed > 0 ? round(totals.sessions / weeksAnalyzed) : 0,
        activeDaysPerWeek: weeksAnalyzed > 0 ? round(totals.activeDays / weeksAnalyzed) : 0,
        holeCountPerWeek: weeksAnalyzed > 0 ? round(totals.holeCount / weeksAnalyzed) : 0,
        holeHoursPerWeek:
          weeksAnalyzed > 0 ? round(totals.holeMinutes / 60 / weeksAnalyzed) : 0,
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
