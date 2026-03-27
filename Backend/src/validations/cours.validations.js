/**
 * VALIDATIONS - Module Cours
 */

import {
  recupererCoursParId,
  recupererCoursParCode,
  coursEstDejaAffecte,
  salleExisteParId,
} from "../model/cours.model.js";

function envoyerErreur(response, status, message) {
  response.status(status).json({ message });
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
  const { code, nom, duree, programme, etape_etude, id_salle_reference } =
    request.body;

  if (!code || String(code).trim() === "") {
    return envoyerErreur(response, 400, "Code obligatoire.");
  }

  if (!nom || String(nom).trim() === "" || /^\d+$/.test(String(nom).trim())) {
    return envoyerErreur(response, 400, "Nom invalide.");
  }

  if (!programme || String(programme).trim() === "") {
    return envoyerErreur(response, 400, "Programme obligatoire.");
  }

  if (!Number.isInteger(Number(id_salle_reference)) || Number(id_salle_reference) <= 0) {
    return envoyerErreur(response, 400, "Salle de reference obligatoire.");
  }

  const dureeInt = Number(duree);
  if (!Number.isInteger(dureeInt) || dureeInt <= 0) {
    return envoyerErreur(response, 400, "Duree invalide (> 0).");
  }

  const etapeInt = Number(etape_etude);
  if (!Number.isInteger(etapeInt) || etapeInt < 1 || etapeInt > 8) {
    return envoyerErreur(response, 400, "Etape invalide (1 a 8).");
  }

  const dejaExiste = await recupererCoursParCode(String(code).trim());
  if (dejaExiste) {
    return envoyerErreur(response, 409, "Code deja utilise.");
  }

  const salleExiste = await salleExisteParId(Number(id_salle_reference));
  if (!salleExiste) {
    return envoyerErreur(response, 400, "Salle de reference inexistante.");
  }

  next();
}

export async function validerUpdateCours(request, response, next) {
  const { code, nom, duree, programme, etape_etude, id_salle_reference, archive } =
    request.body;

  if (archive !== undefined) {
    return envoyerErreur(response, 400, "Champ archive non autorise.");
  }

  if (
    code === undefined &&
    nom === undefined &&
    duree === undefined &&
    programme === undefined &&
    etape_etude === undefined &&
    id_salle_reference === undefined
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

  if (nom !== undefined) {
    if (!nom || String(nom).trim() === "" || /^\d+$/.test(String(nom).trim())) {
      return envoyerErreur(response, 400, "Nom invalide.");
    }
  }

  if (duree !== undefined) {
    const dureeInt = Number(duree);
    if (!Number.isInteger(dureeInt) || dureeInt <= 0) {
      return envoyerErreur(response, 400, "Duree invalide (> 0).");
    }
  }

  if (programme !== undefined && String(programme).trim() === "") {
    return envoyerErreur(response, 400, "Programme invalide.");
  }

  if (etape_etude !== undefined) {
    const etapeInt = Number(etape_etude);
    if (!Number.isInteger(etapeInt) || etapeInt < 1 || etapeInt > 8) {
      return envoyerErreur(response, 400, "Etape invalide (1 a 8).");
    }
  }

  if (id_salle_reference !== undefined) {
    if (!Number.isInteger(Number(id_salle_reference)) || Number(id_salle_reference) <= 0) {
      return envoyerErreur(response, 400, "Salle de reference invalide.");
    }

    const salleExiste = await salleExisteParId(Number(id_salle_reference));
    if (!salleExiste) {
      return envoyerErreur(response, 400, "Salle de reference inexistante.");
    }
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
