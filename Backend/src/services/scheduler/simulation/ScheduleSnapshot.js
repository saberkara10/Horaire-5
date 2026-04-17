/**
 * ScheduleSnapshot
 *
 * Ce module construit une vue read-only d'un horaire officiel existant.
 *
 * Responsabilites principales :
 * - charger l'etat officiel d'une session sans aucune ecriture ;
 * - reconstruire les participants reels de chaque seance ;
 * - fournir un payload stable pour scoring_v1 ;
 * - exposer une matrice de contraintes clonable pour les dry-runs what-if.
 *
 * Integration dans le systeme :
 * - ScenarioSimulator s'appuie sur ce snapshot comme source de verite ;
 * - ScenarioComparator reutilise ses donnees pour comparer avant/apres ;
 * - le flux reste strictement en lecture seule : aucun appel a generer(),
 *   aucune purge, aucune persistance.
 *
 * Dependances principales :
 * - pool pour charger les donnees officielles ;
 * - ConstraintMatrix pour reconstruire les occupations ;
 * - ScheduleScorer pour reevaluer un horaire sur la meme base que scoring_v1.
 */

import pool from "../../../../db.js";
import { ConstraintMatrix } from "../ConstraintMatrix.js";
import { ScheduleScorer } from "../scoring/ScheduleScorer.js";
import { buildSlotMetadataFromTimeRange } from "../time/TimeSlotUtils.js";

/**
 * Normalise un entier positif ou retourne `null`.
 *
 * @param {number|string|null|undefined} value - valeur source.
 *
 * @returns {number|null} Entier positif ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : `0`, `NaN` et les valeurs negatives sont rejetes.
 */
function normalizePositiveInteger(value) {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : null;
}

/**
 * Normalise une heure dans le format HH:MM:SS.
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

function enrichPlacementTiming(placement) {
  const normalizedStartTime = normalizeTime(placement?.heure_debut);
  const normalizedEndTime = normalizeTime(placement?.heure_fin);
  const metadata = buildSlotMetadataFromTimeRange(normalizedStartTime, normalizedEndTime);
  const slotStartIndex = Number(placement?.slotStartIndex);
  const slotEndIndex = Number(placement?.slotEndIndex);
  const durationHours = Number(placement?.dureeHeures);
  const weekday = getIsoWeekday(placement?.date);

  return {
    ...placement,
    heure_debut: metadata?.heure_debut || normalizedStartTime,
    heure_fin: metadata?.heure_fin || normalizedEndTime,
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
    jourSemaine:
      Number.isInteger(Number(placement?.jourSemaine)) &&
      Number(placement?.jourSemaine) >= 1 &&
      Number(placement?.jourSemaine) <= 7
        ? Number(placement.jourSemaine)
        : weekday,
  };
}

/**
 * Trie des placements dans un ordre stable.
 *
 * @param {Object} left - placement de gauche.
 * @param {Object} right - placement de droite.
 *
 * @returns {number} Ordre de tri stable.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : stabilise aussi sur l'identifiant d'affectation.
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
 * Construit une copie simple d'un objet.
 *
 * @param {Object|null|undefined} value - objet source.
 *
 * @returns {Object} Copie simple.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne un objet vide si la source est absente.
 */
function cloneObject(value) {
  return value && typeof value === "object" ? { ...value } : {};
}

/**
 * Construit une copie stable d'un tableau d'objets.
 *
 * @param {Object[]} rows - lignes source.
 *
 * @returns {Object[]} Tableau copie.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne un tableau vide si la source n'est pas valide.
 */
function cloneRows(rows) {
  return [...(Array.isArray(rows) ? rows : [])].map((row) => cloneObject(row));
}

/**
 * Deep-freeze leger d'un tableau d'objets simples.
 *
 * @param {Object[]} rows - lignes a figer.
 *
 * @returns {ReadonlyArray<Object>} Tableau fige.
 *
 * Effets secondaires : fige les objets clones passes en entree.
 * Cas particuliers : le but est d'eviter les mutations accidentelles dans le flux what-if.
 */
function freezeRows(rows) {
  return Object.freeze(cloneRows(rows).map((row) => Object.freeze(row)));
}

/**
 * Construit une Map d'index par identifiant.
 *
 * @param {Object[]} rows - lignes source.
 * @param {string} idField - champ identifiant a utiliser.
 *
 * @returns {Map<number, Object>} Index par identifiant.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : ignore les lignes sans identifiant exploitable.
 */
