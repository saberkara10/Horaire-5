/**
 * StudentScheduleAnalyzer
 *
 * Ce module mesure le confort etudiant a partir d'un horaire deja genere.
 *
 * Responsabilites principales :
 * - calculer les indicateurs de confort hebdomadaire par etudiant ;
 * - transformer les regles metier etudiantes en penalites et bonus lisibles ;
 * - alimenter ScheduleScorer avec des details explicables.
 *
 * Integration dans le systeme :
 * - ScheduleScorer lui confie la lecture de tous les horaires etudiants ;
 * - les rapports `scoring_v1` reutilisent directement sa sortie ;
 * - aucune contrainte dure n'est validee ici : on evalue uniquement le confort
 *   d'une solution deja faisable.
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
 * Convertit un trou journalier en penalite.
 *
 * Regle metier :
 * - 1h reste acceptable pour laisser respirer l'emploi du temps ;
 * - 2h est tolerable mais deja sous-optimal ;
 * - 3h et plus degradent fortement le confort etudiant.
 *
 * @param {number} gapMinutes - duree du trou.
 *
 * @returns {number} Penalite correspondante.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : un trou de 60 minutes ou moins n'est pas penalise.
 */
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

/**
 * Penalise le nombre de jours actifs sur une semaine.
 *
 * Regle metier :
 * - 3 jours est la cible ideale ;
 * - 4 jours restent acceptables ;
 * - 5 jours ou plus dispersent trop la semaine ;
 * - 1 ou 2 jours sont aussi penalises pour ne pas surcomprimer artificiellement.
 *
 * @param {number} activeDays - nombre de jours actifs.
 *
 * @returns {number} Penalite hebdomadaire.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `0` quand la cible metier est atteinte.
 */
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

/**
 * Classe une journee a seance unique.
 *
 * Regle metier :
 * - un cours unique en debut de journee est prefere ;
 * - en fin de journee il reste acceptable ;
 * - en plein milieu il cree une journee peu rentable pour l'etudiant.
 *
 * @param {Object} session - seance unique du jour.
 *
 * @returns {"debut"|"fin"|"milieu"} Position du cours dans la journee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : s'appuie sur les blocs auto actuels du moteur.
 */
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

/**
 * Initialise les cumuls d'indicateurs etudiants.
 *
 * @returns {Object} Structure de totaux initialisee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les compteurs de reprises sont separes des seances regulieres
 * pour que les cours echoues ne dominent pas le confort principal.
 */
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
    singleCourseEarlyDays: 0,
    singleCourseLateDays: 0,
    singleCourseMiddleDays: 0,
    recoveryDays: 0,
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
 * Analyse une journee d'etudiant.
 *
 * Regles metier importantes :
 * - le samedi est fortement penalise ;
 * - plus de 3 seances sur une meme journee reste une surcharge ;
 * - la pause dynamique n'est jamais codee comme une heure fixe universelle :
 *   on regarde la sequence "2 blocs consecutifs puis pause raisonnable puis 3e bloc" ;
 * - une reprise ne doit pas dominer cette analyse principale, elle est geree a part.
 *
 * @param {string} dateValue - date du jour analyse.
 * @param {Object[]} placements - placements reguliers du jour.
 *
 * @returns {Object} Penalite, bonus et indicateurs du jour.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : travaille uniquement sur les seances regulieres.
 */
function analyzeDay(dateValue, placements) {
  const sessions = [...placements].sort(comparePlacementsByTime);
  const positiveGaps = [];
  const gaps = [];
  const consecutiveBlockLengths = [];
  let currentBlockLength = sessions.length > 0 ? 1 : 0;

  for (let index = 1; index < sessions.length; index += 1) {
    const previousEnd = parseTimeToMinutes(sessions[index - 1].heure_fin);
    const currentStart = parseTimeToMinutes(sessions[index].heure_debut);
    const gapMinutes = Math.max(0, currentStart - previousEnd);
    gaps.push(gapMinutes);

    if (gapMinutes === 0) {
      currentBlockLength += 1;
      continue;
    }

    positiveGaps.push(gapMinutes);
    consecutiveBlockLengths.push(currentBlockLength);
    currentBlockLength = 1;
  }

  if (currentBlockLength > 0) {
    consecutiveBlockLengths.push(currentBlockLength);
  }

  const fragmentCount = consecutiveBlockLengths.length;
  const holeMinutes = positiveGaps.reduce((sum, gapMinutes) => sum + gapMinutes, 0);
  const firstGap = gaps[0] ?? null;
  const secondGap = gaps[1] ?? null;
  const totals = initTotals();
  let penalty = 0;
  let bonus = 0;
  let singleCoursePlacement = null;

  totals.holeCount = positiveGaps.length;
  totals.holeMinutes = holeMinutes;
  totals.consecutiveBlocks = consecutiveBlockLengths.filter(
    (blockLength) => blockLength >= 2
  ).length;

  for (const gapMinutes of positiveGaps) {
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

  if (fragmentCount > 1) {
    totals.fragmentedDays = 1;
  }

  if (fragmentCount > 2) {
    penalty += (fragmentCount - 2) * 6;
  }

  if (sessions.length === 1) {
    totals.isolatedDays = 1;
    singleCoursePlacement = classifySingleCourseDay(sessions[0]);
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
  } else if (sessions.length === 2 && positiveGaps.length === 0) {
    totals.compactDoubleDays = 1;
    bonus += 4;
  }

  if (sessions.length === 3) {
    if (firstGap === 0 && secondGap >= 45 && secondGap <= 75) {
      totals.dynamicBreaksRespected = 1;
      bonus += 6;
    } else if (firstGap === 0 && secondGap != null && secondGap < 45) {
      totals.dynamicBreaksMissed = 1;
      penalty += 10;
    } else {
      penalty += 8;
      if (firstGap === 0 && secondGap != null && secondGap > 75) {
        penalty += 4;
      }
    }
  }

  return {
    penalty,
    bonus,
    totals,
    singleCoursePlacement,
  };
}

export class StudentScheduleAnalyzer {
  /**
   * Analyse un ensemble d'horaires etudiants.
   *
   * @param {Object[]} [studentSchedules=[]] - horaires par etudiant.
   *
   * @returns {Object} Detail complet du confort etudiant.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - les reprises sont comptabilisees dans les details mais exclues du score principal ;
   * - un etudiant n'ayant que des reprises n'entre pas dans la note principale ;
   * - le score reste borne entre 0 et 100.
   */
  static analyze(studentSchedules = []) {
    let studentsTotal = 0;
    let studentsAnalyzed = 0;
    let studentsWithRecovery = 0;
    let studentsRecoveryOnly = 0;
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

      const maxBonus = entityWeekCount * 10;
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
      weeksAnalyzed,
      coverage: {
        // Les reprises restent visibles dans les rapports, mais ne doivent pas
        // tirer artificiellement vers le bas le confort principal des cohortes.
        recoveryExcludedFromPrincipalScore: true,
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
        effectivePenaltyPerWeek:
          weeksAnalyzed > 0 ? round(totalEffectivePenalty / weeksAnalyzed) : 0,
      },
    };
  }
}
