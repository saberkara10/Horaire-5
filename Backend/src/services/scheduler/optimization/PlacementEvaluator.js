/**
 * PlacementEvaluator
 *
 * Ce module classe des placements candidats deja juges faisables par le moteur.
 *
 * Son role metier est d'aider SchedulerEngine a choisir un meilleur candidat
 * parmi plusieurs options valides, sans remplacer les validations dures
 * existantes. Il reutilise le profil "legacy" pour reproduire le comportement
 * historique, puis ajoute des ajustements locaux coherents avec scoring_v1 pour
 * les modes etudiant, professeur et equilibre.
 *
 * Dependances principales :
 * - GroupFormer pour estimer correctement l'effectif d'un groupe pour un cours
 * - AcademicCatalog pour les references de creneaux et la cible de jours actifs
 * - ScoringProfiles pour reutiliser les ponderations de scoring_v1
 */

import {
  ACADEMIC_WEEKDAY_TIME_SLOTS,
  TARGET_ACTIVE_DAYS_PER_GROUP,
} from "../AcademicCatalog.js";
import { GroupFormer } from "../GroupFormer.js";
import { ScoringProfiles } from "../scoring/ScoringProfiles.js";

const OPTIMIZATION_MODES = new Set(["legacy", ...ScoringProfiles.list()]);

/**
 * Lit un index de charge par jour pour une entite.
 *
 * @param {Map<string, Map<number, number>>} index - index des charges.
 * @param {number|string|null} entityId - groupe ou professeur.
 * @param {number} weekday - jour ISO.
 *
 * @returns {number} Charge du jour pour l'entite.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne 0 si l'entite ou le jour n'existent pas.
 */
function readDayLoad(index, entityId, weekday) {
  const loadsByDay = index?.get?.(String(entityId));
  if (!loadsByDay) {
    return 0;
  }

  return Number(loadsByDay.get(weekday) || 0);
}

/**
 * Compte le nombre de jours actifs d'une entite.
 *
 * @param {Map<string, Map<number, number>>} index - index des charges.
 * @param {number|string|null} entityId - groupe ou professeur.
 *
 * @returns {number} Nombre de jours avec au moins une serie.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne 0 si l'entite n'est pas presente.
 */
function countActiveDays(index, entityId) {
  const loadsByDay = index?.get?.(String(entityId));
  if (!loadsByDay) {
    return 0;
  }

  return [...loadsByDay.values()].filter((load) => Number(load) > 0).length;
}

/**
 * Lit les slots deja utilises pour une entite sur un jour donne.
 *
 * @param {Map<string, Map<number, Set<number>>>} index - index des slots.
 * @param {number|string|null} entityId - groupe ou professeur.
 * @param {number} weekday - jour ISO.
 *
 * @returns {Set<number>} Slots utilises.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne un Set vide si l'entite n'existe pas.
 */
function readDaySlots(index, entityId, weekday) {
  const slotsByDay = index?.get?.(String(entityId));
  if (!slotsByDay) {
    return new Set();
  }

  return new Set(slotsByDay.get(weekday) || []);
}

/**
 * Projette un nouveau slot dans un ensemble de slots deja utilises.
 *
 * @param {Set<number>} existingSlots - slots deja occupes.
 * @param {number} slotIndex - slot candidat.
 *
 * @returns {number[]} Slots projetes, tries et uniques.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : ignore les slots invalides.
 */
function projectSlotSet(existingSlots, slotIndex) {
  return [...new Set([...[...(existingSlots || new Set())], Number(slotIndex)])]
    .filter((value) => Number.isInteger(value) && value >= 0)
    .sort((left, right) => left - right);
}

/**
 * Mesure la distance du slot candidat par rapport aux slots deja utilises.
 *
 * @param {number} slotIndex - slot candidat.
 * @param {Set<number>} existingSlots - slots deja utilises.
 *
 * @returns {number} Distance minimale.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : si aucun slot n'existe encore, la distance vaut slotIndex.
 */
