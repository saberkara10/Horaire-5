/**
 * UTILS - Sessions académiques
 *
 * Ce module expose les valeurs
 * de session cote frontend.
 */

export const SESSIONS_ACADEMIQUES = [
  "Automne",
  "Hiver",
  "Printemps",
  "Ete",
];

export function formaterLibelleCohorte(session) {
  if (!session) {
    return "-";
  }

  return String(session);
}
