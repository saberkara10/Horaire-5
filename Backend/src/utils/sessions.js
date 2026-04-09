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

export function devinerNomSession(session, dateReference = null) {
  const sessionNormalisee = normaliserNomSession(session);

  if (sessionNormalisee) {
    return sessionNormalisee;
  }

  const valeur = normaliserCleSession(session);

  if (valeur.includes("automne")) {
    return "Automne";
  }

  if (valeur.includes("hiver")) {
    return "Hiver";
  }

  if (valeur.includes("printemps")) {
    return "Printemps";
  }

  if (valeur.includes("ete")) {
    return "Ete";
  }

  const date =
    dateReference instanceof Date
      ? dateReference
      : dateReference
      ? new Date(dateReference)
      : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const mois = date.getMonth() + 1;

  if (mois >= 8 && mois <= 12) {
    return "Automne";
  }

  if (mois >= 1 && mois <= 4) {
    return "Hiver";
  }

  if (mois >= 5 && mois <= 6) {
    return "Printemps";
  }

  return "Ete";
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