function indexRowsById(rows, idField) {
  return new Map(
    cloneRows(rows)
      .map((row) => [normalizePositiveInteger(row?.[idField]), row])
      .filter(([identifier]) => identifier !== null)
  );
}

/**
 * Normalise les disponibilites ou indisponibilites vers une Map par identifiant.
 *
 * @param {Object[]|Map<number, Object[]>} rows - source brute.
 * @param {string} idField - champ identifiant.
 *
 * @returns {Map<number, Object[]>} Map normalisee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : preserve l'ordre de chargement.
 */
function normalizeRowsByEntity(rows, idField) {
  if (rows instanceof Map) {
    return new Map(
      [...rows.entries()]
        .map(([key, value]) => [normalizePositiveInteger(key), cloneRows(value)])
        .filter(([identifier]) => identifier !== null)
    );
  }

  const normalizedMap = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const identifier = normalizePositiveInteger(row?.[idField]);
    if (!identifier) {
      continue;
    }

    if (!normalizedMap.has(identifier)) {
      normalizedMap.set(identifier, []);
    }

    normalizedMap.get(identifier).push(cloneObject(row));
  }

  return normalizedMap;
}

/**
 * Normalise les affectations regulieres etudiant -> groupe.
 *
 * @param {Object[]} students - etudiants de la session.
 *
 * @returns {Map<number, string[]>} Affectations de groupe pour scoring_v1.
 *
 * Effets secondaires : aucun.
 * Cas particuliers :
 * - le score V1 travaille au niveau groupe principal ;
 * - les exceptions individuelles sont gerees dans la validation, pas ici.
 */
function buildStudentGroupAssignments(students) {
  const assignments = new Map();

  for (const student of Array.isArray(students) ? students : []) {
    const studentId = normalizePositiveInteger(student?.id_etudiant);
    const groupId = normalizePositiveInteger(
      student?.id_groupes_etudiants || student?.id_groupe
    );

    if (!studentId || !groupId) {
      continue;
    }

    assignments.set(studentId, [String(groupId)]);
  }

  return assignments;
}

/**
 * Indexe les etudiants reguliers par groupe.
 *
 * @param {Object[]} students - etudiants de la session.
 *
 * @returns {Map<number, number[]>} Etudiants reguliers par groupe.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les doublons sont elimines.
 */
function buildRegularStudentsByGroup(students) {
  const studentsByGroup = new Map();

  for (const student of Array.isArray(students) ? students : []) {
    const studentId = normalizePositiveInteger(student?.id_etudiant);
    const groupId = normalizePositiveInteger(
      student?.id_groupes_etudiants || student?.id_groupe
    );

    if (!studentId || !groupId) {
      continue;
    }

    if (!studentsByGroup.has(groupId)) {
      studentsByGroup.set(groupId, new Set());
    }

    studentsByGroup.get(groupId).add(studentId);
  }

  return new Map(
    [...studentsByGroup.entries()].map(([groupId, ids]) => [
      groupId,
      [...ids].sort((left, right) => left - right),
    ])
  );
}

/**
 * Construit l'index des exceptions individuelles par etudiant et cours.
 *
 * Regle metier :
 * quand un etudiant a une affectation individuelle sur un cours, il ne doit
 * plus etre reserve sur la section reguliere du meme cours.
 *
 * @param {Object[]} studentCourseAssignments - affectations individuelles ou reprises.
 *
 * @returns {Set<string>} Clefs `etudiant|cours`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : seules les affectations `individuelle` excluent le groupe regulier.
 */
function buildIndividualOverrideIndex(studentCourseAssignments) {
  const overrides = new Set();

  for (const assignment of Array.isArray(studentCourseAssignments)
    ? studentCourseAssignments
    : []) {
    if (String(assignment?.source_type || "").trim().toLowerCase() !== "individuelle") {
      continue;
    }

    const studentId = normalizePositiveInteger(assignment?.id_etudiant);
    const courseId = normalizePositiveInteger(assignment?.id_cours);

    if (!studentId || !courseId) {
      continue;
    }

    overrides.add(`${studentId}|${courseId}`);
  }

  return overrides;
}

/**
 * Construit l'index des rattachements explicites groupe/cours -> etudiants.
 *
 * Regle metier :
 * les reprises et les affectations individuelles ajoutent des participants
 * reels a la seance cible. Elles doivent donc etre prises en compte dans
 * les controles de capacite et de conflits, meme si elles ne dominent pas
 * le score principal etudiant.
 *
 * @param {Object[]} studentCourseAssignments - affectations individuelles ou reprises.
 *
 * @returns {Map<string, number[]>} Index `groupe|cours` -> ids etudiants.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les doublons sont elimines.
 */
