function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readAtPath(source, path) {
  let cursor = source;

  for (const segment of path) {
    cursor = cursor?.[segment];
  }

  return cursor;
}

function readFirstFinite(...values) {
  for (const value of values) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return null;
}

function normalizeScoringMode(modeKey, modePayload = {}) {
  return {
    mode: modePayload?.mode || modeKey,
    scoreGlobal: readFirstFinite(modePayload?.scoreGlobal),
    scoreEtudiant: readFirstFinite(modePayload?.scoreEtudiant),
    scoreProfesseur: readFirstFinite(modePayload?.scoreProfesseur),
    scoreGroupe: readFirstFinite(modePayload?.scoreGroupe),
  };
}

function buildMetrics(source = {}, details = null, container = null) {
  const studentTotals = details?.etudiant?.totals || {};
  const teacherTotals = details?.professeur?.totals || {};
  const groupTotals = details?.groupe?.totals || {};
  const nonPlannedCourses = Array.isArray(container?.non_planifies)
    ? container.non_planifies.length
    : null;

  return {
    pausesEtudiantsRespectees: readFirstFinite(
      source?.metrics?.pausesEtudiantsRespectees,
      studentTotals.pauseRespectedCount,
      studentTotals.dynamicBreaksRespected
    ),
    pausesEtudiantsManquees: readFirstFinite(
      source?.metrics?.pausesEtudiantsManquees,
      studentTotals.pauseMissedCount,
      studentTotals.dynamicBreaksMissed
    ),
    pausesProfesseursRespectees: readFirstFinite(
      source?.metrics?.pausesProfesseursRespectees,
      teacherTotals.pauseRespectedCount,
      teacherTotals.pauseRespectedDays
    ),
    pausesProfesseursManquees: readFirstFinite(
      source?.metrics?.pausesProfesseursManquees,
      teacherTotals.pauseMissedCount,
      teacherTotals.pauseMissedDays
    ),
    pausesGroupesRespectees: readFirstFinite(
      source?.metrics?.pausesGroupesRespectees,
      groupTotals.pauseRespectedCount,
      groupTotals.pauseRespectedDays
    ),
    pausesGroupesManquees: readFirstFinite(
      source?.metrics?.pausesGroupesManquees,
      groupTotals.pauseMissedCount,
      groupTotals.pauseMissedDays
    ),
    nbCoursNonPlanifies: readFirstFinite(
      source?.metrics?.nbCoursNonPlanifies,
      container?.nb_cours_non_planifies,
      container?.nbCoursNonPlanifies,
      nonPlannedCourses
    ),
    nbConflitsEvites: readFirstFinite(
      source?.metrics?.nbConflitsEvites,
      container?.nbConflitsEvites
    ),
  };
}

function looksLikeScoringBundle(value) {
  return isPlainObject(value) && isPlainObject(value.modes);
}

function extractRawScoringBundle(source) {
  if (!isPlainObject(source)) {
    return null;
  }

  return (
    readAtPath(source, ["details", "scoring_v1"]) ||
    readAtPath(source, ["details_bruts", "details", "scoring_v1"]) ||
    readAtPath(source, ["details_bruts", "scoring_v1"]) ||
    source?.scoring_v1 ||
    (looksLikeScoringBundle(source) ? source : null)
  );
}

export function resolveSchedulerScoringMode(mode) {
  const normalizedMode = String(mode || "legacy").trim().toLowerCase();
  return normalizedMode === "legacy" ? "equilibre" : normalizedMode;
}

export function readSchedulerScoringSummary(source) {
  if (!isPlainObject(source)) {
    return null;
  }

  const rawScoring = extractRawScoringBundle(source);
  const summarySource =
    source?.resume_scoring_v1 ||
    (looksLikeScoringBundle(source) ? source : null) ||
    rawScoring;

  if (!summarySource) {
    return null;
  }

  const details = rawScoring?.details || summarySource?.details || null;

  return {
    disponible: Boolean(summarySource),
    version: summarySource?.version || "v1",
    modes: Object.fromEntries(
      ["etudiant", "professeur", "equilibre"].map((modeKey) => [
        modeKey,
        normalizeScoringMode(modeKey, summarySource?.modes?.[modeKey] || {}),
      ])
    ),
    metrics: buildMetrics(summarySource, details, source),
    details,
  };
}

export function selectSchedulerScoringMode(source, optimizationMode) {
  const scoringSummary =
    source?.modes && isPlainObject(source.modes)
      ? source
      : readSchedulerScoringSummary(source);

  if (!scoringSummary) {
    return null;
  }

  const scoringMode = resolveSchedulerScoringMode(optimizationMode);

  return (
    scoringSummary?.modes?.[scoringMode] ||
    scoringSummary?.modes?.equilibre ||
    null
  );
}

export function normalizeSchedulerScoreSnapshot(score) {
  if (!isPlainObject(score)) {
    return null;
  }

  return {
    mode: score?.mode || null,
    scoreGlobal: readFirstFinite(score?.scoreGlobal),
    scoreEtudiant: readFirstFinite(score?.scoreEtudiant),
    scoreProfesseur: readFirstFinite(score?.scoreProfesseur),
    scoreGroupe: readFirstFinite(score?.scoreGroupe),
    metrics: buildMetrics(score, score?.details || null, score),
    details: score?.details || null,
  };
}

export function normalizeSchedulerScoreDifference(difference) {
  if (!isPlainObject(difference)) {
    return null;
  }

  return {
    scoreGlobal: readFirstFinite(difference?.scoreGlobal),
    scoreEtudiant: readFirstFinite(difference?.scoreEtudiant),
    scoreProfesseur: readFirstFinite(difference?.scoreProfesseur),
    scoreGroupe: readFirstFinite(difference?.scoreGroupe),
    metrics: buildMetrics(difference, null, difference),
  };
}
