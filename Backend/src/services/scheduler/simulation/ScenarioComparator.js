/**
 * ScenarioComparator
 *
 * Ce module compare l'etat avant/apres d'une simulation what-if.
 *
 * Responsabilites principales :
 * - comparer les scores avant/apres sur le meme format que scoring_v1 ;
 * - detecter les conflits crees ou resolus ;
 * - produire un resume explicable pour les etudiants, les professeurs et les salles.
 *
 * Integration dans le systeme :
 * - ScenarioSimulator lui delegue la production du rapport final ;
 * - la sortie est pensee pour etre exploitable telle quelle par l'API et le frontend ;
 * - aucune ecriture ni mutation de l'horaire officiel n'a lieu ici.
 */

/**
 * Convertit une heure HH:MM:SS en minutes.
 *
 * @param {string|null|undefined} timeValue - heure source.
 *
 * @returns {number} Heure en minutes.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `0` si la valeur est absente.
 */
function timeToMinutes(timeValue) {
  const [hours = "0", minutes = "0"] = String(timeValue || "0:0:0").split(":");
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Determine si deux placements se chevauchent.
 *
 * @param {Object} left - placement de gauche.
 * @param {Object} right - placement de droite.
 *
 * @returns {boolean} True si les deux placements se chevauchent.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : des dates differentes ne se chevauchent jamais.
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
 * Arrondit un delta numerique.
 *
 * @param {number} value - valeur source.
 *
 * @returns {number} Valeur arrondie a 2 decimales.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `0` si la valeur n'est pas finie.
 */
function round(value) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }

  return Math.round(Number(value) * 100) / 100;
}

/**
 * Extrait un nombre depuis un detail de score.
 *
 * @param {Object} source - objet source.
 * @param {string[]} path - chemin imbrique.
 *
 * @returns {number} Valeur numerique.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `0` si le chemin n'existe pas.
 */
function readNumeric(source, path) {
  let cursor = source;

  for (const segment of Array.isArray(path) ? path : []) {
    cursor = cursor?.[segment];
  }

  return Number(cursor || 0);
}

/**
 * Construit un identifiant stable de conflit.
 *
 * @param {string} type - type de conflit.
 * @param {Object} left - placement de gauche.
 * @param {Object} right - placement de droite.
 * @param {number[]|null} [studentIds=null] - etudiants en conflit.
 *
 * @returns {string} Cle stable.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : l'ordre des affectations est trie pour stabiliser la cle.
 */
function buildConflictKey(type, left, right, studentIds = null) {
  const assignmentIds = [
    Number(left?.id_affectation_cours || 0),
    Number(right?.id_affectation_cours || 0),
  ].sort((first, second) => first - second);
  const studentPart = Array.isArray(studentIds) && studentIds.length > 0
    ? `|${[...studentIds].sort((first, second) => first - second).join(",")}`
    : "";

  return `${type}|${assignmentIds.join("|")}${studentPart}`;
}

/**
 * Resume un placement pour le rapport.
 *
 * @param {Object} placement - placement source.
 *
 * @returns {Object} Placement resume.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : on garde uniquement les champs utiles a la lecture UI.
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
 * Formate un conflit detaille.
 *
 * @param {string} type - type de conflit.
 * @param {Object} left - placement de gauche.
 * @param {Object} right - placement de droite.
 * @param {number[]|null} [studentIds=null] - etudiants concernes.
 *
 * @returns {Object} Conflit detaille.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : les ids etudiants ne sont presents que pour les conflits etudiants.
 */
function buildConflictDetail(type, left, right, studentIds = null) {
  return {
    key: buildConflictKey(type, left, right, studentIds),
    type,
    left: summarizePlacement(left),
    right: summarizePlacement(right),
    ...(Array.isArray(studentIds) && studentIds.length > 0
      ? { id_etudiants: [...studentIds].sort((first, second) => first - second) }
      : {}),
  };
}

/**
 * Construit les phrases d'impact cote etudiant.
 *
 * @param {Object|null} beforeScore - score avant.
 * @param {Object|null} afterScore - score apres.
 *
 * @returns {string} Resume d'impact.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : s'appuie sur les details de scoring_v1 deja existants.
 */
