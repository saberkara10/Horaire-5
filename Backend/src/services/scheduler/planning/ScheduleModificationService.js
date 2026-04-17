/**
 * ScheduleModificationService
 *
 * Ce module orchestre la replanification intelligente d'une affectation
 * existante en s'appuyant sur le snapshot officiel, le what-if read-only et
 * les validations deja en place.
 *
 * Responsabilites principales :
 * - distinguer clairement la modification d'une creation ;
 * - imposer une simulation obligatoire avant ecriture ;
 * - appliquer la mutation retenue dans une transaction atomique ;
 * - gerer les portees sur occurrence ou serie ;
 * - journaliser l'etat avant/apres pour audit futur.
 *
 * Integration dans le systeme :
 * - reutilise ScheduleSnapshot pour charger l'horaire officiel ;
 * - reutilise ScenarioSimulator pour scorer et valider avant application ;
 * - s'appuie sur `planification_series` quand une recurrence existe deja ;
 * - n'appelle jamais `generer()`, car la replanification doit rester locale,
 *   explicable et sans effet destructif global.
 */

import pool from "../../../../db.js";
import { assurerSchemaSchedulerAcademique } from "../../academic-scheduler-schema.js";
import { PlacementEvaluator } from "../optimization/PlacementEvaluator.js";
import { ScenarioSimulator } from "../simulation/ScenarioSimulator.js";
import { ScheduleSnapshot } from "../simulation/ScheduleSnapshot.js";
import { buildSlotMetadataFromTimeRange } from "../time/TimeSlotUtils.js";

const STRONG_SCORE_DEGRADATION_THRESHOLD = -5;

/**
 * Cree une erreur fonctionnelle standardisee.
 *
 * @param {string} message - message metier.
 * @param {number} [statusCode=400] - code HTTP a retourner.
 * @param {string} [code="SCHEDULE_MODIFICATION_ERROR"] - code metier.
 * @param {Object} [details={}] - contexte detaille.
 *
 * @returns {Error} Erreur enrichie.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : le detail peut embarquer le rapport de simulation bloque.
 */
