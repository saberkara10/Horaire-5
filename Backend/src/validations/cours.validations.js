import {
  DUREE_COURS_FIXE,
  MODES_COURS,
  coursEstDejaAffecte,
  recupererCoursParCode,
  recupererCoursParId,
  salleExisteParId,
} from "../model/cours.model.js";

function envoyerErreur(response, status, message) {
  response.status(status).json({ message });
}

function normaliserModeCours(modeCours) {
  return String(modeCours || "").trim();
}

function typeSalleValide(typeSalle) {
  const typeNormalise = String(typeSalle || "").trim();
  return typeNormalise !== "" && typeNormalise !== "En ligne";
}

function appliquerCoursEnLigne(body) {
  body.mode_cours = "En ligne";
  body.type_salle = "En ligne";
  body.id_salle_reference = null;
  body.est_en_ligne = 1;
}

function appliquerCoursPresentiel(body) {
  body.mode_cours = "Presentiel";
  body.est_en_ligne = 0;
}

function validerNomCours(nom) {
  return Boolean(nom && String(nom).trim() !== "" && !/^\d+$/.test(String(nom).trim()));
}

function validerEtape(etape) {
  const etapeInt = Number(etape);
  return Number.isInteger(etapeInt) && etapeInt >= 1 && etapeInt <= 8;
}

export function validerIdCours(request, response, next) {
  const id = Number(request.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return envoyerErreur(response, 400, "Identifiant invalide.");
  }

  next();
}

export async function verifierCoursExiste(request, response, next) {
  const idCours = Number(request.params.id);
  const cours = await recupererCoursParId(idCours);

  if (!cours) {
    return envoyerErreur(response, 404, "Cours introuvable.");
  }

  request.cours = cours;
  next();
}

export async function validerCreateCours(request, response, next) {
  const {
    code,
    nom,
    duree,
    programme,
    etape_etude,
    id_salle_reference,
    type_salle,
    mode_cours,
  } = request.body;
  const modeNormalise = normaliserModeCours(mode_cours);

  if (!code || String(code).trim() === "") {
    return envoyerErreur(response, 400, "Code obligatoire.");
  }

  if (!validerNomCours(nom)) {
    return envoyerErreur(response, 400, "Nom invalide.");
  }

  if (!programme || String(programme).trim() === "") {
    return envoyerErreur(response, 400, "Programme obligatoire.");
  }

  if (!MODES_COURS.includes(modeNormalise)) {
    return envoyerErreur(response, 400, "Mode de cours invalide.");
  }

  if (!validerEtape(etape_etude)) {
    return envoyerErreur(response, 400, "Etape invalide (1 a 8).");
  }

  request.body.duree = DUREE_COURS_FIXE;

  const dejaExiste = await recupererCoursParCode(String(code).trim());

  if (dejaExiste) {
    return envoyerErreur(response, 409, "Code deja utilise.");
  }

  if (modeNormalise === "En ligne") {
    appliquerCoursEnLigne(request.body);
    return next();
  }

  appliquerCoursPresentiel(request.body);

  if (
    id_salle_reference !== undefined &&
    id_salle_reference !== null &&
    id_salle_reference !== ""
  ) {
    const idSalle = Number(id_salle_reference);

    if (!Number.isInteger(idSalle) || idSalle <= 0) {
      return envoyerErreur(response, 400, "Salle de reference invalide.");
    }

    const salleExiste = await salleExisteParId(idSalle);

    if (!salleExiste) {
      return envoyerErreur(response, 400, "Salle de reference inexistante.");
    }

    request.body.id_salle_reference = idSalle;
    return next();
  }

  if (!typeSalleValide(type_salle)) {
    return envoyerErreur(response, 400, "Type de salle obligatoire.");
  }

  request.body.type_salle = String(type_salle).trim();
  request.body.id_salle_reference = null;
  next();
}

export async function validerUpdateCours(request, response, next) {
  const {
    code,
    nom,
    duree,
    programme,
    etape_etude,
    id_salle_reference,
    type_salle,
    mode_cours,
    archive,
  } = request.body;

  if (archive !== undefined) {
    return envoyerErreur(response, 400, "Champ archive non autorise.");
  }

  if (
    code === undefined &&
    nom === undefined &&
    duree === undefined &&
    programme === undefined &&
    etape_etude === undefined &&
    id_salle_reference === undefined &&
    type_salle === undefined &&
    mode_cours === undefined
  ) {
    return envoyerErreur(response, 400, "Aucun champ a modifier.");
  }

  if (code !== undefined) {
    if (!code || String(code).trim() === "") {
      return envoyerErreur(response, 400, "Code invalide.");
    }

    const idCours = Number(request.params.id);
    const dejaExiste = await recupererCoursParCode(String(code).trim());

    if (dejaExiste && dejaExiste.id_cours !== idCours) {
      return envoyerErreur(response, 409, "Code deja utilise.");
    }
  }

  if (nom !== undefined && !validerNomCours(nom)) {
    return envoyerErreur(response, 400, "Nom invalide.");
  }

  request.body.duree = DUREE_COURS_FIXE;

  if (programme !== undefined && String(programme).trim() === "") {
    return envoyerErreur(response, 400, "Programme invalide.");
  }

  if (etape_etude !== undefined && !validerEtape(etape_etude)) {
    return envoyerErreur(response, 400, "Etape invalide (1 a 8).");
  }

  const modeResultant = mode_cours === undefined
    ? normaliserModeCours(request.cours?.mode_cours)
    : normaliserModeCours(mode_cours);

  if (!MODES_COURS.includes(modeResultant)) {
    return envoyerErreur(response, 400, "Mode de cours invalide.");
  }

  if (modeResultant === "En ligne") {
    appliquerCoursEnLigne(request.body);
    return next();
  }

  appliquerCoursPresentiel(request.body);

  if (type_salle !== undefined && !typeSalleValide(type_salle)) {
    return envoyerErreur(response, 400, "Type de salle obligatoire.");
  }

  if (
    id_salle_reference !== undefined &&
    id_salle_reference !== null &&
    id_salle_reference !== ""
  ) {
    const idSalle = Number(id_salle_reference);

    if (!Number.isInteger(idSalle) || idSalle <= 0) {
      return envoyerErreur(response, 400, "Salle de reference invalide.");
    }

    const salleExiste = await salleExisteParId(idSalle);

    if (!salleExiste) {
      return envoyerErreur(response, 400, "Salle de reference inexistante.");
    }

    request.body.id_salle_reference = idSalle;
    return next();
  }

  if (id_salle_reference === null || id_salle_reference === "") {
    request.body.id_salle_reference = null;
  }

  const typeResultant = type_salle !== undefined
    ? String(type_salle).trim()
    : String(request.cours?.type_salle || "").trim();

  if (
    !typeSalleValide(typeResultant) &&
    (request.body.id_salle_reference === null || request.body.id_salle_reference === undefined)
  ) {
    return envoyerErreur(response, 400, "Type de salle obligatoire.");
  }

  if (type_salle !== undefined) {
    request.body.type_salle = typeResultant;
  }

  next();
}

export async function validerDeleteCours(request, response, next) {
  const idCours = Number(request.params.id);
  const estAffecte = await coursEstDejaAffecte(idCours);

  if (estAffecte) {
    return envoyerErreur(
      response,
      400,
      "Suppression impossible : cours deja affecte."
    );
  }

  next();
}
