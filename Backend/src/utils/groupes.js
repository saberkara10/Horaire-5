/**
 * UTILS - Groupes
 *
 * Helpers partages pour calculer des groupes d'etudiants faisables
 * a partir de l'effectif et des salles compatibles avec les cours
 * d'une cohorte.
 */

export const TAILLE_MAX_GROUPE_PAR_DEFAUT = 30;

function normaliserTexte(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function valeurCapaciteValide(capacite) {
  const valeur = Number(capacite);
  return Number.isFinite(valeur) && valeur > 0;
}

export function recupererSallesCompatiblesPourCours(cours, salles = []) {
  const idSalleReference = Number(cours?.id_salle_reference);

  if (Number.isInteger(idSalleReference) && idSalleReference > 0) {
    return salles.filter((salle) => Number(salle?.id_salle) === idSalleReference);
  }

  const typeSalleCours = normaliserTexte(cours?.type_salle);

  if (!typeSalleCours) {
    return [];
  }

  return salles.filter(
    (salle) => normaliserTexte(salle?.type) === typeSalleCours
  );
}

export function determinerCapaciteMaximaleGroupeCohorte(
  coursCohorte = [],
  salles = [],
  capaciteParDefaut = TAILLE_MAX_GROUPE_PAR_DEFAUT
) {
  const capaciteMaximaleParDefaut = valeurCapaciteValide(capaciteParDefaut)
    ? Number(capaciteParDefaut)
    : TAILLE_MAX_GROUPE_PAR_DEFAUT;

  const capacitesParCours = coursCohorte
    .map((cours) =>
      recupererSallesCompatiblesPourCours(cours, salles)
        .map((salle) => Number(salle.capacite))
        .filter(valeurCapaciteValide)
    )
    .filter((capacites) => capacites.length > 0)
    .map((capacites) => Math.max(...capacites));

  if (capacitesParCours.length === 0) {
    return capaciteMaximaleParDefaut;
  }

  return Math.max(
    1,
    Math.min(capaciteMaximaleParDefaut, ...capacitesParCours)
  );
}

export function calculerTaillesGroupesEquilibres(
  effectifTotal,
  capaciteMaximale = TAILLE_MAX_GROUPE_PAR_DEFAUT
) {
  const effectif = Number(effectifTotal);

  if (!Number.isFinite(effectif) || effectif <= 0) {
    return [];
  }

  const capacite = valeurCapaciteValide(capaciteMaximale)
    ? Number(capaciteMaximale)
    : TAILLE_MAX_GROUPE_PAR_DEFAUT;
  const nombreGroupes = Math.max(1, Math.ceil(effectif / capacite));
  const base = Math.floor(effectif / nombreGroupes);
  const reste = effectif % nombreGroupes;

  return Array.from({ length: nombreGroupes }, (_, index) =>
    base + (index < reste ? 1 : 0)
  );
}

export function calculerTaillesGroupesEquilibresPourNombreGroupes(
  effectifTotal,
  nombreGroupesSouhaite,
  capaciteMaximale = TAILLE_MAX_GROUPE_PAR_DEFAUT
) {
  const effectif = Number(effectifTotal);
  const nombreGroupes = Number(nombreGroupesSouhaite);

  if (!Number.isFinite(effectif) || effectif <= 0) {
    return [];
  }

  if (!Number.isInteger(nombreGroupes) || nombreGroupes <= 0) {
    return [];
  }

  const capacite = valeurCapaciteValide(capaciteMaximale)
    ? Number(capaciteMaximale)
    : TAILLE_MAX_GROUPE_PAR_DEFAUT;

  if (effectif > nombreGroupes * capacite) {
    return [];
  }

  const base = Math.floor(effectif / nombreGroupes);
  const reste = effectif % nombreGroupes;

  return Array.from({ length: nombreGroupes }, (_, index) =>
    base + (index < reste ? 1 : 0)
  ).filter((taille) => taille > 0);
}
