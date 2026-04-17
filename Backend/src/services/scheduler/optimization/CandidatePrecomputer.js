/**
 * Pré-calculateur de candidats horaires pour les cours.
 *
 * Ce module est responsable de deux choses essentielles pour la performance du scheduler :
 *
 *  1. Résolution de la clé unique d'un cours (resolveCourseKey) :
 *     Chaque cours doit avoir une clé stable pour l'indexer dans les Maps et LogSet.
 *     Le schéma BDD peut varier selon l'origine des données (import, création manuelle...),
 *     donc on cherche la clé dans plusieurs champs possibles par ordre de priorité.
 *
 *  2. Pré-calcul de la liste de candidats horaires (buildCourseTimeCandidateMap) :
 *     Avant de lancer le moteur de planification, on calcule pour chaque cours
 *     TOUS les créneaux horaires où il pourrait commencer dans la journée académique.
 *     Ce pré-calcul est mis en cache par durée pour éviter de le refaire.
 *
 * Pourquoi un cache par durée ?
 * Si 50 cours ont tous une durée de 2h, ils ont tous les mêmes créneaux de départ possibles.
 * On ne calcule buildStartTimeCandidates(2h) qu'une seule fois et on réutilise la liste.
 *
 * @module services/scheduler/optimization/CandidatePrecomputer
 */
import { DEFAULT_COURSE_DURATION_HOURS } from "../AcademicCatalog.js";
import { buildStartTimeCandidates } from "../time/StartTimeCandidates.js";

/**
 * Noms de champs acceptés pour lire la durée d'un cours.
 *
 * Le schéma BDD a évolué au fil du temps et certains cours peuvent avoir leur
 * durée dans des champs différents selon leur origine (import, création via API...).
 * Cette liste est parcourue dans l'ordre jusqu'à trouver une valeur valide.
 *
 * @type {string[]}
 */
const COURSE_DURATION_FIELD_CANDIDATES = [
  "dureeHeures",           // Format interne camelCase
  "duree_heures",          // Format snake_case
  "durationHours",         // Format anglophone camelCase
  "duration_hours",        // Format anglophone snake_case
  "sessionDurationHours",  // Variante session
  "session_duration_hours",
  "cours_duree",           // Champ legacy BDD v1
  "duree",                 // Champ générique (peut être en minutes ou en heures)
  "duration",              // Format anglophone générique
];

/**
 * Normalise une valeur en entier strictement positif.
 * Retourne null si la valeur n'est pas un entier positif fini.
 *
 * @param {*} value - La valeur à normaliser
 * @returns {number|null} L'entier positif, ou null si invalide
 */
function normalizePositiveInteger(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  if (Number.isInteger(numericValue)) {
    return numericValue;
  }

  return null; // Les durées flottantes ne font pas sens pour des créneaux
}

/**
 * Normalise une valeur vers une durée en heures.
 *
 * Gère deux représentations possibles dans les données :
 *  - Durée directe en heures (ex: 2 → 2 heures)
 *  - Durée en minutes multiple de 60 (ex: 120 → 2 heures)
 *
 * Cas particulier : une valeur de 120 pourrait être 120 heures ou 120 minutes.
 * On choisit de traiter sans ambiguïté : si la valeur est ≥ 60 ET divisible par 60,
 * on interprète comme des minutes. Sinon, si c'est un entier ≤ 14h, on prend comme heures.
 *
 * @param {*} value - La valeur brute de la durée
 * @returns {number|null} La durée en heures, ou null si non interprétable
 */
function normalizeDurationHours(value) {
  const directHours = normalizePositiveInteger(value);

  // Cas 1 : c'est déjà des heures valides (1 à 14 heures max dans une journée)
  if (directHours && directHours <= 14) {
    return directHours;
  }

  // Cas 2 : c'est peut-être des minutes (ex: 120 minutes = 2 heures)
  const numericValue = Number(value);
  if (
    Number.isFinite(numericValue) &&
    numericValue >= 60 &&          // Minimum 60 minutes = 1 heure
    numericValue % 60 === 0       // Doit être un multiple exact de 60
  ) {
    return numericValue / 60; // Convertir en heures
  }

  // Cas 3 : retomber sur la valeur directe si un entier > 14 mais valide
  if (directHours) {
    return directHours;
  }

  return null; // Rien ne colle
}

/**
 * Clone superficiellement un objet candidat pour éviter les mutations accidentelles.
 *
 * Le scheduler modifie parfois les candidats pendant la recherche. On clone
 * pour s'assurer que le cache reste intact.
 *
 * @param {object} candidate - Le candidat à cloner
 * @returns {object} Une copie superficielle du candidat
 */
