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

export function formaterLibelleCohorte(session, annee) {
  if (!session || !annee) {
    return "-";
  }

  return `${session} ${annee}`;
}