function buildAttachedStudentsIndex(studentCourseAssignments) {
  const attachedStudents = new Map();

  for (const assignment of Array.isArray(studentCourseAssignments)
    ? studentCourseAssignments
    : []) {
    const studentId = normalizePositiveInteger(assignment?.id_etudiant);
    const groupId = normalizePositiveInteger(assignment?.id_groupes_etudiants);
    const courseId = normalizePositiveInteger(assignment?.id_cours);

    if (!studentId || !groupId || !courseId) {
      continue;
    }

    const key = `${groupId}|${courseId}`;
    if (!attachedStudents.has(key)) {
      attachedStudents.set(key, new Set());
    }

    attachedStudents.get(key).add(studentId);
  }

  return new Map(
    [...attachedStudents.entries()].map(([key, ids]) => [
      key,
      [...ids].sort((left, right) => left - right),
    ])
  );
}

/**
 * Reconstruit les participants reels d'une affectation officielle.
 *
 * @param {Object[]} placements - affectations officielles.
 * @param {Map<number, number[]>} regularStudentsByGroup - etudiants reguliers par groupe.
 * @param {Set<string>} overrideIndex - exceptions individuelles etudiant/cours.
 * @param {Map<string, number[]>} attachedStudentsIndex - rattachements explicites groupe/cours.
 *
 * @returns {Map<number, number[]>} Participants reels par affectation.
 *
 * Effets secondaires : aucun.
 * Cas particuliers :
 * - les reprises sont ajoutees aux participants ;
 * - les exceptions individuelles retirent l'etudiant du groupe principal pour le cours concerne.
 */
function buildParticipantsByAssignment(
  placements,
  regularStudentsByGroup,
  overrideIndex,
  attachedStudentsIndex
) {
  const participantsByAssignment = new Map();

  for (const placement of Array.isArray(placements) ? placements : []) {
    const assignmentId = normalizePositiveInteger(placement?.id_affectation_cours);
    const groupId = normalizePositiveInteger(placement?.id_groupe);
    const courseId = normalizePositiveInteger(placement?.id_cours);

    if (!assignmentId || !groupId || !courseId) {
      continue;
    }

    const regularStudents = (regularStudentsByGroup.get(groupId) || []).filter(
      (studentId) => !overrideIndex.has(`${studentId}|${courseId}`)
    );
    const attachedStudents = attachedStudentsIndex.get(`${groupId}|${courseId}`) || [];

    participantsByAssignment.set(
      assignmentId,
      [...new Set([...regularStudents, ...attachedStudents])].sort(
        (left, right) => left - right
      )
    );
  }

  return participantsByAssignment;
}

/**
 * Reconstruit les reprises visibles par scoring_v1.
 *
 * @param {Object[]} studentCourseAssignments - affectations individuelles ou reprises.
 * @param {Map<number, Object>} groupsById - index des groupes.
 *
 * @returns {Object[]} Reprises attendues par scoring_v1.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : seules les reprises ne doivent pas degrader le confort principal.
 */
function buildRecoveryAssignments(studentCourseAssignments, groupsById) {
  const recoveries = [];

  for (const assignment of Array.isArray(studentCourseAssignments)
    ? studentCourseAssignments
    : []) {
    if (String(assignment?.source_type || "").trim().toLowerCase() !== "reprise") {
      continue;
    }

    const studentId = normalizePositiveInteger(assignment?.id_etudiant);
    const courseId = normalizePositiveInteger(assignment?.id_cours);
    const groupId = normalizePositiveInteger(assignment?.id_groupes_etudiants);

    if (!studentId || !courseId || !groupId) {
      continue;
    }

    const group = groupsById.get(groupId) || {};
    recoveries.push({
      id_etudiant: studentId,
      id_cours: courseId,
      id_groupe: groupId,
      nom_groupe: group.nom_groupe || assignment?.nom_groupe || null,
    });
  }

  return recoveries;
}

/**
 * Normalise un placement officiel.
 *
 * @param {Object} placement - ligne brute.
 *
 * @returns {Object|null} Placement normalise ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : ignore les lignes sans identifiant d'affectation ou de cours.
 */
