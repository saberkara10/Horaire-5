/**
 * VALIDATIONS - Module Professeurs
 *
 * Role :
 * - Verifier les donnees avant d'appeler le modele.
 * - Retourner des messages simples en cas d'erreur.
 */

import {
  recupererProfesseurParId,recupererProfesseurParMatricule,professeurEstDejaAffecte,} from "../model/professeurs.model.js";

/**
 * Envoyer une erreur JSON standard.
 *
 * @param {import("express").Response} response
 * @param {number} status
 * @param {string} message
 */
function envoyerErreur(response, status, message) {
  response.status(status).json({ message });
}

/**
 * Verifier que l'id est un entier positif.
 */
export function validerIdProfesseur(request, response, next) {
  const id = Number(request.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return envoyerErreur(response, 400, "Identifiant invalide.");
  }

  next();
}

/**
 * Verifier que le professeur existe.
 */
export async function verifierProfesseurExiste(request, response, next) {
  const idProfesseur = Number(request.params.id);
  const professeur = await recupererProfesseurParId(idProfesseur);

  if (!professeur) {
    return envoyerErreur(response, 404, "Professeur introuvable.");
  }

  request.professeur = professeur;
  next();
}

/**
 * Validation CREATE
 */
export async function validerCreateProfesseur(request, response, next) {
  const { matricule, nom, prenom, specialite } = request.body;

  // Champs obligatoires
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

  // Longueurs max (table SQL)
  if (String(matricule).trim().length > 50) {
    return envoyerErreur(
      response,
      400,
      "Matricule trop long (max 50)."
    );
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
    String(specialite).trim().length > 100
  ) {
    return envoyerErreur(
      response,
      400,
      "Specialite trop longue (max 100)."
    );
  }

  // Matricule unique
  const dejaExiste = await recupererProfesseurParMatricule(String(matricule).trim());
  if (dejaExiste) {
    return envoyerErreur(response, 409, "Matricule deja utilise.");
  }

  next();
}

/**
 * Validation UPDATE
 */
export async function validerUpdateProfesseur(request, response, next) {
  const { matricule, nom, prenom, specialite } = request.body;

  // Au moins un champ
  if (
    matricule === undefined &&
    nom === undefined &&
    prenom === undefined &&
    specialite === undefined
  ) {
    return envoyerErreur(response, 400, "Aucun champ a modifier.");
  }

  // Matricule
  if (matricule !== undefined) {
    if (!matricule || String(matricule).trim() === "") {
      return envoyerErreur(response, 400, "Matricule invalide.");
    }

    if (String(matricule).trim().length > 50) {
      return envoyerErreur(
        response,
        400,
        "Matricule trop long (max 50)."
      );
    }

    const idProfesseur = Number(request.params.id);
    const dejaExiste = await recupererProfesseurParMatricule(
      String(matricule).trim()
    );

    if (dejaExiste && dejaExiste.id_professeur !== idProfesseur) {
      return envoyerErreur(response, 409, "Matricule deja utilise.");
    }
  }

  // Nom
  if (nom !== undefined) {
    if (!nom || String(nom).trim() === "" || /^\d+$/.test(String(nom).trim())) {
      return envoyerErreur(response, 400, "Nom invalide.");
    }

    if (String(nom).trim().length > 100) {
      return envoyerErreur(response, 400, "Nom trop long (max 100).");
    }
  }

  // Prenom
  if (prenom !== undefined) {
    if (
      !prenom ||
      String(prenom).trim() === "" ||
      /^\d+$/.test(String(prenom).trim())
    ) {
      return envoyerErreur(response, 400, "Prenom invalide.");
    }

    if (String(prenom).trim().length > 100) {
      return envoyerErreur(
        response,
        400,
        "Prenom trop long (max 100)."
      );
    }
  }

  // Specialite (optionnelle, null autorise)
  if (specialite !== undefined && specialite !== null) {
    if (String(specialite).trim().length > 100) {
      return envoyerErreur(
        response,
        400,
        "Specialite trop longue (max 100)."
      );
    }
  }

  next();
}

/**
 * Validation DELETE
 * Refuse si le professeur est deja affecte.
 */
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
