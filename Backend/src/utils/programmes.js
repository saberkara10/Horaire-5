/**
 * Utilitaires pour la normalisation des noms de programmes académiques.
 *
 * Le problème central : les noms de programmes peuvent arriver sous des formes
 * très variées selon la source (import Excel, saisie manuelle, ancienne base).
 * Ce module assure que "web", "Dev Web", "Développement Web" et "developpement web"
 * sont tous traités comme le même programme.
 *
 * Ce fichier ne touche pas à la base de données — il fait uniquement de la
 * manipulation de chaînes. Il est utilisé lors des imports et des validations.
 *
 * @module utils/programmes
 */

/**
 * Dictionnaire des noms officiels des programmes.
 *
 * Ce dictionnaire sert de référence canonique pour tous les programmes
 * offerts par l'établissement. Quand on normalise un nom de programme,
 * on cherche à retourner une valeur de ce dictionnaire.
 *
 * Clés = identifiants courts (pour le code), Valeurs = noms officiels complets.
 *
 * @type {Object.<string, string>}
 */
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

/**
 * Normalise un texte brut pour permettre des comparaisons insensibles
 * à la casse, aux accents, aux tirets spéciaux et aux espaces multiples.
 *
 * Transformations appliquées :
 *  1. Conversion en minuscules
 *  2. Décomposition Unicode NFD (sépare lettres et diacritiques)
 *  3. Suppression des diacritiques (é → e, etc.)
 *  4. Remplacement des tirets longs "–" et "—" par le tiret standard "-"
 *  5. Fusion des espaces multiples en un seul
 *  6. Suppression des espaces en début/fin
 *
 * @param {*} texte - La valeur à normaliser (convertie en chaîne si nécessaire)
 * @returns {string} Le texte normalisé, prêt pour la comparaison
 */
export function normaliserTexte(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // supprimer les accents décomposés
    .replace(/[\u2013\u2014]/g, "-")  // tiret en "–" ou "—" → tiret simple "-"
    .replace(/\s+/g, " ")             // plusieurs espaces → un seul
    .trim();
}

/**
 * Normalise un nom de programme vers son nom officiel connu.
 *
 * Cette fonction fait la correspondance entre des saisies variées et
 * le nom officiel du programme. Elle gère :
 *  - Les abréviations courantes (ex: "web", "ia", "pi")
 *  - Les variantes orthographiques (ex: "Développement Web", "dev web")
 *  - Les sous-spécialités qui appartiennent à un programme parent
 *    (ex: "Programmation Java" → "Programmation informatique")
 *
 * Si aucune correspondance n'est trouvée, retourne le programme original nettoyé.
 * On ne retourne jamais null.
 *
 * @param {string} programme - Le nom de programme brut reçu
 * @returns {string} Le nom officiel du programme, ou la valeur nettoyée si inconnu
 */
export function normaliserNomProgramme(programme) {
  const valeur = normaliserTexte(programme);

  if (!valeur) {
    return "";
  }

  // Développement Web
  if (
    valeur.includes("developpement web") ||
    valeur === "web" ||
    valeur === "dev web"
  ) {
    return PROGRAMMES_OFFICIELS.web;
  }

  // Développement Mobile
  if (
    valeur.includes("developpement mobile") ||
    valeur === "mobile" ||
    valeur === "dev mobile"
  ) {
    return PROGRAMMES_OFFICIELS.mobile;
  }

  // Techniques en administration des affaires
  if (
    valeur === "commerce" ||
    valeur.includes("administration des affaires") ||
    valeur.includes("commerce international")
  ) {
    return PROGRAMMES_OFFICIELS.administration;
  }

  // Comptabilité et gestion
  if (
    valeur.includes("comptabilite") ||
    valeur.includes("gestion financiere")
  ) {
    return PROGRAMMES_OFFICIELS.comptabilite;
  }

  // Gestion de la chaîne d'approvisionnement
  if (
    valeur.includes("chaine d'approvisionnement") ||
    valeur.includes("logistique")
  ) {
    return PROGRAMMES_OFFICIELS.chaine;
  }

  // Marketing numérique
  if (valeur.includes("marketing")) {
    return PROGRAMMES_OFFICIELS.marketing;
  }

  // Programmation informatique (avec ses nombreuses sous-spécialités)
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

  // Intelligence artificielle appliquée
  if (valeur.includes("intelligence artificielle") || valeur === "ia") {
    return PROGRAMMES_OFFICIELS.ia;
  }

  // Analyse de données
  if (
    valeur.includes("analyse de donnees") ||
    valeur.includes("science des donnees") ||
    valeur === "data"
  ) {
    return PROGRAMMES_OFFICIELS.donnees;
  }

  // Technologie des systèmes informatiques — cybersécurité et réseautique
  if (
    valeur === "reseau" ||
    valeur === "reseaux" ||
    valeur.includes("reseautique") ||
    valeur.includes("cybersecurite") ||
    valeur.includes("systemes informatiques")
  ) {
    return PROGRAMMES_OFFICIELS.reseautique;
  }

  // Soutien informatique
  if (valeur.includes("soutien informatique")) {
    return PROGRAMMES_OFFICIELS.soutien;
  }

  // Design graphique
  if (valeur.includes("design graphique")) {
    return PROGRAMMES_OFFICIELS.design;
  }

  // Production multimédia
  if (valeur.includes("multimedia")) {
    return PROGRAMMES_OFFICIELS.multimedia;
  }

  // Gestion hôtelière
  if (valeur.includes("hoteli")) {
    return PROGRAMMES_OFFICIELS.hotelier;
  }

  // Gestion des services de restauration
  if (valeur.includes("restauration")) {
    return PROGRAMMES_OFFICIELS.restauration;
  }

  // Techniques juridiques
  if (valeur.includes("juridique")) {
    return PROGRAMMES_OFFICIELS.juridique;
  }

  // Éducation en services à l'enfance
  if (valeur.includes("enfance")) {
    return PROGRAMMES_OFFICIELS.enfance;
  }

  // Travail social
  if (valeur.includes("travail social")) {
    return PROGRAMMES_OFFICIELS.social;
  }

  // Soins infirmiers auxiliaires
  if (valeur.includes("soins infirmiers")) {
    return PROGRAMMES_OFFICIELS.soins;
  }

  // Techniques de laboratoire
  if (valeur.includes("laboratoire")) {
    return PROGRAMMES_OFFICIELS.laboratoire;
  }

  // Aucune correspondance trouvée → retourner le programme original nettoyé
  // On ne retourne jamais "" pour éviter de perdre une donnée non reconnue
  return String(programme || "").trim();
}

/**
 * Vérifie si deux noms de programmes désignent le même programme officiel.
 *
 * Les deux noms sont normalisés avant comparaison, donc
 * "web" et "Développement Web" sont considérés équivalents.
 * Retourne false si l'un des deux est vide ou non normalisable.
 *
 * @param {string} programmeA - Premier nom de programme
 * @param {string} programmeB - Deuxième nom de programme
 * @returns {boolean} true si les deux programmes sont équivalents
 */
export function programmesCorrespondent(programmeA, programmeB) {
  const normaliseA = normaliserNomProgramme(programmeA);
  const normaliseB = normaliserNomProgramme(programmeB);

  // On refuse de comparer deux valeurs vides — ce serait une fausse correspondance
  if (!normaliseA || !normaliseB) {
    return false;
  }

  // Double normalisation pour absorber les différences de casse résiduelles
  return normaliserTexte(normaliseA) === normaliserTexte(normaliseB);
}