function normalizePlacement(placement) {
  const assignmentId = normalizePositiveInteger(placement?.id_affectation_cours);
  const courseId = normalizePositiveInteger(placement?.id_cours);
  const professorId = normalizePositiveInteger(placement?.id_professeur);
  const groupId = normalizePositiveInteger(
    placement?.id_groupe || placement?.id_groupes_etudiants
  );

  if (!assignmentId || !courseId || !professorId || !groupId) {
    return null;
  }

  return {
    id_affectation_cours: assignmentId,
    id_plage_horaires: normalizePositiveInteger(placement?.id_plage_horaires),
    id_planification_serie: normalizePositiveInteger(placement?.id_planification_serie),
    id_cours: courseId,
    code_cours: placement?.code_cours || placement?.cours_code || null,
    nom_cours: placement?.nom_cours || placement?.cours_nom || null,
    programme_cours: placement?.programme_cours || placement?.programme || null,
    etape_cours: placement?.etape_cours || placement?.etape_etude || null,
    type_salle_cours: placement?.type_salle_cours || placement?.type_salle || null,
    id_professeur: professorId,
    nom_professeur:
      placement?.nom_professeur ||
      [placement?.prenom_professeur, placement?.nom_professeur_detail]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      [placement?.prenom_professeur, placement?.professeur_nom]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      null,
    prenom_professeur: placement?.prenom_professeur || null,
    id_salle: normalizePositiveInteger(placement?.id_salle),
    code_salle: placement?.code_salle || placement?.salle_code || null,
    type_salle: placement?.type_salle || placement?.room_type || null,
    capacite_salle: Number(placement?.capacite_salle || placement?.salle_capacite || 0),
    id_groupe: groupId,
    nom_groupe: placement?.nom_groupe || placement?.groupes || null,
    date: String(placement?.date || "").slice(0, 10),
    heure_debut: normalizeTime(placement?.heure_debut),
    heure_fin: normalizeTime(placement?.heure_fin),
    est_en_ligne: Boolean(Number(placement?.est_en_ligne || 0)),
    est_cours_cle: Boolean(Number(placement?.est_cours_cle || 0)),
    est_groupe_special: Boolean(Number(placement?.est_groupe_special || 0)),
  };
}

/**
 * Construit une matrice de contraintes a partir des placements officiels.
 *
 * @param {Object[]} placements - affectations officielles.
 * @param {Map<number, number[]>} participantsByAssignment - participants reels par affectation.
 *
 * @returns {ConstraintMatrix} Matrice de contraintes reconstruite.
 *
 * Effets secondaires : aucun sur l'etat officiel.
 * Cas particuliers : les reservations etudiantes utilisent les participants reels.
 */
function buildConstraintMatrix(placements, participantsByAssignment) {
  const matrix = new ConstraintMatrix();

  for (const placement of Array.isArray(placements) ? placements : []) {
    const assignmentId = normalizePositiveInteger(placement?.id_affectation_cours);

    matrix.reserver(
      placement.id_salle,
      placement.id_professeur,
      placement.id_groupe,
      placement.id_cours,
      placement.date,
      placement.heure_debut,
      placement.heure_fin,
      {
        studentIds: assignmentId
          ? participantsByAssignment.get(assignmentId) || []
          : [],
      }
    );
  }

  return matrix;
}

/**
 * Construit un index de cours depuis les placements.
 *
 * @param {Object[]} placements - placements officiels.
 *
 * @returns {Map<number, Object>} Index des cours references.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : seul le sous-ensemble utile au what-if est conserve.
 */
function buildCoursesIndexFromPlacements(placements) {
  const courses = new Map();

  for (const placement of Array.isArray(placements) ? placements : []) {
    const courseId = normalizePositiveInteger(placement?.id_cours);
    if (!courseId || courses.has(courseId)) {
      continue;
    }

    courses.set(courseId, {
      id_cours: courseId,
      code: placement?.code_cours || null,
      nom: placement?.nom_cours || null,
      programme: placement?.programme_cours || null,
      etape_etude: placement?.etape_cours || null,
      type_salle: placement?.type_salle_cours || null,
      est_en_ligne: placement?.est_en_ligne ? 1 : 0,
      est_cours_cle: placement?.est_cours_cle ? 1 : 0,
    });
  }

  return courses;
}

/**
 * Charge la session cible.
 *
 * @param {number|null} idSession - identifiant de session cible.
 * @param {Object} executor - executeur SQL.
 *
 * @returns {Promise<Object>} Session chargee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retombe sur la session active si aucun identifiant n'est fourni.
 */
