/**
 * TeacherScheduleAnalyzer
 *
 * Ce module mesure le confort professeur a partir d'un horaire deja genere.
 *
 * Responsabilites principales :
 * - evaluer les horaires hebdomadaires des professeurs ;
 * - traduire les preferences metier professeurs en penalites et bonus ;
 * - exposer des indicateurs lisibles pour scoring_v1 et les rapports.
 *
 * Integration dans le systeme :
 * - ScheduleScorer l'utilise pour calculer `scoreProfesseur` ;
 * - PlacementEvaluator et le what-if lisent ensuite ces resultats ;
 * - aucune contrainte dure n'est verifiee ici, uniquement le confort.
 */

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
 * Convertit une heure HH:MM:SS en minutes.
 *
 * @param {string|null|undefined} timeValue - heure source.
 *
 * @returns {number} Nombre de minutes depuis minuit.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `0` si l'heure est invalide.
 */
function parseTimeToMinutes(timeValue) {
  const [hours = "0", minutes = "0"] = String(timeValue || "0:0:0").split(":");
  const hourValue = Number(hours);
  const minuteValue = Number(minutes);

  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) {
    return 0;
  }

  return hourValue * 60 + minuteValue;
}

/**
 * Parse une date ISO en UTC.
 *
 * @param {string|null|undefined} dateValue - date source.
 *
 * @returns {Date|null} Date UTC ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : rejette les formats incomplets.
 */
