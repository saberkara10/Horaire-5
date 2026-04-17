/**
 * Utilitaires pour les sessions académiques.
 *
 * Dans ce projet, une "session académique" correspond à une période scolaire :
 * Automne, Hiver, Printemps ou Été. Chaque horaire est généré pour une session
 * spécifique et une année donnée (ex: "Hiver 2025").
 *
 * Ce module fournit des outils pour normaliser les noms de session
 * (car "automne", "AUTOMNE", "Automne" doivent tous être traités pareil),
 * les deviner à partir d'une date, et valider les années de cohorte.
 *
 * @module utils/sessions
 */

/**
 * Liste officielle des quatre sessions académiques reconnues par le système.
 * L'ordre reflète l'ordre calendaire dans une année scolaire.
 *
 * @type {string[]}
 */
export const SESSIONS_ACADEMIQUES = [
  "Automne",
  "Hiver",
  "Printemps",
  "Ete",
];

/**
 * Normalise un texte pour la comparaison insensible à la casse et aux accents.
 *
 * Transformations appliquées (dans l'ordre) :
 *  1. Conversion en minuscules
 *  2. Décomposition NFD (sépare les lettres de leurs accents)
 *  3. Suppression des diacritiques (é → e, è → e, ê → e, etc.)
 *  4. Suppression des espaces en début/fin
 *
 * @param {*} valeur - La valeur à normaliser (sera convertie en chaîne)
 * @returns {string} La valeur normalisée (sans accents, en minuscules, sans espaces)
 */
function normaliserCleSession(valeur) {
  return String(valeur || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Table de correspondance : clé normalisée → nom officiel de session.
 * Construite automatiquement depuis SESSIONS_ACADEMIQUES.
 * Exemple : "automne" → "Automne", "ete" → "Ete"
 *
 * @type {Map<string, string>}
 */
const SESSION_PAR_CLE = new Map(
  SESSIONS_ACADEMIQUES.map((session) => [normaliserCleSession(session), session])
);

/**
 * Normalise un nom de session vers sa forme officielle.
 *
 * Exemples :
 *  - "automne" → "Automne"
 *  - "HIVER"   → "Hiver"
 *  - "ÉTÉ"    → "Ete"
 *  - "xyz"     → "" (inconnu)
 *
 * @param {string} session - Le nom de session à normaliser
 * @returns {string} Le nom officiel de la session ou "" si non reconnu
 */
export function normaliserNomSession(session) {
  return SESSION_PAR_CLE.get(normaliserCleSession(session)) || "";
}

/**
 * Tente de deviner le nom de session à partir d'une valeur flou ou d'une date.
 *
 * Stratégie en deux temps :
 *  1. Essayer de trouver un nom officiel via normaliserNomSession()
 *  2. Chercher des mots-clés dans la valeur (ex: "automne2024" → "Automne")
 *  3. En dernier recours, dériver la session depuis une date de référence
 *
 * Correspondance mois → session utilisée en cas de fallback par date :
 *  - Août à Décembre (8–12)  → Automne
 *  - Janvier à Avril (1–4)   → Hiver
 *  - Mai à Juin (5–6)        → Printemps
 *  - Juillet (7)             → Été
 *
 * @param {string} session - Le nom de session brut (peut être flou ou vide)
 * @param {Date|string|null} dateReference - Date de référence pour le dernier fallback
 * @returns {string} Le nom officiel deviné, ou "" si impossible à déterminer
 */
export function devinerNomSession(session, dateReference = null) {
  // Essai direct avec le nom fourni
  const sessionNormalisee = normaliserNomSession(session);
  if (sessionNormalisee) {
    return sessionNormalisee;
  }

  // Recherche de mots-clés dans la valeur brute
  const valeur = normaliserCleSession(session);

  if (valeur.includes("automne")) return "Automne";
  if (valeur.includes("hiver")) return "Hiver";
  if (valeur.includes("printemps")) return "Printemps";
  if (valeur.includes("ete")) return "Ete";

  // Dernier recours : déduction par la date de référence
  const date =
    dateReference instanceof Date
      ? dateReference
      : dateReference
      ? new Date(dateReference)
      : null;

  if (!date || Number.isNaN(date.getTime())) {
    return ""; // Impossible de deviner sans date valide
  }

  const mois = date.getMonth() + 1; // getMonth() retourne 0–11, on passe à 1–12

  if (mois >= 8 && mois <= 12) return "Automne";
  if (mois >= 1 && mois <= 4) return "Hiver";
  if (mois >= 5 && mois <= 6) return "Printemps";

  return "Ete"; // Juillet
}

/**
 * Vérifie si deux noms de session désignent la même session académique.
 *
 * Insensible à la casse et aux accents grâce à la normalisation.
 * Retourne false si l'un des deux noms est vide ou non reconnu.
 *
 * @param {string} sessionA - Premier nom de session
 * @param {string} sessionB - Deuxième nom de session
 * @returns {boolean} true si les deux sessions sont équivalentes
 */
export function sessionsCorrespondent(sessionA, sessionB) {
  const sessionANormalisee = normaliserNomSession(sessionA);
  const sessionBNormalisee = normaliserNomSession(sessionB);

  // On exige que les deux soient non vides ET identiques
  return Boolean(sessionANormalisee) && sessionANormalisee === sessionBNormalisee;
}

/**
 * Vérifie qu'une année de cohorte est dans une plage réaliste.
 *
 * On accepte les années entre 2000 et 2100. En dehors de cette plage,
 * c'est probablement une saisie erronée ou une donnée corrompue.
 *
 * @param {number|string} annee - L'année à valider
 * @returns {boolean} true si l'année est un entier entre 2000 et 2100 inclus
 */
export function anneeSessionValide(annee) {
  const anneeNumerique = Number(annee);

  return (
    Number.isInteger(anneeNumerique) &&
    anneeNumerique >= 2000 &&
    anneeNumerique <= 2100
  );
}
