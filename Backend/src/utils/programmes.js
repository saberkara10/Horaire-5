export const PROGRAMMES_OFFICIELS = {
  administration: "Techniques en administration des affaires",
  comptabilite: "Comptabilite et gestion",
  chaine: "Gestion de la chaine d'approvisionnement",
  marketing: "Marketing numerique",
  hotelier: "Gestion hoteliere",
  restauration: "Gestion des services de restauration",
  juridique: "Techniques juridiques",
  enfance: "Education en services a l'enfance",
  social: "Travail social",
  soins: "Soins infirmiers auxiliaires",
  laboratoire: "Techniques de laboratoire",
  informatique: "Programmation informatique",
  web: "Developpement Web",
  mobile: "Developpement mobile",
  ia: "Intelligence artificielle appliquee",
  donnees: "Analyse de donnees",
  reseautique:
    "Technologie des systemes informatiques - cybersecurite et reseautique",
  soutien: "Soutien informatique",
  design: "Design graphique",
  multimedia: "Production multimedia",
};

export const PROGRAMMES_REFERENCE = [
  PROGRAMMES_OFFICIELS.administration,
  PROGRAMMES_OFFICIELS.comptabilite,
  PROGRAMMES_OFFICIELS.chaine,
  PROGRAMMES_OFFICIELS.marketing,
  PROGRAMMES_OFFICIELS.hotelier,
  PROGRAMMES_OFFICIELS.restauration,
  PROGRAMMES_OFFICIELS.juridique,
  PROGRAMMES_OFFICIELS.enfance,
  PROGRAMMES_OFFICIELS.social,
  PROGRAMMES_OFFICIELS.soins,
  PROGRAMMES_OFFICIELS.laboratoire,
  PROGRAMMES_OFFICIELS.informatique,
  PROGRAMMES_OFFICIELS.web,
  PROGRAMMES_OFFICIELS.mobile,
  PROGRAMMES_OFFICIELS.ia,
  PROGRAMMES_OFFICIELS.donnees,
  PROGRAMMES_OFFICIELS.reseautique,
  PROGRAMMES_OFFICIELS.soutien,
  PROGRAMMES_OFFICIELS.design,
  PROGRAMMES_OFFICIELS.multimedia,
];

export function normaliserTexte(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[â€“â€”]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normaliserNomProgramme(programme) {
  const valeur = normaliserTexte(programme);

  if (!valeur) {
    return "";
  }

  if (
    valeur.includes("developpement web") ||
    valeur === "web" ||
    valeur === "dev web"
  ) {
    return PROGRAMMES_OFFICIELS.web;
  }

  if (
    valeur.includes("developpement mobile") ||
    valeur === "mobile" ||
    valeur === "dev mobile"
  ) {
    return PROGRAMMES_OFFICIELS.mobile;
  }

  if (
    valeur === "commerce" ||
    valeur.includes("administration des affaires") ||
    valeur.includes("commerce international")
  ) {
    return PROGRAMMES_OFFICIELS.administration;
  }

  if (
    valeur.includes("comptabilite") ||
    valeur.includes("gestion financiere")
  ) {
    return PROGRAMMES_OFFICIELS.comptabilite;
  }

  if (
    valeur.includes("chaine d'approvisionnement") ||
    valeur.includes("logistique")
  ) {
    return PROGRAMMES_OFFICIELS.chaine;
  }

  if (valeur.includes("marketing")) {
    return PROGRAMMES_OFFICIELS.marketing;
  }

  if (
    valeur === "informatique" ||
    valeur === "inf" ||
    valeur === "pi" ||
    valeur.includes("programmation informatique") ||
    valeur.includes("programmation web") ||
    valeur.includes("programmation java") ||
    valeur.includes("programmation python") ||
    valeur.includes("programmation mobile") ||
    valeur.includes("programmation c#")
  ) {
    return PROGRAMMES_OFFICIELS.informatique;
  }

  if (valeur.includes("intelligence artificielle") || valeur === "ia") {
    return PROGRAMMES_OFFICIELS.ia;
  }

  if (
    valeur.includes("analyse de donnees") ||
    valeur.includes("science des donnees") ||
    valeur === "data"
  ) {
    return PROGRAMMES_OFFICIELS.donnees;
  }

  if (
    valeur === "reseau" ||
    valeur === "reseaux" ||
    valeur.includes("reseautique") ||
    valeur.includes("cybersecurite") ||
    valeur.includes("systemes informatiques")
  ) {
    return PROGRAMMES_OFFICIELS.reseautique;
  }

  if (valeur.includes("soutien informatique")) {
    return PROGRAMMES_OFFICIELS.soutien;
  }

  if (valeur.includes("design graphique")) {
    return PROGRAMMES_OFFICIELS.design;
  }

  if (valeur.includes("multimedia")) {
    return PROGRAMMES_OFFICIELS.multimedia;
  }

  if (valeur.includes("hoteli")) {
    return PROGRAMMES_OFFICIELS.hotelier;
  }

  if (valeur.includes("restauration")) {
    return PROGRAMMES_OFFICIELS.restauration;
  }

  if (valeur.includes("juridique")) {
    return PROGRAMMES_OFFICIELS.juridique;
  }

  if (valeur.includes("enfance")) {
    return PROGRAMMES_OFFICIELS.enfance;
  }

  if (valeur.includes("travail social")) {
    return PROGRAMMES_OFFICIELS.social;
  }

  if (valeur.includes("soins infirmiers")) {
    return PROGRAMMES_OFFICIELS.soins;
  }

  if (valeur.includes("laboratoire")) {
    return PROGRAMMES_OFFICIELS.laboratoire;
  }

  return String(programme || "").trim();
}

export function programmesCorrespondent(programmeA, programmeB) {
  const normaliseA = normaliserNomProgramme(programmeA);
  const normaliseB = normaliserNomProgramme(programmeB);

  if (!normaliseA || !normaliseB) {
    return false;
  }

  return normaliserTexte(normaliseA) === normaliserTexte(normaliseB);
}
