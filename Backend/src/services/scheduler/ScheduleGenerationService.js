import pool from "../../../db.js";
import { SchedulerEngine } from "./SchedulerEngine.js";
import { ScheduleSnapshot } from "./simulation/ScheduleSnapshot.js";
import { AvailabilityChecker } from "./AvailabilityChecker.js";
import { journaliserActivite } from "../activity-log.service.js";

const GENERATION_STATUSES = new Set([
  "draft",
  "active",
  "archived",
  "restored",
]);

const GENERATION_ITEM_TYPES = {
  PLACEMENT: "placement",
  STUDENT_ASSIGNMENT: "student_assignment",
};

function getUserFromRequest(request) {
  return request?.user || request?.session?.user || null;
}

function normalizePositiveInteger(value) {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : null;
}

function normalizeTime(timeValue) {
  const value = String(timeValue || "").trim();
  if (!value) {
    return null;
  }

  if (value.length === 5) {
    return `${value}:00`;
  }

  return value.slice(0, 8);
}

function parseJsonValue(value, fallback = null) {
  if (value == null) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function serializeJsonValue(value) {
  return value == null ? null : JSON.stringify(value);
}

function readNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function resolveScoringMode(optimizationMode) {
  const normalizedMode = String(optimizationMode || "legacy").trim().toLowerCase();
  return normalizedMode === "legacy" ? "equilibre" : normalizedMode;
}

function readScoringMode(scoring, optimizationMode) {
  if (!scoring?.modes || typeof scoring.modes !== "object") {
    return null;
  }

  const mode = resolveScoringMode(optimizationMode);
  return scoring.modes[mode] || scoring.modes.equilibre || null;
}

function readScoringQuality(scoring, optimizationMode, fallback = 0) {
  const score = Number(readScoringMode(scoring, optimizationMode)?.scoreGlobal);
  return Number.isFinite(score) ? Number(score.toFixed(2)) : readNumber(fallback, 0);
}

function enrichScoringMetrics(metrics = {}) {
  const scoring = metrics.scoring_v1 || null;
  const optimizationMode = metrics.optimisation_mode || null;
  const selectedScoringMode = readScoringMode(scoring, optimizationMode);

  if (!selectedScoringMode) {
    return metrics;
  }

  return {
    ...metrics,
    score_global_equilibre:
      metrics.score_global_equilibre ?? scoring?.modes?.equilibre?.scoreGlobal ?? null,
    score_global_etudiant:
      metrics.score_global_etudiant ?? scoring?.modes?.etudiant?.scoreGlobal ?? null,
    score_global_professeur:
      metrics.score_global_professeur ?? scoring?.modes?.professeur?.scoreGlobal ?? null,
    score_global_selectionne:
      metrics.score_global_selectionne ?? selectedScoringMode.scoreGlobal ?? null,
    score_etudiant_selectionne:
      metrics.score_etudiant_selectionne ?? selectedScoringMode.scoreEtudiant ?? null,
    score_professeur_selectionne:
      metrics.score_professeur_selectionne ?? selectedScoringMode.scoreProfesseur ?? null,
    score_groupe_selectionne:
      metrics.score_groupe_selectionne ?? selectedScoringMode.scoreGroupe ?? null,
    score_mode_selectionne:
      metrics.score_mode_selectionne ?? selectedScoringMode.mode ?? resolveScoringMode(optimizationMode),
  };
}

function comparePlacementRows(left, right) {
  return (
    String(left?.date || "").localeCompare(String(right?.date || ""), "fr") ||
    String(left?.heure_debut || "").localeCompare(String(right?.heure_debut || ""), "fr") ||
    String(left?.heure_fin || "").localeCompare(String(right?.heure_fin || ""), "fr") ||
    Number(left?.id_affectation_cours || 0) - Number(right?.id_affectation_cours || 0)
  );
}

function buildMetricRow(metricKey, metricValue) {
  if (metricValue == null) {
    return {
      metric_key: metricKey,
      metric_type: "text",
      metric_numeric: null,
      metric_text: null,
      metric_json: null,
    };
  }

  if (typeof metricValue === "number") {
    return {
      metric_key: metricKey,
      metric_type: "number",
      metric_numeric: Number(metricValue),
      metric_text: null,
      metric_json: null,
    };
  }

  if (typeof metricValue === "string" || typeof metricValue === "boolean") {
    return {
      metric_key: metricKey,
      metric_type: typeof metricValue === "boolean" ? "boolean" : "text",
      metric_numeric: null,
      metric_text: String(metricValue),
      metric_json: null,
    };
  }

  return {
    metric_key: metricKey,
    metric_type: "json",
    metric_numeric: null,
    metric_text: null,
    metric_json: serializeJsonValue(metricValue),
  };
}

function hydrateMetricRows(rows = []) {
  return Object.fromEntries(
    rows.map((row) => {
      if (row.metric_type === "number") {
        return [row.metric_key, readNumber(row.metric_numeric)];
      }

      if (row.metric_type === "json") {
        return [row.metric_key, parseJsonValue(row.metric_json, null)];
      }

      if (row.metric_type === "boolean") {
        return [row.metric_key, String(row.metric_text || "").toLowerCase() === "true"];
      }

      return [row.metric_key, row.metric_text];
    })
  );
}

function buildGenerationName({ versionNumber, sessionName, sourceKind, referenceName }) {
  if (sourceKind === "duplicate" && referenceName) {
    return `Version ${versionNumber} - Copie de ${referenceName}`;
  }

  if (sourceKind === "restore" && referenceName) {
    return `Version ${versionNumber} - Restauration de ${referenceName}`;
  }

  if (sourceKind === "pre_restore_backup") {
    return `Version ${versionNumber} - Sauvegarde avant restauration`;
  }

  return `Version ${versionNumber} - ${sessionName || "Session"}`;
}

function normalizeStatus(status, fallback = "draft") {
  const normalizedStatus = String(status || fallback).trim().toLowerCase();
  return GENERATION_STATUSES.has(normalizedStatus) ? normalizedStatus : fallback;
}

function buildGenerationMetadata({ report, sourceKind, request }) {
  return {
    source_kind: sourceKind,
    request_path: request?.originalUrl || request?.path || null,
    optimization_mode:
      report?.details?.modeOptimisationUtilise ||
      report?.details?.modeOptimisation ||
      null,
    report_id: normalizePositiveInteger(report?.id_rapport || report?.id || null),
    report_summary: report
      ? {
          nb_cours_planifies: readNumber(report.nb_cours_planifies),
          nb_cours_non_planifies: readNumber(report.nb_cours_non_planifies),
          score_qualite: readNumber(report.score_qualite),
        }
      : null,
  };
}

function buildMetrics({ report, snapshot, placementItems, studentAssignments }) {
  const scoring = report?.details?.scoring_v1 || snapshot?.scoreAllModes?.() || null;
  const scoreGlobalEquilibre = scoring?.modes?.equilibre?.scoreGlobal ?? null;
  const optimizationMode =
    report?.details?.modeOptimisationUtilise ||
    report?.details?.modeOptimisation ||
    null;
  const selectedScoringMode = readScoringMode(scoring, optimizationMode);
  const uniqueRooms = new Set();
  const uniqueTeachers = new Set();
  const uniqueGroups = new Set();
  const uniqueStudents = new Set();

  for (const item of placementItems) {
    if (normalizePositiveInteger(item.id_salle)) {
      uniqueRooms.add(Number(item.id_salle));
    }
    if (normalizePositiveInteger(item.id_professeur)) {
      uniqueTeachers.add(Number(item.id_professeur));
    }
    for (const groupId of item.payload?.group_ids || []) {
      if (normalizePositiveInteger(groupId)) {
        uniqueGroups.add(Number(groupId));
      }
    }
    for (const studentId of item.payload?.participant_ids || []) {
      if (normalizePositiveInteger(studentId)) {
        uniqueStudents.add(Number(studentId));
      }
    }
  }

  for (const assignment of studentAssignments) {
    if (normalizePositiveInteger(assignment.id_etudiant)) {
      uniqueStudents.add(Number(assignment.id_etudiant));
    }
    if (normalizePositiveInteger(assignment.id_groupes_etudiants)) {
      uniqueGroups.add(Number(assignment.id_groupes_etudiants));
    }
  }

  const conflictsFromReport =
    (Array.isArray(report?.non_planifies) ? report.non_planifies.length : 0) +
    (Array.isArray(report?.resolutions_manuelles) ? report.resolutions_manuelles.length : 0);

  return {
    placement_count: placementItems.length,
    student_assignment_count: studentAssignments.length,
    room_count: uniqueRooms.size,
    teacher_count: uniqueTeachers.size,
    group_count: uniqueGroups.size,
    student_count: uniqueStudents.size,
    conflict_count: conflictsFromReport,
    quality_score: readScoringQuality(
      scoring,
      optimizationMode,
      readNumber(report?.score_qualite, readNumber(scoreGlobalEquilibre, 0))
    ),
    score_global_equilibre: scoreGlobalEquilibre,
    score_global_etudiant: scoring?.modes?.etudiant?.scoreGlobal ?? null,
    score_global_professeur: scoring?.modes?.professeur?.scoreGlobal ?? null,
    score_global_selectionne: selectedScoringMode?.scoreGlobal ?? null,
    score_etudiant_selectionne: selectedScoringMode?.scoreEtudiant ?? null,
    score_professeur_selectionne: selectedScoringMode?.scoreProfesseur ?? null,
    score_groupe_selectionne: selectedScoringMode?.scoreGroupe ?? null,
    score_mode_selectionne: selectedScoringMode?.mode || resolveScoringMode(optimizationMode),
    nb_cours_planifies: readNumber(report?.nb_cours_planifies, placementItems.length),
    nb_cours_non_planifies: readNumber(report?.nb_cours_non_planifies, 0),
    nb_resolutions_manuelles: readNumber(report?.nb_resolutions_manuelles, 0),
    optimisation_mode: optimizationMode,
    scoring_v1: scoring,
  };
}

function buildConflictRows(report = {}) {
  const rows = [];
  const nonPlanifies = Array.isArray(report?.non_planifies) ? report.non_planifies : [];
  const resolutionsManuelles = Array.isArray(report?.resolutions_manuelles)
    ? report.resolutions_manuelles
    : [];

  for (const item of nonPlanifies) {
    rows.push({
      conflict_category: "course_unplanned",
      severity: "warning",
      conflict_code: item?.raison_code || "NON_PLANIFIE",
      label: item?.raison || "Cours non planifie.",
      item_reference: item?.code || item?.code_cours || null,
      payload: item,
    });
  }

  for (const item of resolutionsManuelles) {
    rows.push({
      conflict_category: "student_recovery",
      severity: "warning",
      conflict_code: item?.raison_code || "RESOLUTION_MANUELLE",
      label: item?.raison || "Resolution manuelle requise.",
      item_reference: item?.code_cours || null,
      payload: item,
    });
  }

  return rows;
}

async function resolveSession(idSession, executor) {
  const sessionId = normalizePositiveInteger(idSession);
  const [rows] = await executor.query(
    `SELECT id_session,
            nom,
            DATE_FORMAT(date_debut, '%Y-%m-%d') AS date_debut,
            DATE_FORMAT(date_fin, '%Y-%m-%d') AS date_fin
     FROM sessions
     WHERE ${sessionId ? "id_session = ?" : "active = TRUE"}
     ORDER BY active DESC, id_session DESC
     LIMIT 1`,
    sessionId ? [sessionId] : []
  );

  if (rows.length === 0) {
    const error = new Error("Aucune session exploitable n'a ete trouvee.");
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

async function loadAssignmentGroupRows(idSession, executor) {
  const [rows] = await executor.query(
    `SELECT ag.id_affectation_cours,
            ag.id_groupes_etudiants,
            ge.nom_groupe
     FROM affectation_groupes ag
     JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     WHERE ge.id_session = ?
     ORDER BY ag.id_affectation_cours ASC, ag.id_groupes_etudiants ASC`,
    [Number(idSession)]
  );

  const groupsByAssignment = new Map();
  for (const row of rows) {
    const assignmentId = Number(row.id_affectation_cours);
    if (!groupsByAssignment.has(assignmentId)) {
      groupsByAssignment.set(assignmentId, []);
    }

    groupsByAssignment.get(assignmentId).push({
      id_groupes_etudiants: Number(row.id_groupes_etudiants),
      nom_groupe: row.nom_groupe,
    });
  }

  return groupsByAssignment;
}

async function loadStudentAssignments(idSession, executor) {
  const [rows] = await executor.query(
    `SELECT ae.id_affectation_etudiant,
            ae.id_etudiant,
            ae.id_cours,
            ae.id_groupes_etudiants,
            ae.id_session,
            ae.source_type,
            ae.id_cours_echoue,
            ae.id_echange_cours,
            ge.nom_groupe
     FROM affectation_etudiants ae
     LEFT JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = ae.id_groupes_etudiants
     WHERE ae.id_session = ?
       AND ae.source_type IN ('reprise', 'individuelle')
     ORDER BY ae.id_etudiant ASC, ae.id_cours ASC, ae.id_affectation_etudiant ASC`,
    [Number(idSession)]
  );

  return rows.map((row) => ({
    id_affectation_etudiant: normalizePositiveInteger(row.id_affectation_etudiant),
    id_etudiant: normalizePositiveInteger(row.id_etudiant),
    id_cours: normalizePositiveInteger(row.id_cours),
    id_groupes_etudiants: normalizePositiveInteger(row.id_groupes_etudiants),
    id_session: normalizePositiveInteger(row.id_session),
    source_type: row.source_type || null,
    id_cours_echoue: normalizePositiveInteger(row.id_cours_echoue),
    id_echange_cours: normalizePositiveInteger(row.id_echange_cours),
    nom_groupe: row.nom_groupe || null,
  }));
}

async function loadLiveScheduleState(idSession, executor) {
  const session = await resolveSession(idSession, executor);
  const snapshot = await ScheduleSnapshot.load({ idSession: session.id_session }, executor);
  const [assignmentGroups, studentAssignments] = await Promise.all([
    loadAssignmentGroupRows(session.id_session, executor),
    loadStudentAssignments(session.id_session, executor),
  ]);

  const placementGroupsCounters = new Map();
  const placementItems = snapshot.clonePlacements().sort(comparePlacementRows).map((placement) => {
    const assignmentId = Number(placement.id_affectation_cours);
    const groups = assignmentGroups.get(assignmentId) || [];
    const groupIds = groups.map((row) => Number(row.id_groupes_etudiants)).sort((a, b) => a - b);
    const groupNames = groups.map((row) => row.nom_groupe);
    const baseKey = [
      Number(placement.id_cours || 0),
      groupIds.join("-") || Number(placement.id_groupe || 0) || "0",
      Number(placement.est_en_ligne ? 1 : 0),
    ].join("|");
    const itemOrder = (placementGroupsCounters.get(baseKey) || 0) + 1;
    placementGroupsCounters.set(baseKey, itemOrder);

    return {
      item_type: GENERATION_ITEM_TYPES.PLACEMENT,
      comparison_key: `${baseKey}|${itemOrder}`,
      item_order: itemOrder,
      id_cours: normalizePositiveInteger(placement.id_cours),
      id_professeur: normalizePositiveInteger(placement.id_professeur),
      id_salle: normalizePositiveInteger(placement.id_salle),
      id_groupes_etudiants: groupIds[0] || normalizePositiveInteger(placement.id_groupe),
      id_etudiant: null,
      id_session: normalizePositiveInteger(session.id_session),
      source_type: null,
      date_cours: placement.date,
      heure_debut: normalizeTime(placement.heure_debut),
      heure_fin: normalizeTime(placement.heure_fin),
      payload: {
        id_affectation_cours: normalizePositiveInteger(placement.id_affectation_cours),
        id_plage_horaires: normalizePositiveInteger(placement.id_plage_horaires),
        id_planification_serie: normalizePositiveInteger(placement.id_planification_serie),
        code_cours: placement.code_cours || null,
        nom_cours: placement.nom_cours || null,
        nom_professeur: placement.nom_professeur || null,
        code_salle: placement.code_salle || null,
        est_en_ligne: Boolean(placement.est_en_ligne),
        group_ids: groupIds,
        group_names: groupNames,
        participant_ids: snapshot.getParticipantsForAssignment(placement.id_affectation_cours),
      },
    };
  });

  const studentAssignmentItems = studentAssignments.map((assignment, index) => ({
    item_type: GENERATION_ITEM_TYPES.STUDENT_ASSIGNMENT,
    comparison_key: [
      normalizePositiveInteger(assignment.id_etudiant) || "0",
      normalizePositiveInteger(assignment.id_cours) || "0",
      normalizePositiveInteger(assignment.id_groupes_etudiants) || "0",
      assignment.source_type || "na",
      index + 1,
    ].join("|"),
    item_order: index + 1,
    id_cours: assignment.id_cours,
    id_professeur: null,
    id_salle: null,
    id_groupes_etudiants: assignment.id_groupes_etudiants,
    id_etudiant: assignment.id_etudiant,
    id_session: assignment.id_session,
    source_type: assignment.source_type,
    date_cours: null,
    heure_debut: null,
    heure_fin: null,
    payload: {
      id_affectation_etudiant: assignment.id_affectation_etudiant,
      nom_groupe: assignment.nom_groupe,
      id_cours_echoue: assignment.id_cours_echoue,
      id_echange_cours: assignment.id_echange_cours,
    },
  }));

  return {
    session,
    snapshot,
    placementItems,
    studentAssignments,
    studentAssignmentItems,
  };
}

function normalizePlacementForCompare(item = {}) {
  const payload = item.payload || {};

  return {
    comparison_key: item.comparison_key || null,
    id_cours: normalizePositiveInteger(item.id_cours),
    id_professeur: normalizePositiveInteger(item.id_professeur),
    id_salle: normalizePositiveInteger(item.id_salle),
    date: item.date_cours || null,
    heure_debut: normalizeTime(item.heure_debut),
    heure_fin: normalizeTime(item.heure_fin),
    group_ids: [...(payload.group_ids || [])].map((value) => Number(value)).filter((value) => value > 0).sort((a, b) => a - b),
    group_names: Array.isArray(payload.group_names) ? payload.group_names : [],
    code_cours: payload.code_cours || null,
    nom_cours: payload.nom_cours || null,
    nom_professeur: payload.nom_professeur || null,
    code_salle: payload.code_salle || null,
    est_en_ligne: Boolean(payload.est_en_ligne),
  };
}

function summarizePlacements(placements = [], summary = {}) {
  const uniqueRooms = new Set();
  const uniqueTeachers = new Set();

  for (const placement of placements) {
    if (normalizePositiveInteger(placement.id_salle)) {
      uniqueRooms.add(Number(placement.id_salle));
    }
    if (normalizePositiveInteger(placement.id_professeur)) {
      uniqueTeachers.add(Number(placement.id_professeur));
    }
  }

  return {
    placement_count: readNumber(summary.placement_count, placements.length),
    room_count: readNumber(summary.room_count, uniqueRooms.size),
    teacher_count: readNumber(summary.teacher_count, uniqueTeachers.size),
    conflict_count: readNumber(summary.conflict_count, 0),
    quality_score: readNumber(summary.quality_score, 0),
  };
}

export function compareGenerationPlacements(leftPlacements = [], rightPlacements = [], leftSummary = {}, rightSummary = {}) {
  const leftByKey = new Map(
    leftPlacements.map((item) => {
      const normalized = normalizePlacementForCompare(item);
      return [normalized.comparison_key, normalized];
    })
  );
  const rightByKey = new Map(
    rightPlacements.map((item) => {
      const normalized = normalizePlacementForCompare(item);
      return [normalized.comparison_key, normalized];
    })
  );

  const added = [];
  const removed = [];
  const movedCourses = [];
  const changedTeachers = [];
  const changedRooms = [];

  const keys = [...new Set([...leftByKey.keys(), ...rightByKey.keys()])].filter(Boolean).sort();

  for (const key of keys) {
    const left = leftByKey.get(key) || null;
    const right = rightByKey.get(key) || null;

    if (!left && right) {
      added.push(right);
      continue;
    }

    if (left && !right) {
      removed.push(left);
      continue;
    }

    if (!left || !right) {
      continue;
    }

    if (
      left.date !== right.date ||
      left.heure_debut !== right.heure_debut ||
      left.heure_fin !== right.heure_fin
    ) {
      movedCourses.push({
        comparison_key: key,
        cours: right.code_cours || left.code_cours || null,
        groupes: right.group_names?.length ? right.group_names : left.group_names,
        from: {
          date: left.date,
          heure_debut: left.heure_debut,
          heure_fin: left.heure_fin,
        },
        to: {
          date: right.date,
          heure_debut: right.heure_debut,
          heure_fin: right.heure_fin,
        },
      });
    }

    if (Number(left.id_professeur || 0) !== Number(right.id_professeur || 0)) {
      changedTeachers.push({
        comparison_key: key,
        cours: right.code_cours || left.code_cours || null,
        groupes: right.group_names?.length ? right.group_names : left.group_names,
        from: {
          id_professeur: left.id_professeur,
          nom_professeur: left.nom_professeur,
        },
        to: {
          id_professeur: right.id_professeur,
          nom_professeur: right.nom_professeur,
        },
      });
    }

    if (Number(left.id_salle || 0) !== Number(right.id_salle || 0)) {
      changedRooms.push({
        comparison_key: key,
        cours: right.code_cours || left.code_cours || null,
        groupes: right.group_names?.length ? right.group_names : left.group_names,
        from: {
          id_salle: left.id_salle,
          code_salle: left.code_salle,
        },
        to: {
          id_salle: right.id_salle,
          code_salle: right.code_salle,
        },
      });
    }
  }

  return {
    overview: {
      left: summarizePlacements(leftPlacements, leftSummary),
      right: summarizePlacements(rightPlacements, rightSummary),
      delta: {
        placement_count:
          summarizePlacements(rightPlacements, rightSummary).placement_count -
          summarizePlacements(leftPlacements, leftSummary).placement_count,
        room_count:
          summarizePlacements(rightPlacements, rightSummary).room_count -
          summarizePlacements(leftPlacements, leftSummary).room_count,
        teacher_count:
          summarizePlacements(rightPlacements, rightSummary).teacher_count -
          summarizePlacements(leftPlacements, leftSummary).teacher_count,
        conflict_count:
          summarizePlacements(rightPlacements, rightSummary).conflict_count -
          summarizePlacements(leftPlacements, leftSummary).conflict_count,
        quality_score:
          summarizePlacements(rightPlacements, rightSummary).quality_score -
          summarizePlacements(leftPlacements, leftSummary).quality_score,
      },
    },
    changes: {
      added,
      removed,
      movedCourses,
      changedTeachers,
      changedRooms,
    },
  };
}

async function listRowsByIds(tableName, idColumn, ids, executor) {
  const normalizedIds = [...new Set(ids.map((value) => Number(value)).filter((value) => value > 0))];
  if (normalizedIds.length === 0) {
    return new Set();
  }

  const placeholders = normalizedIds.map(() => "?").join(", ");
  const [rows] = await executor.query(
    `SELECT ${idColumn} AS id
     FROM ${tableName}
     WHERE ${idColumn} IN (${placeholders})`,
    normalizedIds
  );

  return new Set(rows.map((row) => Number(row.id)).filter((value) => value > 0));
}

async function buildRestoreValidation({ sessionId, placementItems, studentAssignments, executor }) {
  const courseIds = placementItems.map((item) => item.id_cours);
  const professorIds = placementItems.map((item) => item.id_professeur);
  const roomIds = placementItems.map((item) => item.id_salle).filter(Boolean);
  const groupIds = placementItems.flatMap((item) => item.payload?.group_ids || []);
  const studentIds = studentAssignments.map((item) => item.id_etudiant);

  const [existingCourses, existingProfessors, existingRooms, existingGroups, existingStudents] =
    await Promise.all([
      listRowsByIds("cours", "id_cours", courseIds, executor),
      listRowsByIds("professeurs", "id_professeur", professorIds, executor),
      listRowsByIds("salles", "id_salle", roomIds, executor),
      listRowsByIds("groupes_etudiants", "id_groupes_etudiants", groupIds, executor),
      listRowsByIds("etudiants", "id_etudiant", studentIds, executor),
    ]);

  const snapshot = await ScheduleSnapshot.load({ idSession: sessionId }, executor);
  const issues = [];

  for (const item of placementItems) {
    if (!existingCourses.has(Number(item.id_cours))) {
      issues.push({
        severity: "error",
        code: "COURSE_NOT_FOUND",
        message: `Le cours ${item.payload?.code_cours || item.id_cours} n'existe plus.`,
      });
    }

    if (!existingProfessors.has(Number(item.id_professeur))) {
      issues.push({
        severity: "error",
        code: "PROFESSOR_NOT_FOUND",
        message: `Le professeur ${item.payload?.nom_professeur || item.id_professeur} n'existe plus.`,
      });
    }

    if (item.id_salle && !existingRooms.has(Number(item.id_salle))) {
      issues.push({
        severity: "error",
        code: "ROOM_NOT_FOUND",
        message: `La salle ${item.payload?.code_salle || item.id_salle} n'existe plus.`,
      });
    }

    for (const groupId of item.payload?.group_ids || []) {
      if (!existingGroups.has(Number(groupId))) {
        issues.push({
          severity: "error",
          code: "GROUP_NOT_FOUND",
          message: `Le groupe ${groupId} n'existe plus.`,
        });
      }
    }

    const professor = snapshot.getProfessor(item.id_professeur);
    const course = snapshot.getCourse(item.id_cours);

    if (
      professor &&
      course &&
      !AvailabilityChecker.profDisponible(
        Number(item.id_professeur),
        item.date_cours,
        item.heure_debut,
        item.heure_fin,
        snapshot.dispParProf,
        snapshot.absencesParProf
      )
    ) {
      issues.push({
        severity: "warning",
        code: "PROFESSOR_UNAVAILABLE",
        message: `Le professeur ${item.payload?.nom_professeur || item.id_professeur} est actuellement indisponible sur ${item.date_cours}.`,
      });
    }

    if (
      item.id_salle &&
      !AvailabilityChecker.salleDisponible(Number(item.id_salle), item.date_cours, snapshot.indispoParSalle)
    ) {
      issues.push({
        severity: "warning",
        code: "ROOM_UNAVAILABLE",
        message: `La salle ${item.payload?.code_salle || item.id_salle} est actuellement indisponible le ${item.date_cours}.`,
      });
    }
  }

  for (const assignment of studentAssignments) {
    if (!existingStudents.has(Number(assignment.id_etudiant))) {
      issues.push({
        severity: "error",
        code: "STUDENT_NOT_FOUND",
        message: `L'etudiant ${assignment.id_etudiant} n'existe plus.`,
      });
    }
  }

  return {
    issues,
    blockingIssues: issues.filter((item) => item.severity === "error"),
    warningIssues: issues.filter((item) => item.severity !== "error"),
  };
}

async function getNextVersionNumber(sessionId, executor) {
  const [rows] = await executor.query(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
     FROM schedule_generations
     WHERE id_session = ?`,
    [Number(sessionId)]
  );

  return Number(rows[0]?.next_version || 1);
}

async function executeBatchInsert({
  executor,
  prefixSql,
  tupleSql,
  rows,
  chunkSize = 150,
}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const sql = `${prefixSql} ${chunk.map(() => tupleSql).join(", ")}`;
    const params = chunk.flat();
    await executor.query(sql, params);
  }
}

async function persistGeneration({
  session,
  placementItems,
  studentAssignmentItems,
  metrics,
  conflicts,
  status,
  sourceKind,
  createdBy,
  parentGenerationId = null,
  restoredFromGenerationId = null,
  sourceReportId = null,
  notes = null,
  generationName = null,
  metadata = null,
  executor,
}) {
  const versionNumber = await getNextVersionNumber(session.id_session, executor);
  const finalStatus = normalizeStatus(status, "draft");
  const finalGenerationName =
    generationName ||
    buildGenerationName({
      versionNumber,
      sessionName: session.nom,
      sourceKind,
      referenceName: null,
    });

  if (finalStatus === "active" || finalStatus === "restored") {
    await executor.query(
      `UPDATE schedule_generations
       SET is_active = 0,
           status = CASE WHEN status = 'active' THEN 'archived' ELSE status END,
           archived_at = CASE WHEN archived_at IS NULL THEN CURRENT_TIMESTAMP ELSE archived_at END
       WHERE id_session = ?
         AND is_active = 1
         AND deleted_at IS NULL`,
      [Number(session.id_session)]
    );
  }

  const [result] = await executor.query(
    `INSERT INTO schedule_generations (
       id_session,
       version_number,
       generation_name,
       status,
       is_active,
       created_by,
       parent_generation_id,
       restored_from_generation_id,
       source_report_id,
       source_kind,
       optimization_mode,
       quality_score,
       conflict_count,
       placement_count,
       teacher_count,
       room_count,
       group_count,
       student_count,
       constraint_ok_count,
       constraint_warning_count,
       notes,
       metadata,
       activated_at,
       archived_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(session.id_session),
      versionNumber,
      finalGenerationName,
      finalStatus,
      finalStatus === "active" || finalStatus === "restored" ? 1 : 0,
      createdBy,
      parentGenerationId,
      restoredFromGenerationId,
      sourceReportId,
      sourceKind,
      metrics.optimisation_mode || null,
      metrics.quality_score,
      metrics.conflict_count,
      metrics.placement_count,
      metrics.teacher_count,
      metrics.room_count,
      metrics.group_count,
      metrics.student_count,
      readNumber(metrics.constraint_ok_count, 0),
      readNumber(metrics.constraint_warning_count, 0),
      notes,
      serializeJsonValue(metadata),
      finalStatus === "active" || finalStatus === "restored" ? new Date() : null,
      finalStatus === "archived" ? new Date() : null,
    ]
  );

  const generationId = Number(result.insertId);

  if (placementItems.length > 0 || studentAssignmentItems.length > 0) {
    const items = [...placementItems, ...studentAssignmentItems];
    await executeBatchInsert({
      executor,
      prefixSql: `INSERT INTO schedule_generation_items (
        id_generation,
        item_type,
        comparison_key,
        item_order,
        id_cours,
        id_professeur,
        id_salle,
        id_groupes_etudiants,
        id_etudiant,
        id_session,
        source_type,
        date_cours,
        heure_debut,
        heure_fin,
        payload
      ) VALUES`,
      tupleSql: "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      rows: items.map((item) => [
        generationId,
        item.item_type,
        item.comparison_key,
        item.item_order,
        item.id_cours,
        item.id_professeur,
        item.id_salle,
        item.id_groupes_etudiants,
        item.id_etudiant,
        item.id_session,
        item.source_type,
        item.date_cours,
        item.heure_debut,
        item.heure_fin,
        serializeJsonValue(item.payload || null),
      ]),
    });
  }

  await executeBatchInsert({
    executor,
    prefixSql: `INSERT INTO schedule_generation_metrics (
      id_generation,
      metric_key,
      metric_type,
      metric_numeric,
      metric_text,
      metric_json
    ) VALUES`,
    tupleSql: "(?, ?, ?, ?, ?, ?)",
    rows: Object.entries(metrics).map(([metricKey, metricValue]) => {
      const row = buildMetricRow(metricKey, metricValue);
      return [
        generationId,
        row.metric_key,
        row.metric_type,
        row.metric_numeric,
        row.metric_text,
        row.metric_json,
      ];
    }),
    chunkSize: 80,
  });

  await executeBatchInsert({
    executor,
    prefixSql: `INSERT INTO schedule_generation_conflicts (
      id_generation,
      conflict_category,
      severity,
      conflict_code,
      label,
      item_reference,
      payload
    ) VALUES`,
    tupleSql: "(?, ?, ?, ?, ?, ?, ?)",
    rows: conflicts.map((conflict) => [
      generationId,
      conflict.conflict_category,
      conflict.severity,
      conflict.conflict_code,
      conflict.label,
      conflict.item_reference,
      serializeJsonValue(conflict.payload || null),
    ]),
    chunkSize: 120,
  });

  await executor.query(
    `INSERT INTO schedule_generation_actions (
       id_generation,
       action_type,
       performed_by,
       action_note,
       details
     ) VALUES (?, ?, ?, ?, ?)`,
    [
      generationId,
      sourceKind === "restore" ? "RESTORE" : sourceKind === "duplicate" ? "DUPLICATE" : "CREATE",
      createdBy,
      notes,
      serializeJsonValue({
        source_kind: sourceKind,
        status: finalStatus,
        version_number: versionNumber,
      }),
    ]
  );

  return generationId;
}

async function loadGenerationSummary(idGeneration, executor) {
  const [rows] = await executor.query(
    `SELECT sg.*,
            s.nom AS session_nom,
            u.nom AS created_by_nom,
            u.prenom AS created_by_prenom
     FROM schedule_generations sg
     JOIN sessions s
       ON s.id_session = sg.id_session
     LEFT JOIN utilisateurs u
       ON u.id_utilisateur = sg.created_by
     WHERE sg.id_generation = ?
     LIMIT 1`,
    [Number(idGeneration)]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

async function loadGenerationItems(idGeneration, executor) {
  const [rows] = await executor.query(
    `SELECT *
     FROM schedule_generation_items
     WHERE id_generation = ?
     ORDER BY item_type ASC, item_order ASC, id_generation_item ASC`,
    [Number(idGeneration)]
  );

  return rows.map((row) => ({
    ...row,
    payload: parseJsonValue(row.payload, {}),
  }));
}

async function loadGenerationMetrics(idGeneration, executor) {
  const [rows] = await executor.query(
    `SELECT *
     FROM schedule_generation_metrics
     WHERE id_generation = ?
     ORDER BY metric_key ASC`,
    [Number(idGeneration)]
  );

  return hydrateMetricRows(rows);
}

async function loadGenerationConflicts(idGeneration, executor) {
  const [rows] = await executor.query(
    `SELECT *
     FROM schedule_generation_conflicts
     WHERE id_generation = ?
     ORDER BY id_generation_conflict ASC`,
    [Number(idGeneration)]
  );

  return rows.map((row) => ({
    ...row,
    payload: parseJsonValue(row.payload, {}),
  }));
}

async function loadGenerationActions(idGeneration, executor) {
  const [rows] = await executor.query(
    `SELECT sga.*,
            u.nom AS performed_by_nom,
            u.prenom AS performed_by_prenom
     FROM schedule_generation_actions sga
     LEFT JOIN utilisateurs u
       ON u.id_utilisateur = sga.performed_by
     WHERE sga.id_generation = ?
     ORDER BY sga.created_at DESC, sga.id_generation_action DESC`,
    [Number(idGeneration)]
  );

  return rows.map((row) => ({
    ...row,
    details: parseJsonValue(row.details, {}),
  }));
}

async function insertGenerationAction({
  idGeneration,
  actionType,
  performedBy,
  actionNote = null,
  details = null,
  executor,
}) {
  await executor.query(
    `INSERT INTO schedule_generation_actions (
       id_generation,
       action_type,
       performed_by,
       action_note,
       details
     ) VALUES (?, ?, ?, ?, ?)`,
    [
      Number(idGeneration),
      actionType,
      performedBy,
      actionNote,
      serializeJsonValue(details),
    ]
  );
}

export class ScheduleGenerationService {
  static async captureCurrentGeneration({
    idSession = null,
    report = null,
    request = null,
    sourceKind = "automatic_generation",
    status = "active",
    notes = null,
    parentGenerationId = null,
    restoredFromGenerationId = null,
    executor = pool,
    performanceTracker = null,
  } = {}) {
    const connection =
      typeof executor.getConnection === "function" ? await executor.getConnection() : executor;
    const trackedConnection =
      performanceTracker?.wrapExecutor?.(connection, "schedule_generation") || connection;
    const user = getUserFromRequest(request);
    const shouldManageTransaction = typeof executor.getConnection === "function";

    try {
      performanceTracker?.startStep("capture_generation_totale");
      if (shouldManageTransaction) {
        await trackedConnection.beginTransaction();
      }

      const liveState = await (performanceTracker?.measure
        ? performanceTracker.measure("capture_chargement_donnees", async () =>
            loadLiveScheduleState(idSession, trackedConnection)
          )
        : loadLiveScheduleState(idSession, trackedConnection));
      const metrics = buildMetrics({
        report,
        snapshot: liveState.snapshot,
        placementItems: liveState.placementItems,
        studentAssignments: liveState.studentAssignments,
      });
      performanceTracker?.setCounter(
        "generation_snapshot_items",
        liveState.placementItems.length + liveState.studentAssignmentItems.length
      );
      const conflicts = buildConflictRows(report);
      const generationId = await (performanceTracker?.measure
        ? performanceTracker.measure("capture_persistance_generation", async () =>
            persistGeneration({
              session: liveState.session,
              placementItems: liveState.placementItems,
              studentAssignmentItems: liveState.studentAssignmentItems,
              metrics,
              conflicts,
              status,
              sourceKind,
              createdBy: normalizePositiveInteger(user?.id),
              parentGenerationId: normalizePositiveInteger(parentGenerationId),
              restoredFromGenerationId: normalizePositiveInteger(restoredFromGenerationId),
              sourceReportId: normalizePositiveInteger(report?.id_rapport || report?.id),
              notes,
              metadata: buildGenerationMetadata({ report, sourceKind, request }),
              executor: trackedConnection,
            })
          )
        : persistGeneration({
            session: liveState.session,
            placementItems: liveState.placementItems,
            studentAssignmentItems: liveState.studentAssignmentItems,
            metrics,
            conflicts,
            status,
            sourceKind,
            createdBy: normalizePositiveInteger(user?.id),
            parentGenerationId: normalizePositiveInteger(parentGenerationId),
            restoredFromGenerationId: normalizePositiveInteger(restoredFromGenerationId),
            sourceReportId: normalizePositiveInteger(report?.id_rapport || report?.id),
            notes,
            metadata: buildGenerationMetadata({ report, sourceKind, request }),
            executor: trackedConnection,
          }));

      if (shouldManageTransaction) {
        await trackedConnection.commit();
      }

      const generation = await (performanceTracker?.measure
        ? performanceTracker.measure("capture_relecture_generation", async () =>
            ScheduleGenerationService.getGenerationById(generationId, trackedConnection)
          )
        : ScheduleGenerationService.getGenerationById(generationId, trackedConnection));
      performanceTracker?.endStep("capture_generation_totale");
      return generation;
    } catch (error) {
      performanceTracker?.endStep("capture_generation_totale");
      if (shouldManageTransaction) {
        await trackedConnection.rollback();
      }
      throw error;
    } finally {
      if (shouldManageTransaction) {
        connection.release();
      }
    }
  }

  static async listGenerations({ idSession = null, status = null } = {}, executor = pool) {
    const clauses = ["sg.deleted_at IS NULL"];
    const values = [];

    if (normalizePositiveInteger(idSession)) {
      clauses.push("sg.id_session = ?");
      values.push(Number(idSession));
    }

    if (status) {
      clauses.push("sg.status = ?");
      values.push(normalizeStatus(status, status));
    }

    const [rows] = await executor.query(
      `SELECT sg.id_generation,
              sg.id_session,
              sg.version_number,
              sg.generation_name,
              sg.status,
              sg.is_active,
              sg.created_at,
              sg.activated_at,
              sg.archived_at,
              sg.source_kind,
              sg.optimization_mode,
              CASE
                WHEN sg.quality_score IS NULL OR (sg.quality_score = 0 AND sg.placement_count > 0)
                  THEN COALESCE(msel.metric_numeric, meq.metric_numeric, sg.quality_score)
                ELSE sg.quality_score
              END AS quality_score,
              sg.conflict_count,
              sg.placement_count,
              sg.teacher_count,
              sg.room_count,
              sg.group_count,
              sg.student_count,
              sg.notes,
              s.nom AS session_nom,
              u.nom AS created_by_nom,
              u.prenom AS created_by_prenom
       FROM schedule_generations sg
       JOIN sessions s
         ON s.id_session = sg.id_session
       LEFT JOIN utilisateurs u
         ON u.id_utilisateur = sg.created_by
       LEFT JOIN schedule_generation_metrics msel
         ON msel.id_generation = sg.id_generation
        AND msel.metric_key = 'score_global_selectionne'
       LEFT JOIN schedule_generation_metrics meq
         ON meq.id_generation = sg.id_generation
        AND meq.metric_key = 'score_global_equilibre'
       WHERE ${clauses.join(" AND ")}
       ORDER BY sg.created_at DESC, sg.id_generation DESC`,
      values
    );

    return rows.map((row) => ({
      ...row,
      is_active: Boolean(Number(row.is_active || 0)),
    }));
  }

  static async getGenerationById(idGeneration, executor = pool) {
    const generation = await loadGenerationSummary(idGeneration, executor);
    if (!generation || generation.deleted_at) {
      return null;
    }

    const [rawMetrics, conflicts, actions, items] = await Promise.all([
      loadGenerationMetrics(idGeneration, executor),
      loadGenerationConflicts(idGeneration, executor),
      loadGenerationActions(idGeneration, executor),
      loadGenerationItems(idGeneration, executor),
    ]);
    const metrics = enrichScoringMetrics(rawMetrics);

    return {
      ...generation,
      is_active: Boolean(Number(generation.is_active || 0)),
      quality_score:
        generation.quality_score === null ||
        (Number(generation.quality_score) === 0 && Number(generation.placement_count || 0) > 0)
          ? readNumber(
              metrics.score_global_selectionne,
              readNumber(metrics.score_global_equilibre, generation.quality_score)
            )
          : generation.quality_score,
      metrics,
      conflicts,
      actions,
      placements: items.filter((item) => item.item_type === GENERATION_ITEM_TYPES.PLACEMENT),
      student_assignments: items.filter(
        (item) => item.item_type === GENERATION_ITEM_TYPES.STUDENT_ASSIGNMENT
      ),
    };
  }

  static async updateGeneration(idGeneration, payload = {}, request = null, executor = pool) {
    const connection =
      typeof executor.getConnection === "function" ? await executor.getConnection() : executor;
    const shouldManageTransaction = typeof executor.getConnection === "function";
    const user = getUserFromRequest(request);

    try {
      if (shouldManageTransaction) {
        await connection.beginTransaction();
      }

      const current = await loadGenerationSummary(idGeneration, connection);
      if (!current || current.deleted_at) {
        const error = new Error("Generation introuvable.");
        error.statusCode = 404;
        throw error;
      }

      const generationName =
        typeof payload.generation_name === "string" && payload.generation_name.trim()
          ? payload.generation_name.trim().slice(0, 160)
          : current.generation_name;
      const notes =
        payload.notes === null || payload.notes === undefined
          ? current.notes
          : String(payload.notes || "").trim() || null;

      await connection.query(
        `UPDATE schedule_generations
         SET generation_name = ?, notes = ?
         WHERE id_generation = ?`,
        [generationName, notes, Number(idGeneration)]
      );

      await insertGenerationAction({
        idGeneration,
        actionType: "UPDATE_NOTE",
        performedBy: normalizePositiveInteger(user?.id),
        actionNote: notes,
        details: {
          generation_name: generationName,
        },
        executor: connection,
      });

      if (shouldManageTransaction) {
        await connection.commit();
      }

      return ScheduleGenerationService.getGenerationById(idGeneration, connection);
    } catch (error) {
      if (shouldManageTransaction) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (shouldManageTransaction) {
        connection.release();
      }
    }
  }

  static async compareGenerations({ leftId, rightId }, request = null, executor = pool) {
    const [left, right] = await Promise.all([
      ScheduleGenerationService.getGenerationById(leftId, executor),
      ScheduleGenerationService.getGenerationById(rightId, executor),
    ]);

    if (!left || !right) {
      const error = new Error("Impossible de comparer des generations introuvables.");
      error.statusCode = 404;
      throw error;
    }

    const comparison = compareGenerationPlacements(
      left.placements,
      right.placements,
      left,
      right
    );

    await journaliserActivite({
      request,
      actionType: "COMPARE",
      module: "Generations horaires",
      targetType: "Generation comparee",
      targetId: `${left.id_generation}-${right.id_generation}`,
      description: `Comparaison des generations ${left.version_number} et ${right.version_number}.`,
      newValue: {
        left_id_generation: left.id_generation,
        right_id_generation: right.id_generation,
      },
    });

    return {
      left: {
        id_generation: left.id_generation,
        version_number: left.version_number,
        generation_name: left.generation_name,
        created_at: left.created_at,
      },
      right: {
        id_generation: right.id_generation,
        version_number: right.version_number,
        generation_name: right.generation_name,
        created_at: right.created_at,
      },
      comparison,
    };
  }

  static async duplicateGeneration(idGeneration, request = null, executor = pool) {
    const connection =
      typeof executor.getConnection === "function" ? await executor.getConnection() : executor;
    const shouldManageTransaction = typeof executor.getConnection === "function";
    const user = getUserFromRequest(request);

    try {
      if (shouldManageTransaction) {
        await connection.beginTransaction();
      }

      const source = await ScheduleGenerationService.getGenerationById(idGeneration, connection);
      if (!source) {
        const error = new Error("Generation introuvable.");
        error.statusCode = 404;
        throw error;
      }

      const metrics = {
        ...source.metrics,
        placement_count: source.placements.length,
      };
      const generationId = await persistGeneration({
        session: {
          id_session: source.id_session,
          nom: source.session_nom,
        },
        placementItems: source.placements.map((item) => ({
          ...item,
          payload: item.payload || {},
        })),
        studentAssignmentItems: source.student_assignments.map((item) => ({
          ...item,
          payload: item.payload || {},
        })),
        metrics,
        conflicts: source.conflicts,
        status: "draft",
        sourceKind: "duplicate",
        createdBy: normalizePositiveInteger(user?.id),
        parentGenerationId: normalizePositiveInteger(source.id_generation),
        generationName: buildGenerationName({
          versionNumber: await getNextVersionNumber(source.id_session, connection),
          sessionName: source.session_nom,
          sourceKind: "duplicate",
          referenceName: source.generation_name,
        }),
        metadata: {
          duplicated_from_generation_id: source.id_generation,
        },
        executor: connection,
      });

      await insertGenerationAction({
        idGeneration,
        actionType: "DUPLICATED_AS_NEW_VERSION",
        performedBy: normalizePositiveInteger(user?.id),
        details: {
          duplicated_to_generation_id: generationId,
        },
        executor: connection,
      });

      if (shouldManageTransaction) {
        await connection.commit();
      }

      await journaliserActivite({
        request,
        actionType: "DUPLICATE",
        module: "Generations horaires",
        targetType: "Generation",
        targetId: idGeneration,
        description: `Duplication de la generation ${source.version_number}.`,
        newValue: {
          source_generation_id: source.id_generation,
          duplicated_generation_id: generationId,
        },
      });

      return ScheduleGenerationService.getGenerationById(generationId, connection);
    } catch (error) {
      if (shouldManageTransaction) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (shouldManageTransaction) {
        connection.release();
      }
    }
  }

  static async archiveGeneration(idGeneration, request = null, executor = pool) {
    const connection =
      typeof executor.getConnection === "function" ? await executor.getConnection() : executor;
    const shouldManageTransaction = typeof executor.getConnection === "function";
    const user = getUserFromRequest(request);

    try {
      if (shouldManageTransaction) {
        await connection.beginTransaction();
      }

      const generation = await loadGenerationSummary(idGeneration, connection);
      if (!generation || generation.deleted_at) {
        const error = new Error("Generation introuvable.");
        error.statusCode = 404;
        throw error;
      }

      if (Number(generation.is_active || 0) === 1) {
        const error = new Error("Impossible d'archiver la generation active.");
        error.statusCode = 409;
        throw error;
      }

      await connection.query(
        `UPDATE schedule_generations
         SET status = 'archived',
             archived_at = CURRENT_TIMESTAMP
         WHERE id_generation = ?`,
        [Number(idGeneration)]
      );

      await insertGenerationAction({
        idGeneration,
        actionType: "ARCHIVE",
        performedBy: normalizePositiveInteger(user?.id),
        executor: connection,
      });

      if (shouldManageTransaction) {
        await connection.commit();
      }

      await journaliserActivite({
        request,
        actionType: "ARCHIVE",
        module: "Generations horaires",
        targetType: "Generation",
        targetId: idGeneration,
        description: `Archivage de la generation ${generation.version_number}.`,
      });

      return ScheduleGenerationService.getGenerationById(idGeneration, connection);
    } catch (error) {
      if (shouldManageTransaction) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (shouldManageTransaction) {
        connection.release();
      }
    }
  }

  static async softDeleteGeneration(idGeneration, request = null, executor = pool) {
    const generation = await loadGenerationSummary(idGeneration, executor);
    if (!generation || generation.deleted_at) {
      const error = new Error("Generation introuvable.");
      error.statusCode = 404;
      throw error;
    }

    if (Number(generation.is_active || 0) === 1) {
      const error = new Error("Impossible de supprimer logiquement la generation active.");
      error.statusCode = 409;
      throw error;
    }

    await executor.query(
      `UPDATE schedule_generations
       SET deleted_at = CURRENT_TIMESTAMP,
           status = 'archived'
       WHERE id_generation = ?`,
      [Number(idGeneration)]
    );

    await journaliserActivite({
      request,
      actionType: "DELETE",
      module: "Generations horaires",
      targetType: "Generation",
      targetId: idGeneration,
      description: `Suppression logique de la generation ${generation.version_number}.`,
    });

    return {
      success: true,
      id_generation: Number(idGeneration),
    };
  }

  static async previewRestore(idGeneration, executor = pool) {
    const [generation, liveState] = await Promise.all([
      ScheduleGenerationService.getGenerationById(idGeneration, executor),
      (async () => {
        const summary = await loadGenerationSummary(idGeneration, executor);
        if (!summary) {
          return null;
        }
        return loadLiveScheduleState(summary.id_session, executor);
      })(),
    ]);

    if (!generation || !liveState) {
      const error = new Error("Generation introuvable.");
      error.statusCode = 404;
      throw error;
    }

    const validation = await buildRestoreValidation({
      sessionId: generation.id_session,
      placementItems: generation.placements,
      studentAssignments: generation.student_assignments,
      executor,
    });

    return {
      generation: {
        id_generation: generation.id_generation,
        version_number: generation.version_number,
        generation_name: generation.generation_name,
        status: generation.status,
      },
      session: liveState.session,
      current_active_generation_id: null,
      comparison: compareGenerationPlacements(
        liveState.placementItems,
        generation.placements,
        {
          placement_count: liveState.placementItems.length,
          room_count: liveState.snapshot.rooms.length,
          teacher_count: liveState.snapshot.professors.length,
          conflict_count: 0,
          quality_score: 0,
        },
        generation
      ),
      validation,
    };
  }

  static async restoreGeneration(idGeneration, { confirm = false, note = null } = {}, request = null, executor = pool) {
    const connection =
      typeof executor.getConnection === "function" ? await executor.getConnection() : executor;
    const shouldManageTransaction = typeof executor.getConnection === "function";
    const user = getUserFromRequest(request);

    try {
      const preview = await ScheduleGenerationService.previewRestore(idGeneration, connection);

      if (!confirm) {
        return {
          requires_confirmation: true,
          ...preview,
        };
      }

      if (preview.validation.blockingIssues.length > 0) {
        const error = new Error("La restauration est bloquee par des references manquantes.");
        error.statusCode = 409;
        error.details = preview.validation;
        throw error;
      }

      if (shouldManageTransaction) {
        await connection.beginTransaction();
      }

      const target = await ScheduleGenerationService.getGenerationById(idGeneration, connection);
      const liveState = await loadLiveScheduleState(target.id_session, connection);

      await ScheduleGenerationService.captureCurrentGeneration({
        idSession: target.id_session,
        request,
        sourceKind: "pre_restore_backup",
        status: "archived",
        notes: "Sauvegarde automatique avant restauration.",
        executor: connection,
      });

      await SchedulerEngine._supprimerHoraireSession(target.id_session, connection);

      for (const placement of target.placements.sort((left, right) => left.item_order - right.item_order)) {
        await connection.query(
          `INSERT IGNORE INTO plages_horaires (date, heure_debut, heure_fin)
           VALUES (?, ?, ?)`,
          [placement.date_cours, placement.heure_debut, placement.heure_fin]
        );

        const [[plage]] = await connection.query(
          `SELECT id_plage_horaires
           FROM plages_horaires
           WHERE date = ? AND heure_debut = ? AND heure_fin = ?
           LIMIT 1`,
          [placement.date_cours, placement.heure_debut, placement.heure_fin]
        );

        const [affectation] = await connection.query(
          `INSERT INTO affectation_cours (
             id_cours,
             id_professeur,
             id_salle,
             id_plage_horaires,
             id_planification_serie
           ) VALUES (?, ?, ?, ?, ?)`,
          [
            placement.id_cours,
            placement.id_professeur,
            placement.id_salle || null,
            plage.id_plage_horaires,
            normalizePositiveInteger(placement.payload?.id_planification_serie),
          ]
        );

        for (const groupId of placement.payload?.group_ids || []) {
          await connection.query(
            `INSERT INTO affectation_groupes (id_groupes_etudiants, id_affectation_cours)
             VALUES (?, ?)`,
            [Number(groupId), Number(affectation.insertId)]
          );
        }
      }

      for (const assignment of target.student_assignments) {
        await connection.query(
          `INSERT INTO affectation_etudiants (
             id_etudiant,
             id_groupes_etudiants,
             id_cours,
             id_session,
             source_type,
             id_cours_echoue,
             id_echange_cours
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            assignment.id_etudiant,
            assignment.id_groupes_etudiants,
            assignment.id_cours,
            target.id_session,
            assignment.source_type,
            normalizePositiveInteger(assignment.payload?.id_cours_echoue),
            normalizePositiveInteger(assignment.payload?.id_echange_cours),
          ]
        );
      }

      await connection.query(
        `UPDATE schedule_generations
         SET is_active = 0,
             status = CASE WHEN status = 'active' THEN 'archived' ELSE status END,
             archived_at = CASE WHEN archived_at IS NULL THEN CURRENT_TIMESTAMP ELSE archived_at END
         WHERE id_session = ?
           AND is_active = 1
           AND id_generation <> ?`,
        [Number(target.id_session), Number(target.id_generation)]
      );

      await connection.query(
        `UPDATE schedule_generations
         SET is_active = 1,
             status = 'restored',
             activated_at = CURRENT_TIMESTAMP
         WHERE id_generation = ?`,
        [Number(target.id_generation)]
      );

      await insertGenerationAction({
        idGeneration,
        actionType: "RESTORE",
        performedBy: normalizePositiveInteger(user?.id),
        actionNote: note,
        details: {
          restored_placement_count: target.placements.length,
          previous_live_placement_count: liveState.placementItems.length,
          validation_warnings: preview.validation.warningIssues.length,
        },
        executor: connection,
      });

      if (shouldManageTransaction) {
        await connection.commit();
      }

      await journaliserActivite({
        request,
        actionType: "RESTORE",
        module: "Generations horaires",
        targetType: "Generation",
        targetId: idGeneration,
        description: `Restauration de la generation ${target.version_number}.`,
        newValue: {
          id_generation: target.id_generation,
          version_number: target.version_number,
          notes: note,
        },
      });

      return {
        restored: true,
        preview,
        generation: await ScheduleGenerationService.getGenerationById(idGeneration, connection),
      };
    } catch (error) {
      if (shouldManageTransaction) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (shouldManageTransaction) {
        connection.release();
      }
    }
  }
}

export default ScheduleGenerationService;