async function loadSession(idSession, executor) {
  const [sessions] = await executor.query(
    `SELECT id_session,
            nom,
            DATE_FORMAT(date_debut, '%Y-%m-%d') AS date_debut,
            DATE_FORMAT(date_fin, '%Y-%m-%d') AS date_fin
     FROM sessions
     WHERE ${idSession ? "id_session = ?" : "active = TRUE"}
     ORDER BY active DESC, id_session DESC
     LIMIT 1`,
    idSession ? [Number(idSession)] : []
  );

  const session = sessions[0];
  if (!session) {
    const error = new Error("Aucune session exploitable n'a ete trouvee.");
    error.statusCode = 404;
    error.code = "SESSION_NOT_FOUND";
    throw error;
  }

  return session;
}

export class ScheduleSnapshot {
  /**
   * Construit un snapshot read-only depuis la base.
   *
   * @param {Object} [options={}] - options de chargement.
   * @param {number|null} [options.idSession=null] - session cible.
   * @param {Object} [executor=pool] - executeur SQL.
   *
   * @returns {Promise<ScheduleSnapshot>} Snapshot charge en memoire.
   *
   * Effets secondaires : aucun ; ce flux est strictement read-only.
   * Cas particuliers :
   * - ne persiste rien ;
   * - ne reconstruit jamais toute la session ;
   * - ne doit jamais appeler generer().
   */
  static async load({ idSession = null } = {}, executor = pool) {
    const session = await loadSession(idSession, executor);

    const [
      [placementRows],
      [professorRows],
      [roomRows],
      [groupRows],
      [studentRows],
      [professorAvailabilityRows],
      [professorAbsenceRows],
      [roomUnavailabilityRows],
      [studentCourseAssignmentRows],
    ] = await Promise.all([
      executor.query(
        `SELECT ac.id_affectation_cours,
                ac.id_plage_horaires,
                ac.id_planification_serie,
                ac.id_cours,
                c.code AS code_cours,
                c.nom AS nom_cours,
                c.programme AS programme_cours,
                c.etape_etude AS etape_cours,
                c.type_salle AS type_salle_cours,
                COALESCE(c.est_en_ligne, 0) AS est_en_ligne,
                COALESCE(c.est_cours_cle, 0) AS est_cours_cle,
                ac.id_professeur,
                p.nom AS nom_professeur_detail,
                p.prenom AS prenom_professeur,
                ac.id_salle,
                s.code AS code_salle,
                s.type AS type_salle,
                s.capacite AS capacite_salle,
                DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
                ph.heure_debut,
                ph.heure_fin,
                MIN(ag.id_groupes_etudiants) AS id_groupe,
                COALESCE(
                  GROUP_CONCAT(DISTINCT ge.nom_groupe ORDER BY ge.nom_groupe SEPARATOR ', '),
                  ''
                ) AS nom_groupe,
                MIN(COALESCE(ge.est_groupe_special, 0)) AS est_groupe_special
         FROM affectation_cours ac
         JOIN cours c
           ON c.id_cours = ac.id_cours
         JOIN professeurs p
           ON p.id_professeur = ac.id_professeur
         LEFT JOIN salles s
           ON s.id_salle = ac.id_salle
         JOIN plages_horaires ph
           ON ph.id_plage_horaires = ac.id_plage_horaires
         LEFT JOIN affectation_groupes ag
           ON ag.id_affectation_cours = ac.id_affectation_cours
         LEFT JOIN groupes_etudiants ge
           ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
         WHERE EXISTS (
           SELECT 1
           FROM affectation_groupes ag_scope
           JOIN groupes_etudiants ge_scope
             ON ge_scope.id_groupes_etudiants = ag_scope.id_groupes_etudiants
           WHERE ag_scope.id_affectation_cours = ac.id_affectation_cours
             AND ge_scope.id_session = ?
         )
         GROUP BY ac.id_affectation_cours,
                  ac.id_plage_horaires,
                  ac.id_planification_serie,
                  ac.id_cours,
                  c.code,
                  c.nom,
                  c.programme,
                  c.etape_etude,
                  c.type_salle,
                  c.est_en_ligne,
                  c.est_cours_cle,
                  ac.id_professeur,
                  p.nom,
                  p.prenom,
                  ac.id_salle,
                  s.code,
                  s.type,
                  s.capacite,
                  ph.date,
                  ph.heure_debut,
                  ph.heure_fin
         ORDER BY ph.date ASC, ph.heure_debut ASC, ac.id_affectation_cours ASC`,
        [Number(session.id_session)]
      ),
      executor.query(
        `SELECT p.id_professeur,
                p.matricule,
                p.nom,
                p.prenom,
                p.specialite,
                COALESCE(
                  GROUP_CONCAT(DISTINCT pc.id_cours ORDER BY pc.id_cours SEPARATOR ','),
                  ''
                ) AS cours_ids
         FROM professeurs p
         LEFT JOIN professeur_cours pc
           ON pc.id_professeur = p.id_professeur
         GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
         ORDER BY p.nom ASC, p.prenom ASC`
      ),
      executor.query(
        `SELECT id_salle, code, type, capacite
         FROM salles
         ORDER BY capacite ASC, code ASC`
      ),
      executor.query(
        `SELECT id_groupes_etudiants,
                nom_groupe,
                COALESCE(est_groupe_special, 0) AS est_groupe_special,
                programme,
                etape,
                id_session
         FROM groupes_etudiants
         WHERE id_session = ?
         ORDER BY nom_groupe ASC`,
        [Number(session.id_session)]
      ),
      executor.query(
        `SELECT e.id_etudiant,
                e.id_groupes_etudiants,
                e.matricule,
                e.nom,
                e.prenom
         FROM etudiants e
         JOIN groupes_etudiants ge
           ON ge.id_groupes_etudiants = e.id_groupes_etudiants
         WHERE ge.id_session = ?
         ORDER BY e.id_etudiant ASC`,
        [Number(session.id_session)]
      ),
      executor.query(
        `SELECT id_professeur,
                jour_semaine,
                heure_debut,
                heure_fin,
                DATE_FORMAT(date_debut_effet, '%Y-%m-%d') AS date_debut_effet,
                DATE_FORMAT(date_fin_effet, '%Y-%m-%d') AS date_fin_effet
         FROM disponibilites_professeurs
         WHERE date_fin_effet >= ?
           AND date_debut_effet <= ?
         ORDER BY id_professeur ASC, jour_semaine ASC`,
        [session.date_debut, session.date_fin]
      ),
      executor.query(
        `SELECT id_professeur,
                DATE_FORMAT(date_debut, '%Y-%m-%d') AS date_debut,
                DATE_FORMAT(date_fin, '%Y-%m-%d') AS date_fin,
                type
         FROM absences_professeurs
         WHERE date_fin >= ?
           AND date_debut <= ?
         ORDER BY id_professeur ASC, date_debut ASC`,
        [session.date_debut, session.date_fin]
      ),
      executor.query(
        `SELECT id_salle,
                DATE_FORMAT(date_debut, '%Y-%m-%d') AS date_debut,
                DATE_FORMAT(date_fin, '%Y-%m-%d') AS date_fin,
                raison
         FROM salles_indisponibles
         WHERE date_fin >= ?
           AND date_debut <= ?
         ORDER BY id_salle ASC, date_debut ASC`,
        [session.date_debut, session.date_fin]
      ),
      executor.query(
        `SELECT ae.id_affectation_etudiant,
                ae.id_etudiant,
                ae.id_cours,
                ae.id_groupes_etudiants,
                ae.id_session,
                ae.source_type,
                ge.nom_groupe
         FROM affectation_etudiants ae
         LEFT JOIN groupes_etudiants ge
           ON ge.id_groupes_etudiants = ae.id_groupes_etudiants
         WHERE ae.id_session = ?
           AND ae.source_type IN ('reprise', 'individuelle')
         ORDER BY ae.id_etudiant ASC, ae.id_cours ASC`,
        [Number(session.id_session)]
      ),
    ]);

    const placements = placementRows
      .map((row) => normalizePlacement(row))
      .filter(Boolean)
      .sort(comparePlacements);
    const professors = professorRows.map((row) => ({
      ...row,
      cours_ids: String(row?.cours_ids || "")
        .split(",")
        .map((value) => normalizePositiveInteger(value))
        .filter((value) => value !== null),
    }));

    return ScheduleSnapshot.fromData({
      session,
      placements,
      courses: [...buildCoursesIndexFromPlacements(placements).values()],
      professors,
      rooms: roomRows,
      groups: groupRows,
      students: studentRows,
      studentCourseAssignments: studentCourseAssignmentRows,
      professorAvailabilities: professorAvailabilityRows,
      professorAbsences: professorAbsenceRows,
      roomUnavailabilities: roomUnavailabilityRows,
    });
  }