function cloneCandidate(candidate) {
  return {
    ...candidate,
  };
}

/**
 * Construit la clé de cache pour un ensemble durée + options de journée.
 *
 * Deux courses de même durée dans les mêmes conditions de journée auront
 * le même jeu de candidats → même clé de cache → calcul partagé.
 *
 * @param {number} durationHours - Durée du cours en heures
 * @param {object} [options={}] - Options de journée (dayStartTime, dayEndTime, slotDurationMinutes)
 * @returns {string} Clé de cache unique pour cette combinaison
 */
function buildDurationCacheKey(durationHours, options = {}) {
  return [
    Number(durationHours),
    String(options.dayStartTime ?? ""),
    String(options.dayEndTime ?? ""),
    String(options.slotDurationMinutes ?? ""),
  ].join("|"); // Ex: "2|08:00:00|22:00:00|60"
}

/**
 * Résout la clé unique d'un cours, en cherchant dans plusieurs champs possibles.
 *
 * Ordre de priorité pour construire la clé :
 *  1. course.courseKey (déjà calculée précédemment)
 *  2. id_affectation_cours (clé primaire table affectation_cours)
 *  3. id_cours (clé primaire table cours)
 *  4. id (générique)
 *  5. code + groupe (combinaison unique suffisante)
 *  6. code seul
 *  7. nom (dernier recours)
 *  8. index dans la liste (fallback positionnel)
 *  9. "course:unknown" (cas désespéré)
 *
 * @param {object|null} course - L'objet cours dont on cherche la clé
 * @param {number|null} [fallbackIndex=null] - Position dans la liste (fallback)
 * @returns {string} La clé unique du cours
 */
export function resolveCourseKey(course, fallbackIndex = null) {
  // Cas 1 : la clé est déjà calculée et stockée dans le cours
  if (course && String(course.courseKey || "").trim()) {
    return String(course.courseKey).trim();
  }

  // Cas 2-4 : chercher un ID dans les champs connus
  const idFields = [
    ["affectation", course?.id_affectation_cours],  // Lien vers une affectation planifiée
    ["course", course?.id_cours],                    // ID de la matière
    ["id", course?.id],                              // ID générique
  ];

  for (const [prefix, rawValue] of idFields) {
    const normalized = String(rawValue ?? "").trim();
    if (normalized) {
      return `${prefix}:${normalized}`; // Ex: "affectation:42", "course:7"
    }
  }

  // Cas 5 : combiner code et groupe pour une clé composite
  const code = String(course?.code || "").trim();
  const groupeId = String(
    course?.id_groupe ?? course?.groupId ?? course?.id_groupe_etudiants ?? ""
  ).trim();

  if (code && groupeId) {
    return `code:${code}|groupe:${groupeId}`;
  }

  // Cas 6 : code seul (peut ne pas être unique si le même cours est dans plusieurs groupes)
  if (code) {
    return `code:${code}`;
  }

  // Cas 7 : nom du cours (encore moins fiable mais dernier recours textuel)
  const nom = String(course?.nom || course?.name || "").trim();
  if (nom) {
    return `name:${nom}`;
  }

  // Cas 8 : position dans la liste (fallback positionnel, stable pendant l'exécution)
  if (Number.isInteger(Number(fallbackIndex)) && Number(fallbackIndex) >= 0) {
    return `index:${Number(fallbackIndex)}`;
  }

  return "course:unknown"; // Cas impossible en pratique si les données sont valides
}

/**
 * Résout la durée d'un cours en heures, en cherchant dans plusieurs champs possibles.
 *
 * Parcourt COURSE_DURATION_FIELD_CANDIDATES dans l'ordre et retourne la première
 * valeur valide trouvée. Si aucun champ ne donne une durée valide, utilise
 * `fallbackDurationHours` puis `DEFAULT_COURSE_DURATION_HOURS`.
 *
 * @param {object|null} course - L'objet cours dont on cherche la durée
 * @param {number} [fallbackDurationHours=DEFAULT_COURSE_DURATION_HOURS] - Durée par défaut
 * @returns {number} La durée du cours en heures (jamais 0)
 */
export function resolveCourseDurationHours(
  course,
  fallbackDurationHours = DEFAULT_COURSE_DURATION_HOURS
) {
  // Chercher la durée dans tous les champs candidats
  for (const fieldName of COURSE_DURATION_FIELD_CANDIDATES) {
    const durationHours = normalizeDurationHours(course?.[fieldName]);
    if (durationHours) {
      return durationHours;
    }
  }

  // Aucun champ trouvé → utiliser le fallback fourni ou la constante par défaut
  return (
    normalizeDurationHours(fallbackDurationHours) ??
    DEFAULT_COURSE_DURATION_HOURS
  );
}

