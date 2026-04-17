/**
 * ScenarioSimulator
 *
 * Ce module orchestre l'execution d'un scenario what-if V1 en lecture seule.
 *
 * Responsabilites principales :
 * - charger un snapshot officiel ;
 * - appliquer une mutation uniquement sur une copie ;
 * - revalider les contraintes dures sans ecrire en base ;
 * - recalculer scoring_v1 avant/apres ;
 * - produire un rapport comparatif explicable.
 *
 * Integration dans le systeme :
 * - expose une API reutilisable par la route HTTP de previsualisation ;
 * - s'appuie sur ScheduleSnapshot, ScheduleMutationValidator et ScenarioComparator ;
 * - n'appelle jamais generer(), car un what-if doit rester local, explicable et non destructif.
 */

import pool from "../../../../db.js";
import { PlacementEvaluator } from "../optimization/PlacementEvaluator.js";
import { ScheduleMutationValidator } from "../planning/ScheduleMutationValidator.js";
import { ScenarioComparator } from "./ScenarioComparator.js";
import { ScheduleSnapshot } from "./ScheduleSnapshot.js";
import { buildSlotMetadataFromTimeRange } from "../time/TimeSlotUtils.js";

const SUPPORTED_SCENARIO_TYPES = new Set([
  "DEPLACER_SEANCE",
  "CHANGER_SALLE",
  "CHANGER_PROF",
  "REEVALUER_MODE",
]);

/**
 * Cree une erreur fonctionnelle standardisee.
 *
 * @param {string} message - message explicable.
 * @param {number} [statusCode=400] - code HTTP attendu.
 * @param {string} [code="SIMULATION_ERROR"] - code fonctionnel.
 * @param {Object} [details={}] - contexte detaille.
 *
 * @returns {Error} Erreur enrichie.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : permet de distinguer les erreurs de payload des scenarios infaisables.
 */
