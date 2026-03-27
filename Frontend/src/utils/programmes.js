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
    return "Developpement Web";
  }

  if (
    valeur.includes("developpement mobile") ||
    valeur === "mobile" ||
    valeur === "dev mobile"
  ) {
    return "Developpement mobile";
  }

  if (
    valeur === "commerce" ||
    valeur.includes("administration des affaires") ||
    valeur.includes("commerce international")
  ) {
    return "Techniques en administration des affaires";
  }

  if (valeur.includes("comptabilite") || valeur.includes("gestion financiere")) {
    return "Comptabilite et gestion";
  }

  if (
    valeur.includes("chaine d'approvisionnement") ||
    valeur.includes("logistique")
  ) {
    return "Gestion de la chaine d'approvisionnement";
  }

  if (valeur.includes("marketing")) {
    return "Marketing numerique";
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
    return "Programmation informatique";
  }

  if (valeur.includes("intelligence artificielle") || valeur === "ia") {
    return "Intelligence artificielle appliquee";
  }

  if (
    valeur.includes("analyse de donnees") ||
    valeur.includes("science des donnees") ||
    valeur === "data"
  ) {
    return "Analyse de donnees";
  }

  if (
    valeur === "reseau" ||
    valeur === "reseaux" ||
    valeur.includes("reseautique") ||
    valeur.includes("cybersecurite") ||
    valeur.includes("systemes informatiques")
  ) {
    return "Technologie des systemes informatiques - cybersecurite et reseautique";
  }

  if (valeur.includes("soutien informatique")) {
    return "Soutien informatique";
  }

  if (valeur.includes("design graphique")) {
    return "Design graphique";
  }

  if (valeur.includes("multimedia")) {
    return "Production multimedia";
  }

  if (valeur.includes("hoteli")) {
    return "Gestion hoteliere";
  }

  if (valeur.includes("restauration")) {
    return "Gestion des services de restauration";
  }

  if (valeur.includes("juridique")) {
    return "Techniques juridiques";
  }

  if (valeur.includes("enfance")) {
    return "Education en services a l'enfance";
  }

  if (valeur.includes("travail social")) {
    return "Travail social";
  }

  if (valeur.includes("soins infirmiers")) {
    return "Soins infirmiers auxiliaires";
  }

  if (valeur.includes("laboratoire")) {
    return "Techniques de laboratoire";
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