/**
 * Construit tous les créneaux de départ valides pour un cours donné.
 *
 * Combine resolveCourseKey() et resolveCourseDurationHours() pour identifier
 * le cours, puis délègue à buildStartTimeCandidates() pour générer les candidats.
 *
 * Chaque candidat retourné est enrichi avec :
 *  - `courseKey` : la clé du cours
 *  - `candidateKey` : clé unique du candidat (courseKey + position dans la grille)
 *  - `index` : position dans le tableau de candidats
 *
 * @param {object} course - L'objet cours
 * @param {object} [options={}] - Options de configuration
 * @param {number} [options.fallbackDurationHours] - Durée par défaut si non trouvée
 * @param {number} [options.fallbackIndex] - Index de fallback pour la clé
 * @returns {object[]} Liste des candidats horaires pour ce cours
 */
export function buildCourseTimeCandidates(course, options = {}) {
  const durationHours = resolveCourseDurationHours(
    course,
    options.fallbackDurationHours
  );

  if (!durationHours) {
    return []; // Durée invalide → impossible de générer des candidats
  }

  const courseKey = resolveCourseKey(course, options.fallbackIndex);
  const candidates = buildStartTimeCandidates(durationHours, options);

  // Enrichir chaque candidat avec les identifiants du cours
  return candidates.map((candidate, index) => ({
    ...cloneCandidate(candidate),
    courseKey,
    // candidateKey = identifiant unique de ce candidat : "course|slotStart|slotEnd"
    candidateKey: `${courseKey}|${candidate.slotStartIndex}|${candidate.slotEndIndex}`,
    index,
  }));
}

/**
 * Construit une Map de tous les candidats horaires pour une liste de cours.
 *
 * C'est la fonction principale utilisée par le scheduler au démarrage.
 * Elle génère tous les candidats pour tous les cours et les met en cache.
 *
 * Optimisation via cache des durées :
 * Si plusieurs cours ont la même durée et les mêmes options de journée,
 * les candidats ne sont calculés qu'une seule fois via `durationCache`.
 *
 * Gestion des clés en double :
 * Si deux cours ont la même clé calculée, on ajoute "#index" pour les différencier.
 *
 * @param {object[]|Iterable} courses - La liste ou collection des cours
 * @param {object} [options={}] - Options de configuration
 * @param {Map} [options.durationCache] - Cache externe des durées (pour partager entre appels)
 * @param {number} [options.fallbackDurationHours] - Durée par défaut
 * @returns {Map<string, object[]>} Map courseKey → liste de candidats horaires
 */
export function buildCourseTimeCandidateMap(courses, options = {}) {
  const candidateMap = new Map();

  // Utiliser le cache fourni ou en créer un nouveau (local à cet appel)
  const durationCache =
    options.durationCache instanceof Map ? options.durationCache : new Map();

  const courseList = Array.isArray(courses) ? courses : Array.from(courses || []);

  courseList.forEach((course, index) => {
    const durationHours = resolveCourseDurationHours(
      course,
      options.fallbackDurationHours
    );

    // Clé de cache basée sur durée + configuration de journée
    const durationCacheKey = buildDurationCacheKey(durationHours, options);
    let cachedCandidates = durationCache.get(durationCacheKey);

    if (!cachedCandidates) {
      // Premier cours avec cette durée → calculer et mettre en cache
      cachedCandidates = buildCourseTimeCandidates(course, {
        ...options,
        fallbackIndex: index,
      }).map(cloneCandidate); // Cloner pour protéger le cache des mutations

      durationCache.set(durationCacheKey, cachedCandidates);
    }

    // Résoudre la clé du cours (peut être identique pour des cours différents dans des cas edge)
    let courseKey = resolveCourseKey(course, index);

    if (candidateMap.has(courseKey)) {
      // Collision de clé → ajouter le numéro d'index pour garantir l'unicité
      courseKey = `${courseKey}#${index}`;
    }

    // Personnaliser les candidats avec la clé spécifique à CE cours
    candidateMap.set(
      courseKey,
      cachedCandidates.map((candidate) => ({
        ...cloneCandidate(candidate),
        courseKey,
        candidateKey: `${courseKey}|${candidate.slotStartIndex}|${candidate.slotEndIndex}`,
      }))
    );
  });

  return candidateMap;
}

/**
 * Objet façade exposant les fonctions publiques du module.
 * Permet l'import destructuré ou l'utilisation en tant qu'objet.
 */
export const CandidatePrecomputer = {
  resolveCourseDurationHours,
  buildCourseTimeCandidates,
  buildCourseTimeCandidateMap,
  resolveCourseKey,
};