function createScheduleModificationError(
  message,
  statusCode = 400,
  code = "SCHEDULE_MODIFICATION_ERROR",
  details = {}
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Execute une operation dans une transaction si l'executor est un pool.
 *
 * @param {Function} operation - operation a executer.
 * @param {Object} [executor=pool] - pool MySQL ou connexion transactionnelle.
 *
 * @returns {Promise<*>} Resultat de l'operation.
 *
 * Effets secondaires : ouvre/commit/rollback une transaction si necessaire.
 * Cas particuliers : une connexion deja ouverte est reutilisee telle quelle.
 */
async function executeInTransactionIfNeeded(operation, executor = pool) {
  const shouldOpenTransaction =
    executor &&
    typeof executor.getConnection === "function" &&
    typeof executor.query === "function";
  const connection = shouldOpenTransaction ? await executor.getConnection() : executor;

  if (shouldOpenTransaction) {
    await connection.beginTransaction();
  }

  try {
    const result = await operation(connection);

    if (shouldOpenTransaction) {
      await connection.commit();
    }

    return result;
  } catch (error) {
    if (shouldOpenTransaction) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (shouldOpenTransaction) {
      connection.release();
    }
  }
}

/**
 * Normalise un entier positif.
 *
 * @param {number|string|null|undefined} value - valeur source.
 *
 * @returns {number|null} Entier positif ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les valeurs nulles, negatives et NaN sont rejetees.
 */
function normalizePositiveInteger(value) {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : null;
}

/**
 * Normalise une heure HH:MM:SS.
 *
 * @param {string|null|undefined} timeValue - heure source.
 *
 * @returns {string} Heure normalisee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne une chaine vide si la valeur est absente.
 */
function normalizeTime(timeValue) {
  const value = String(timeValue || "").trim();
  if (value === "") {
    return "";
  }

  if (value.length === 5) {
    return `${value}:00`;
  }

  return value.slice(0, 8);
}

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

function getIsoWeekday(dateValue) {
  const date = parseDateUtc(dateValue);
  if (!date) {
    return null;
  }

  const weekday = date.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function resolvePlacementTiming(placement) {
  const normalizedStartTime = normalizeTime(placement?.heure_debut);
  const normalizedEndTime = normalizeTime(placement?.heure_fin);
  const metadata = buildSlotMetadataFromTimeRange(normalizedStartTime, normalizedEndTime);
  const slotStartIndex = Number(placement?.slotStartIndex);
  const slotEndIndex = Number(placement?.slotEndIndex);
  const durationHours = Number(placement?.dureeHeures);

  return {
    jourSemaine:
      Number.isInteger(Number(placement?.jourSemaine)) &&
      Number(placement?.jourSemaine) >= 1 &&
      Number(placement?.jourSemaine) <= 7
        ? Number(placement.jourSemaine)
        : getIsoWeekday(placement?.date),
    dureeHeures:
      Number(metadata?.dureeHeures) > 0
        ? Number(metadata.dureeHeures)
        : durationHours > 0
          ? durationHours
          : Number.isInteger(slotStartIndex) && Number.isInteger(slotEndIndex) && slotEndIndex > slotStartIndex
            ? slotEndIndex - slotStartIndex
            : 0,
    slotStartIndex:
      Number.isInteger(Number(metadata?.slotStartIndex)) &&
      Number(metadata.slotStartIndex) >= 0
        ? Number(metadata.slotStartIndex)
        : Number.isInteger(slotStartIndex)
          ? slotStartIndex
          : null,
    slotEndIndex:
      Number.isInteger(Number(metadata?.slotEndIndex)) &&
      Number(metadata.slotEndIndex) > Number(metadata.slotStartIndex)
        ? Number(metadata.slotEndIndex)
        : Number.isInteger(slotEndIndex)
          ? slotEndIndex
          : null,
  };
}

/**
 * Parse une date ISO `YYYY-MM-DD`.
 *
 * @param {string|null|undefined} dateValue - date source.
 *
 * @returns {Date|null} Date locale minuit ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `null` si le format n'est pas exploitable.
 */
function parseIsoDate(dateValue) {
  const value = String(dateValue || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formate une date en ISO.
 *
 * @param {Date|null} dateValue - date source.
 *
 * @returns {string} Date ISO ou chaine vide.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne une chaine vide si la date est invalide.
 */
function formatIsoDate(dateValue) {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
    return "";
  }

  return dateValue.toISOString().slice(0, 10);
}

/**
 * Ajoute un nombre de jours a une date.
 *
 * @param {Date} dateValue - date de depart.
 * @param {number} dayCount - nombre de jours.
 *
 * @returns {Date} Nouvelle date.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne une copie, jamais la date d'origine.
 */
function addDays(dateValue, dayCount) {
  const clone = new Date(dateValue.getTime());
  clone.setDate(clone.getDate() + Number(dayCount || 0));
  return clone;
}

/**
 * Trie des placements dans l'ordre chronologique.
 *
 * @param {Object} left - placement de gauche.
 * @param {Object} right - placement de droite.
 *
 * @returns {number} Ordre stable.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : stabilise sur l'identifiant d'affectation.
 */
function comparePlacements(left, right) {
  return (
    String(left?.date || "").localeCompare(String(right?.date || ""), "fr") ||
    String(left?.heure_debut || "").localeCompare(String(right?.heure_debut || ""), "fr") ||
    String(left?.heure_fin || "").localeCompare(String(right?.heure_fin || ""), "fr") ||
    Number(left?.id_affectation_cours || 0) - Number(right?.id_affectation_cours || 0)
  );
}

/**
 * Serialise une valeur JSON.
 *
 * @param {*} value - valeur a serialiser.
 *
 * @returns {string|null} JSON ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : `null` reste `null`.
 */
function serializeJson(value) {
  return value == null ? null : JSON.stringify(value);
}

/**
 * Formate le nom affichable d'un professeur.
 *
 * @param {Object|null} professor - professeur source.
 *
 * @returns {string|null} Nom affiche.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `null` si aucune information n'est disponible.
 */
function buildProfessorDisplayName(professor) {
  const fullName = [professor?.prenom, professor?.nom].filter(Boolean).join(" ").trim();
  return fullName || professor?.nom || null;
}

/**
 * Construit un resume compact d'un placement pour le journal.
 *
 * @param {Object} placement - placement source.
 *
 * @returns {Object} Resume stable.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : ne conserve que les champs utiles a l'audit.
 */
function summarizePlacementForHistory(placement) {
  const timing = resolvePlacementTiming(placement);

  return {
    id_affectation_cours: Number(placement?.id_affectation_cours || 0) || null,
    id_planification_serie: Number(placement?.id_planification_serie || 0) || null,
    id_plage_horaires: Number(placement?.id_plage_horaires || 0) || null,
    id_cours: Number(placement?.id_cours || 0) || null,
    id_professeur: Number(placement?.id_professeur || 0) || null,
    id_salle: placement?.id_salle == null ? null : Number(placement.id_salle),
    id_groupe: Number(placement?.id_groupe || 0) || null,
    date: placement?.date || null,
    heure_debut: placement?.heure_debut || null,
    heure_fin: placement?.heure_fin || null,
    jourSemaine: timing.jourSemaine,
    dureeHeures: timing.dureeHeures,
    slotStartIndex: timing.slotStartIndex,
    slotEndIndex: timing.slotEndIndex,
  };
}

function summarizeSimulationScore(score) {
  if (!score || typeof score !== "object") {
    return null;
  }

  return {
    mode: score.mode || null,
    scoreGlobal: Number(score.scoreGlobal || 0),
    scoreEtudiant: Number(score.scoreEtudiant || 0),
    scoreProfesseur: Number(score.scoreProfesseur || 0),
    scoreGroupe: Number(score.scoreGroupe || 0),
    metrics: score.metrics || {},
  };
}

function buildHistoryDetails(simulation, warnings) {
  return {
    warnings,
    scoring_v1: {
      mode_scoring_avant: simulation?.modeScoringAvant || null,
      mode_scoring_apres: simulation?.modeScoringApres || null,
      score_avant: summarizeSimulationScore(simulation?.scoreAvant),
      score_apres: summarizeSimulationScore(simulation?.scoreApres),
      difference: simulation?.difference || null,
    },
  };
}

/**
 * Retourne des identifiants numeriques uniques tries.
 *
 * @param {Object[]} placements - placements sources.
 * @param {string} fieldName - champ a collecter.
 *
 * @returns {number[]} Identifiants uniques tries.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : ignore les valeurs nulles ou invalides.
 */
function collectUniqueNumericValues(placements, fieldName) {
  return [
    ...new Set(
      (Array.isArray(placements) ? placements : [])
        .map((placement) => Number(placement?.[fieldName] || 0))
        .filter((value) => Number.isInteger(value) && value > 0)
    ),
  ].sort((first, second) => first - second);
}

/**
 * Normalise la portee de modification.
 *
 * @param {string|Object|null|undefined} scopeValue - portee demandee.
 *
 * @returns {Object} Portee normalisee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : accepte les variantes historiques et camelCase.
 */
function normalizeScope(scopeValue) {
  if (scopeValue && typeof scopeValue === "object" && !Array.isArray(scopeValue)) {
    const rawMode = String(
      scopeValue.mode ||
        scopeValue.type ||
        scopeValue.portee ||
        scopeValue.scope ||
        "THIS_OCCURRENCE"
    )
      .trim()
      .toUpperCase();
    const normalizedMode = normalizeScope(rawMode).mode;

    return {
      mode: normalizedMode,
      dateDebut: String(
        scopeValue.dateDebut || scopeValue.date_debut || scopeValue.startDate || ""
      ).trim() || null,
      dateFin: String(
        scopeValue.dateFin || scopeValue.date_fin || scopeValue.endDate || ""
      ).trim() || null,
    };
  }

  const rawMode = String(scopeValue || "THIS_OCCURRENCE").trim().toUpperCase();
  const aliases = new Map([
    ["THIS_OCCURRENCE", "THIS_OCCURRENCE"],
    ["SINGLE", "THIS_OCCURRENCE"],
    ["SINGLE_OCCURRENCE", "THIS_OCCURRENCE"],
    ["THIS_AND_FOLLOWING", "THIS_AND_FOLLOWING"],
    ["FROM_THIS_WEEK", "THIS_AND_FOLLOWING"],
    ["UNTIL_SESSION_END", "THIS_AND_FOLLOWING"],
    ["ALL_OCCURRENCES", "ALL_OCCURRENCES"],
    ["ALL", "ALL_OCCURRENCES"],
    ["DATE_RANGE", "DATE_RANGE"],
    ["CUSTOM_RANGE", "DATE_RANGE"],
  ]);
  const mode = aliases.get(rawMode) || "THIS_OCCURRENCE";

  return {
    mode,
    dateDebut: null,
    dateFin: null,
  };
}

/**
 * Normalise les changements demandes.
 *
 * @param {Object} [modifications={}] - charge utile source.
 *
 * @returns {Object} Modifications normalisees.
 *
 * Effets secondaires : aucun.
 * Cas particuliers :
 * - la modification ne supporte que professeur, salle et plage horaire ;
 * - si une heure est fournie, les deux bornes sont requises.
 */
function normalizeModifications(modifications = {}) {
  const hasRoomKey =
    Object.prototype.hasOwnProperty.call(modifications, "idSalle") ||
    Object.prototype.hasOwnProperty.call(modifications, "id_salle");
  const hasProfessorKey =
    Object.prototype.hasOwnProperty.call(modifications, "idProfesseur") ||
    Object.prototype.hasOwnProperty.call(modifications, "id_professeur");
  const hasDateKey = Object.prototype.hasOwnProperty.call(modifications, "date");
  const hasStartTimeKey =
    Object.prototype.hasOwnProperty.call(modifications, "heureDebut") ||
    Object.prototype.hasOwnProperty.call(modifications, "heure_debut");
  const hasEndTimeKey =
    Object.prototype.hasOwnProperty.call(modifications, "heureFin") ||
    Object.prototype.hasOwnProperty.call(modifications, "heure_fin");

  if (hasStartTimeKey !== hasEndTimeKey) {
    throw createScheduleModificationError(
      "La modification d'une plage horaire exige heure_debut et heure_fin.",
      400,
      "TIME_RANGE_REQUIRED"
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(modifications, "idCours") ||
    Object.prototype.hasOwnProperty.call(modifications, "id_cours") ||
    Object.prototype.hasOwnProperty.call(modifications, "idGroupeEtudiants") ||
    Object.prototype.hasOwnProperty.call(modifications, "id_groupes_etudiants")
  ) {
    throw createScheduleModificationError(
      "La replanification intelligente V1 ne permet pas de changer le cours ou le groupe d'une affectation.",
      400,
      "UNSUPPORTED_MUTATION_SCOPE"
    );
  }

  const normalized = {
    hasRoomKey,
    hasProfessorKey,
    hasDateKey,
    hasTimeRange: hasStartTimeKey && hasEndTimeKey,
    idSalle: hasRoomKey
      ? modifications.idSalle === null || modifications.id_salle === null
        ? null
        : normalizePositiveInteger(modifications.idSalle ?? modifications.id_salle)
      : undefined,
    idProfesseur: hasProfessorKey
      ? normalizePositiveInteger(modifications.idProfesseur ?? modifications.id_professeur)
      : undefined,
    date: hasDateKey ? String(modifications.date || "").trim() : undefined,
    heureDebut: hasStartTimeKey
      ? normalizeTime(modifications.heureDebut ?? modifications.heure_debut)
      : undefined,
    heureFin: hasEndTimeKey
      ? normalizeTime(modifications.heureFin ?? modifications.heure_fin)
      : undefined,
  };

  if (
    !normalized.hasRoomKey &&
    !normalized.hasProfessorKey &&
    !normalized.hasDateKey &&
    !normalized.hasTimeRange
  ) {
    throw createScheduleModificationError(
      "Aucune modification exploitable n'a ete fournie.",
      400,
      "NO_CHANGE_REQUESTED"
    );
  }

  if (normalized.hasProfessorKey && !normalized.idProfesseur) {
    throw createScheduleModificationError(
      "Le professeur cible est invalide.",
      400,
      "TARGET_PROFESSOR_REQUIRED"
    );
  }

  if (normalized.hasRoomKey && normalized.idSalle === undefined) {
    throw createScheduleModificationError(
      "La salle cible est invalide.",
      400,
      "TARGET_ROOM_INVALID"
    );
  }

  return normalized;
}

/**
 * Normalise la requete de modification.
 *
 * @param {Object} payload - payload brut.
 *
 * @returns {Object} Requete normalisee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : accepte les variantes snake_case et camelCase.
 */
function normalizeModificationRequest(payload = {}) {
  const idAssignment = normalizePositiveInteger(
    payload.idSeance ||
      payload.id_seance ||
      payload.idAffectationCours ||
      payload.id_affectation_cours
  );

  if (!idAssignment) {
    throw createScheduleModificationError(
      "La modification exige un id de seance valide.",
      400,
      "ASSIGNMENT_ID_REQUIRED"
    );
  }

  return {
    idAssignment,
    modifications: normalizeModifications(payload.modifications || payload.changements || {}),
    scope: normalizeScope(payload.portee || payload.scope || payload.scope_mode),
    optimizationMode: PlacementEvaluator.normalizeMode(
      payload.modeOptimisation ||
        payload.mode_optimisation ||
        payload.optimizationMode ||
        "legacy"
    ),
    allowStrongScoreDegradation: Boolean(
      payload.allowStrongScoreDegradation ||
        payload.allow_strong_score_degradation ||
        payload.confirmerDegradationScore ||
        payload.confirmer_degradation_score
    ),
    idUtilisateur: normalizePositiveInteger(
      payload.idUtilisateur || payload.id_utilisateur
    ),
  };
}

/**
 * Charge le contexte minimal de l'affectation a modifier.
 *
 * @param {number} idAssignment - affectation de reference.
 * @param {Object} executor - connexion SQL active.
 *
 * @returns {Promise<Object|null>} Contexte minimal ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : la session est derivee du groupe rattache a l'affectation.
 */
async function loadAssignmentScopeContext(idAssignment, executor) {
  const [rows] = await executor.query(
    `SELECT ac.id_affectation_cours,
            ac.id_planification_serie,
            MIN(ge.id_session) AS id_session
     FROM affectation_cours ac
     LEFT JOIN affectation_groupes ag
       ON ag.id_affectation_cours = ac.id_affectation_cours
     LEFT JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     WHERE ac.id_affectation_cours = ?
     GROUP BY ac.id_affectation_cours, ac.id_planification_serie
     LIMIT 1`,
    [Number(idAssignment)]
  );

  return rows[0] || null;
}

/**
 * Verrouille les affectations ciblees pour la transaction courante.
 *
 * @param {number[]} assignmentIds - affectations a verrouiller.
 * @param {Object} executor - connexion transactionnelle.
 *
 * @returns {Promise<Object[]>} Lignes verrouillees.
 *
 * Effets secondaires : pose des verrous SQL `FOR UPDATE`.
 * Cas particuliers : leve une erreur si une occurrence a disparu entre lecture et ecriture.
 */
async function lockAssignmentsForUpdate(assignmentIds, executor) {
  const normalizedIds = assignmentIds
    .map((assignmentId) => Number(assignmentId))
    .filter((assignmentId) => Number.isInteger(assignmentId) && assignmentId > 0);

  if (normalizedIds.length === 0) {
    throw createScheduleModificationError(
      "Aucune occurrence cible n'a ete resolue.",
      404,
      "NO_ASSIGNMENT_IN_SCOPE"
    );
  }

  const placeholders = normalizedIds.map(() => "?").join(", ");
  const [rows] = await executor.query(
    `SELECT id_affectation_cours,
            id_plage_horaires,
            id_planification_serie
     FROM affectation_cours
     WHERE id_affectation_cours IN (${placeholders})
     FOR UPDATE`,
    normalizedIds
  );

  if (rows.length !== normalizedIds.length) {
    throw createScheduleModificationError(
      "Au moins une occurrence a change avant l'application de la modification.",
      409,
      "STALE_ASSIGNMENT_SCOPE"
    );
  }

  return rows;
}

/**
 * Resout les occurrences ciblees selon la portee demandee.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object} referencePlacement - affectation de reference.
 * @param {Object} scope - portee normalisee.
 *
 * @returns {Object} Resolution complete de la portee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers :
 * - une portee serie exige une `id_planification_serie` persistante ;
 * - `DATE_RANGE` reste optionnel mais supporte si les bornes sont coherentes.
 */
function resolveScopePlacements(snapshot, referencePlacement, scope) {
  const normalizedScope = normalizeScope(scope);
  const seriesId = Number(referencePlacement?.id_planification_serie || 0) || null;
  const seriesPlacements = (
    seriesId
      ? (snapshot?.clonePlacements?.() || []).filter(
          (placement) =>
            Number(placement?.id_planification_serie || 0) === Number(seriesId)
        )
      : [referencePlacement]
  ).sort(comparePlacements);

  if (
    normalizedScope.mode !== "THIS_OCCURRENCE" &&
    (!seriesId || seriesPlacements.length <= 1)
  ) {
    throw createScheduleModificationError(
      "Cette affectation ne supporte pas une portee serie. Seule THIS_OCCURRENCE est disponible.",
      409,
      "RECURRENCE_NOT_SUPPORTED"
    );
  }

  let targetPlacements = [referencePlacement];

  if (normalizedScope.mode === "THIS_AND_FOLLOWING") {
    targetPlacements = seriesPlacements.filter(
      (placement) => String(placement?.date || "") >= String(referencePlacement?.date || "")
    );
  } else if (normalizedScope.mode === "ALL_OCCURRENCES") {
    targetPlacements = seriesPlacements;
  } else if (normalizedScope.mode === "DATE_RANGE") {
    if (!normalizedScope.dateDebut || !normalizedScope.dateFin) {
      throw createScheduleModificationError(
        "DATE_RANGE exige dateDebut et dateFin.",
        400,
        "DATE_RANGE_REQUIRED"
      );
    }

    targetPlacements = seriesPlacements.filter((placement) => {
      const dateValue = String(placement?.date || "");
      return (
        dateValue >= String(normalizedScope.dateDebut) &&
        dateValue <= String(normalizedScope.dateFin)
      );
    });
  }

  if (targetPlacements.length === 0) {
    throw createScheduleModificationError(
      "Aucune occurrence ne correspond a la portee demandee.",
      404,
      "NO_ASSIGNMENT_IN_SCOPE"
    );
  }

  const anchorIndex = targetPlacements.findIndex(
    (placement) =>
      Number(placement?.id_affectation_cours || 0) ===
      Number(referencePlacement?.id_affectation_cours || 0)
  );

  return {
    mode: normalizedScope.mode,
    dateDebut: normalizedScope.dateDebut || null,
    dateFin: normalizedScope.dateFin || null,
    seriesId,
    seriesPlacements,
    targetPlacements,
    anchorIndex: anchorIndex >= 0 ? anchorIndex : 0,
  };
}

/**
 * Construit les dates ciblees pour les occurrences d'une meme portee.
 *
 * Regle metier :
 * quand une serie est deplacee, on conserve un pas hebdomadaire de 7 jours.
 * Le jour cible n'est donc jamais "fixe" globalement ; il est derive de la
 * nouvelle date d'ancrage choisie par l'utilisateur.
 *
 * @param {Object[]} targetPlacements - occurrences ciblees.
 * @param {number} anchorIndex - index de l'occurrence de reference.
 * @param {Object} modifications - modifications normalisees.
 *
 * @returns {Map<number, string>} Date cible par affectation.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : sans `date` explicite, chaque occurrence garde sa date actuelle.
 */
function buildTargetDatesByAssignment(targetPlacements, anchorIndex, modifications) {
  const targetDates = new Map();
  const hasExplicitDate = Boolean(modifications?.hasDateKey);

  if (!hasExplicitDate) {
    for (const placement of targetPlacements) {
      targetDates.set(Number(placement.id_affectation_cours), String(placement.date));
    }
    return targetDates;
  }

  const anchorDate = parseIsoDate(modifications.date);
  if (!anchorDate) {
    throw createScheduleModificationError(
      "La date cible est invalide.",
      400,
      "INVALID_TARGET_DATE"
    );
  }

  for (let index = 0; index < targetPlacements.length; index += 1) {
    const placement = targetPlacements[index];
    const targetDate = addDays(anchorDate, (index - anchorIndex) * 7);
    targetDates.set(Number(placement.id_affectation_cours), formatIsoDate(targetDate));
  }

  return targetDates;
}

/**
 * Construit un placement propose a partir d'un original.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object} originalPlacement - placement avant modification.
 * @param {Object} modifications - modifications normalisees.
 * @param {string} targetDate - date cible resolue.
 *
 * @returns {Object} Nouveau placement propose.
 *
 * Effets secondaires : aucun.
 * Cas particuliers :
 * - les identifiants d'affectation et de groupe sont preserves ;
 * - la simulation reste l'autorite pour juger la faisabilite finale.
 */
function buildProposedPlacement(
  snapshot,
  originalPlacement,
  modifications,
  targetDate
) {
  const hasExplicitRoom = Boolean(modifications?.hasRoomKey);
  const hasExplicitProfessor = Boolean(modifications?.hasProfessorKey);
  const nextProfessor =
    hasExplicitProfessor && modifications.idProfesseur
      ? snapshot.getProfessor(modifications.idProfesseur)
      : snapshot.getProfessor(originalPlacement.id_professeur);
  const nextRoom = hasExplicitRoom
    ? modifications.idSalle == null
      ? null
      : snapshot.getRoom(modifications.idSalle)
    : snapshot.getRoom(originalPlacement.id_salle);
  const nextStartTime = modifications.hasTimeRange
    ? modifications.heureDebut
    : originalPlacement.heure_debut;
  const nextEndTime = modifications.hasTimeRange
    ? modifications.heureFin
    : originalPlacement.heure_fin;
  const nextDate = targetDate;
  const timing = resolvePlacementTiming({
    ...originalPlacement,
    date: nextDate,
    heure_debut: nextStartTime,
    heure_fin: nextEndTime,
  });

  return {
    ...originalPlacement,
    date: nextDate,
    heure_debut: nextStartTime,
    heure_fin: nextEndTime,
    jourSemaine: timing.jourSemaine,
    dureeHeures: timing.dureeHeures,
    slotStartIndex: timing.slotStartIndex,
    slotEndIndex: timing.slotEndIndex,
    id_professeur: hasExplicitProfessor
      ? Number(modifications.idProfesseur)
      : Number(originalPlacement.id_professeur),
    nom_professeur: nextProfessor
      ? buildProfessorDisplayName(nextProfessor)
      : originalPlacement.nom_professeur || null,
    prenom_professeur: nextProfessor?.prenom || originalPlacement.prenom_professeur || null,
    id_salle: hasExplicitRoom
      ? nextRoom
        ? Number(nextRoom.id_salle)
        : null
      : originalPlacement.id_salle == null
        ? null
        : Number(originalPlacement.id_salle),
    code_salle: hasExplicitRoom
      ? nextRoom
        ? nextRoom.code || null
        : "EN LIGNE"
      : originalPlacement.code_salle || null,
    type_salle: hasExplicitRoom
      ? nextRoom
        ? nextRoom.type || null
        : null
      : originalPlacement.type_salle || null,
    capacite_salle: hasExplicitRoom
      ? nextRoom
        ? Number(nextRoom.capacite || 0)
        : 0
      : Number(originalPlacement.capacite_salle || 0),
    est_en_ligne: hasExplicitRoom
      ? nextRoom == null
      : Boolean(originalPlacement.est_en_ligne),
  };
}

/**
 * Construit le lot complet de placements proposes.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object} referencePlacement - occurrence de reference.
 * @param {Object} scopeResolution - occurrences ciblees.
 * @param {Object} modifications - modifications normalisees.
 *
 * @returns {Map<number, Object>} Propositions par affectation.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : preserve la cardinalite exacte des occurrences ciblees.
 */
function buildProposedPlacementsByAssignment(
  snapshot,
  referencePlacement,
  scopeResolution,
  modifications
) {
  const targetDates = buildTargetDatesByAssignment(
    scopeResolution.targetPlacements,
    scopeResolution.anchorIndex,
    modifications
  );
  const proposedPlacementsByAssignment = new Map();

  for (const placement of scopeResolution.targetPlacements) {
    const assignmentId = Number(placement.id_affectation_cours);
    proposedPlacementsByAssignment.set(
      assignmentId,
      buildProposedPlacement(
        snapshot,
        placement,
        modifications,
        targetDates.get(assignmentId) || String(placement.date)
      )
    );
  }

  return proposedPlacementsByAssignment;
}

/**
 * Verifie qu'au moins une occurrence change vraiment.
 *
 * @param {Object[]} originalPlacements - occurrences avant modification.
 * @param {Map<number, Object>} proposedPlacementsByAssignment - propositions.
 *
 * @returns {void}
 *
 * Effets secondaires : leve une erreur si la mutation est un no-op.
 * Cas particuliers : compare uniquement les champs effectivement modifiables.
 */
function ensureEffectiveChange(originalPlacements, proposedPlacementsByAssignment) {
  const hasEffectiveChange = (Array.isArray(originalPlacements) ? originalPlacements : []).some(
    (placement) => {
      const proposed = proposedPlacementsByAssignment.get(
        Number(placement.id_affectation_cours)
      );

      return (
        String(placement?.date || "") !== String(proposed?.date || "") ||
        String(placement?.heure_debut || "") !== String(proposed?.heure_debut || "") ||
        String(placement?.heure_fin || "") !== String(proposed?.heure_fin || "") ||
        Number(placement?.id_professeur || 0) !== Number(proposed?.id_professeur || 0) ||
        Number(placement?.id_salle || 0) !== Number(proposed?.id_salle || 0)
      );
    }
  );

  if (!hasEffectiveChange) {
    throw createScheduleModificationError(
      "La modification demandee ne change aucune valeur de l'affectation cible.",
      400,
      "NO_EFFECTIVE_CHANGE"
    );
  }
}

/**
 * Cree une plage horaire dediee a une occurrence modifiee.
 *
 * Cette creation volontaire evite de muter en place une plage potentiellement
 * partagee, ce qui reduit le risque de bord sur d'autres affectations.
 *
 * @param {Object} executor - connexion transactionnelle.
 * @param {Object} placement - placement cible.
 *
 * @returns {Promise<number>} Identifiant de la plage creee.
 *
 * Effets secondaires : insertion SQL.
 * Cas particuliers : chaque occurrence modifiee recoit sa propre plage.
 */
async function createTimeSlot(executor, placement) {
  const [result] = await executor.query(
    `INSERT INTO plages_horaires (date, heure_debut, heure_fin)
     VALUES (?, ?, ?)`,
    [
      String(placement.date),
      normalizeTime(placement.heure_debut),
      normalizeTime(placement.heure_fin),
    ]
  );

  return Number(result.insertId || 0);
}

/**
 * Cree une serie de planification.
 *
 * @param {Object} executor - connexion transactionnelle.
 * @param {Object} options - definition de serie.
 *
 * @returns {Promise<number>} Identifiant de serie cree.
 *
 * Effets secondaires : insertion SQL.
 * Cas particuliers : utilise `ponctuelle` pour une occurrence isolee detachee.
 */
async function createPlanningSeries(
  executor,
  { idSession, recurrence, dateDebut, dateFin }
) {
  const [result] = await executor.query(
    `INSERT INTO planification_series (
       id_session,
       type_planification,
       recurrence,
       date_debut,
       date_fin
     )
     VALUES (?, 'groupe', ?, ?, ?)`,
    [Number(idSession), recurrence, dateDebut, dateFin]
  );

  return Number(result.insertId || 0);
}

/**
 * Recalcule les bornes d'une serie de planification.
 *
 * @param {Object} executor - connexion transactionnelle.
 * @param {number|null} seriesId - serie a recalculer.
 *
 * @returns {Promise<void>}
 *
 * Effets secondaires : mise a jour SQL.
 * Cas particuliers : ignore les series nulles ou invalides.
 */
async function refreshPlanningSeriesBounds(executor, seriesId) {
  if (!normalizePositiveInteger(seriesId)) {
    return;
  }

  await executor.query(
    `UPDATE planification_series ps
     JOIN (
       SELECT ac.id_planification_serie,
              MIN(ph.date) AS date_debut,
              MAX(ph.date) AS date_fin
       FROM affectation_cours ac
       JOIN plages_horaires ph
         ON ph.id_plage_horaires = ac.id_plage_horaires
       WHERE ac.id_planification_serie = ?
       GROUP BY ac.id_planification_serie
     ) calculee
       ON calculee.id_planification_serie = ps.id_planification_serie
     SET ps.date_debut = calculee.date_debut,
         ps.date_fin = calculee.date_fin,
         ps.updated_at = CURRENT_TIMESTAMP
     WHERE ps.id_planification_serie = ?`,
    [Number(seriesId), Number(seriesId)]
  );
}

/**
 * Supprime les series devenues orphelines.
 *
 * @param {Object} executor - connexion transactionnelle.
 *
 * @returns {Promise<void>}
 *
 * Effets secondaires : suppression SQL.
 * Cas particuliers : operation sure car limitee aux series sans affectation.
 */
async function deleteOrphanPlanningSeries(executor) {
  await executor.query(
    `DELETE ps
     FROM planification_series ps
     LEFT JOIN affectation_cours ac
       ON ac.id_planification_serie = ps.id_planification_serie
     WHERE ac.id_affectation_cours IS NULL`
  );
}

/**
 * Nettoie les anciennes plages devenues orphelines.
 *
 * @param {Object} executor - connexion transactionnelle.
 * @param {number[]} timeSlotIds - anciennes plages a verifier.
 *
 * @returns {Promise<void>}
 *
 * Effets secondaires : suppression SQL conditionnelle.
 * Cas particuliers : ne supprime jamais une plage encore referencee.
 */
async function deleteUnusedTimeSlots(executor, timeSlotIds) {
  const normalizedIds = [...new Set(
    (Array.isArray(timeSlotIds) ? timeSlotIds : [])
      .map((timeSlotId) => Number(timeSlotId))
      .filter((timeSlotId) => Number.isInteger(timeSlotId) && timeSlotId > 0)
  )];

  if (normalizedIds.length === 0) {
    return;
  }

  const placeholders = normalizedIds.map(() => "?").join(", ");
  await executor.query(
    `DELETE ph
     FROM plages_horaires ph
     WHERE ph.id_plage_horaires IN (${placeholders})
       AND NOT EXISTS (
         SELECT 1
         FROM affectation_cours ac
         WHERE ac.id_plage_horaires = ph.id_plage_horaires
       )`,
    normalizedIds
  );
}

/**
 * Determine les avertissements de score a remonter a l'utilisateur.
 *
 * @param {Object} simulation - rapport what-if.
 *
 * @returns {Object[]} Avertissements non bloquants.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : la degradation forte ne bloque pas par principe, mais peut
 * exiger une confirmation explicite cote API.
 */
function buildWarnings(simulation) {
  const warnings = [];
  const scoreDifference = Number(simulation?.difference?.scoreGlobal || 0);

  if (scoreDifference <= STRONG_SCORE_DEGRADATION_THRESHOLD) {
    warnings.push({
      code: "SCORE_STRONG_DEGRADATION",
      message:
        "La modification degrade fortement le score global de reference. Une confirmation explicite est recommandee avant application.",
      details: {
        threshold: STRONG_SCORE_DEGRADATION_THRESHOLD,
        scoreDifference,
      },
    });
  }

  return warnings;
}

/**
 * Collecte les etudiants en reprise rattaches aux occurrences ciblees.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object[]} placements - occurrences ciblees.
 *
 * @returns {number[]} Identifiants d'etudiants en reprise.
 *
 * Effets secondaires : aucun.
 * Cas particuliers :
 * - les conflits de reprise restent bloquants ;
 * - en revanche leur confort ne doit pas dominer le score principal, ce qui est
 *   deja gere par scoring_v1 en lecture seule.
 */
function collectRecoveryStudentIds(snapshot, placements) {
  const targetedPairs = new Set(
    (Array.isArray(placements) ? placements : []).map(
      (placement) => `${Number(placement?.id_cours || 0)}|${Number(placement?.id_groupe || 0)}`
    )
  );

  return [
    ...new Set(
      (Array.isArray(snapshot?.studentCourseAssignments) ? snapshot.studentCourseAssignments : [])
        .filter(
          (row) =>
            String(row?.source_type || "").trim().toLowerCase() === "reprise" &&
            targetedPairs.has(
              `${Number(row?.id_cours || 0)}|${Number(row?.id_groupes_etudiants || 0)}`
            )
        )
        .map((row) => Number(row?.id_etudiant || 0))
        .filter((studentId) => Number.isInteger(studentId) && studentId > 0)
    ),
  ].sort((first, second) => first - second);
}

/**
 * Resolve la serie cible a affecter aux occurrences modifiees.
 *
 * @param {Object} executor - connexion transactionnelle.
 * @param {Object} options - contexte de replanification.
 *
 * @returns {Promise<Object>} Strategie de serie appliquee.
 *
 * Effets secondaires : peut creer une nouvelle serie de planification.
 * Cas particuliers :
 * - THIS_AND_FOLLOWING et DATE_RANGE decoupent la serie quand ils n'emportent
 *   pas toutes les occurrences restantes ;
 * - THIS_OCCURRENCE detache une occurrence isolee d'une serie plus large via
 *   une serie ponctuelle, pour conserver une trace coherente avant/apres.
 */
async function resolveSeriesStrategy(
  executor,
  {
    sessionId,
    referencePlacement,
    scopeResolution,
    proposedPlacementsByAssignment,
  }
) {
  const originalSeriesId = normalizePositiveInteger(referencePlacement?.id_planification_serie);
  const targetedPlacements = scopeResolution.targetPlacements;
  const fullSeriesPlacements = scopeResolution.seriesPlacements;
  const targetsAllOccurrences =
    targetedPlacements.length === fullSeriesPlacements.length;

  if (!originalSeriesId) {
    return {
      originalSeriesId: null,
      targetSeriesId: null,
      createdSeriesId: null,
    };
  }

  if (targetsAllOccurrences) {
    return {
      originalSeriesId,
      targetSeriesId: originalSeriesId,
      createdSeriesId: null,
    };
  }

  const sortedTargetDates = targetedPlacements
    .map((placement) =>
      String(
        proposedPlacementsByAssignment.get(Number(placement.id_affectation_cours))?.date ||
          placement.date
      )
    )
    .sort((left, right) => left.localeCompare(right, "fr"));

  const createdSeriesId = await createPlanningSeries(executor, {
    idSession: sessionId,
    recurrence: targetedPlacements.length > 1 ? "hebdomadaire" : "ponctuelle",
    dateDebut: sortedTargetDates[0],
    dateFin: sortedTargetDates[sortedTargetDates.length - 1],
  });

  return {
    originalSeriesId,
    targetSeriesId: createdSeriesId,
    createdSeriesId,
  };
}

/**
 * Insere le journal metier d'une modification d'affectation.
 *
 * @param {Object} executor - connexion transactionnelle.
 * @param {Object} payload - donnees a journaliser.
 *
 * @returns {Promise<number>} Identifiant de journal.
 *
 * Effets secondaires : insertion SQL.
 * Cas particuliers : l'historique conserve le rapport de simulation avant application.
 */
async function insertModificationJournal(
  executor,
  {
    sessionId,
    userId,
    referenceAssignmentId,
    referenceSeriesId,
    scope,
    optimizationMode,
    occurrenceCount,
    beforePlacements,
    afterPlacements,
    simulation,
    warnings,
  }
) {
  const [result] = await executor.query(
    `INSERT INTO journal_modifications_affectations_scheduler (
       id_session,
       id_utilisateur,
       id_affectation_reference,
       id_planification_serie_reference,
       portee,
       mode_optimisation,
       nb_occurrences_ciblees,
       statut,
       anciennes_valeurs_json,
       nouvelles_valeurs_json,
       simulation_json,
       details_json
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, 'APPLIQUEE', ?, ?, ?, ?)`,
    [
      Number(sessionId),
      userId ? Number(userId) : null,
      Number(referenceAssignmentId),
      referenceSeriesId ? Number(referenceSeriesId) : null,
      scope,
      optimizationMode,
      Number(occurrenceCount || 0),
      serializeJson(beforePlacements.map((placement) => summarizePlacementForHistory(placement))),
      serializeJson(afterPlacements.map((placement) => summarizePlacementForHistory(placement))),
      serializeJson(simulation),
      serializeJson(buildHistoryDetails(simulation, warnings)),
    ]
  );

  return Number(result.insertId || 0);
}

/**
 * Applique les mutations retenues sur les occurrences ciblees.
 *
 * @param {Object} executor - connexion transactionnelle.
 * @param {Object} options - contexte d'application.
 *
 * @returns {Promise<Object>} Resume des changements appliques.
 *
 * Effets secondaires : ecrit en base dans la transaction courante.
 * Cas particuliers :
 * - une nouvelle plage horaire est creee pour chaque occurrence modifiee ;
 * - les affectations conservent leur identifiant pour eviter les doublons ;
 * - la serie est decoupee uniquement quand la portee ne couvre pas tout le motif.
 */
async function applyPlacementMutations(
  executor,
  {
    sessionId,
    referencePlacement,
    scopeResolution,
    proposedPlacementsByAssignment,
  }
) {
  const seriesStrategy = await resolveSeriesStrategy(executor, {
    sessionId,
    referencePlacement,
    scopeResolution,
    proposedPlacementsByAssignment,
  });
  const oldTimeSlotIds = [];
  const appliedOccurrences = [];

  for (const originalPlacement of scopeResolution.targetPlacements) {
    const assignmentId = Number(originalPlacement.id_affectation_cours);
    const proposedPlacement = proposedPlacementsByAssignment.get(assignmentId);
    const newTimeSlotId = await createTimeSlot(executor, proposedPlacement);

    oldTimeSlotIds.push(Number(originalPlacement.id_plage_horaires || 0));

    await executor.query(
      `UPDATE affectation_cours
       SET id_professeur = ?,
           id_salle = ?,
           id_plage_horaires = ?,
           id_planification_serie = ?
       WHERE id_affectation_cours = ?`,
      [
        Number(proposedPlacement.id_professeur),
        proposedPlacement.id_salle == null ? null : Number(proposedPlacement.id_salle),
        Number(newTimeSlotId),
        seriesStrategy.targetSeriesId ? Number(seriesStrategy.targetSeriesId) : null,
        assignmentId,
      ]
    );

    appliedOccurrences.push({
      before: summarizePlacementForHistory(originalPlacement),
      after: summarizePlacementForHistory({
        ...proposedPlacement,
        id_plage_horaires: newTimeSlotId,
        id_planification_serie: seriesStrategy.targetSeriesId,
      }),
    });
  }

  await refreshPlanningSeriesBounds(executor, seriesStrategy.originalSeriesId);
  if (
    seriesStrategy.createdSeriesId &&
    seriesStrategy.createdSeriesId !== seriesStrategy.originalSeriesId
  ) {
    await refreshPlanningSeriesBounds(executor, seriesStrategy.createdSeriesId);
  }
  await deleteOrphanPlanningSeries(executor);
  await deleteUnusedTimeSlots(executor, oldTimeSlotIds);

  return {
    ...seriesStrategy,
    appliedOccurrences,
  };
}

/**
 * Prepare une simulation read-only de replanification intelligente.
 *
 * Cette etape est partagee par l'API de previsualisation what-if et le flux
 * d'application reelle. Elle centralise la resolution de portee et la
 * construction des mutations pour garantir que le preview et l'application
 * comparent exactement le meme projet de modification.
 *
 * @param {Object} request - requete deja normalisee.
 * @param {Object} executor - executeur SQL read-only ou transactionnel.
 *
 * @returns {Promise<Object>} Contexte complet de simulation.
 *
 * Effets secondaires : aucun en base.
 * Cas particuliers :
 * - la validation finale d'autorite reste cote backend ;
 * - aucun verrou SQL n'est pris ici car le flux reste purement analytique.
 */
async function prepareAssignmentModificationSimulation(request, executor) {
  await assurerSchemaSchedulerAcademique(executor);

  const assignmentContext = await loadAssignmentScopeContext(
    request.idAssignment,
    executor
  );

  if (!assignmentContext?.id_session) {
    throw createScheduleModificationError(
      "La seance cible est introuvable.",
      404,
      "ASSIGNMENT_NOT_FOUND"
    );
  }

  const snapshot = await ScheduleSnapshot.load(
    { idSession: Number(assignmentContext.id_session) },
    executor
  );
  const referencePlacement = snapshot.getPlacementById(request.idAssignment);

  if (!referencePlacement) {
    throw createScheduleModificationError(
      "La seance cible est introuvable dans la session chargee.",
      404,
      "ASSIGNMENT_NOT_FOUND"
    );
  }

  const scopeResolution = resolveScopePlacements(
    snapshot,
    referencePlacement,
    request.scope
  );
  const proposedPlacementsByAssignment = buildProposedPlacementsByAssignment(
    snapshot,
    referencePlacement,
    scopeResolution,
    request.modifications
  );

  ensureEffectiveChange(
    scopeResolution.targetPlacements,
    proposedPlacementsByAssignment
  );

  const simulation = ScenarioSimulator.simulatePlacementMutations({
    snapshot,
    placementsByAssignmentId: proposedPlacementsByAssignment,
    optimizationMode: request.optimizationMode,
    scope: scopeResolution.mode,
    scenarioType: "MODIFIER_AFFECTATION",
  });
  const warnings = buildWarnings(simulation);

  return {
    assignmentContext,
    snapshot,
    referencePlacement,
    scopeResolution,
    proposedPlacementsByAssignment,
    simulation,
    warnings,
  };
}

export class ScheduleModificationService {
  /**
   * Previsualise une replanification intelligente sans rien persister.
   *
   * @param {Object} payload - requete brute ou deja normalisee.
   * @param {Object} [executor=pool] - executeur SQL read-only.
   *
   * @returns {Promise<Object>} Rapport what-if enrichi pour l'interface.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - cette methode sert le frontend pour rendre la simulation obligatoire
   *   avant l'application reelle ;
   * - le rapport reste read-only, mais conserve les warnings d'application.
   */
  static async previewAssignmentModification(payload, executor = pool) {
    const request = normalizeModificationRequest(payload);
    const {
      assignmentContext,
      scopeResolution,
      simulation,
      warnings,
    } = await prepareAssignmentModificationSimulation(request, executor);

    return {
      ...simulation,
      warnings,
      simulationObligatoireExecutee: true,
      validation: {
        ...(simulation?.validation || {}),
        simulationObligatoireExecutee: true,
        scope: scopeResolution.mode,
      },
      meta: {
        id_session: Number(assignmentContext.id_session),
        occurrences_ciblees: scopeResolution.targetPlacements.length,
        recurrence_disponible: Boolean(scopeResolution.seriesId),
      },
    };
  }

  /**
   * Replanifie une affectation existante en imposant une simulation prealable.
   *
   * @param {Object} payload - requete brute ou deja normalisee.
   * @param {Object} [executor=pool] - pool MySQL ou connexion transactionnelle.
   *
   * @returns {Promise<Object>} Resultat metier complet avec simulation et audit.
   *
   * Effets secondaires :
   * - ecrit en base uniquement si la simulation est faisable ;
   * - journalise l'etat avant/apres dans la transaction ;
   * - rollback integral si une etape echoue.
   *
   * Cas particuliers :
   * - le what-if est obligatoire et execute dans la meme transaction logique ;
   * - un conflit groupe/professeur/salle/reprise bloque l'application ;
   * - une forte degradation de score peut exiger une confirmation explicite.
   */
  static async modifyAssignment(payload, executor = pool) {
    const request = normalizeModificationRequest(payload);

    return executeInTransactionIfNeeded(async (transactionExecutor) => {
      const {
        assignmentContext,
        snapshot,
        referencePlacement,
        scopeResolution,
        proposedPlacementsByAssignment,
        simulation,
        warnings,
      } = await prepareAssignmentModificationSimulation(request, transactionExecutor);

      await lockAssignmentsForUpdate(
        scopeResolution.targetPlacements.map((placement) =>
          Number(placement.id_affectation_cours)
        ),
        transactionExecutor
      );

      if (!simulation.faisable || simulation.conflitsCrees > 0) {
        throw createScheduleModificationError(
          "La modification demandee est infaisable dans l'etat actuel des horaires.",
          409,
          "MODIFICATION_BLOCKED_BY_SIMULATION",
          {
            simulation,
          }
        );
      }
      const requiresAcknowledgement = warnings.some(
        (warning) => warning.code === "SCORE_STRONG_DEGRADATION"
      );

      if (requiresAcknowledgement && !request.allowStrongScoreDegradation) {
        throw createScheduleModificationError(
          "La simulation signale une degradation forte du score. Une confirmation explicite est requise pour appliquer cette modification.",
          412,
          "SCORE_DEGRADATION_CONFIRMATION_REQUIRED",
          {
            simulation,
            warnings,
          }
        );
      }

      const applyResult = await applyPlacementMutations(transactionExecutor, {
        sessionId: Number(assignmentContext.id_session),
        referencePlacement,
        scopeResolution,
        proposedPlacementsByAssignment,
      });

      const afterPlacements = applyResult.appliedOccurrences.map((occurrence) => ({
        ...occurrence.after,
      }));
      const historyId = await insertModificationJournal(transactionExecutor, {
        sessionId: Number(assignmentContext.id_session),
        userId: request.idUtilisateur,
        referenceAssignmentId: request.idAssignment,
        referenceSeriesId: normalizePositiveInteger(referencePlacement.id_planification_serie),
        scope: scopeResolution.mode,
        optimizationMode: request.optimizationMode,
        occurrenceCount: scopeResolution.targetPlacements.length,
        beforePlacements: scopeResolution.targetPlacements,
        afterPlacements,
        simulation,
        warnings,
      });

      const impactedPlacements = [
        ...scopeResolution.targetPlacements,
        ...afterPlacements,
      ];

      return {
        message:
          scopeResolution.targetPlacements.length > 1
            ? `${scopeResolution.targetPlacements.length} occurrence(s) modifiee(s) avec succes.`
            : "Affectation modifiee avec succes.",
        simulationObligatoireExecutee: true,
        simulation,
        warnings,
        validation: {
          simulationObligatoireExecutee: true,
          scope: scopeResolution.mode,
        },
        result: {
          portee: scopeResolution.mode,
          occurrences_modifiees: applyResult.appliedOccurrences,
          historique: {
            id_journal_modification_affectation: historyId,
          },
          series: {
            id_planification_serie_reference:
              applyResult.originalSeriesId || null,
            id_planification_serie_cible:
              applyResult.targetSeriesId || null,
            id_planification_serie_creee:
              applyResult.createdSeriesId || null,
          },
          groupes_impactes: collectUniqueNumericValues(impactedPlacements, "id_groupe"),
          professeurs_impactes: collectUniqueNumericValues(
            impactedPlacements,
            "id_professeur"
          ),
          salles_impactees: collectUniqueNumericValues(impactedPlacements, "id_salle"),
          etudiants_impactes: simulation.impact?.etudiants?.idsImpactes || [],
          etudiants_reprises_impactes: collectRecoveryStudentIds(
            snapshot,
            scopeResolution.targetPlacements
          ),
        },
      };
    }, executor);
  }
}