  /**
   * Construit un snapshot depuis des donnees deja chargees.
   *
   * @param {Object} data - donnees brutes du snapshot.
   *
   * @returns {ScheduleSnapshot} Snapshot en memoire.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : cette entree est volontairement exposee pour les tests unitaires.
   */
  static fromData(data = {}) {
    return new ScheduleSnapshot(data);
  }

  /**
   * @param {Object} data - donnees normalisees du snapshot.
   */
  constructor(data = {}) {
    this.session = Object.freeze(cloneObject(data.session));
    this.placements = freezeRows(
      [...(Array.isArray(data.placements) ? data.placements : [])]
        .map((placement) => enrichPlacementTiming(placement))
        .sort(comparePlacements)
    );
    this.courses = freezeRows(data.courses);
    this.professors = freezeRows(data.professors);
    this.rooms = freezeRows(data.rooms);
    this.groups = freezeRows(data.groups);
    this.students = freezeRows(data.students);
    this.studentCourseAssignments = freezeRows(data.studentCourseAssignments);

    this.coursesById = indexRowsById(this.courses, "id_cours");
    this.professorsById = indexRowsById(this.professors, "id_professeur");
    this.roomsById = indexRowsById(this.rooms, "id_salle");
    this.groupsById = indexRowsById(this.groups, "id_groupes_etudiants");
    this.placementsById = indexRowsById(this.placements, "id_affectation_cours");

    this.affectationsEtudiantGroupe = buildStudentGroupAssignments(this.students);
    this.regularStudentsByGroup = buildRegularStudentsByGroup(this.students);
    this.individualOverrideIndex = buildIndividualOverrideIndex(
      this.studentCourseAssignments
    );
    this.attachedStudentsIndex = buildAttachedStudentsIndex(this.studentCourseAssignments);
    this.participantsByAssignment = buildParticipantsByAssignment(
      this.placements,
      this.regularStudentsByGroup,
      this.individualOverrideIndex,
      this.attachedStudentsIndex
    );
    this.affectationsReprises = Object.freeze(
      buildRecoveryAssignments(this.studentCourseAssignments, this.groupsById).map((row) =>
        Object.freeze(row)
      )
    );

    this.dispParProf = normalizeRowsByEntity(
      data.professorAvailabilities,
      "id_professeur"
    );
    this.absencesParProf = normalizeRowsByEntity(
      data.professorAbsences,
      "id_professeur"
    );
    this.indispoParSalle = normalizeRowsByEntity(
      data.roomUnavailabilities,
      "id_salle"
    );
    this.constraintMatrix = buildConstraintMatrix(
      this.placements,
      this.participantsByAssignment
    );
  }