function buildStudentImpactSummary(beforeScore, afterScore) {
  if (!beforeScore || !afterScore) {
    return "Aucun impact etudiant exploitable tant que le scenario reste infaisable.";
  }

  const deltaHoleHours =
    readNumeric(beforeScore, ["details", "etudiant", "totals", "holeHours"]) -
    readNumeric(afterScore, ["details", "etudiant", "totals", "holeHours"]);
  const deltaFragmentedDays =
    readNumeric(beforeScore, ["details", "etudiant", "totals", "fragmentedDays"]) -
    readNumeric(afterScore, ["details", "etudiant", "totals", "fragmentedDays"]);
  const deltaSaturdayDays =
    readNumeric(beforeScore, ["details", "etudiant", "totals", "saturdayDays"]) -
    readNumeric(afterScore, ["details", "etudiant", "totals", "saturdayDays"]);
  const deltaActiveDays =
    readNumeric(beforeScore, ["details", "etudiant", "averages", "activeDaysPerWeek"]) -
    readNumeric(afterScore, ["details", "etudiant", "averages", "activeDaysPerWeek"]);

  const fragments = [];

  if (deltaHoleHours > 0) {
    fragments.push(`trous en baisse de ${round(deltaHoleHours)}h`);
  } else if (deltaHoleHours < 0) {
    fragments.push(`trous en hausse de ${round(Math.abs(deltaHoleHours))}h`);
  }

  if (deltaFragmentedDays > 0) {
    fragments.push(`fragmentation reduite de ${deltaFragmentedDays} jour(s)`);
  } else if (deltaFragmentedDays < 0) {
    fragments.push(`fragmentation accrue de ${Math.abs(deltaFragmentedDays)} jour(s)`);
  }

  if (deltaSaturdayDays > 0) {
    fragments.push(`samedi evite sur ${deltaSaturdayDays} jour(s)`);
  } else if (deltaSaturdayDays < 0) {
    fragments.push(`presence du samedi accrue de ${Math.abs(deltaSaturdayDays)} jour(s)`);
  }

  if (deltaActiveDays > 0) {
    fragments.push(`jours actifs moyens reduits de ${round(deltaActiveDays)}`);
  } else if (deltaActiveDays < 0) {
    fragments.push(`jours actifs moyens augmentes de ${round(Math.abs(deltaActiveDays))}`);
  }

  return fragments.length > 0
    ? fragments.join(", ")
    : "Impact etudiant neutre sur les indicateurs principaux.";
}

/**
 * Construit les phrases d'impact cote professeur.
 *
 * @param {Object|null} beforeScore - score avant.
 * @param {Object|null} afterScore - score apres.
 *
 * @returns {string} Resume d'impact.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : met l'accent sur les trous, la fragmentation et l'amplitude.
 */
function buildTeacherImpactSummary(beforeScore, afterScore) {
  if (!beforeScore || !afterScore) {
    return "Aucun impact professeur exploitable tant que le scenario reste infaisable.";
  }

  const deltaHoleHours =
    readNumeric(beforeScore, ["details", "professeur", "totals", "holeHours"]) -
    readNumeric(afterScore, ["details", "professeur", "totals", "holeHours"]);
  const deltaFragmentedDays =
    readNumeric(beforeScore, ["details", "professeur", "totals", "fragmentedDays"]) -
    readNumeric(afterScore, ["details", "professeur", "totals", "fragmentedDays"]);
  const deltaLongAmplitudeDays =
    readNumeric(beforeScore, ["details", "professeur", "totals", "longAmplitudeDays"]) -
    readNumeric(afterScore, ["details", "professeur", "totals", "longAmplitudeDays"]);

  const fragments = [];

  if (deltaHoleHours > 0) {
    fragments.push(`trous professeurs en baisse de ${round(deltaHoleHours)}h`);
  } else if (deltaHoleHours < 0) {
    fragments.push(`trous professeurs en hausse de ${round(Math.abs(deltaHoleHours))}h`);
  }

  if (deltaFragmentedDays > 0) {
    fragments.push(`fragmentation reduite de ${deltaFragmentedDays} jour(s)`);
  } else if (deltaFragmentedDays < 0) {
    fragments.push(`fragmentation accrue de ${Math.abs(deltaFragmentedDays)} jour(s)`);
  }

  if (deltaLongAmplitudeDays > 0) {
    fragments.push(`longues amplitudes reduites de ${deltaLongAmplitudeDays} jour(s)`);
  } else if (deltaLongAmplitudeDays < 0) {
    fragments.push(
      `longues amplitudes augmentees de ${Math.abs(deltaLongAmplitudeDays)} jour(s)`
    );
  }

  return fragments.length > 0
    ? fragments.join(", ")
    : "Impact professeur neutre sur les indicateurs principaux.";
}