function createSimulationError(
  message,
  statusCode = 400,
  code = "SIMULATION_ERROR",
  details = {}
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Normalise un entier positif.
 *
 * @param {number|string|null|undefined} value - valeur source.
 *
 * @returns {number|null} Entier positif ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : `0`, `NaN` et les valeurs negatives sont rejetees.
 */
function normalizePositiveInteger(value) {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : null;
}

/**
 * Normalise une heure au format HH:MM:SS.
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

function buildPlacementTemporalFields(placement, date, startTime, endTime) {
  const normalizedDate = String(date || placement?.date || "").trim();
  const metadata = buildSlotMetadataFromTimeRange(startTime, endTime);
  const slotStartIndex = Number(placement?.slotStartIndex);
  const slotEndIndex = Number(placement?.slotEndIndex);
  const durationHours = Number(placement?.dureeHeures);

  return {
    date: normalizedDate,
    heure_debut: normalizeTime(startTime || placement?.heure_debut),
    heure_fin: normalizeTime(endTime || placement?.heure_fin),
    jourSemaine: getIsoWeekday(normalizedDate),
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
 * Normalise le type de scenario.
 *
 * @param {string|null|undefined} type - type source.
 *
 * @returns {string} Type normalise.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : leve une erreur si le type n'est pas supporte en V1.
 */
function normalizeScenarioType(type) {
  const normalizedType = String(type || "").trim().toUpperCase();

  if (!SUPPORTED_SCENARIO_TYPES.has(normalizedType)) {
    throw createSimulationError(
      "Le type de scenario demande n'est pas supporte en V1.",
      400,
      "UNSUPPORTED_SCENARIO_TYPE",
      {
        supportedTypes: [...SUPPORTED_SCENARIO_TYPES],
      }
    );
  }

  return normalizedType;
}

/**
 * Normalise un payload de scenario.
 *
 * @param {Object} scenario - scenario source.
 *
 * @returns {Object} Scenario normalise.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : accepte les variantes snake_case et camelCase cote API.
 */
function normalizeScenario(scenario = {}) {
  const scenarioType = normalizeScenarioType(scenario?.type || scenario?.scenario_type);
  const hasExplicitRoomKey =
    Object.prototype.hasOwnProperty.call(scenario, "idSalle") ||
    Object.prototype.hasOwnProperty.call(scenario, "id_salle");

  return {
    type: scenarioType,
    idAffectationCours: normalizePositiveInteger(
      scenario?.idAffectationCours || scenario?.id_affectation_cours
    ),
    date: String(
      scenario?.date || scenario?.date_cible || scenario?.dateCible || ""
    ).trim(),
    heureDebut: normalizeTime(
      scenario?.heureDebut || scenario?.heure_debut || scenario?.heure_debut_cible
    ),
    heureFin: normalizeTime(
      scenario?.heureFin || scenario?.heure_fin || scenario?.heure_fin_cible
    ),
    idSalle: hasExplicitRoomKey
      ? scenario?.idSalle === null || scenario?.id_salle === null
        ? null
        : normalizePositiveInteger(scenario?.idSalle || scenario?.id_salle)
      : undefined,
    idProfesseur: normalizePositiveInteger(
      scenario?.idProfesseur || scenario?.id_professeur
    ),
    modeCible: PlacementEvaluator.normalizeMode(
      scenario?.modeCible || scenario?.mode_cible || scenario?.mode_optimisation_cible
    ),
  };
}

/**
 * Verifie qu'une seance ciblee est presente quand le scenario l'exige.
 *
 * @param {Object} scenario - scenario normalise.
 *
 * @returns {void}
 *
 * Effets secondaires : leve une erreur si l'identifiant est absent.
 * Cas particuliers : `REEVALUER_MODE` ne cible aucune seance.
 */
function ensureAssignmentTarget(scenario) {
  if (scenario.type === "REEVALUER_MODE") {
    return;
  }

  if (!scenario.idAffectationCours) {
    throw createSimulationError(
      "Le scenario doit cibler une seance via id_affectation_cours.",
      400,
      "ASSIGNMENT_ID_REQUIRED"
    );
  }
}

/**
 * Construit le placement propose pour un changement de salle.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object} originalPlacement - placement d'origine.
 * @param {Object} scenario - scenario normalise.
 *
 * @returns {Object} Nouveau placement propose.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : le creneau et le professeur restent inchanges.
 */
function buildRoomChangePlacement(snapshot, originalPlacement, scenario) {
  if (scenario.idSalle === undefined || scenario.idSalle === null) {
    throw createSimulationError(
      "Le scenario CHANGER_SALLE exige une salle cible valide.",
      400,
      "TARGET_ROOM_REQUIRED"
    );
  }

  const room = snapshot.getRoom(scenario.idSalle);
  if (!room) {
    throw createSimulationError("La salle cible est introuvable.", 404, "ROOM_NOT_FOUND");
  }

  return {
    ...originalPlacement,
    id_salle: Number(room.id_salle),
    code_salle: room.code || null,
    type_salle: room.type || null,
    capacite_salle: Number(room.capacite || 0),
    est_en_ligne: false,
  };
}

/**
 * Construit le placement propose pour un changement de professeur.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object} originalPlacement - placement d'origine.
 * @param {Object} scenario - scenario normalise.
 *
 * @returns {Object} Nouveau placement propose.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : le creneau et la salle restent inchanges.
 */
function buildProfessorChangePlacement(snapshot, originalPlacement, scenario) {
  if (!scenario.idProfesseur) {
    throw createSimulationError(
      "Le scenario CHANGER_PROF exige un professeur cible valide.",
      400,
      "TARGET_PROFESSOR_REQUIRED"
    );
  }

  const professor = snapshot.getProfessor(scenario.idProfesseur);
  if (!professor) {
    throw createSimulationError(
      "Le professeur cible est introuvable.",
      404,
      "PROFESSOR_NOT_FOUND"
    );
  }

  return {
    ...originalPlacement,
    id_professeur: Number(professor.id_professeur),
    nom_professeur: buildProfessorDisplayName(professor),
    prenom_professeur: professor.prenom || null,
  };
}

/**
 * Construit le placement propose pour un deplacement de seance.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object} originalPlacement - placement d'origine.
 * @param {Object} scenario - scenario normalise.
 *
 * @returns {Object} Nouveau placement propose.
 *
 * Effets secondaires : aucun.
 * Cas particuliers :
 * - la salle cible est optionnelle ;
 * - si aucune salle n'est fournie, la salle actuelle est conservee.
 */
function buildMovePlacement(snapshot, originalPlacement, scenario) {
  if (!scenario.date || !scenario.heureDebut || !scenario.heureFin) {
    throw createSimulationError(
      "Le scenario DEPLACER_SEANCE exige date, heure_debut et heure_fin.",
      400,
      "TARGET_SLOT_REQUIRED"
    );
  }

  let room = null;
  if (scenario.idSalle === null) {
    room = null;
  } else if (scenario.idSalle) {
    room = snapshot.getRoom(scenario.idSalle);
    if (!room) {
      throw createSimulationError("La salle cible est introuvable.", 404, "ROOM_NOT_FOUND");
    }
  } else if (originalPlacement.id_salle) {
    room = snapshot.getRoom(originalPlacement.id_salle);
  }

  return {
    ...originalPlacement,
    ...buildPlacementTemporalFields(
      originalPlacement,
      scenario.date,
      scenario.heureDebut,
      scenario.heureFin
    ),
    id_salle: room ? Number(room.id_salle) : null,
    code_salle: room ? room.code || null : "EN LIGNE",
    type_salle: room ? room.type || null : null,
    capacite_salle: room ? Number(room.capacite || 0) : 0,
    est_en_ligne: room ? false : Boolean(snapshot.getCourse(originalPlacement.id_cours)?.est_en_ligne),
  };
}

/**
 * Construit le placement cible d'un scenario V1.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Object} originalPlacement - placement d'origine.
 * @param {Object} scenario - scenario normalise.
 *
 * @returns {Object|null} Placement cible ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : `REEVALUER_MODE` ne produit aucune mutation.
 */
function buildProposedPlacement(snapshot, originalPlacement, scenario) {
  if (scenario.type === "REEVALUER_MODE") {
    return null;
  }

  if (scenario.type === "DEPLACER_SEANCE") {
    return buildMovePlacement(snapshot, originalPlacement, scenario);
  }

  if (scenario.type === "CHANGER_SALLE") {
    return buildRoomChangePlacement(snapshot, originalPlacement, scenario);
  }

  return buildProfessorChangePlacement(snapshot, originalPlacement, scenario);
}

/**
 * Derive le mode scoring_v1 a partir d'un mode d'optimisation.
 *
 * @param {string} optimizationMode - mode demande.
 *
 * @returns {string} Mode scoring_v1.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : `legacy` est mappe sur `equilibre` pour garder scoring_v1 intact.
 */
function resolveScoringMode(optimizationMode) {
  return PlacementEvaluator.resolveScoringMode(
    PlacementEvaluator.normalizeMode(optimizationMode)
  );
}

/**
 * Normalise un lot de placements proposes par identifiant d'affectation.
 *
 * @param {Map<number, Object>|Object} placementsByAssignmentId - placements proposes.
 *
 * @returns {Map<number, Object>} Map normalisee.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : accepte une Map native ou un objet simple.
 */
function normalizePlacementsByAssignmentId(placementsByAssignmentId) {
  if (placementsByAssignmentId instanceof Map) {
    return new Map(
      [...placementsByAssignmentId.entries()]
        .map(([assignmentId, placement]) => [normalizePositiveInteger(assignmentId), placement])
        .filter(([assignmentId, placement]) => assignmentId && placement)
    );
  }

  return new Map(
    Object.entries(placementsByAssignmentId || {})
      .map(([assignmentId, placement]) => [normalizePositiveInteger(assignmentId), placement])
      .filter(([assignmentId, placement]) => assignmentId && placement)
  );
}

/**
 * Trie des affectations dans l'ordre chronologique du snapshot.
 *
 * @param {Object} snapshot - snapshot officiel.
 * @param {Map<number, Object>} proposedPlacementsById - propositions ciblees.
 *
 * @returns {number[]} Identifiants tries.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : preserve l'ordre stable des placements deja connu par le snapshot.
 */
function sortAssignmentIdsBySnapshotOrder(snapshot, proposedPlacementsById) {
  const requestedIds = new Set([...proposedPlacementsById.keys()]);

  return (snapshot?.clonePlacements?.() || [])
    .filter((placement) => requestedIds.has(Number(placement?.id_affectation_cours || 0)))
    .map((placement) => Number(placement.id_affectation_cours));
}

export class ScenarioSimulator {
  /**
   * Simule un scenario sur un snapshot deja charge.
   *
   * @param {Object} options - contexte de simulation.
   * @param {Object} options.snapshot - snapshot officiel read-only.
   * @param {Object} options.scenario - scenario demande.
   * @param {string} [options.optimizationMode="legacy"] - mode d'optimisation.
   *
   * @returns {Object} Rapport de simulation.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - le snapshot source n'est jamais modifie ;
   * - les scenarios infaisables retournent un rapport exploitable ;
   * - `REEVALUER_MODE` compare les scores sans mutation d'horaire.
   */
  static simulate({
    snapshot,
    scenario,
    optimizationMode = "legacy",
  }) {
    const normalizedScenario = normalizeScenario(scenario);
    const normalizedMode = PlacementEvaluator.normalizeMode(optimizationMode);
    const scoringModeBefore = resolveScoringMode(normalizedMode);
    const beforeScore = snapshot.score(scoringModeBefore);
    const beforeConflicts = ScenarioComparator.collectConflicts(snapshot);

    ensureAssignmentTarget(normalizedScenario);

    if (normalizedScenario.type === "REEVALUER_MODE") {
      const scoringModeAfter = resolveScoringMode(
        normalizedScenario.modeCible || normalizedMode
      );
      const afterScore = snapshot.score(scoringModeAfter);

      return ScenarioComparator.compare({
        scenarioType: normalizedScenario.type,
        modeOptimisation: normalizedMode,
        modeScoringAvant: scoringModeBefore,
        modeScoringApres: scoringModeAfter,
        beforeScore,
        afterScore,
        beforeConflicts,
        afterConflicts: beforeConflicts,
        feasible: true,
        mutationApplied: false,
        validation: {
          reasons: [],
          participantIds: [],
        },
      });
    }

    const originalPlacement = snapshot.getPlacementById(normalizedScenario.idAffectationCours);
    if (!originalPlacement) {
      throw createSimulationError(
        "La seance cible est introuvable.",
        404,
        "ASSIGNMENT_NOT_FOUND"
      );
    }

    const proposedPlacement = buildProposedPlacement(
      snapshot,
      originalPlacement,
      normalizedScenario
    );
    const validation = ScheduleMutationValidator.validate({
      snapshot,
      originalPlacement,
      proposedPlacement,
    });

    if (!validation.feasible) {
      return ScenarioComparator.compare({
        scenarioType: normalizedScenario.type,
        modeOptimisation: normalizedMode,
        modeScoringAvant: scoringModeBefore,
        modeScoringApres: scoringModeBefore,
        originalPlacement,
        proposedPlacement,
        beforeScore,
        afterScore: null,
        beforeConflicts,
        afterConflicts: beforeConflicts,
        feasible: false,
        mutationApplied: false,
        validation,
      });
    }

    const afterPlacements = snapshot.replacePlacement(
      originalPlacement.id_affectation_cours,
      proposedPlacement
    );
    const afterSnapshot = snapshot.withPlacements(afterPlacements);
    const afterScore = afterSnapshot.score(scoringModeBefore);
    const afterConflicts = ScenarioComparator.collectConflicts(afterSnapshot);

    return ScenarioComparator.compare({
      scenarioType: normalizedScenario.type,
      modeOptimisation: normalizedMode,
      modeScoringAvant: scoringModeBefore,
      modeScoringApres: scoringModeBefore,
      originalPlacement,
      proposedPlacement,
      beforeScore,
      afterScore,
      beforeConflicts,
      afterConflicts,
      feasible: true,
      mutationApplied: true,
      validation,
    });
  }

  /**
   * Simule un lot de mutations sur plusieurs occurrences.
   *
   * Cette methode est la base du flux de replanification intelligente :
   * - le snapshot officiel reste intact ;
   * - chaque occurrence est validee sur une copie de travail deja mise a jour
   *   par les mutations precedentes du meme lot ;
   * - aucune persistance n'a lieu ici.
   *
   * @param {Object} options - contexte de simulation.
   * @param {Object} options.snapshot - snapshot officiel read-only.
   * @param {Map<number, Object>|Object} options.placementsByAssignmentId - propositions par affectation.
   * @param {string} [options.optimizationMode="legacy"] - mode d'optimisation.
   * @param {string} [options.scope=null] - portee logique de la mutation.
   * @param {string} [options.scenarioType="MODIFIER_AFFECTATION"] - type logique du scenario.
   *
   * @returns {Object} Rapport read-only avant/apres agrege.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - bloque des qu'une occurrence devient infaisable ;
   * - garde `legacy` mappe vers `equilibre` pour le score ;
   * - conserve les identifiants d'affectation d'origine.
   */
  static simulatePlacementMutations({
    snapshot,
    placementsByAssignmentId,
    optimizationMode = "legacy",
    scope = null,
    scenarioType = "MODIFIER_AFFECTATION",
  }) {
    if (!snapshot) {
      throw createSimulationError(
        "Le snapshot officiel est requis pour la simulation de modification.",
        400,
        "SNAPSHOT_REQUIRED"
      );
    }

    const normalizedPlacementsById =
      normalizePlacementsByAssignmentId(placementsByAssignmentId);

    if (normalizedPlacementsById.size === 0) {
      throw createSimulationError(
        "Aucune mutation n'a ete fournie pour la simulation.",
        400,
        "PLACEMENT_MUTATION_REQUIRED"
      );
    }

    const normalizedMode = PlacementEvaluator.normalizeMode(optimizationMode);
    const scoringModeBefore = resolveScoringMode(normalizedMode);
    const beforeScore = snapshot.score(scoringModeBefore);
    const beforeConflicts = ScenarioComparator.collectConflicts(snapshot);
    const orderedAssignmentIds = sortAssignmentIdsBySnapshotOrder(
      snapshot,
      normalizedPlacementsById
    );

    if (orderedAssignmentIds.length !== normalizedPlacementsById.size) {
      throw createSimulationError(
        "Au moins une affectation cible est introuvable dans le snapshot officiel.",
        404,
        "ASSIGNMENT_NOT_FOUND"
      );
    }

    let workingSnapshot = snapshot;
    const originalPlacements = [];
    const proposedPlacements = [];
    const validationDetails = [];
    const participantIds = new Set();

    for (const assignmentId of orderedAssignmentIds) {
      const originalPlacement = workingSnapshot.getPlacementById(assignmentId);
      if (!originalPlacement) {
        throw createSimulationError(
          "La seance cible est introuvable.",
          404,
          "ASSIGNMENT_NOT_FOUND",
          { id_affectation_cours: assignmentId }
        );
      }

      const proposedPlacement = {
        ...normalizedPlacementsById.get(assignmentId),
        id_affectation_cours: Number(originalPlacement.id_affectation_cours),
      };
      const validation = ScheduleMutationValidator.validate({
        snapshot: workingSnapshot,
        originalPlacement,
        proposedPlacement,
      });

      validationDetails.push({
        id_affectation_cours: Number(originalPlacement.id_affectation_cours),
        feasible: Boolean(validation.feasible),
        reasons: validation.reasons || [],
      });

      for (const participantId of validation.participantIds || []) {
        const normalizedParticipantId = Number(participantId);
        if (Number.isInteger(normalizedParticipantId) && normalizedParticipantId > 0) {
          participantIds.add(normalizedParticipantId);
        }
      }

      originalPlacements.push(originalPlacement);
      proposedPlacements.push(proposedPlacement);

      if (!validation.feasible) {
        return ScenarioComparator.compareBatch({
          scenarioType,
          scope,
          modeOptimisation: normalizedMode,
          modeScoringAvant: scoringModeBefore,
          modeScoringApres: scoringModeBefore,
          originalPlacements,
          proposedPlacements,
          beforeScore,
          afterScore: null,
          beforeConflicts,
          afterConflicts: beforeConflicts,
          feasible: false,
          mutationApplied: false,
          validation: {
            reasons: validation.reasons || [],
            participantIds: [...participantIds],
            detailsByAssignment: validationDetails,
          },
        });
      }

      workingSnapshot = workingSnapshot.withPlacements(
        workingSnapshot.replacePlacement(assignmentId, proposedPlacement)
      );
    }

    const afterScore = workingSnapshot.score(scoringModeBefore);
    const afterConflicts = ScenarioComparator.collectConflicts(workingSnapshot);

    return ScenarioComparator.compareBatch({
      scenarioType,
      scope,
      modeOptimisation: normalizedMode,
      modeScoringAvant: scoringModeBefore,
      modeScoringApres: scoringModeBefore,
      originalPlacements,
      proposedPlacements,
      beforeScore,
      afterScore,
      beforeConflicts,
      afterConflicts,
      feasible: true,
      mutationApplied: true,
      validation: {
        reasons: [],
        participantIds: [...participantIds],
        detailsByAssignment: validationDetails,
      },
    });
  }

  /**
   * Charge un snapshot officiel puis execute un scenario.
   *
   * @param {Object} options - options de chargement et de simulation.
   * @param {Object} [executor=pool] - executeur SQL read-only.
   *
   * @returns {Promise<Object>} Rapport de simulation.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : cette methode sert d'entree principale pour l'API.
   */
  static async simulateOfficialScenario(
    {
      idSession = null,
      scenario,
      optimizationMode = "legacy",
    } = {},
    executor = pool
  ) {
    const snapshot = await ScheduleSnapshot.load(
      { idSession: idSession ? Number(idSession) : null },
      executor
    );

    return ScenarioSimulator.simulate({
      snapshot,
      scenario,
      optimizationMode,
    });
  }
}
