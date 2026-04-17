/**
 * ScheduleMutationValidator
 *
 * Ce module valide une mutation locale d'horaire en mode strictement read-only.
 *
 * Responsabilites principales :
 * - verifier qu'un changement what-if respecte toujours les contraintes dures ;
 * - reutiliser les memes principes de validation que la planification manuelle ;
 * - produire un diagnostic explicable quand un scenario est bloque.
 *
 * Integration dans le systeme :
 * - ScenarioSimulator l'utilise avant tout calcul de score apres mutation ;
 * - aucune ecriture en base n'est realisee ici ;
 * - cette couche n'appelle jamais generer(), car le what-if doit rester un
 *   dry-run pur sur copie et non un flux destructif.
 *
 * Dependances principales :
 * - AvailabilityChecker pour les disponibilites reelles ;
 * - ScheduleSnapshot pour les donnees read-only et la matrice clonable.
 */

import { AvailabilityChecker } from "../AvailabilityChecker.js";
import {
  MAX_GROUP_SESSIONS_PER_DAY,
  MAX_PROFESSOR_SESSIONS_PER_DAY,
  REQUIRED_WEEKLY_SESSIONS_PER_GROUP,
} from "../AcademicCatalog.js";
import {
  getSchedulerMaxGroupsPerProfessor,
  getSchedulerMaxWeeklySessionsPerProfessor,
} from "../SchedulerConfig.js";
import { BreakConstraintValidator } from "../constraints/BreakConstraintValidator.js";

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

/**
 * Convertit une heure en minutes.
 *
 * @param {string|null|undefined} timeValue - heure source.
 *
 * @returns {number} Heure en minutes.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `0` si la valeur est invalide.
 */