/**
 * Construit le resume d'impact cote salles.
 *
 * @param {Object} options - contexte du scenario.
 *
 * @returns {string} Resume d'impact.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : le what-if reste read-only, donc l'impact salle est purement analytique.
 */
function buildRoomImpactSummary({
  originalPlacement,
  proposedPlacement,
  createdRoomConflicts,
  resolvedRoomConflicts,
}) {
  const originalRoomId = Number(originalPlacement?.id_salle || 0) || null;
  const proposedRoomId = Number(proposedPlacement?.id_salle || 0) || null;

  if (originalRoomId !== proposedRoomId) {
    if (createdRoomConflicts > 0) {
      return `La salle change de ${originalRoomId || "en ligne"} vers ${proposedRoomId || "en ligne"}, avec ${createdRoomConflicts} conflit(s) de salle cree(s).`;
    }

    if (resolvedRoomConflicts > 0) {
      return `La salle change de ${originalRoomId || "en ligne"} vers ${proposedRoomId || "en ligne"} et resout ${resolvedRoomConflicts} conflit(s) de salle.`;
    }

    return `La salle change de ${originalRoomId || "en ligne"} vers ${proposedRoomId || "en ligne"} sans creer de conflit de salle.`;
  }

  if (createdRoomConflicts > 0) {
    return `${createdRoomConflicts} conflit(s) de salle sont crees sur la salle actuelle.`;
  }

  if (resolvedRoomConflicts > 0) {
    return `${resolvedRoomConflicts} conflit(s) de salle sont resolus sur la salle actuelle.`;
  }

  return "Impact salle neutre.";
}

/**
 * Resume un delta de score.
 *
 * @param {Object|null} beforeScore - score avant.
 * @param {Object|null} afterScore - score apres.
 *
 * @returns {Object|null} Delta de score ou `null`.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne `null` si aucun score apres n'est disponible.
 */
function buildScoreDifference(beforeScore, afterScore) {
  if (!beforeScore || !afterScore) {
    return null;
  }

  return {
    scoreGlobal: round(Number(afterScore.scoreGlobal || 0) - Number(beforeScore.scoreGlobal || 0)),
    scoreEtudiant: round(
      Number(afterScore.scoreEtudiant || 0) - Number(beforeScore.scoreEtudiant || 0)
    ),
    scoreProfesseur: round(
      Number(afterScore.scoreProfesseur || 0) - Number(beforeScore.scoreProfesseur || 0)
    ),
  };
}

/**
 * Collecte des identifiants numeriques uniques a partir d'un ensemble de placements.
 *
 * @param {Object[]} placements - placements sources.
 * @param {string} fieldName - champ a collecter.
 *
 * @returns {number[]} Identifiants tries.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : ignore les valeurs nulles, invalides ou negatives.
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
 * Construit le resume d'impact cote salles pour un lot de mutations.
 *
 * @param {Object[]} originalPlacements - placements avant mutation.
 * @param {Object[]} proposedPlacements - placements apres mutation.
 * @param {number} createdRoomConflicts - conflits de salle crees.
 * @param {number} resolvedRoomConflicts - conflits de salle resolus.
 *
 * @returns {string} Resume d'impact.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : le message reste purement analytique car le what-if est read-only.
 */
function buildBatchRoomImpactSummary(
  originalPlacements,
  proposedPlacements,
  createdRoomConflicts,
  resolvedRoomConflicts
) {
  const beforeRooms = collectUniqueNumericValues(originalPlacements, "id_salle");
  const afterRooms = collectUniqueNumericValues(proposedPlacements, "id_salle");

  if (beforeRooms.join(",") !== afterRooms.join(",")) {
    return `Salles impliquees avant: ${beforeRooms.join(", ") || "en ligne"}; apres: ${afterRooms.join(", ") || "en ligne"}.`;
  }

  if (createdRoomConflicts > 0) {
    return `${createdRoomConflicts} conflit(s) de salle sont crees sur les occurrences ciblees.`;
  }

  if (resolvedRoomConflicts > 0) {
    return `${resolvedRoomConflicts} conflit(s) de salle sont resolus sur les occurrences ciblees.`;
  }

  return "Impact salle neutre.";
}