function distanceToExistingSlots(slotIndex, existingSlots) {
  if (!(existingSlots instanceof Set) || existingSlots.size === 0) {
    return Number(slotIndex) || 0;
  }

  return Math.min(
    ...[...existingSlots].map((usedSlot) => Math.abs(Number(slotIndex) - usedSlot))
  );
}

/**
 * Convertit une liste de slots projetes en penalite de trous.
 *
 * Regle metier :
 * - des slots adjacents representent des blocs consecutifs, donc pas de trou
 * - un slot manquant entre deux blocs auto represente deja un trou de 3h,
 *   ce qui est mauvais pour les etudiants et les professeurs
 *
 * @param {number[]} projectedSlots - slots projetes, tries.
 * @param {"student"|"teacher"} audience - cible metier.
 *
 * @returns {number} Penalite locale.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne 0 si moins de deux slots sont occupes.
 */
function computeGapPenalty(projectedSlots, audience) {
  if (!Array.isArray(projectedSlots) || projectedSlots.length < 2) {
    return 0;
  }

  let penalty = 0;
  for (let index = 1; index < projectedSlots.length; index += 1) {
    const missingSlots = projectedSlots[index] - projectedSlots[index - 1] - 1;
    if (missingSlots <= 0) {
      continue;
    }

    if (audience === "student") {
      penalty += missingSlots === 1 ? 14 : 24 + (missingSlots - 1) * 8;
    } else {
      penalty += missingSlots === 1 ? 10 : 18 + (missingSlots - 1) * 6;
    }
  }

  return penalty;
}

/**
 * Detecte si un ensemble de slots contient au moins un bloc adjacent.
 *
 * @param {number[]} projectedSlots - slots projetes, tries.
 *
 * @returns {boolean} True si deux slots consecutifs existent.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : false si moins de deux slots.
 */
function hasAdjacentBlock(projectedSlots) {
  if (!Array.isArray(projectedSlots) || projectedSlots.length < 2) {
    return false;
  }

  return projectedSlots.some(
    (slotValue, index) =>
      index > 0 && slotValue - projectedSlots[index - 1] === 1
  );
}

/**
 * Calcule l'amplitude d'une journee en nombre de slots.
 *
 * Regle metier :
 * une amplitude de 4 slots auto represente environ 12h entre le debut et la fin,
 * donc depasse l'objectif de confort professeur d'environ 9h.
 *
 * @param {number[]} projectedSlots - slots projetes, tries.
 *
 * @returns {number} Nombre de slots couverts entre le premier et le dernier.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne 0 si aucun slot n'est fourni.
 */
function computeAmplitudeSlots(projectedSlots) {
  if (!Array.isArray(projectedSlots) || projectedSlots.length === 0) {
    return 0;
  }

  return projectedSlots[projectedSlots.length - 1] - projectedSlots[0] + 1;
}

/**
 * Approxime une journee etudiante "compacte" dans le modele actuel.
 *
 * Le moteur auto n'a que des blocs de 3h fixes. Il ne peut donc pas modeliser
 * exactement la pause dynamique de 1h voulue metier. On approxime donc une
 * bonne journee a 3 seances par trois slots consecutifs, tout en laissant
 * scoring_v1 juger le resultat global plus finement.
 *
 * @param {number[]} projectedSlots - slots projetes, tries.
 *
 * @returns {boolean} True si trois slots consecutifs existent.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : false si moins de trois slots.
 */
function isCompactThreeBlockDay(projectedSlots) {
  if (!Array.isArray(projectedSlots) || projectedSlots.length < 3) {
    return false;
  }

  return projectedSlots.length === 3 && computeGapPenalty(projectedSlots, "student") === 0;
}

/**
 * Normalise un index de slot a partir d'un creneau.
 *
 * @param {Object|null} timeSlot - creneau candidat.
 *
 * @returns {number} Index du slot dans le catalogue, ou -1 si inconnu.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : retourne -1 pour un creneau libre ou hors catalogue.
 */
function resolveReferenceSlotIndex(timeSlot) {
  return ACADEMIC_WEEKDAY_TIME_SLOTS.findIndex(
    (slot) =>
      String(slot.debut) === String(timeSlot?.debut) &&
      String(slot.fin) === String(timeSlot?.fin)
  );
}

