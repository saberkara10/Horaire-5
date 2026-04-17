/**
 * Trieur de cours par contrainte croissante (Most-Constrained-First).
 *
 * Ce module implémente une heuristique classique de résolution de contraintes :
 * planifier en premier les cours les plus difficiles à placer.
 *
 * Philosophie de l'algorithme :
 * Un cours "difficile" est un cours avec peu d'options disponibles.
 * Si on le planifie trop tard, il se peut qu'il n'y ait plus aucun créneau libre.
 * En le planifiant en premier, on lui donne la priorité sur les ressources encore disponibles.
 *
 * Critères de priorité (du plus important au moins important) :
 *  1. Nombre de créneaux horaires disponibles (le moins = le plus prioritaire)
 *  2. Nombre de professeurs compatibles (le moins = le plus prioritaire)
 *  3. Nombre de salles compatibles (le moins = le plus prioritaire)
 *  4. Durée du cours (le plus long = le plus prioritaire, car plus difficile à caser)
 *  5. Cours "clé" (marqué comme prioritaire par la logique métier)
 *  6. Clé alphanumérique du cours (pour un tri déterministe en cas d'égalité totale)
 *
 * @module services/scheduler/optimization/CoursePrioritySorter
 */
import {
  buildCourseTimeCandidates,
  resolveCourseDurationHours,
  resolveCourseKey,
} from "./CandidatePrecomputer.js";

/**
 * Retourne la longueur d'un tableau, ou null si ce n'est pas un tableau.
 *
 * @param {*} value - La valeur à vérifier
 * @returns {number|null} La longueur ou null
 */
function countList(value) {
  return Array.isArray(value) ? value.length : null;
}

/**
 * Lit une valeur dans un objet Map-like (Map native ou objet JavaScript).
 *
 * Les données du scheduler sont souvent stockées dans des Maps pour la performance,
 * mais parfois dans des objets classiques pour la sérialisation.
 * Cette fonction abstrait la différence.
 *
 * @param {Map|object|null} mapLike - Le conteneur (Map ou objet)
 * @param {*} key - La clé à chercher
 * @returns {*} La valeur, ou undefined si non trouvée
 */
function readMapLikeValue(mapLike, key) {
  if (!mapLike || !key) {
    return undefined;
  }

  if (mapLike instanceof Map) {
    return mapLike.get(key);
  }

  return mapLike[key];
}

/**
 * Normalise un compteur vers un nombre positif.
 *
 * Si la valeur est un tableau, on utilise sa longueur.
 * Si c'est un nombre fini positif, on l'utilise directement.
 * Sinon, on retourne MAX_SAFE_INTEGER (= "pas de contrainte" → priorité la plus basse).
 *
 * Le MAX_SAFE_INTEGER pour les valeurs inconnues garantit que les cours sans
 * information de ressources ne bloquent pas les cours dont on sait qu'ils sont contraints.
 *
 * @param {*} value - La valeur à normaliser (tableau, nombre ou autre)
 * @returns {number} Le compteur normalisé
 */
