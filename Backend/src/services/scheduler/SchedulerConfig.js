/**
 * Configuration du moteur de planification (Scheduler).
 *
 * Ce module centralise tous les paramètres configurables du scheduler académique.
 * Les valeurs par défaut sont définies ici et peuvent être surchargées via
 * des variables d'environnement dans le fichier .env du projet.
 *
 * Variables d'environnement supportées :
 *  - ENABLE_ONLINE_COURSES             → "true"/"1"/"yes"/"on" pour activer les cours en ligne
 *  - SCHEDULER_TARGET_GROUP_SIZE       → taille cible d'un groupe (ex: 26)
 *  - SCHEDULER_MAX_GROUP_CAPACITY      → capacité maximale d'un groupe (ex: 30)
 *  - SCHEDULER_MAX_GROUPS_PER_PROFESSOR → nombre max de groupes par professeur (ex: 16)
 *  - SCHEDULER_MAX_WEEKLY_SESSIONS_PER_PROFESSOR → sessions max par semaine (ex: 16)
 *
 * Pourquoi des variables d'environnement ?
 * La capacité des salles, la taille des groupes et les limites professeurs varient
 * selon le semestre, les locaux disponibles et les décisions pédagogiques.
 * Permettre la configuration sans toucher au code évite les déploiements risqués.
 *
 * @module services/scheduler/SchedulerConfig
 */

/**
 * Valeurs acceptées pour activer un flag booléen via variable d'environnement.
 * @type {Set<string>}
 */
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

/**
 * Taille cible d'un groupe d'étudiants.
 * Le scheduler essaie d'atteindre cette taille lors de la formation des groupes.
 * @type {number}
 */
const DEFAULT_TARGET_GROUP_SIZE = 26;

/**
 * Capacité maximale absolue d'un groupe.
 * Aucun groupe ne peut dépasser ce nombre d'étudiants.
 * @type {number}
 */
const DEFAULT_MAX_GROUP_CAPACITY = 30;

/**
 * Nombre maximal de groupes qu'un professeur peut enseigner dans une session.
 * @type {number}
 */
const DEFAULT_MAX_GROUPS_PER_PROFESSOR = 16;

/**
 * Nombre maximal de séances hebdomadaires pour un professeur.
 * Limite la charge de travail hebdomadaire maximale.
 * @type {number}
 */
const DEFAULT_MAX_WEEKLY_SESSIONS_PER_PROFESSOR = 16;

/**
 * Lit une variable d'environnement comme entier strictement positif.
 * Si la valeur est manquante ou invalide, retourne le fallback.
 *
 * @param {*} rawValue - La valeur brute de la variable d'environnement
 * @param {number} fallback - La valeur par défaut à utiliser si rawValue est invalide
 * @returns {number} L'entier positif résolu
 */
function readPositiveInteger(rawValue, fallback) {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Vérifie si la planification des cours en ligne est activée.
 *
 * Par défaut, les cours marqués `est_en_ligne = 1` sont exclus de la planification
 * (ils n'ont pas besoin de salle physique). Ce comportement peut être désactivé
 * pour les tests ou les configurations spéciales via ENABLE_ONLINE_COURSES.
 *
 * @returns {boolean} true si ENABLE_ONLINE_COURSES est défini à une valeur "vraie"
 */
export function isOnlineCourseSchedulingEnabled() {
  const brute = String(process.env.ENABLE_ONLINE_COURSES || "").trim().toLowerCase();
  if (!brute) {
    return false; // Non défini → comportement par défaut : cours en ligne exclus
  }

  return TRUE_VALUES.has(brute);
}

/**
 * Détermine si un cours donné peut être planifié par le moteur.
 *
 * Règle : les cours en ligne sont exclus sauf si ENABLE_ONLINE_COURSES est activé.
 * Cela permet d'inclure les cours en ligne dans les tests sans supprimer la logique
 * de filtrage pour la production.
 *
 * @param {object|null} cours - L'objet cours à évaluer
 * @param {number|string} [cours.est_en_ligne] - 1 si le cours est en ligne
 * @returns {boolean} true si ce cours doit être planifié
 */
export function isCourseSchedulable(cours) {
  if (isOnlineCourseSchedulingEnabled()) {
    return true; // Mode test : tous les cours sont planifiables
  }

  // Un cours avec est_en_ligne = 1 est exclu de la planification physique
  return !Boolean(Number(cours?.est_en_ligne || 0));
}

/**
 * Retourne la taille cible d'un groupe d'étudiants.
 *
 * Configurable via SCHEDULER_TARGET_GROUP_SIZE.
 * Utilisée lors de la formation des groupes cohort pour équilibrer les effectifs.
 *
 * @returns {number} La taille cible (ex: 26)
 */
export function getSchedulerTargetGroupSize() {
  return readPositiveInteger(
    process.env.SCHEDULER_TARGET_GROUP_SIZE,
    DEFAULT_TARGET_GROUP_SIZE
  );
}

/**
 * Retourne la capacité maximale d'un groupe.
 *
 * Configurable via SCHEDULER_MAX_GROUP_CAPACITY.
 * Garantit toujours d'être >= getSchedulerTargetGroupSize() pour rester cohérent :
 * un groupe ne peut pas avoir une capacité max inférieure à sa taille cible.
 *
 * @returns {number} La capacité maximale (toujours >= taille cible)
 */
export function getSchedulerMaxGroupCapacity() {
  const configuredMax = readPositiveInteger(
    process.env.SCHEDULER_MAX_GROUP_CAPACITY,
    DEFAULT_MAX_GROUP_CAPACITY
  );

  // Invariant : capacité max >= taille cible (protection contre les configs incohérentes)
  return Math.max(configuredMax, getSchedulerTargetGroupSize());
}

/**
 * Retourne la capacité opérationnelle d'un cours.
 *
 * Dans la version actuelle, c'est un alias de getSchedulerMaxGroupCapacity().
 * Une future version pourrait différencier la capacité opérationnelle de la capacité max.
 *
 * @returns {number} La capacité opérationnelle d'un cours
 */
export function resolveOperationalCourseCapacity() {
  return getSchedulerMaxGroupCapacity();
}

/**
 * Retourne le nombre maximal de groupes qu'un professeur peut enseigner.
 *
 * Configurable via SCHEDULER_MAX_GROUPS_PER_PROFESSOR.
 * Limite la charge de travail totale d'un professeur sur l'ensemble d'une session.
 *
 * @returns {number} Le nombre max de groupes par professeur
 */
export function getSchedulerMaxGroupsPerProfessor() {
  return readPositiveInteger(
    process.env.SCHEDULER_MAX_GROUPS_PER_PROFESSOR,
    DEFAULT_MAX_GROUPS_PER_PROFESSOR
  );
}

/**
 * Retourne le nombre maximal de séances hebdomadaires pour un professeur.
 *
 * Configurable via SCHEDULER_MAX_WEEKLY_SESSIONS_PER_PROFESSOR.
 * Évite de surcharger un professeur sur une semaine donnée.
 *
 * @returns {number} Le nombre max de séances par semaine par professeur
 */
export function getSchedulerMaxWeeklySessionsPerProfessor() {
  return readPositiveInteger(
    process.env.SCHEDULER_MAX_WEEKLY_SESSIONS_PER_PROFESSOR,
    DEFAULT_MAX_WEEKLY_SESSIONS_PER_PROFESSOR
  );
}
