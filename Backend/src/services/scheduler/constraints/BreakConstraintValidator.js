/**
 * Validateur de contrainte de pause entre cours consécutifs.
 *
 * Ce module applique une règle pédagogique importante : après deux cours consécutifs
 * (sans aucune interruption entre eux), un troisième cours ne peut pas être placé
 * immédiatement après — il faut au minimum 60 minutes de pause.
 *
 * Règle métier exacte :
 *  - Cours A finit à 10:00, Cours B commence à 10:00 → ils sont "consécutifs"
 *  - Si B finit à 12:00, Cours C ne peut pas commencer avant 13:00
 *  - 0 minute de pause : interdit
 *  - 30 minutes de pause : interdit (minimum requis : 60 min)
 *  - 60 minutes de pause : valide ✅
 *  - 90 minutes de pause : valide ✅
 *
 * Pourquoi cette contrainte ?
 * Sans pause, les professeurs et les groupes d'étudiants seraient en cours
 * non-stop. Une pause d'au moins 1h après 2 cours d'affilée garantit la qualité
 * de l'enseignement et le bien-être académique.
 *
 * @module services/scheduler/constraints/BreakConstraintValidator
 */

/**
 * Durée minimale de pause exigée après deux cours consécutifs, en minutes.
 * @type {number}
 */
const DEFAULT_MIN_BREAK_MINUTES = 60;

/**
 * Normalise une chaîne horaire au format "HH:MM:SS" sur 8 caractères.
 *
 * Accepte "HH:MM" (5 caractères) et complète avec ":00" pour les secondes.
 * Tronque à 8 caractères si plus long.
 *
 * @param {*} timeValue - La valeur à normaliser
 * @returns {string} La chaîne normalisée, ou "" si vide
 */
function normalizeTime(timeValue) {
  const value = String(timeValue || "").trim();

  if (!value) {
    return "";
  }

  if (value.length === 5) {
    return `${value}:00`; // "14:30" → "14:30:00"
  }

  return value.slice(0, 8); // Tronquer pour éviter les millisecondes
}

/**
 * Convertit une chaîne horaire en nombre total de minutes.
 *
 * @param {*} timeValue - La chaîne horaire (ex: "14:30:00")
 * @returns {number} Le nombre de minutes (ex: 870 pour 14:30)
 */
function timeToMinutes(timeValue) {
  const [hours = "0", minutes = "0"] = normalizeTime(timeValue).split(":");
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Normalise une date vers le format "YYYY-MM-DD" (10 premiers caractères).
 *
 * @param {*} dateValue - La date à normaliser
 * @returns {string} Date normalisée ou "" si invalide
 */
function normalizeDate(dateValue) {
  return String(dateValue || "").trim().slice(0, 10);
}

/**
 * Normalise un placement (séance planifiée) en vérifiant sa validité.
 *
 * Un placement est valide si :
 *  - Il a une date, une heure_debut et une heure_fin
 *  - heure_debut < heure_fin (logique temporelle)
 *
 * Retourne null si le placement est invalide → il sera ignoré pour cette contrainte.
 *
 * Ajoute des champs internes _startMinutes et _endMinutes pour les calculs,
 * préfixés avec "_" pour signaler qu'ils sont internes et ne doivent pas
 * être persistés en base de données.
 *
 * @param {object|null} placement - Le placement à normaliser
 * @returns {object|null} Le placement normalisé avec champs internes, ou null
 */
function normalizePlacement(placement) {
  const date = normalizeDate(placement?.date);
  const heureDebut = normalizeTime(placement?.heure_debut);
  const heureFin = normalizeTime(placement?.heure_fin);

  if (!date || !heureDebut || !heureFin) {
    return null; // Données manquantes → placement invalide
  }

  const startMinutes = timeToMinutes(heureDebut);
  const endMinutes = timeToMinutes(heureFin);

  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || startMinutes >= endMinutes) {
    return null; // Heure de début >= heure de fin → incohérence
  }

  return {
    ...placement,
    date,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    _startMinutes: startMinutes, // Champ interne pour le calcul des comparaisons
    _endMinutes: endMinutes,     // Champ interne pour le calcul des pauses
  };
}

/**
 * Construit l'objet de violation de contrainte.
 *
 * Quand la contrainte de pause est violée, on construit un objet structuré
 * qui décrit précisément la violation : quels cours sont impliqués, quelle
 * pause était disponible vs quelle pause était requise.
 *
 * Ce format structuré permet :
 *  - Au scheduler de comprendre pourquoi un placement a échoué
 *  - Au rapport FailedCourseDebugService de construire un diagnostic précis
 *  - Au frontend d'afficher un message d'erreur informatif
 *
 * @param {object} params - Les données de la violation
 * @returns {object} L'objet de violation avec code, message et détails
 */