/**
 * Produit un resume humain du scenario.
 *
 * @param {Object} options - contexte de comparaison.
 *
 * @returns {string} Resume explicable.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : distingue le cas infaisable du cas purement analytique `REEVALUER_MODE`.
 */
function buildSummary({
  feasible,
  scenarioType,
  beforeScore,
  afterScore,
  difference,
  createdConflictCount,
  resolvedConflictCount,
  validationReasons,
}) {
  if (!feasible) {
    const reason = Array.isArray(validationReasons) && validationReasons.length > 0
      ? validationReasons[0].message
      : "Le scenario viole au moins une contrainte dure.";
    return `Simulation infaisable : ${reason}`;
  }

  if (scenarioType === "REEVALUER_MODE") {
    return `Aucune mutation d'horaire : seule la ponderation change, avec un delta global de ${round(Number(afterScore?.scoreGlobal || 0) - Number(beforeScore?.scoreGlobal || 0))}.`;
  }

  const scoreDelta = round(Number(difference?.scoreGlobal || 0));
  const fragments = [`Scenario faisable`];

  if (scoreDelta > 0) {
    fragments.push(`score global en hausse de ${scoreDelta}`);
  } else if (scoreDelta < 0) {
    fragments.push(`score global en baisse de ${Math.abs(scoreDelta)}`);
  } else {
    fragments.push("score global stable");
  }

  if (resolvedConflictCount > 0) {
    fragments.push(`${resolvedConflictCount} conflit(s) resolu(s)`);
  }

  if (createdConflictCount > 0) {
    fragments.push(`${createdConflictCount} conflit(s) cree(s)`);
  }

  return `${fragments.join(", ")}.`;
}

/**
 * Produit un resume humain pour une mutation multi-occurrences.
 *
 * @param {Object} options - contexte de comparaison.
 *
 * @returns {string} Resume explicable.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : distingue les cas infaisables et les applications sur serie.
 */
function buildBatchSummary({
  feasible,
  scope,
  targetedCount,
  difference,
  createdConflictCount,
  resolvedConflictCount,
  validationReasons,
}) {
  if (!feasible) {
    const reason = Array.isArray(validationReasons) && validationReasons.length > 0
      ? validationReasons[0].message
      : "La replanification viole au moins une contrainte dure.";
    return `Modification infaisable (${scope || "THIS_OCCURRENCE"}) : ${reason}`;
  }

  const scoreDelta = round(Number(difference?.scoreGlobal || 0));
  const fragments = [
    `${targetedCount} occurrence(s) replanifiable(s) sur la portee ${scope || "THIS_OCCURRENCE"}`,
  ];

  if (scoreDelta > 0) {
    fragments.push(`score global en hausse de ${scoreDelta}`);
  } else if (scoreDelta < 0) {
    fragments.push(`score global en baisse de ${Math.abs(scoreDelta)}`);
  } else {
    fragments.push("score global stable");
  }

  if (resolvedConflictCount > 0) {
    fragments.push(`${resolvedConflictCount} conflit(s) resolu(s)`);
  }

  if (createdConflictCount > 0) {
    fragments.push(`${createdConflictCount} conflit(s) cree(s)`);
  }

  return `${fragments.join(", ")}.`;
}