function timeToMinutes(timeValue) {
  const [hours = "0", minutes = "0"] = normalizeTime(timeValue).split(":");
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Parse une date ISO `YYYY-MM-DD`.
 *
 * @param {string|null|undefined} dateValue - date source.
 *
 * @returns {Date|null} Date locale minuit ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `null` si le format est invalide.
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
 * Cree un diagnostic de blocage standardise.
 *
 * @param {string} code - code fonctionnel.
 * @param {string} message - message explicable.
 * @param {Object} [details={}] - contexte complementaire.
 *
 * @returns {Object} Diagnostic de validation.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les details sont volontairement structurables cote UI.
 */
function createIssue(code, message, details = {}) {
  return {
    code,
    message,
    details,
  };
}

/**
 * Determine si deux occurrences se chevauchent.
 *
 * @param {Object} left - occurrence de gauche.
 * @param {Object} right - occurrence de droite.
 *
 * @returns {boolean} True si les occurrences se chevauchent.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les occurrences sur des dates differentes ne se chevauchent jamais.
 */
function overlaps(left, right) {
  if (String(left?.date || "") !== String(right?.date || "")) {
    return false;
  }

  return (
    timeToMinutes(left?.heure_debut) < timeToMinutes(right?.heure_fin) &&
    timeToMinutes(left?.heure_fin) > timeToMinutes(right?.heure_debut)
  );
}

/**
 * Extrait une cle stable de conflit.
 *
 * @param {Object} placement - placement en cause.
 *
 * @returns {Object} Resume de placement.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : on limite volontairement les champs pour garder le diagnostic lisible.
 */
function summarizePlacement(placement) {
  return {
    id_affectation_cours: Number(placement?.id_affectation_cours || 0) || null,
    id_cours: Number(placement?.id_cours || 0) || null,
    id_professeur: Number(placement?.id_professeur || 0) || null,
    id_salle: Number(placement?.id_salle || 0) || null,
    id_groupe: Number(placement?.id_groupe || 0) || null,
    date: placement?.date || null,
    heure_debut: placement?.heure_debut || null,
    heure_fin: placement?.heure_fin || null,
  };
}

/**
 * Retourne la liste des placements a comparer a un candidat.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object} originalPlacement - placement d'origine a exclure.
 *
 * @returns {Object[]} Placements concurrents.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : l'affectation modifiee est exclue pour permettre son deplacement.
 */
function getCompetingPlacements(snapshot, originalPlacement) {
  const originalAssignmentId = Number(originalPlacement?.id_affectation_cours || 0);

  return snapshot
    .clonePlacements()
    .filter(
      (placement) => Number(placement?.id_affectation_cours || 0) !== originalAssignmentId
    );
}

/**
 * Recherche les conflits de type salle, professeur ou groupe.
 *
 * @param {Object[]} placements - placements concurrents.
 * @param {Object} proposedPlacement - placement propose.
 * @param {string} fieldName - champ compare.
 *
 * @returns {Object[]} Placements bloquants.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : ignore les identifiants absents.
 */
function findEntityConflicts(placements, proposedPlacement, fieldName) {
  const targetId = Number(proposedPlacement?.[fieldName] || 0);
  if (!targetId) {
    return [];
  }

  return placements.filter(
    (placement) =>
      Number(placement?.[fieldName] || 0) === targetId && overlaps(placement, proposedPlacement)
  );
}

/**
 * Recherche les conflits horaires etudiants sur le placement propose.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object[]} placements - placements concurrents.
 * @param {Object} proposedPlacement - placement propose.
 * @param {number[]} participantIds - etudiants reels de la seance.
 *
 * @returns {Object[]} Conflits trouves.
 *
 * Effets secondaires : aucun.
 * Cas particuliers :
 * - les reprises et affectations individuelles sont deja integrees dans les participants reels ;
 * - on remonte les ids etudiants exacts pour expliquer le blocage.
 */
function findStudentConflicts(snapshot, placements, proposedPlacement, participantIds) {
  const participantSet = new Set(
    [...(Array.isArray(participantIds) ? participantIds : [])]
      .map((studentId) => Number(studentId))
      .filter((studentId) => Number.isInteger(studentId) && studentId > 0)
  );

  if (participantSet.size === 0) {
    return [];
  }

  const conflicts = [];

  for (const placement of placements) {
    if (!overlaps(placement, proposedPlacement)) {
      continue;
    }

    const competingParticipants = new Set(
      snapshot.getParticipantsForAssignment(placement.id_affectation_cours)
    );
    const intersectingStudents = [...participantSet].filter((studentId) =>
      competingParticipants.has(studentId)
    );

    if (intersectingStudents.length === 0) {
      continue;
    }

    conflicts.push({
      placement: summarizePlacement(placement),
      id_etudiants: intersectingStudents,
    });
  }

  return conflicts;
}

/**
 * Verifie qu'une date cible reste dans la session chargee.
 *
 * @param {Object} session - session chargee.
 * @param {string} dateValue - date cible.
 *
 * @returns {boolean} True si la date est dans l'intervalle de session.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `false` si les bornes de session sont incompletes.
 */
function isDateWithinSession(session, dateValue) {
  const date = parseIsoDate(dateValue);
  const dateDebut = parseIsoDate(session?.date_debut);
  const dateFin = parseIsoDate(session?.date_fin);

  if (!date || !dateDebut || !dateFin) {
    return false;
  }

  return date >= dateDebut && date <= dateFin;
}

/**
 * Construit les diagnostics de conflits d'occupation.
 *
 * @param {Object} options - contexte de comparaison.
 *
 * @returns {Object} Detail des conflits par famille.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : on garde un detail exploitable sans surcharger la reponse.
 */
function collectConflictDiagnostics({
  snapshot,
  placements,
  proposedPlacement,
  participantIds,
}) {
  const roomConflicts = findEntityConflicts(placements, proposedPlacement, "id_salle");
  const professorConflicts = findEntityConflicts(
    placements,
    proposedPlacement,
    "id_professeur"
  );
  const groupConflicts = findEntityConflicts(placements, proposedPlacement, "id_groupe");
  const studentConflicts = findStudentConflicts(
    snapshot,
    placements,
    proposedPlacement,
    participantIds
  );

  return {
    roomConflicts,
    professorConflicts,
    groupConflicts,
    studentConflicts,
  };
}

/**
 * Transforme les violations de pause en issues de validation explicites.
 *
 * @param {Object[]} violations - violations produites par le validateur de pause.
 * @param {string} resourceType - type de ressource cible.
 * @param {number} resourceId - identifiant de la ressource cible.
 * @param {string} date - date concernee.
 *
 * @returns {Object[]} Issues standardisees.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : conserve les details structurels pour un diagnostic UI lisible.
 */
function transformBreakViolations(violations, resourceType, resourceId, date) {
  return (Array.isArray(violations) ? violations : []).map((violation) =>
    createIssue(
      violation.code || "BREAK_AFTER_TWO_CONSECUTIVE_REQUIRED",
      violation.message ||
        "Apres 2 cours consecutifs, une pause d'au moins 1h est obligatoire avant un 3e cours.",
      {
        ...violation.details,
        resource_type: violation.resourceType || resourceType || null,
        resource_id: Number(violation.resourceId || resourceId || 0) || null,
        date: violation.date || date || null,
      }
    )
  );
}

/**
 * Releve les conflits de pause sur un ensemble de placements d'une ressource.
 *
 * @param {Object[]} placements - placements concurrents.
 * @param {Object} proposedPlacement - placement candidat.
 * @param {string} resourceType - type de ressource.
 * @param {number} resourceId - identifiant de ressource.
 *
 * @returns {Object[]} Issues de pause.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : la validation repose sur l'ordre temporel réel du jour.
 */
function collectBreakIssuesForResource(
  placements,
  proposedPlacement,
  resourceType,
  resourceId
) {
  const resultat = BreakConstraintValidator.validateSequenceBreakConstraint({
    placements,
    proposedPlacement,
    resourceType,
    resourceId,
  });

  return transformBreakViolations(
    resultat.violations,
    resourceType,
    resourceId,
    proposedPlacement?.date
  );
}

/**
 * Releve les conflits de pause pour chaque etudiant reel de la seance.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object[]} placements - placements concurrents.
 * @param {Object} proposedPlacement - placement candidat.
 * @param {number[]} participantIds - etudiants reels de la seance.
 *
 * @returns {Object[]} Issues de pause.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les reprises et affectations individuelles sont deja inclues dans les participants.
 */
function collectBreakIssuesForStudents(
  snapshot,
  placements,
  proposedPlacement,
  participantIds
) {
  const issues = [];
  const normalizedParticipants = [...new Set(
    (Array.isArray(participantIds) ? participantIds : [])
      .map((studentId) => Number(studentId))
      .filter((studentId) => Number.isInteger(studentId) && studentId > 0)
  )];

  if (normalizedParticipants.length === 0) {
    return issues;
  }

  const participantsByPlacement = new Map();

  for (const placement of placements) {
    const assignmentId = Number(placement?.id_affectation_cours || 0);

    if (!assignmentId) {
      continue;
    }

    participantsByPlacement.set(
      assignmentId,
      new Set(snapshot.getParticipantsForAssignment(assignmentId))
    );
  }

  for (const studentId of normalizedParticipants) {
    const studentPlacements = placements.filter((placement) => {
      const assignmentId = Number(placement?.id_affectation_cours || 0);
      const participants = participantsByPlacement.get(assignmentId);

      return participants ? participants.has(studentId) : false;
    });

    issues.push(
      ...collectBreakIssuesForResource(
        studentPlacements,
        proposedPlacement,
        "etudiant",
        studentId
      )
    );
  }

  return issues;
}

/**
 * Retourne le premier diagnostic bloquant present.
 *
 * @param {Object} diagnostics - details de conflits.
 *
 * @returns {Object[]} Issues standardisees.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : plusieurs familles peuvent etre bloquees simultanement.
 */
function buildConflictIssues(diagnostics) {
  const issues = [];

  if (diagnostics.roomConflicts.length > 0) {
    issues.push(
      createIssue(
        "ROOM_TIME_CONFLICT",
        "La salle cible est deja occupee sur ce creneau.",
        {
          conflits: diagnostics.roomConflicts.map((placement) =>
            summarizePlacement(placement)
          ),
        }
      )
    );
  }

  if (diagnostics.professorConflicts.length > 0) {
    issues.push(
      createIssue(
        "PROFESSOR_TIME_CONFLICT",
        "Le professeur cible est deja assigne sur ce creneau.",
        {
          conflits: diagnostics.professorConflicts.map((placement) =>
            summarizePlacement(placement)
          ),
        }
      )
    );
  }

  if (diagnostics.groupConflicts.length > 0) {
    issues.push(
      createIssue(
        "GROUP_TIME_CONFLICT",
        "Le groupe est deja occupe sur ce creneau.",
        {
          conflits: diagnostics.groupConflicts.map((placement) =>
            summarizePlacement(placement)
          ),
        }
      )
    );
  }

  if (diagnostics.studentConflicts.length > 0) {
    issues.push(
      createIssue(
        "STUDENT_TIME_CONFLICT",
        "Au moins un etudiant reel de la seance est deja occupe sur ce creneau.",
        {
          conflits: diagnostics.studentConflicts,
        }
      )
    );
  }

  return issues;
}

/**
 * Compte la charge journaliere d'une entite dans une solution concurrente.
 *
 * @param {Object[]} placements - placements concurrents.
 * @param {string} fieldName - champ d'entite a compter.
 * @param {number} entityId - identifiant cible.
 * @param {string} dateValue - date cible.
 *
 * @returns {number} Nombre de seances deja presentes sur la journee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `0` si l'entite n'a aucune seance ce jour-la.
 */
function countDailyLoadForEntity(placements, fieldName, entityId, dateValue) {
  return (Array.isArray(placements) ? placements : []).filter(
    (placement) =>
      Number(placement?.[fieldName] || 0) === Number(entityId || 0) &&
      String(placement?.date || "") === String(dateValue || "")
  ).length;
}

export class ScheduleMutationValidator {
  /**
   * Valide un mouvement local sans jamais modifier l'horaire officiel.
   *
   * @param {Object} options - contexte de validation.
   * @param {Object} options.snapshot - snapshot officiel read-only.
   * @param {Object} options.originalPlacement - seance d'origine.
   * @param {Object} options.proposedPlacement - seance candidate.
   *
   * @returns {Object} Resultat de validation.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - le validateur travaille sur la copie clonable de la matrice ;
   * - il ne remplace pas la validation existante, il la transpose en dry-run ;
   * - il ne doit jamais appeler generer(), car ce flux doit rester local et explicable.
   */
  static validate({ snapshot, originalPlacement, proposedPlacement }) {
    const issues = [];

    if (!snapshot) {
      return {
        feasible: false,
        reasons: [createIssue("SNAPSHOT_MISSING", "Le snapshot de simulation est introuvable.")],
      };
    }

    if (!originalPlacement) {
      return {
        feasible: false,
        reasons: [
          createIssue("ASSIGNMENT_NOT_FOUND", "La seance de reference est introuvable."),
        ],
      };
    }

    if (!proposedPlacement) {
      return {
        feasible: false,
        reasons: [
          createIssue("PROPOSED_PLACEMENT_MISSING", "La mutation proposee est invalide."),
        ],
      };
    }

    if (
      Number(proposedPlacement.id_cours) !== Number(originalPlacement.id_cours) ||
      Number(proposedPlacement.id_groupe) !== Number(originalPlacement.id_groupe)
    ) {
      return {
        feasible: false,
        reasons: [
          createIssue(
            "UNSUPPORTED_MUTATION_SCOPE",
            "Le scenario V1 ne permet pas de changer le cours ou le groupe d'une seance."
          ),
        ],
      };
    }

    const course = snapshot.getCourse(proposedPlacement.id_cours);
    const professor = snapshot.getProfessor(proposedPlacement.id_professeur);
    const group = snapshot.getGroup(proposedPlacement.id_groupe);
    const room = proposedPlacement.id_salle == null
      ? null
      : snapshot.getRoom(proposedPlacement.id_salle);
    const participantIds = snapshot.getParticipantsForAssignment(
      originalPlacement.id_affectation_cours
    );
    const competingPlacements = getCompetingPlacements(snapshot, originalPlacement);

    if (!course) {
      issues.push(createIssue("COURSE_NOT_FOUND", "Le cours de la seance est introuvable."));
    }

    if (!professor) {
      issues.push(createIssue("PROFESSOR_NOT_FOUND", "Le professeur cible est introuvable."));
    }

    if (!group) {
      issues.push(createIssue("GROUP_NOT_FOUND", "Le groupe de la seance est introuvable."));
    }

    if (!course?.est_en_ligne && proposedPlacement.id_salle == null) {
      issues.push(
        createIssue(
          "ROOM_REQUIRED",
          "Une seance en presentiel doit conserver une salle valide."
        )
      );
    }

    if (proposedPlacement.id_salle != null && !room) {
      issues.push(createIssue("ROOM_NOT_FOUND", "La salle cible est introuvable."));
    }

    if (course && professor && !AvailabilityChecker.profCompatible(professor, course)) {
      issues.push(
        createIssue(
          "PROFESSOR_COURSE_MISMATCH",
          "Le professeur cible n'est pas compatible avec ce cours."
        )
      );
    }

    if (
      course &&
      room &&
      !AvailabilityChecker.salleCompatible(room, course, participantIds.length)
    ) {
      const roomTypeMismatch =
        !course.est_en_ligne &&
        String(room.type || "").trim() !== "" &&
        String(course.type_salle || "").trim() !== "" &&
        String(room.type || "").trim().toLowerCase() !==
          String(course.type_salle || "").trim().toLowerCase();

      issues.push(
        createIssue(
          roomTypeMismatch ? "ROOM_COURSE_TYPE_MISMATCH" : "ROOM_CAPACITY_INSUFFICIENT",
          roomTypeMismatch
            ? "La salle cible n'est pas compatible avec le type de cours."
            : `La salle cible ne peut pas accueillir l'effectif reel (${participantIds.length} etudiants).`,
          {
            capacite_salle: Number(room.capacite || 0),
            effectif_reel: participantIds.length,
            type_salle: room.type || null,
            type_salle_cours: course.type_salle || null,
          }
        )
      );
    }

    if (!isDateWithinSession(snapshot.session, proposedPlacement.date)) {
      issues.push(
        createIssue(
          "DATE_OUTSIDE_SESSION",
          "La date cible sort des bornes de la session active.",
          {
            date: proposedPlacement.date,
            session_date_debut: snapshot.session?.date_debut || null,
            session_date_fin: snapshot.session?.date_fin || null,
          }
        )
      );
    }

    if (
      normalizeTime(proposedPlacement.heure_debut) === "" ||
      normalizeTime(proposedPlacement.heure_fin) === "" ||
      timeToMinutes(proposedPlacement.heure_debut) >= timeToMinutes(proposedPlacement.heure_fin)
    ) {
      issues.push(
        createIssue("INVALID_TIME_RANGE", "Le creneau horaire cible est invalide.")
      );
    }

    if (issues.length > 0) {
      return {
        feasible: false,
        reasons: issues,
        participantIds,
      };
    }

    if (
      !AvailabilityChecker.profDisponible(
        Number(proposedPlacement.id_professeur),
        proposedPlacement.date,
        proposedPlacement.heure_debut,
        proposedPlacement.heure_fin,
        snapshot.dispParProf,
        snapshot.absencesParProf
      )
    ) {
      issues.push(
        createIssue(
          "PROFESSOR_UNAVAILABLE",
          "Le professeur cible est indisponible sur ce creneau."
        )
      );
    }

    if (
      room &&
      !AvailabilityChecker.salleDisponible(
        Number(room.id_salle),
        proposedPlacement.date,
        snapshot.indispoParSalle
      )
    ) {
      issues.push(
        createIssue(
          "ROOM_UNAVAILABLE",
          "La salle cible est indisponible a cette date."
        )
      );
    }

    const workingMatrix = snapshot.cloneConstraintMatrix();
    workingMatrix.liberer(
      originalPlacement.id_salle,
      originalPlacement.id_professeur,
      originalPlacement.id_groupe,
      originalPlacement.date,
      originalPlacement.heure_debut,
      originalPlacement.heure_fin,
      originalPlacement.id_cours,
      { studentIds: participantIds }
    );

    const projectedGroupDayLoad =
      countDailyLoadForEntity(
        competingPlacements,
        "id_groupe",
        proposedPlacement.id_groupe,
        proposedPlacement.date
      ) + 1;
    const projectedProfessorDayLoad =
      countDailyLoadForEntity(
        competingPlacements,
        "id_professeur",
        proposedPlacement.id_professeur,
        proposedPlacement.date
      ) + 1;

    if (projectedGroupDayLoad > MAX_GROUP_SESSIONS_PER_DAY) {
      issues.push(
        createIssue(
          "GROUP_DAILY_LOAD_EXCEEDED",
          `Le groupe depasserait ${MAX_GROUP_SESSIONS_PER_DAY} seances sur la journee cible.`,
          {
            projected_daily_sessions: projectedGroupDayLoad,
            max_daily_sessions: MAX_GROUP_SESSIONS_PER_DAY,
          }
        )
      );
    }

    if (projectedProfessorDayLoad > MAX_PROFESSOR_SESSIONS_PER_DAY) {
      // On conserve ici le plafond partage avec SchedulerEngine pour rester
      // retrocompatible. Le scoring V1 penalise deja les journees au-dela de 3
      // seances, mais le garde-fou dur du moteur historique reste l'autorite.
      issues.push(
        createIssue(
          "PROFESSOR_DAILY_LOAD_EXCEEDED",
          `Le professeur depasserait ${MAX_PROFESSOR_SESSIONS_PER_DAY} seances sur la journee cible.`,
          {
            projected_daily_sessions: projectedProfessorDayLoad,
            max_daily_sessions: MAX_PROFESSOR_SESSIONS_PER_DAY,
          }
        )
      );
    }

    if (!workingMatrix.profPeutEnseignerCours(proposedPlacement.id_professeur, proposedPlacement.id_cours)) {
      issues.push(
        createIssue(
          "PROFESSOR_MAX_COURSES_REACHED",
          "Le professeur cible atteint deja son plafond de cours distincts.",
          {
            id_professeur: Number(proposedPlacement.id_professeur),
            id_cours: Number(proposedPlacement.id_cours),
          }
        )
      );
    }

    if (
      !workingMatrix.profPeutPrendreGroupe(
        proposedPlacement.id_professeur,
        proposedPlacement.id_groupe,
        getSchedulerMaxGroupsPerProfessor()
      )
    ) {
      issues.push(
        createIssue(
          "PROFESSOR_MAX_GROUPS_REACHED",
          "Le professeur cible atteint deja son plafond de groupes.",
          {
            id_professeur: Number(proposedPlacement.id_professeur),
            id_groupe: Number(proposedPlacement.id_groupe),
            max_groupes: getSchedulerMaxGroupsPerProfessor(),
          }
        )
      );
    }

    if (
      !workingMatrix.profPeutAjouterSeanceSemaine(
        proposedPlacement.id_professeur,
        proposedPlacement.date,
        getSchedulerMaxWeeklySessionsPerProfessor()
      )
    ) {
      issues.push(
        createIssue(
          "PROFESSOR_WEEKLY_LOAD_EXCEEDED",
          "Le professeur cible depasserait son plafond hebdomadaire de seances.",
          {
            id_professeur: Number(proposedPlacement.id_professeur),
            max_weekly_sessions: getSchedulerMaxWeeklySessionsPerProfessor(),
          }
        )
      );
    }

    if (
      !workingMatrix.groupePeutAjouterSeanceSemaine(
        proposedPlacement.id_groupe,
        proposedPlacement.date,
        REQUIRED_WEEKLY_SESSIONS_PER_GROUP
      )
    ) {
      issues.push(
        createIssue(
          "GROUP_WEEKLY_LOAD_EXCEEDED",
          "Le groupe depasserait sa charge hebdomadaire cible sur la semaine visee.",
          {
            id_groupe: Number(proposedPlacement.id_groupe),
            max_weekly_sessions: REQUIRED_WEEKLY_SESSIONS_PER_GROUP,
          }
        )
      );
    }

    const diagnostics = collectConflictDiagnostics({
      snapshot,
      placements: competingPlacements,
      proposedPlacement,
      participantIds,
    });

    if (
      room &&
      !workingMatrix.salleLibre(
        room.id_salle,
        proposedPlacement.date,
        proposedPlacement.heure_debut,
        proposedPlacement.heure_fin
      )
    ) {
      issues.push(...buildConflictIssues({ ...diagnostics, professorConflicts: [], groupConflicts: [], studentConflicts: [] }));
    }

    if (
      !workingMatrix.profLibre(
        proposedPlacement.id_professeur,
        proposedPlacement.date,
        proposedPlacement.heure_debut,
        proposedPlacement.heure_fin
      )
    ) {
      issues.push(...buildConflictIssues({ ...diagnostics, roomConflicts: [], groupConflicts: [], studentConflicts: [] }));
    }

    if (
      !workingMatrix.groupeLibre(
        proposedPlacement.id_groupe,
        proposedPlacement.date,
        proposedPlacement.heure_debut,
        proposedPlacement.heure_fin
      )
    ) {
      issues.push(...buildConflictIssues({ ...diagnostics, roomConflicts: [], professorConflicts: [], studentConflicts: [] }));
    }

    if (
      !workingMatrix.etudiantsLibres(
        participantIds,
        proposedPlacement.date,
        proposedPlacement.heure_debut,
        proposedPlacement.heure_fin
      )
    ) {
      issues.push(...buildConflictIssues({ ...diagnostics, roomConflicts: [], professorConflicts: [], groupConflicts: [] }));
    }

    issues.push(
      ...collectBreakIssuesForResource(
        competingPlacements.filter(
          (placement) =>
            Number(placement?.id_professeur || 0) === Number(proposedPlacement.id_professeur || 0)
        ),
        proposedPlacement,
        "professeur",
        Number(proposedPlacement.id_professeur || 0)
      )
    );

    issues.push(
      ...collectBreakIssuesForResource(
        competingPlacements.filter(
          (placement) =>
            Number(placement?.id_groupe || 0) === Number(proposedPlacement.id_groupe || 0)
        ),
        proposedPlacement,
        "groupe",
        Number(proposedPlacement.id_groupe || 0)
      )
    );

    issues.push(
      ...collectBreakIssuesForStudents(
        snapshot,
        competingPlacements,
        proposedPlacement,
        participantIds
      )
    );

    const deduplicatedReasons = [];
    const seenIssueKeys = new Set();

    for (const issue of issues) {
      const key = `${issue.code}|${issue.message}|${JSON.stringify(issue.details || {})}`;
      if (seenIssueKeys.has(key)) {
        continue;
      }

      seenIssueKeys.add(key);
      deduplicatedReasons.push(issue);
    }

    return {
      feasible: deduplicatedReasons.length === 0,
      reasons: deduplicatedReasons,
      participantIds,
      resources: {
        course,
        professor,
        room,
        group,
      },
      diagnostics,
    };
  }
}