/**
 * Calcule le score legacy historique de la recherche hebdomadaire.
 *
 * @param {Object} candidate - candidat a evaluer.
 * @param {Object} context - index de charge et de slots.
 *
 * @returns {number} Score historique.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : la formule reproduit l'heuristique actuelle pour limiter
 * les regressions quand le mode est "legacy".
 */
function scoreLegacyWeeklyCandidate(candidate, context) {
  let score = 0;
  const groupDayLoad =
    readDayLoad(context.chargeSeriesParGroupeJour, candidate.idGroupe, candidate.jourSemaine) +
    1;
  const teacherDayLoad =
    readDayLoad(
      context.chargeSeriesParProfJour,
      candidate.professeur.id_professeur,
      candidate.jourSemaine
    ) + 1;
  const activeGroupDays = countActiveDays(
    context.chargeSeriesParGroupeJour,
    candidate.idGroupe
  );
  const groupDayAlreadyActive =
    readDayLoad(context.chargeSeriesParGroupeJour, candidate.idGroupe, candidate.jourSemaine) > 0;
  const teacherDayAlreadyActive =
    readDayLoad(
      context.chargeSeriesParProfJour,
      candidate.professeur.id_professeur,
      candidate.jourSemaine
    ) > 0;
  const groupSlots = readDaySlots(
    context.slotsParGroupeJour,
    candidate.idGroupe,
    candidate.jourSemaine
  );
  const teacherSlots = readDaySlots(
    context.slotsParProfJour,
    candidate.professeur.id_professeur,
    candidate.jourSemaine
  );
  const groupSlotDistance = distanceToExistingSlots(candidate.slotIndex, groupSlots);
  const teacherSlotDistance = distanceToExistingSlots(candidate.slotIndex, teacherSlots);
  const groupSize = GroupFormer.lireEffectifCours(candidate.groupe, candidate.cours?.id_cours);
  const roomCapacity = Number(candidate.salle?.capacite || 0);

  if (groupDayLoad === 1) {
    score += 18;
  } else if (groupDayLoad === 2) {
    score += 28;
  } else {
    score -= 80;
  }

  if (groupDayAlreadyActive) {
    score += 20;
  } else if (activeGroupDays < TARGET_ACTIVE_DAYS_PER_GROUP) {
    score += 14;
  } else {
    score -= 35;
  }

  if (teacherDayLoad === 1) {
    score += 12;
  } else if (teacherDayLoad === 2) {
    score += 18;
  } else if (teacherDayLoad === 3) {
    score += 6;
  } else {
    score -= 50;
  }

  if (teacherDayAlreadyActive) {
    score += 10;
  }

  score -= groupSlotDistance * 6;
  score -= teacherSlotDistance * 4;
  score -= (context.chargeSeriesParJour.get(candidate.jourSemaine) || 0) * 2;
  score -= Number(candidate.indexStrategie || 0) * 25;
  score -= Number(candidate.indexProfesseur || 0) * 4;
  score -= Number(candidate.indexCreneau || 0) * 3;
  score -= Number(candidate.indexSalle || 0) * 2;

  if (roomCapacity > 0 && groupSize > 0) {
    const capacityMargin = Math.max(0, roomCapacity - groupSize);
    score += Math.max(0, 12 - capacityMargin);
  }

  if (candidate.preferenceSerie) {
    const preferredSlot = resolveReferenceSlotIndex({
      debut: candidate.preferenceSerie.heure_debut,
      fin: candidate.preferenceSerie.heure_fin,
    });
    const candidateSlot = resolveReferenceSlotIndex(candidate.creneau);

    if (Number(candidate.preferenceSerie.jourSemaine) === Number(candidate.jourSemaine)) {
      score += 90;
    } else {
      score -=
        Math.abs(Number(candidate.preferenceSerie.jourSemaine) - Number(candidate.jourSemaine)) *
        12;
    }

    if (
      String(candidate.preferenceSerie.heure_debut) === String(candidate.creneau.debut) &&
      String(candidate.preferenceSerie.heure_fin) === String(candidate.creneau.fin)
    ) {
      score += 110;
    } else if (preferredSlot >= 0 && candidateSlot >= 0) {
      score -= Math.abs(preferredSlot - candidateSlot) * 18;
    }

    if (
      Number(candidate.preferenceSerie.id_professeur) ===
      Number(candidate.professeur.id_professeur)
    ) {
      score += 60;
    }

    if (
      Number(candidate.preferenceSerie.id_salle || 0) > 0 &&
      Number(candidate.preferenceSerie.id_salle) === Number(candidate.salle?.id_salle)
    ) {
      score += 35;
    }
  }

  return score;
}

