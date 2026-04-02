/**
 * UTILS - Sessions académiques
 *
 * Ce module normalise les sessions
 * et valide l'annee de cohorte.
 */

export const SESSIONS_ACADEMIQUES = [
  "Automne",
  "Hiver",
  "Printemps",
  "Ete",
];

function normaliserCleSession(valeur) {
  return String(valeur || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const SESSION_PAR_CLE = new Map(
  SESSIONS_ACADEMIQUES.map((session) => [normaliserCleSession(session), session])
);

export function normaliserNomSession(session) {
  return SESSION_PAR_CLE.get(normaliserCleSession(session)) || "";
}

export function sessionsCorrespondent(sessionA, sessionB) {
  const sessionANormalisee = normaliserNomSession(sessionA);
  const sessionBNormalisee = normaliserNomSession(sessionB);

  return Boolean(sessionANormalisee) && sessionANormalisee === sessionBNormalisee;
}

export function anneeSessionValide(annee) {
  const anneeNumerique = Number(annee);

  return (
    Number.isInteger(anneeNumerique) &&
    anneeNumerique >= 2000 &&
    anneeNumerique <= 2100
  );
}