function parseDateUtc(dateValue) {
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

/**
 * Retourne le jour ISO de la semaine.
 *
 * @param {string|null|undefined} dateValue - date source.
 *
 * @returns {number|null} Jour ISO 1..7 ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : le dimanche est mappe sur `7`.
 */
function getIsoWeekday(dateValue) {
  const date = parseDateUtc(dateValue);
  if (!date) {
    return null;
  }

  const weekday = date.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/**
 * Retourne la cle de semaine ISO simplifiee.
 *
 * @param {string|null|undefined} dateValue - date source.
 *
 * @returns {string|null} Cle `YYYY-MM-DD` du lundi de la semaine.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `null` si la date est invalide.
 */
function getWeekKey(dateValue) {
  const date = parseDateUtc(dateValue);
  if (!date) {
    return null;
  }

  const weekday = getIsoWeekday(dateValue);
  date.setUTCDate(date.getUTCDate() - ((weekday || 1) - 1));
  return date.toISOString().slice(0, 10);
}

/**
 * Trie des placements dans l'ordre chronologique.
 *
 * @param {Object} a - placement de gauche.
 * @param {Object} b - placement de droite.
 *
 * @returns {number} Ordre de tri stable.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : compare d'abord la date puis le creneau.
 */
function comparePlacementsByTime(a, b) {
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

/**
 * Convertit un trou journalier en penalite professeur.
 *
 * Regle metier :
 * - les trous doivent etre evites ;
 * - plus ils sont longs, plus la journee devient fragmentee et peu productive.
 *
 * @param {number} gapMinutes - duree du trou.
 *
 * @returns {number} Penalite correspondante.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : un trou de 60 minutes ou moins reste tolere.
 */
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

/**
 * Penalise une repartition hebdomadaire trop compressee ou trop etalee.
 *
 * Regle metier :
 * - 4 ou 5 jours travailles restent acceptables ;
 * - un fort volume tasse sur 2 ou 3 jours augmente la fatigue et l'amplitude.
 *
 * @param {number} workingDays - jours travailles sur la semaine.
 * @param {number} totalSessions - volume de seances sur la semaine.
 *
 * @returns {number} Penalite hebdomadaire.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les semaines legeres peuvent rester compactes sans penalite.
 */
function workingDaysPenalty(workingDays, totalSessions) {
  if (workingDays > 5) {
    return (workingDays - 5) * 6;
  }

  if (totalSessions >= 8 && workingDays <= 3) {
    return 6;
  }

  if (totalSessions >= 6 && workingDays <= 2) {
    return 8;
  }

  return 0;
}

/**
 * Bonus leger pour une repartition hebdomadaire saine.
 *
 * @param {number} workingDays - jours travailles.
 * @param {number} totalSessions - volume hebdomadaire.
 *
 * @returns {number} Bonus applique.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : vise les semaines de charge normale sur 4 ou 5 jours.
 */
function workingDaysBonus(workingDays, totalSessions) {
  if (totalSessions >= 4 && workingDays >= 4 && workingDays <= 5) {
    return 2;
  }

  return 0;
}

/**
 * Initialise les cumuls d'indicateurs professeurs.
 *
 * @returns {Object} Structure de totaux initialisee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les amplitudes sont stockees en heures cumulees.
 */
function initTotals() {
  return {
    sessions: 0,
    workingDays: 0,
    overloadDays: 0,
    fragmentedDays: 0,
    holeCount: 0,
    holeMinutes: 0,
    amplitudeHours: 0,
    longAmplitudeDays: 0,
    pauseRespectedDays: 0,
    pauseMissedDays: 0,
    singleSessionDays: 0,
    compactDoubleDays: 0,
  };
}

/**
 * Fusionne deux objets de totaux.
 *
 * @param {Object} target - cible a enrichir.
 * @param {Object} source - source a additionner.
 *
 * @returns {void}
 *
 * Effets secondaires : incremente `target`.
 * Cas particuliers : suppose des cles numeriques homogenes.
 */
function mergeTotals(target, source) {
  for (const [key, value] of Object.entries(source)) {
    target[key] += value;
  }
}

/**
 * Analyse une journee professeur.
 *
 * Regles metier importantes :
 * - plus de 3 seances dans une journee doit etre penalise ;
 * - l'amplitude ideale reste autour de 9h ;
 * - apres 2 blocs consecutifs, une pause raisonnable reste fortement preferee ;
 * - une journee avec une seule seance reste acceptable.
 *
 * @param {Object[]} placements - placements du jour.
 *
 * @returns {Object} Penalite, bonus et indicateurs du jour.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : la pause reste dynamique, jamais codee comme une heure fixe.
 */
function analyzeDay(placements) {
  const sessions = [...placements].sort(comparePlacementsByTime);
  const positiveGaps = [];
  const gaps = [];
  const totals = initTotals();
  let penalty = 0;
  let bonus = 0;

  for (let index = 1; index < sessions.length; index += 1) {
    const previousEnd = parseTimeToMinutes(sessions[index - 1].heure_fin);
    const currentStart = parseTimeToMinutes(sessions[index].heure_debut);
    const gapMinutes = Math.max(0, currentStart - previousEnd);
    gaps.push(gapMinutes);

    if (gapMinutes > 0) {
      positiveGaps.push(gapMinutes);
      penalty += gapPenaltyMinutes(gapMinutes);
    }
  }

  const amplitudeMinutes =
    sessions.length > 0
      ? parseTimeToMinutes(sessions[sessions.length - 1].heure_fin) -
        parseTimeToMinutes(sessions[0].heure_debut)
      : 0;
  const firstGap = gaps[0] ?? null;
  const secondGap = gaps[1] ?? null;

  totals.holeCount = positiveGaps.length;
  totals.holeMinutes = positiveGaps.reduce((sum, gapMinutes) => sum + gapMinutes, 0);
  totals.amplitudeHours = amplitudeMinutes / 60;

  if (positiveGaps.length > 0) {
    totals.fragmentedDays = 1;
  }

  if (sessions.length > 3) {
    totals.overloadDays = 1;
    penalty += 12 + (sessions.length - 3) * 10;
  }

  if (amplitudeMinutes > 9 * 60) {
    totals.longAmplitudeDays = 1;
    penalty += Math.ceil((amplitudeMinutes - 9 * 60) / 60) * 5;
  }

  if (positiveGaps.length > 1) {
    penalty += (positiveGaps.length - 1) * 4;
  }

  if (sessions.length === 1) {
    totals.singleSessionDays = 1;
    bonus += 1;
  } else if (sessions.length === 2 && positiveGaps.length === 0) {
    totals.compactDoubleDays = 1;
    bonus += 3;
  }

  if (sessions.length >= 3) {
    if (firstGap === 0 && secondGap >= 45 && secondGap <= 75) {
      totals.pauseRespectedDays = 1;
      bonus += 4;
    } else if (firstGap === 0 && secondGap != null && secondGap < 45) {
      totals.pauseMissedDays = 1;
      penalty += 8;
    } else if (firstGap === 0 && secondGap != null && secondGap > 75) {
      penalty += 3;
    } else if (positiveGaps.length > 0) {
      penalty += 4;
    }
  }

  return {
    penalty,
    bonus,
    totals,
  };
}

export class TeacherScheduleAnalyzer {
  /**
   * Analyse un ensemble d'horaires professeurs.
   *
   * @param {Object[]} [teacherSchedules=[]] - horaires par professeur.
   *
   * @returns {Object} Detail complet du confort professeur.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - un professeur sans seance n'entre pas dans la moyenne principale ;
   * - le score reste borne entre 0 et 100.
   */
  static analyze(teacherSchedules = []) {
    let teachersTotal = 0;
    let teachersAnalyzed = 0;
    let weeksAnalyzed = 0;
    let scoreSum = 0;
    let totalEffectivePenalty = 0;
    const totals = initTotals();

    for (const teacherSchedule of Array.isArray(teacherSchedules) ? teacherSchedules : []) {
      teachersTotal += 1;

      const placements = Array.isArray(teacherSchedule?.placements)
        ? teacherSchedule.placements
        : [];
      if (placements.length === 0) {
        continue;
      }

      teachersAnalyzed += 1;

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
        const workingDays = daysMap.size;
        const sessionsThisWeek = [...daysMap.values()].reduce(
          (sum, dayPlacements) => sum + dayPlacements.length,
          0
        );

        entityWeekCount += 1;
        entityTotals.workingDays += workingDays;
        entityPenalty += workingDaysPenalty(workingDays, sessionsThisWeek);
        entityBonus += workingDaysBonus(workingDays, sessionsThisWeek);

        for (const dayPlacements of daysMap.values()) {
          const dayAnalysis = analyzeDay(dayPlacements);
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
        singleSessionDays: totals.singleSessionDays,
        compactDoubleDays: totals.compactDoubleDays,
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
        effectivePenaltyPerWeek:
          weeksAnalyzed > 0 ? round(totalEffectivePenalty / weeksAnalyzed) : 0,
      },
    };
  }
}
