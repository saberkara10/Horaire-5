/**
 * VALIDATIONS - Module Professeurs
 */

import {
  recupererProfesseurParId,
  recupererProfesseurParNomPrenom,
  recupererProfesseurParMatricule,
  professeurEstDejaAffecte,
  validerContrainteCoursProfesseur,
} from "../model/professeurs.model.js";

function envoyerErreur(response, status, message) {
  response.status(status).json({ message });
}

function coursIdsValides(coursIds) {
  if (!Array.isArray(coursIds)) {
    return false;
  }

  const ids = coursIds.map((idCours) => Number(idCours));
  const idsValides = ids.filter(
    (idCours) => Number.isInteger(idCours) && idCours > 0
  );

  return ids.length === idsValides.length && new Set(idsValides).size === idsValides.length;
}

export function validerIdProfesseur(request, response, next) {
  const id = Number(request.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return envoyerErreur(response, 400, "Identifiant invalide.");
  }

  next();
}

export async function verifierProfesseurExiste(request, response, next) {
  const idProfesseur = Number(request.params.id);
  const professeur = await recupererProfesseurParId(idProfesseur);

  if (!professeur) {
    return envoyerErreur(response, 404, "Professeur introuvable.");
  }

  request.professeur = professeur;
  next();
}

export async function validerCreateProfesseur(request, response, next) {
  const { matricule, nom, prenom, specialite, cours_ids } = request.body;

  if (!matricule || String(matricule).trim() === "") {
    return envoyerErreur(response, 400, "Matricule obligatoire.");
  }

  if (!nom || String(nom).trim() === "" || /^\d+$/.test(String(nom).trim())) {
    return envoyerErreur(response, 400, "Nom invalide.");
  }

  if (
    !prenom ||
    String(prenom).trim() === "" ||
    /^\d+$/.test(String(prenom).trim())
  ) {
    return envoyerErreur(response, 400, "Prenom invalide.");
  }

  if (String(matricule).trim().length > 50) {
    return envoyerErreur(response, 400, "Matricule trop long (max 50).");
  }

  if (String(nom).trim().length > 100) {
    return envoyerErreur(response, 400, "Nom trop long (max 100).");
  }

  if (String(prenom).trim().length > 100) {
    return envoyerErreur(response, 400, "Prenom trop long (max 100).");
  }

  if (
    specialite !== undefined &&
    specialite !== null &&
    String(specialite).trim().length > 150
  ) {
    return envoyerErreur(response, 400, "Specialite trop longue (max 150).");
  }

  if (cours_ids !== undefined && !coursIdsValides(cours_ids)) {
    return envoyerErreur(response, 400, "La liste des cours est invalide.");
  }

  if (cours_ids !== undefined) {
    const messageErreurCours = await validerContrainteCoursProfesseur(cours_ids);

    if (messageErreurCours) {
      return envoyerErreur(response, 400, messageErreurCours);
    }
  }

  const dejaExiste = await recupererProfesseurParMatricule(String(matricule).trim());
  if (dejaExiste) {
    return envoyerErreur(response, 409, "Matricule deja utilise.");
  }

  const dejaExisteMemeNom = await recupererProfesseurParNomPrenom(nom, prenom);
  if (dejaExisteMemeNom) {
    return envoyerErreur(
      response,
      409,
      "Un professeur avec ce nom et prenom existe deja."
    );
  }

  next();
}

export async function validerUpdateProfesseur(request, response, next) {
  const { matricule, nom, prenom, specialite, cours_ids } = request.body;

  if (
    matricule === undefined &&
    nom === undefined &&
    prenom === undefined &&
    specialite === undefined &&
    cours_ids === undefined
  ) {
    return envoyerErreur(response, 400, "Aucun champ a modifier.");
  }

  if (matricule !== undefined) {
    if (!matricule || String(matricule).trim() === "") {
      return envoyerErreur(response, 400, "Matricule invalide.");
    }

    if (String(matricule).trim().length > 50) {
      return envoyerErreur(response, 400, "Matricule trop long (max 50).");
    }

    const idProfesseur = Number(request.params.id);
    const dejaExiste = await recupererProfesseurParMatricule(
      String(matricule).trim()
    );

    if (dejaExiste && dejaExiste.id_professeur !== idProfesseur) {
      return envoyerErreur(response, 409, "Matricule deja utilise.");
    }
  }

  if (nom !== undefined) {
    if (!nom || String(nom).trim() === "" || /^\d+$/.test(String(nom).trim())) {
      return envoyerErreur(response, 400, "Nom invalide.");
    }

    if (String(nom).trim().length > 100) {
      return envoyerErreur(response, 400, "Nom trop long (max 100).");
    }
  }

  if (prenom !== undefined) {
    if (
      !prenom ||
      String(prenom).trim() === "" ||
      /^\d+$/.test(String(prenom).trim())
    ) {
      return envoyerErreur(response, 400, "Prenom invalide.");
    }

    if (String(prenom).trim().length > 100) {
      return envoyerErreur(response, 400, "Prenom trop long (max 100).");
    }
  }

  if (specialite !== undefined) {
    if (
      specialite !== null &&
      String(specialite).trim().length > 150
    ) {
      return envoyerErreur(response, 400, "Specialite trop longue (max 150).");
    }
  }

  if (cours_ids !== undefined && !coursIdsValides(cours_ids)) {
    return envoyerErreur(response, 400, "La liste des cours est invalide.");
  }

  if (cours_ids !== undefined) {
    const messageErreurCours = await validerContrainteCoursProfesseur(cours_ids);

    if (messageErreurCours) {
      return envoyerErreur(response, 400, messageErreurCours);
    }
  }

  const idProfesseur = Number(request.params.id);
  const nomCible = nom !== undefined ? nom : request.professeur?.nom;
  const prenomCible = prenom !== undefined ? prenom : request.professeur?.prenom;
  const dejaExisteMemeNom = await recupererProfesseurParNomPrenom(nomCible, prenomCible);

  if (dejaExisteMemeNom && dejaExisteMemeNom.id_professeur !== idProfesseur) {
    return envoyerErreur(
      response,
      409,
      "Un professeur avec ce nom et prenom existe deja."
    );
  }

  next();
}

export async function validerDeleteProfesseur(request, response, next) {
  const idProfesseur = Number(request.params.id);
  const estAffecte = await professeurEstDejaAffecte(idProfesseur);

  if (estAffecte) {
    return envoyerErreur(
      response,
      400,
      "Suppression impossible : professeur deja affecte."
    );
  }

  next();
}