/**
 * Calcule un score legacy pour la passe assouplie.
 *
 * Regle metier : en mode legacy, la passe assouplie doit rester la plus proche
 * possible du comportement historique, c'est-a-dire retenir l'option faisable
 * la plus tot dans l'ordre de parcours.
 *
 * @param {Object} candidate - candidat assoupli.
 *
 * @returns {number} Score de priorite historique.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : plus le candidat apparait tot dans les boucles, plus son
 * score est eleve.
 */
function scoreLegacyFallbackCandidate(candidate) {
  return (
    1_000_000 -
    Number(candidate.indexJour || 0) * 100_000 -
    Number(candidate.indexProfesseur || 0) * 10_000 -
    Number(candidate.indexCreneau || 0) * 1_000 -
    Number(candidate.fallbackTypeIndex || 0) * 100 -
    Number(candidate.indexSalle || 0)
  );
}

/**
 * Calcule une base de score plus souple pour la passe assouplie opt-in.
 *
 * Regle metier :
 * - on garde une preference pour les candidats explores tot
 * - mais on laisse suffisamment de marge aux ajustements etudiant/professeur
 *   pour que le fallback soit reellement plus intelligent que "premier faisable"
 *
 * @param {Object} candidate - candidat assoupli.
 *
 * @returns {number} Base de score fallback pour les modes opt-in.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : le presentiel integral reste prefere a l'hybride, lui-meme
 * prefere au tout en ligne.
 */
function scoreAdaptiveFallbackCandidate(candidate) {
  return (
    220 -
    Number(candidate.indexJour || 0) * 26 -
    Number(candidate.indexProfesseur || 0) * 10 -
    Number(candidate.indexCreneau || 0) * 8 -
    Number(candidate.fallbackTypeIndex || 0) * 18 -
    Number(candidate.indexSalle || 0) * 2
  );
}

/**
 * Transforme les ratios de couverture en bonus local.
 *
 * @param {Object} candidate - candidat evalue.
 *
 * @param {"weekly"|"fallback"} phase - phase d'evaluation.
 *
 * @returns {number} Bonus de couverture.
 *
 * Effets secondaires : aucun.
 * Cas particuliers :
 * - la passe hebdomadaire garde une formule proche du comportement historique
 * - la passe fallback historique ne surpondere pas la couverture
 */
function computeCoverageBonus(candidate, phase) {
  if (phase === "fallback") {
    return 0;
  }

  const coverageRatio = Number(candidate.coverageRatio || 0);
  const roomCoverageRatio = Number(candidate.roomCoverageRatio || 0);
  let bonus = 0;

  if (coverageRatio > 0) {
    bonus += Math.round((coverageRatio - 0.6) * 50);
  }

  if (roomCoverageRatio > 0) {
    bonus += Math.round((roomCoverageRatio - 0.42) * 30);
  }

  return bonus;
}

/**
 * Ajoute une preference locale etudiante derivee de scoring_v1.
 *
 * @param {Object} candidate - candidat a evaluer.
 * @param {Object} context - index de charge et de slots.
 *
 * @returns {number} Ajustement local etudiant.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : ce score reste volontairement local et approximatif pour
 * rester rapide pendant la generation.
 */