  /**
   * Retourne une copie des placements du snapshot.
   *
   * @returns {Object[]} Placements copies.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : le snapshot reste immuable ; toute simulation travaille sur une copie.
   */
  clonePlacements() {
    return cloneRows(this.placements).sort(comparePlacements);
  }

  /**
   * Retourne une copie des affectations etudiant -> groupe.
   *
   * @returns {Map<number, string[]>} Copie de la Map.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : chaque tableau de groupes est aussi clone.
   */
  cloneStudentGroupAssignments() {
    return new Map(
      [...this.affectationsEtudiantGroupe.entries()].map(([studentId, groups]) => [
        Number(studentId),
        [...groups],
      ])
    );
  }

  /**
   * Retourne une copie des reprises attendues par scoring_v1.
   *
   * @returns {Object[]} Reprises clones.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : les reprises restent exclues du score principal etudiant.
   */
  cloneRecoveryAssignments() {
    return cloneRows(this.affectationsReprises);
  }

  /**
   * Construit le payload standard de scoring_v1.
   *
   * @param {Object[]} [placements=this.placements] - placements a evaluer.
   *
   * @returns {Object} Payload compatible ScheduleScorer.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : le score principal reste base sur le groupe principal
   * et les reprises planifiees, sans jamais muter l'etat officiel.
   */
  buildScoringPayload(placements = this.placements) {
    return {
      placements: cloneRows(placements)
        .map((placement) => enrichPlacementTiming(placement))
        .sort(comparePlacements),
      affectationsEtudiantGroupe: this.cloneStudentGroupAssignments(),
      affectationsReprises: this.cloneRecoveryAssignments(),
      participantsParAffectation: new Map(
        [...this.participantsByAssignment.entries()].map(([assignmentId, studentIds]) => [
          Number(assignmentId),
          [...studentIds],
        ])
      ),
      nbCoursNonPlanifies: 0,
      nbConflitsEvites: 0,
    };
  }

  /**
   * Evalue l'horaire sur un mode unique.
   *
   * @param {string} mode - mode scoring_v1.
   * @param {Object[]} [placements=this.placements] - placements a scorer.
   *
   * @returns {Object} Score compose.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : reutilise exactement ScheduleScorer.
   */
  score(mode, placements = this.placements) {
    return ScheduleScorer.scoreSchedule(this.buildScoringPayload(placements), mode);
  }

