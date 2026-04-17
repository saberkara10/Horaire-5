/**
 * Utilitaires pour le calcul et la répartition des groupes d'étudiants.
 *
 * Ce module répond à un problème concret : comment former des groupes équilibrés
 * à partir d'un effectif total, en respectant la capacité maximale des salles
 * disponibles pour les cours de la cohorte ?
 *
 * Exemple :
 *  - 75 étudiants, salles max 30 → 3 groupes de [25, 25, 25]
 *  - 73 étudiants, salles max 30 → 3 groupes de [25, 24, 24]
 *
 * @module utils/groupes
 */

/**
 * Taille maximale par défaut d'un groupe si aucune contrainte de salle
 * ne peut être calculée. Valeur raisonnable pour un cours en classe ordinaire.
 *
 * @type {number}
 */
export const TAILLE_MAX_GROUPE_PAR_DEFAUT = 30;

/**
 * Normalise un texte pour la comparaison sans sensibilité à la casse ou aux accents.
 *
 * @param {*} texte - Valeur à normaliser
 * @returns {string} Texte en minuscules, sans accents, sans espaces superflus
 */
function normaliserTexte(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Vérifie qu'une valeur de capacité est utilisable (nombre positif fini).
 *
 * @param {*} capacite - La valeur à vérifier
 * @returns {boolean} true si c'est un nombre positif et fini
 */
function valeurCapaciteValide(capacite) {
  const valeur = Number(capacite);
  return Number.isFinite(valeur) && valeur > 0;
}

/**
 * Filtre les salles compatibles avec les exigences de type d'un cours.
 *
 * Chaque cours a un type de salle requis (ex: "Laboratoire", "Classe").
 * On retourne uniquement les salles dont le type correspond.
 * La comparaison est insensible à la casse et aux accents.
 *
 * @param {object} cours - Le cours avec sa propriété `type_salle`
 * @param {object[]} salles - La liste complète des salles disponibles
 * @returns {object[]} Les salles dont le type correspond au cours
 */
export function recupererSallesCompatiblesPourCours(cours, salles = []) {
  const typeSalleCours = normaliserTexte(cours?.type_salle);

  // Si le cours ne spécifie pas de type de salle → aucune salle compatible
  if (!typeSalleCours) {
    return [];
  }

  return salles.filter(
    (salle) => normaliserTexte(salle?.type) === typeSalleCours
  );
}

/**
 * Détermine la capacité maximale utilisable pour un groupe d'une cohorte.
 *
 * On cherche la contrainte la plus restrictive :
 *  - Pour chaque cours de la cohorte, on trouve la salle compatible la plus grande.
 *  - On prend le minimum de toutes ces "meilleures salles" par cours.
 *  - Si aucune salle n'est trouvée pour un cours, ce cours est ignoré.
 *  - On applique ensuite la borne supérieure `capaciteParDefaut`.
 *
 * Cette approche garantit que le groupe peut être placé dans une salle
 * pour CHACUN de ses cours.
 *
 * @param {object[]} coursCohorte - Les cours de la cohorte
 * @param {object[]} salles - Toutes les salles disponibles
 * @param {number} [capaciteParDefaut=30] - Capacité max si aucune salle trouvée
 * @returns {number} La capacité maximale réaliste pour un groupe de cette cohorte
 */
export function determinerCapaciteMaximaleGroupeCohorte(
  coursCohorte = [],
  salles = [],
  capaciteParDefaut = TAILLE_MAX_GROUPE_PAR_DEFAUT
) {
  // Valider et normaliser la valeur par défaut
  const capaciteMaximaleParDefaut = valeurCapaciteValide(capaciteParDefaut)
    ? Number(capaciteParDefaut)
    : TAILLE_MAX_GROUPE_PAR_DEFAUT;

  // Pour chaque cours : trouver la capacité max parmi les salles compatibles
  const capacitesParCours = coursCohorte
    .map((cours) =>
      recupererSallesCompatiblesPourCours(cours, salles)
        .map((salle) => Number(salle.capacite))
        .filter(valeurCapaciteValide)
    )
    .filter((capacites) => capacites.length > 0) // ignorer les cours sans salle compatible
    .map((capacites) => Math.max(...capacites));  // meilleure salle pour ce cours

  // Si aucun cours n'a de salle → on retourne la valeur par défaut
  if (capacitesParCours.length === 0) {
    return capaciteMaximaleParDefaut;
  }

  // La contrainte la plus restrictive = le minimum des "meilleures salles"
  // On borne aussi par capaciteMaximaleParDefaut et on garantit au moins 1
  return Math.max(
    1,
    Math.min(capaciteMaximaleParDefaut, ...capacitesParCours)
  );
}

/**
 * Calcule les tailles de groupes équilibrées pour un effectif donné.
 *
 * Divise l'effectif en groupes de taille aussi égale que possible,
 * en respectant la capacité maximale par groupe.
 *
 * Exemple :
 *  - 73 étudiants, capacité max 30 → 3 groupes → [25, 24, 24]
 *    (le reste de 73 ÷ 3 = 1, donc le premier groupe a +1)
 *  - 60 étudiants, capacité max 30 → 2 groupes → [30, 30]
 *
 * @param {number} effectifTotal - Le nombre total d'étudiants à répartir
 * @param {number} [capaciteMaximale=30] - La taille maximale d'un groupe
 * @returns {number[]} Un tableau avec la taille de chaque groupe (trié croissant)
 */
export function calculerTaillesGroupesEquilibres(
  effectifTotal,
  capaciteMaximale = TAILLE_MAX_GROUPE_PAR_DEFAUT
) {
  const effectif = Number(effectifTotal);

  // Refuser un effectif invalide ou nul
  if (!Number.isFinite(effectif) || effectif <= 0) {
    return [];
  }

  const capacite = valeurCapaciteValide(capaciteMaximale)
    ? Number(capaciteMaximale)
    : TAILLE_MAX_GROUPE_PAR_DEFAUT;

  // Nombre de groupes minimum pour respecter la capacité maximale
  const nombreGroupes = Math.max(1, Math.ceil(effectif / capacite));

  // Division entière → taille de base de chaque groupe
  const base = Math.floor(effectif / nombreGroupes);

  // Les "reste" premiers groupes reçoivent +1 pour équilibrer
  const reste = effectif % nombreGroupes;

  return Array.from({ length: nombreGroupes }, (_, index) =>
    base + (index < reste ? 1 : 0)
  );
}

/**
 * Calcule les tailles de groupes équilibrées pour UN NOMBRE FIXE de groupes.
 *
 * Similaire à calculerTaillesGroupesEquilibres, mais le nombre de groupes
 * est imposé par l'appelant plutôt que calculé automatiquement.
 *
 * Retourne un tableau vide si l'effectif dépasse la capacité totale
 * (ex: 100 étudiants dans 3 groupes de 30 → impossible → []).
 *
 * @param {number} effectifTotal - Le nombre total d'étudiants
 * @param {number} nombreGroupesSouhaite - Le nombre de groupes voulu
 * @param {number} [capaciteMaximale=30] - La taille max par groupe
 * @returns {number[]} Tailles des groupes, ou [] si configuration impossible
 */
export function calculerTaillesGroupesEquilibresPourNombreGroupes(
  effectifTotal,
  nombreGroupesSouhaite,
  capaciteMaximale = TAILLE_MAX_GROUPE_PAR_DEFAUT
) {
  const effectif = Number(effectifTotal);
  const nombreGroupes = Number(nombreGroupesSouhaite);

  if (!Number.isFinite(effectif) || effectif <= 0) return [];
  if (!Number.isInteger(nombreGroupes) || nombreGroupes <= 0) return [];

  const capacite = valeurCapaciteValide(capaciteMaximale)
    ? Number(capaciteMaximale)
    : TAILLE_MAX_GROUPE_PAR_DEFAUT;

  // Vérifier que l'effectif peut tenir dans le nombre de groupes demandé
  if (effectif > nombreGroupes * capacite) {
    return []; // Configuration impossible — pas assez de capacité
  }

  const base = Math.floor(effectif / nombreGroupes);
  const reste = effectif % nombreGroupes;

  return Array.from({ length: nombreGroupes }, (_, index) =>
    base + (index < reste ? 1 : 0)
  ).filter((taille) => taille > 0); // Filtrer les groupes vides (sécurité)
}