export class ScenarioComparator {
  /**
   * Collecte les conflits presents dans un snapshot.
   *
   * @param {Object} snapshot - snapshot a analyser.
   *
   * @returns {Object} Conflits regroupes par type.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - le moteur officiel est cense etre sain, mais ce controle permet aussi de
   *   mesurer des conflits deja presents et potentiellement resolus.
   */
  static collectConflicts(snapshot) {
    const placements = snapshot?.clonePlacements?.() || [];
    const roomConflicts = [];
    const professorConflicts = [];
    const groupConflicts = [];
    const studentConflicts = [];

    for (let leftIndex = 0; leftIndex < placements.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < placements.length; rightIndex += 1) {
        const left = placements[leftIndex];
        const right = placements[rightIndex];

        if (!overlaps(left, right)) {
          continue;
        }

        if (
          Number(left?.id_salle || 0) > 0 &&
          Number(left?.id_salle || 0) === Number(right?.id_salle || 0)
        ) {
          roomConflicts.push(buildConflictDetail("room", left, right));
        }

        if (Number(left?.id_professeur || 0) === Number(right?.id_professeur || 0)) {
          professorConflicts.push(buildConflictDetail("professor", left, right));
        }

        if (Number(left?.id_groupe || 0) === Number(right?.id_groupe || 0)) {
          groupConflicts.push(buildConflictDetail("group", left, right));
        }

        const leftParticipants = new Set(
          snapshot.getParticipantsForAssignment(left.id_affectation_cours)
        );
        const commonStudents = snapshot
          .getParticipantsForAssignment(right.id_affectation_cours)
          .filter((studentId) => leftParticipants.has(studentId));

        if (commonStudents.length > 0) {
          studentConflicts.push(
            buildConflictDetail("student", left, right, commonStudents)
          );
        }
      }
    }

    const all = [...roomConflicts, ...professorConflicts, ...groupConflicts, ...studentConflicts];