function buildViolation({
  resourceType,
  resourceId,
  date,
  gapMinutes,
  previousPlacement,
  consecutivePlacement,
  blockedPlacement,
  minBreakMinutes,
}) {
  return {
    code: "BREAK_AFTER_TWO_CONSECUTIVE_REQUIRED",    // Code machine pour les traitements automatiques
    constraint: "break_after_two_consecutive",        // Nom de la contrainte violée
    resourceType,                                     // "professeur" ou "groupe"
    resourceId,                                       // ID de la ressource (professeur ou groupe)
    date,                                             // Date de la violation
    message:
      "Apres 2 cours consecutifs, une pause d'au moins 1h est obligatoire avant un 3e cours.",
    details: {
      min_break_minutes: minBreakMinutes,             // Pause minimum requise (60 min)
      gap_minutes: gapMinutes,                        // Pause réellement disponible
      // Détails des 3 cours impliqués dans la violation
      first_placement: previousPlacement
        ? {
            date: previousPlacement.date,
            heure_debut: previousPlacement.heure_debut,
            heure_fin: previousPlacement.heure_fin,
            id_affectation_cours: Number(previousPlacement.id_affectation_cours || 0) || null,
          }
        : null,
      second_placement: consecutivePlacement
        ? {
            date: consecutivePlacement.date,
            heure_debut: consecutivePlacement.heure_debut,
            heure_fin: consecutivePlacement.heure_fin,
            id_affectation_cours: Number(consecutivePlacement.id_affectation_cours || 0) || null,
          }
        : null,
      blocked_placement: blockedPlacement             // Le 3e cours qui violerait la contrainte
        ? {
            date: blockedPlacement.date,
            heure_debut: blockedPlacement.heure_debut,
            heure_fin: blockedPlacement.heure_fin,
            id_affectation_cours: Number(blockedPlacement.id_affectation_cours || 0) || null,
          }
        : null,
    },
  };
}

/**
 * Trie une liste de placements par heure de début (puis heure de fin en cas d'égalité).
 *
 * Le tri est nécessaire pour analyser correctement les séquences de cours :
 * on doit parcourir les cours dans l'ordre chronologique pour détecter
 * les consécutivités.
 *
 * @param {object[]} placements - Liste de placements à trier
 * @returns {object[]} Liste normalisée et triée chronologiquement
 */
function sortPlacementsByStart(placements) {
  return [...(Array.isArray(placements) ? placements : [])]
    .map(normalizePlacement)
    .filter(Boolean) // Supprimer les placements invalides
    .sort((left, right) => {
      // Tri primaire : heure de début
      if (left._startMinutes !== right._startMinutes) {
        return left._startMinutes - right._startMinutes;
      }

      // Tri secondaire : heure de fin (pour différencier des cours de même début)
      if (left._endMinutes !== right._endMinutes) {
        return left._endMinutes - right._endMinutes;
      }

      // Tri tertiaire : ID d'affectation (pour la stabilité)
      return String(left.id_affectation_cours || "").localeCompare(
        String(right.id_affectation_cours || "")
      );
    });
}

/**
 * Valide la contrainte de pause pour un placement proposé.
 *
 * Algorithme :
 *  1. Normaliser et valider le placement proposé
 *  2. Fusionner avec les placements existants du même jour
 *  3. Trier chronologiquement
 *  4. Chercher des triplets où les deux premiers sont consécutifs
 *     mais la pause avant le troisième est insuffisante
 *
 * Un triplet viole la contrainte si :
 *  - placement[i].heure_fin == placement[i+1].heure_debut  (consécutifs)
 *  - pause entre placement[i+1].heure_fin et placement[i+2].heure_debut < 60 min
 *
 * @param {object} params
 * @param {object[]} params.placements - Placements existants de la ressource ce jour-là
 * @param {object} params.proposedPlacement - Le nouveau placement à valider
 * @param {string} params.resourceType - Type de ressource ("professeur", "groupe", "etudiant")
 * @param {*} params.resourceId - Identifiant de la ressource
 * @param {number} [params.minBreakMinutes=60] - Durée minimum de pause requise
 * @returns {{ valid: boolean, violations: object[] }} Résultat de validation
 */
function validateSequenceBreakConstraint({
  placements = [],
  proposedPlacement,
  resourceType,
  resourceId,
  minBreakMinutes = DEFAULT_MIN_BREAK_MINUTES,
}) {
  const candidate = normalizePlacement(proposedPlacement);

  if (!candidate) {
    // Le créneau proposé lui-même est invalide → violation immédiate
    return {
      valid: false,
      violations: [
        {
          code: "INVALID_TIME_RANGE",
          constraint: "break_after_two_consecutive",
          resourceType,
          resourceId,
          date: normalizeDate(proposedPlacement?.date),
          message: "Le creneau horaire cible est invalide.",
          details: {},
        },
      ],
    };
  }

  // Fusionner le placement proposé avec les existants, puis filtrer sur le même jour
  const normalizedPlacements = sortPlacementsByStart([
    ...placements,
    candidate,
  ]).filter((placement) => normalizeDate(placement.date) === candidate.date);

  const violations = [];

  // Analyser tous les triplets consécutifs dans la liste triée
  // On cherche : [A][B][C] où A finit quand B commence → pair consécutif
  // Si la pause entre B.fin et C.debut < minBreakMinutes → violation
  for (let index = 0; index <= normalizedPlacements.length - 3; index += 1) {
    const first = normalizedPlacements[index];
    const second = normalizedPlacements[index + 1];
    const third = normalizedPlacements[index + 2];

    // Vérifier si first et second sont vraiment consécutifs (fin = début du suivant)
    if (first._endMinutes !== second._startMinutes) {
      continue; // Pas consécutifs → pas de contrainte de pause applicable ici
    }

    // Calculer la pause entre le second cours et le troisième
    const gapMinutes = third._startMinutes - second._endMinutes;

    if (gapMinutes >= minBreakMinutes) {
      continue; // Pause suffisante → contrainte respectée
    }

    // Pause insuffisante après 2 cours consécutifs → violation !
    violations.push(
      buildViolation({
        resourceType,
        resourceId,
        date: candidate.date,
        gapMinutes,
        previousPlacement: first,
        consecutivePlacement: second,
        blockedPlacement: third,
        minBreakMinutes,
      })
    );
  }

  return {
    valid: violations.length === 0, // Aucune violation → placement valide
    violations,
  };
}

/**
 * Interface publique du module.
 * Expose uniquement la fonction principale de validation.
 */
export const BreakConstraintValidator = {
  validateSequenceBreakConstraint,
};