function scoreStudentAdjustment(candidate, context) {
  let adjustment = 0;
  const groupDayLoadBefore = readDayLoad(
    context.chargeSeriesParGroupeJour,
    candidate.idGroupe,
    candidate.jourSemaine
  );
  const groupDayLoadAfter = groupDayLoadBefore + 1;
  const groupActiveDaysBefore = countActiveDays(
    context.chargeSeriesParGroupeJour,
    candidate.idGroupe
  );
  const groupDayAlreadyActive = groupDayLoadBefore > 0;
  const groupActiveDaysAfter = groupDayAlreadyActive
    ? groupActiveDaysBefore
    : groupActiveDaysBefore + 1;
  const projectedGroupSlots = projectSlotSet(
    readDaySlots(context.slotsParGroupeJour, candidate.idGroupe, candidate.jourSemaine),
    candidate.slotIndex
  );
  const groupGapPenalty = computeGapPenalty(projectedGroupSlots, "student");

  if (candidate.jourSemaine === 6) {
    adjustment -= 22;
  }

  if (groupDayAlreadyActive) {
    adjustment += 14;
  } else if (groupActiveDaysAfter <= 3) {
    adjustment += 10;
  } else if (groupActiveDaysAfter === 4) {
    adjustment -= 4;
  } else {
    adjustment -= 18;
  }

  if (groupDayLoadAfter === 1) {
    if (candidate.slotIndex === 0) {
      adjustment += 8;
    } else if (candidate.slotIndex === ACADEMIC_WEEKDAY_TIME_SLOTS.length - 1) {
      adjustment += 4;
    } else {
      adjustment -= 10;
    }
  } else if (groupDayLoadAfter === 2) {
    adjustment += hasAdjacentBlock(projectedGroupSlots) ? 16 : -8;
  } else if (groupDayLoadAfter === 3) {
    adjustment += isCompactThreeBlockDay(projectedGroupSlots) ? 8 : -10;
  } else {
    adjustment -= 28;
  }

  adjustment -= groupGapPenalty;
  return adjustment;
}

/**
 * Ajoute une preference locale professeur derivee de scoring_v1.
 *
 * @param {Object} candidate - candidat a evaluer.
 * @param {Object} context - index de charge et de slots.
 *
 * @returns {number} Ajustement local professeur.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : l'amplitude est approximee par le nombre de slots couverts
 * car le moteur auto travaille sur des blocs fixes de 3h.
 */
function scoreTeacherAdjustment(candidate, context) {
  let adjustment = 0;
  const teacherDayLoadBefore = readDayLoad(
    context.chargeSeriesParProfJour,
    candidate.professeur.id_professeur,
    candidate.jourSemaine
  );
  const teacherDayLoadAfter = teacherDayLoadBefore + 1;
  const teacherActiveDaysBefore = countActiveDays(
    context.chargeSeriesParProfJour,
    candidate.professeur.id_professeur
  );
  const teacherDayAlreadyActive = teacherDayLoadBefore > 0;
  const projectedTeacherSlots = projectSlotSet(
    readDaySlots(
      context.slotsParProfJour,
      candidate.professeur.id_professeur,
      candidate.jourSemaine
    ),
    candidate.slotIndex
  );
  const teacherGapPenalty = computeGapPenalty(projectedTeacherSlots, "teacher");
  const amplitudeSlots = computeAmplitudeSlots(projectedTeacherSlots);

  if (teacherDayAlreadyActive) {
    adjustment += 5;
  } else if (teacherActiveDaysBefore >= 5) {
    adjustment -= 4;
  } else if (teacherActiveDaysBefore >= 4) {
    adjustment -= 1;
  } else {
    adjustment += 2;
  }

  if (teacherDayLoadAfter === 1) {
    adjustment += 2;
  } else if (teacherDayLoadAfter === 2) {
    adjustment += hasAdjacentBlock(projectedTeacherSlots) ? 10 : -6;
  } else if (teacherDayLoadAfter === 3) {
    adjustment += 5;
  } else {
    adjustment -= 24;
  }

  adjustment -= teacherGapPenalty;

  if (amplitudeSlots > 3) {
    adjustment -= (amplitudeSlots - 3) * 14;
  }

  return adjustment;
}