    return {
      all,
      roomConflicts,
      professorConflicts,
      groupConflicts,
      studentConflicts,
      keySet: new Set(all.map((conflict) => conflict.key)),
    };
  }

  /**
   * Compare deux etats de simulation et construit le rapport final.
   *
   * @param {Object} options - contexte complet de comparaison.
   *
   * @returns {Object} Rapport what-if stable et exploitable par l'API.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - le rapport reste present meme en cas d'infaisabilite ;
   * - `scoreApres` et `difference` restent `null` si le scenario n'est pas faisable.
   */
  static compare({
    scenarioType,
    modeOptimisation,
    modeScoringAvant,
    modeScoringApres,
    originalPlacement = null,
    proposedPlacement = null,
    beforeScore,
    afterScore,
    beforeConflicts,
    afterConflicts,
    feasible,
    mutationApplied,
    validation = {},
  }) {
    const beforeKeySet = beforeConflicts?.keySet || new Set();
    const afterKeySet = afterConflicts?.keySet || new Set();
    const createdConflicts = (afterConflicts?.all || []).filter(
      (conflict) => !beforeKeySet.has(conflict.key)
    );
    const resolvedConflicts = (beforeConflicts?.all || []).filter(
      (conflict) => !afterKeySet.has(conflict.key)
    );
    const difference = buildScoreDifference(beforeScore, afterScore);

    return {
      readOnly: true,
      faisable: Boolean(feasible),
      mutationAppliquee: Boolean(mutationApplied),
      typeScenario: scenarioType,
      modeOptimisation,
      modeOptimisationUtilise: modeOptimisation,
      modeScoringAvant,
      modeScoringApres,
      scoreAvant: beforeScore || null,
      scoreApres: afterScore || null,
      difference,
      conflitsCrees: createdConflicts.length,
      conflitsResolus: resolvedConflicts.length,
      detailsConflits: {
        crees: createdConflicts,
        resolus: resolvedConflicts,
      },
      impact: {
        etudiants: {
          idsImpactes: [...new Set(validation?.participantIds || [])].sort(
            (first, second) => first - second
          ),
          resume: buildStudentImpactSummary(beforeScore, afterScore),
        },
        professeurs: {
          idsImpactes: [...new Set(
            [
              Number(originalPlacement?.id_professeur || 0) || null,
              Number(proposedPlacement?.id_professeur || 0) || null,
            ].filter(Boolean)
          )].sort((first, second) => first - second),
          resume: buildTeacherImpactSummary(beforeScore, afterScore),
        },
        salles: {
          idsImpactees: [...new Set(
            [
              Number(originalPlacement?.id_salle || 0) || null,
              Number(proposedPlacement?.id_salle || 0) || null,
            ].filter((value) => value !== null)
          )].sort((first, second) => first - second),
          resume: buildRoomImpactSummary({
            originalPlacement,
            proposedPlacement,
            createdRoomConflicts: createdConflicts.filter(
              (conflict) => conflict.type === "room"
            ).length,
            resolvedRoomConflicts: resolvedConflicts.filter(
              (conflict) => conflict.type === "room"
            ).length,
          }),
        },
      },
      validation: {
        raisonsBlocage: validation?.reasons || [],
      },
      resume: buildSummary({
        feasible,
        scenarioType,
        beforeScore,
        afterScore,
        difference,
        createdConflictCount: createdConflicts.length,
        resolvedConflictCount: resolvedConflicts.length,
        validationReasons: validation?.reasons || [],
      }),
    };
  }

  /**
   * Compare un lot de mutations d'affectations sur un meme snapshot.
   *
   * @param {Object} options - contexte complet de comparaison.
   *
   * @returns {Object} Rapport what-if read-only pour une replanification multi-occurrences.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - reste additif par rapport au contrat what-if existant ;
   * - agrege les impacts de plusieurs occurrences dans une meme reponse ;
   * - `scoreApres` et `difference` restent `null` si la mutation est infaisable.
   */
  static compareBatch({
    scenarioType,
    scope = null,
    modeOptimisation,
    modeScoringAvant,
    modeScoringApres,
    originalPlacements = [],
    proposedPlacements = [],
    beforeScore,
    afterScore,
    beforeConflicts,
    afterConflicts,
    feasible,
    mutationApplied,
    validation = {},
  }) {
    const beforeKeySet = beforeConflicts?.keySet || new Set();
    const afterKeySet = afterConflicts?.keySet || new Set();
    const createdConflicts = (afterConflicts?.all || []).filter(
      (conflict) => !beforeKeySet.has(conflict.key)
    );
    const resolvedConflicts = (beforeConflicts?.all || []).filter(
      (conflict) => !afterKeySet.has(conflict.key)
    );
    const difference = buildScoreDifference(beforeScore, afterScore);
    const impactedStudentIds = [...new Set(validation?.participantIds || [])].sort(
      (first, second) => first - second
    );
    const impactedProfessorIds = collectUniqueNumericValues(
      [...originalPlacements, ...proposedPlacements],
      "id_professeur"
    );
    const impactedRoomIds = collectUniqueNumericValues(
      [...originalPlacements, ...proposedPlacements],
      "id_salle"
    );

    return {
      readOnly: true,
      faisable: Boolean(feasible),
      mutationAppliquee: Boolean(mutationApplied),
      typeScenario: scenarioType,
      portee: scope,
      modeOptimisation,
      modeOptimisationUtilise: modeOptimisation,
      modeScoringAvant,
      modeScoringApres,
      affectationsCiblees: collectUniqueNumericValues(
        originalPlacements,
        "id_affectation_cours"
      ),
      mutations: {
        avant: originalPlacements.map((placement) => summarizePlacement(placement)),
        apres: proposedPlacements.map((placement) => summarizePlacement(placement)),
      },
      scoreAvant: beforeScore || null,
      scoreApres: afterScore || null,
      difference,
      conflitsCrees: createdConflicts.length,
      conflitsResolus: resolvedConflicts.length,
      detailsConflits: {
        crees: createdConflicts,
        resolus: resolvedConflicts,
      },
      impact: {
        etudiants: {
          idsImpactes: impactedStudentIds,
          resume: buildStudentImpactSummary(beforeScore, afterScore),
        },
        professeurs: {
          idsImpactes: impactedProfessorIds,
          resume: buildTeacherImpactSummary(beforeScore, afterScore),
        },
        salles: {
          idsImpactees: impactedRoomIds,
          resume: buildBatchRoomImpactSummary(
            originalPlacements,
            proposedPlacements,
            createdConflicts.filter((conflict) => conflict.type === "room").length,
            resolvedConflicts.filter((conflict) => conflict.type === "room").length
          ),
        },
      },
      validation: {
        raisonsBlocage: validation?.reasons || [],
        detailsParAffectation: validation?.detailsByAssignment || [],
      },
      resume: buildBatchSummary({
        feasible,
        scope,
        targetedCount: originalPlacements.length,
        difference,
        createdConflictCount: createdConflicts.length,
        resolvedConflictCount: resolvedConflicts.length,
        validationReasons: validation?.reasons || [],
      }),
    };
  }
}