function normalizeCount(value) {
  if (Array.isArray(value)) {
    return value.length;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : Number.MAX_SAFE_INTEGER; // Inconnu → traité comme "aucune contrainte"
}

/**
 * Résout le nombre de créneaux horaires disponibles pour un cours.
 *
 * Cherche dans plusieurs sources par ordre de priorité :
 *  1. Callback personnalisé options.resolveCandidateCount(course, courseKey)
 *  2. options.candidateMap → Map pré-calculée par le scheduler
 *  3. options.candidateCountMap → Map de compteurs pré-calculés
 *  4. course.timeCandidates → candidats déjà attachés à l'objet cours
 *  5. course.candidatsHoraires → version française du même champ
 *  6. course.time_candidates → version snake_case
 *  7. Calcul à la volée via buildCourseTimeCandidates (plus lent)
 *
 * @param {object} course - Le cours dont on résout le nombre de candidats
 * @param {string} courseKey - La clé du cours
 * @param {object} [options={}] - Options avec les maps et callbacks
 * @returns {number} Nombre de candidats, ou MAX_SAFE_INTEGER si inconnu
 */
function resolveCandidateCount(course, courseKey, options = {}) {
  // Callback externe : permet au scheduler de brancher sa propre logique
  if (typeof options.resolveCandidateCount === "function") {
    return normalizeCount(options.resolveCandidateCount(course, courseKey));
  }

  // Chercher dans les sources disponibles (par ordre de performance)
  const candidateSource =
    readMapLikeValue(options.candidateMap, courseKey) ??        // Map pré-calculée complète
    readMapLikeValue(options.candidateCountMap, courseKey) ??   // Map de compteurs
    course?.timeCandidates ??
    course?.candidatsHoraires ??
    course?.time_candidates ??
    buildCourseTimeCandidates(course, options.candidateOptions);   // Calcul de dernier recours

  return normalizeCount(candidateSource);
}

/**
 * Résout le nombre de professeurs compatibles pour un cours.
 *
 * Cherche dans plusieurs champs possibles (camelCase, snake_case, anglophone)
 * pour absorber les différences de nomenclature entre les imports et les APIs.
 *
 * @param {object} course - Le cours
 * @param {string} courseKey - La clé du cours
 * @param {object} [options={}] - Options avec maps et callbacks
 * @returns {number} Nombre de professeurs compatibles, ou MAX_SAFE_INTEGER si inconnu
 */
function resolveCompatibleProfessorCount(course, courseKey, options = {}) {
  if (typeof options.resolveCompatibleProfessorCount === "function") {
    return normalizeCount(
      options.resolveCompatibleProfessorCount(course, courseKey)
    );
  }

  const professorSource =
    readMapLikeValue(options.professorCountMap, courseKey) ??
    readMapLikeValue(options.compatibleProfessorMap, courseKey) ??
    countList(course?.professeursCompatibles) ??     // Format BDD français
    countList(course?.compatibleProfessors) ??       // Format anglophone camelCase
    countList(course?.compatibleProfessorIds) ??     // Liste d'IDs
    countList(course?.professeurs_compatibles) ??    // Format snake_case
    countList(course?.professorIds);                 // IDs anglophone

  return normalizeCount(professorSource);
}

/**
 * Résout le nombre de salles compatibles pour un cours.
 *
 * Même logique que resolveCompatibleProfessorCount mais pour les salles.
 *
 * @param {object} course - Le cours
 * @param {string} courseKey - La clé du cours
 * @param {object} [options={}] - Options avec maps et callbacks
 * @returns {number} Nombre de salles compatibles, ou MAX_SAFE_INTEGER si inconnu
 */
function resolveCompatibleRoomCount(course, courseKey, options = {}) {
  if (typeof options.resolveCompatibleRoomCount === "function") {
    return normalizeCount(options.resolveCompatibleRoomCount(course, courseKey));
  }

  const roomSource =
    readMapLikeValue(options.roomCountMap, courseKey) ??
    readMapLikeValue(options.compatibleRoomMap, courseKey) ??
    countList(course?.sallesCompatibles) ??         // Format BDD français
    countList(course?.compatibleRooms) ??           // Format anglophone
    countList(course?.compatibleRoomIds) ??         // Liste d'IDs
    countList(course?.salles_compatibles) ??        // Format snake_case
    countList(course?.roomIds);                     // IDs anglophone

  return normalizeCount(roomSource);
}

/**
 * Détermine si un cours est marqué comme "cours-clé" (priorité métier).
 *
 * Un cours-clé est un cours qui, selon les règles académiques, doit être planifié
 * en priorité absolue (ex: cours de synthèse, examens, cours fondamentaux).
 *
 * Accepte plusieurs champs pour la compatibilité :
 *  - est_cours_cle  (snake_case français)
 *  - isKeyCourse    (camelCase anglophone)
 *  - coursCle       (camelCase français)
 *  - key_course     (snake_case anglophone)
 *
 * @param {object|null} course - Le cours à vérifier
 * @returns {boolean} true si le cours est marqué comme prioritaire
 */
function isKeyCourse(course) {
  return Boolean(
    course?.est_cours_cle ??
      course?.isKeyCourse ??
      course?.coursCle ??
      course?.key_course
  );
}

/**
 * Calcule la structure de priorité complète d'un cours.
 *
 * Cette structure est créée une fois par cours avant le tri. Elle contient
 * tous les métriques nécessaires à la comparaison, évitant d'appeler les
 * fonctions de résolution à chaque comparaison (optimisation du tri).
 *
 * @param {object} course - Le cours à analyser
 * @param {object} [options={}] - Options avec maps de ressources pré-calculées
 * @param {number} [options.fallbackIndex] - Index dans la liste (pour la clé fallback)
 * @returns {{
 *   course: object,
 *   courseKey: string,
 *   durationHours: number,
 *   candidateCount: number,
 *   compatibleProfessorCount: number,
 *   compatibleRoomCount: number,
 *   isKeyCourse: boolean
 * }} La structure de priorité du cours
 */
export function buildCoursePriority(course, options = {}) {
  const courseKey = resolveCourseKey(course, options.fallbackIndex);
  const durationHours = resolveCourseDurationHours(
    course,
    options.fallbackDurationHours
  );
  const candidateCount = resolveCandidateCount(course, courseKey, options);
  const compatibleProfessorCount = resolveCompatibleProfessorCount(
    course,
    courseKey,
    options
  );
  const compatibleRoomCount = resolveCompatibleRoomCount(
    course,
    courseKey,
    options
  );

  return {
    course,
    courseKey,
    durationHours,
    candidateCount,          // Moins il y en a → plus prioritaire
    compatibleProfessorCount, // Moins il y en a → plus prioritaire
    compatibleRoomCount,     // Moins il y en a → plus prioritaire
    isKeyCourse: isKeyCourse(course),
  };
}

/**
 * Compare deux structures de priorité pour le tri.
 *
 * Retourne un nombre négatif si `leftPriority` doit passer avant `rightPriority`.
 * (Convention du comparateur JavaScript Array.sort())
 *
 * Ordre de comparaison (du plus discriminant au moins discriminant) :
 *  1. Candidats horaires (ASC — moins de créneaux = prioritaire)
 *  2. Professeurs compatibles (ASC)
 *  3. Salles compatibles (ASC)
 *  4. Durée du cours (DESC — cours plus long = prioritaire)
 *  5. Cours-clé (true avant false)
 *  6. Ordre alphabétique de la clé (pour un tri stable et déterministe)
 *
 * @param {ReturnType<typeof buildCoursePriority>} leftPriority - Premier cours
 * @param {ReturnType<typeof buildCoursePriority>} rightPriority - Second cours
 * @returns {number} Négatif si left avant right, positif si right avant left
 */
export function compareCoursePriority(leftPriority, rightPriority) {
  // Critère 1 : moins de créneaux → plus contraint → en premier
  if (leftPriority.candidateCount !== rightPriority.candidateCount) {
    return leftPriority.candidateCount - rightPriority.candidateCount;
  }

  // Critère 2 : moins de professeurs → plus contraint → en premier
  if (
    leftPriority.compatibleProfessorCount !==
    rightPriority.compatibleProfessorCount
  ) {
    return (
      leftPriority.compatibleProfessorCount -
      rightPriority.compatibleProfessorCount
    );
  }

  // Critère 3 : moins de salles → plus contraint → en premier
  if (leftPriority.compatibleRoomCount !== rightPriority.compatibleRoomCount) {
    return leftPriority.compatibleRoomCount - rightPriority.compatibleRoomCount;
  }

  // Critère 4 : cours plus long en premier (plus difficile à caser)
  if (leftPriority.durationHours !== rightPriority.durationHours) {
    return rightPriority.durationHours - leftPriority.durationHours; // DESC → d'où l'inversion
  }

  // Critère 5 : cours-clé en priorité sur les cours ordinaires
  if (leftPriority.isKeyCourse !== rightPriority.isKeyCourse) {
    return Number(rightPriority.isKeyCourse) - Number(leftPriority.isKeyCourse);
  }

  // Critère 6 : tri alphabétique pour un résultat déterministe (reproductible)
  return leftPriority.courseKey.localeCompare(rightPriority.courseKey, "fr");
}

/**
 * Trie une liste de cours en mettant les plus contraints en premier.
 *
 * C'est la fonction principale de ce module, utilisée par le SchedulerEngine
 * avant de commencer la phase d'affectation.
 *
 * L'algo Most-Constrained-First est prouvé efficace pour les problèmes de
 * satisfaction de contraintes (CSP). En planifiant les cours difficiles en premier,
 * on maximise la probabilité de trouver une solution complète.
 *
 * @param {object[]|Iterable} courses - La liste des cours à trier
 * @param {object} [options={}] - Options avec maps de ressources et callbacks
 * @returns {object[]} Nouvelle liste de cours triée, les plus contraints en premier
 */
export function sortCoursesMostConstrainedFirst(courses, options = {}) {
  const courseList = Array.isArray(courses) ? courses : Array.from(courses || []);

  return courseList
    .map((course, index) =>
      // Étape 1 : calculer la priorité de chaque cours (une seule fois)
      buildCoursePriority(course, {
        ...options,
        fallbackIndex: index,
      })
    )
    .sort(compareCoursePriority) // Étape 2 : trier par contrainte croissante
    .map((priority) => priority.course); // Étape 3 : retirer l'objet priorité, ne garder que le cours
}

/**
 * Objet façade exposant les fonctions publiques du module.
 */
export const CoursePrioritySorter = {
  buildCoursePriority,
  compareCoursePriority,
  sortCoursesMostConstrainedFirst,
};
