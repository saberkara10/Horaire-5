/**
 * Utilitaires de sessions académiques — côté frontend.
 *
 * Ce module expose les constantes et helpers de sessions pour le frontend.
 * La logique plus complexe de normalisation et validation vit côté backend
 * (Backend/src/utils/sessions.js). Ce fichier frontend reste volontairement léger.
 *
 * @module utils/sessions
 */

/**
 * Liste officielle des quatre sessions académiques reconnues.
 * Utilisée pour alimenter les listes déroulantes dans les formulaires.
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
 * Formate le libellé d'affichage d'une cohorte.
 *
 * Une cohorte est identifiée par sa session et son année (ex: "Hiver 2025").
 * Si la session n'est pas disponible, on retourne "-" pour éviter un champ vide.
 *
 * Note : dans de futures versions, on pourrait enrichir cette fonction pour
 * inclure l'année : formaterLibelleCohorte("Hiver", 2025) → "Hiver 2025"
 *
 * @param {string|null|undefined} session - Nom de la session ("Automne", "Hiver"...)
 * @returns {string} Le libellé formaté, ou "-" si la session est absente
 */
export function formaterLibelleCohorte(session) {
  if (!session) {
    return "-";
  }

  return String(session);
}