  /**
   * Evalue l'horaire sur tous les modes de scoring_v1.
   *
   * @param {Object[]} [placements=this.placements] - placements a scorer.
   *
   * @returns {Object} Bundle complet de scoring_v1.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : utile pour les rapports explicables.
   */
  scoreAllModes(placements = this.placements) {
    return ScheduleScorer.scoreAllModes(this.buildScoringPayload(placements));
  }

  /**
   * Retourne une affectation par identifiant.
   *
   * @param {number|string} assignmentId - identifiant d'affectation.
   *
   * @returns {Object|null} Affectation trouvee ou `null`.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : retourne la reference read-only du snapshot.
   */
  getPlacementById(assignmentId) {
    return this.placementsById.get(Number(assignmentId)) || null;
  }

  /**
   * Retourne le cours d'une affectation.
   *
   * @param {number|string} courseId - identifiant du cours.
   *
   * @returns {Object|null} Cours ou `null`.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : retourne `null` si le cours n'est pas reference dans le snapshot.
   */
  getCourse(courseId) {
    return this.coursesById.get(Number(courseId)) || null;
  }

  /**
   * Retourne un professeur.
   *
   * @param {number|string} professorId - identifiant du professeur.
   *
   * @returns {Object|null} Professeur ou `null`.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : retourne `null` pour un identifiant absent.
   */
  getProfessor(professorId) {
    return this.professorsById.get(Number(professorId)) || null;
  }

  /**
   * Retourne une salle.
   *
   * @param {number|string|null} roomId - identifiant de salle.
   *
   * @returns {Object|null} Salle ou `null`.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : `null` represente un cours en ligne.
   */
  getRoom(roomId) {
    if (roomId == null) {
      return null;
    }

    return this.roomsById.get(Number(roomId)) || null;
  }

  /**
   * Retourne un groupe.
   *
   * @param {number|string} groupId - identifiant du groupe.
   *
   * @returns {Object|null} Groupe ou `null`.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : retourne `null` si le groupe n'appartient pas a la session chargee.
   */
  getGroup(groupId) {
    return this.groupsById.get(Number(groupId)) || null;
  }

  /**
   * Retourne les participants reels d'une affectation.
   *
   * @param {number|string} assignmentId - identifiant d'affectation.
   *
   * @returns {number[]} Ids etudiants concernes.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : tient compte des reprises et exceptions individuelles.
   */
  getParticipantsForAssignment(assignmentId) {
    return [...(this.participantsByAssignment.get(Number(assignmentId)) || [])];
  }

  /**
   * Retourne une copie clonable de la matrice de contraintes.
   *
   * @returns {ConstraintMatrix} Copie profonde de la matrice.
   *
   * Effets secondaires : aucun sur le snapshot source.
   * Cas particuliers : la copie est destinee aux dry-runs, jamais a la persistance.
   */
  cloneConstraintMatrix() {
    return this.constraintMatrix.clone();
  }

  /**
   * Remplace une affectation sur une copie de l'horaire.
   *
   * @param {number|string} assignmentId - affectation a remplacer.
   * @param {Object} nextPlacement - nouveau placement.
   *
   * @returns {Object[]} Nouvel horaire copie.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : preserve l'ordre stable des placements.
   */
  replacePlacement(assignmentId, nextPlacement) {
    const normalizedAssignmentId = Number(assignmentId);
    const clonedPlacements = this.clonePlacements();

    return clonedPlacements
      .map((placement) =>
        Number(placement.id_affectation_cours) === normalizedAssignmentId
          ? cloneObject(nextPlacement)
          : placement
      )
      .sort(comparePlacements);
  }

  /**
   * Construit un nouveau snapshot partageant le meme contexte metier.
   *
   * @param {Object[]} placements - nouveaux placements officiels simules.
   *
   * @returns {ScheduleSnapshot} Nouveau snapshot derive.
   *
   * Effets secondaires : aucun sur le snapshot d'origine.
   * Cas particuliers : ce mecanisme est la base du what-if dry-run.
   */
  withPlacements(placements) {
    return ScheduleSnapshot.fromData({
      session: cloneObject(this.session),
      placements,
      courses: this.courses,
      professors: this.professors,
      rooms: this.rooms,
      groups: this.groups,
      students: this.students,
      studentCourseAssignments: this.studentCourseAssignments,
      professorAvailabilities: this.dispParProf,
      professorAbsences: this.absencesParProf,
      roomUnavailabilities: this.indispoParSalle,
    });
  }
}