export class PlacementEvaluator {
  /**
   * Normalise le mode d'optimisation.
   *
   * @param {string|null|undefined} mode - mode demande.
   *
   * @returns {"legacy"|"etudiant"|"professeur"|"equilibre"} Mode normalise.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : toute valeur inconnue retombe sur "legacy".
   */
  static normalizeMode(mode = "legacy") {
    const normalizedMode = String(mode || "legacy").trim().toLowerCase();
    return OPTIMIZATION_MODES.has(normalizedMode) ? normalizedMode : "legacy";
  }

  /**
   * Mappe le mode d'optimisation vers le mode scoring_v1 de reference.
   *
   * @param {string|null|undefined} mode - mode d'optimisation.
   *
   * @returns {"etudiant"|"professeur"|"equilibre"} Mode scoring_v1.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : legacy utilise equilibre pour les rapports.
   */
  static resolveScoringMode(mode = "legacy") {
    const normalizedMode = PlacementEvaluator.normalizeMode(mode);
    return normalizedMode === "legacy" ? "equilibre" : normalizedMode;
  }

  /**
   * Evalue un candidat faisable.
   *
   * @param {Object} options - options d'evaluation.
   * @param {string} [options.mode="legacy"] - mode d'optimisation.
   * @param {"weekly"|"fallback"} [options.phase="weekly"] - phase moteur.
   * @param {Object} options.candidate - candidat faisable.
   * @param {Object} options.context - index de charge et de slots.
   *
   * @returns {{mode: string, score: number, components: Object}} Evaluation complete.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - "legacy" reproduit la logique historique
   * - les autres modes ajoutent des ajustements locaux derives de scoring_v1
   */
  static evaluateCandidate({ mode = "legacy", phase = "weekly", candidate, context }) {
    const normalizedMode = PlacementEvaluator.normalizeMode(mode);
    const baseScore =
      phase === "fallback"
        ? normalizedMode === "legacy"
          ? scoreLegacyFallbackCandidate(candidate)
          : scoreAdaptiveFallbackCandidate(candidate)
        : scoreLegacyWeeklyCandidate(candidate, context);
    const coverageBonus = computeCoverageBonus(candidate, phase);

    if (normalizedMode === "legacy") {
      return {
        mode: normalizedMode,
        score: baseScore + coverageBonus,
        components: {
          baseScore,
          coverageBonus,
          studentAdjustment: 0,
          teacherAdjustment: 0,
        },
      };
    }

    const scoringProfile = ScoringProfiles.get(normalizedMode);
    const studentAdjustment = scoreStudentAdjustment(candidate, context);
    const teacherAdjustment = scoreTeacherAdjustment(candidate, context);
    const weightedAdjustment = Math.round(
      studentAdjustment * (Number(scoringProfile.weights.etudiant || 0) * 2.5) +
        teacherAdjustment * (Number(scoringProfile.weights.professeur || 0) * 2.5)
    );

    return {
      mode: normalizedMode,
      score: baseScore + coverageBonus + weightedAdjustment,
      components: {
        baseScore,
        coverageBonus,
        studentAdjustment,
        teacherAdjustment,
        weightedAdjustment,
      },
    };
  }

  /**
   * Trie une liste de candidats du meilleur au moins bon.
   *
   * @param {Object} options - options de tri.
   * @param {string} [options.mode="legacy"] - mode d'optimisation.
   * @param {"weekly"|"fallback"} [options.phase="weekly"] - phase moteur.
   * @param {Object[]} options.candidates - candidats faisables.
   * @param {Object} options.context - index de charge et de slots.
   *
   * @returns {Array<{candidate: Object, evaluation: Object}>} Candidats tries.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : en cas d'egalite, l'ordre initial est conserve pour ne
   * pas introduire de non-determinisme supplementaire.
   */
  static rankCandidates({ mode = "legacy", phase = "weekly", candidates, context }) {
    return [...(Array.isArray(candidates) ? candidates : [])]
      .map((candidate, index) => ({
        candidate,
        evaluation: PlacementEvaluator.evaluateCandidate({
          mode,
          phase,
          candidate,
          context,
        }),
        originalIndex: index,
      }))
      .sort((left, right) => {
        if (left.evaluation.score !== right.evaluation.score) {
          return right.evaluation.score - left.evaluation.score;
        }

        return left.originalIndex - right.originalIndex;
      });
  }
}
