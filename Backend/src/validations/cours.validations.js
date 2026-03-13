/**
 * VALIDATIONS — Module Cours
 *
 * Rôle :
 * - Vérifier les données avant d'appeler le modèle.
 * - Retourner des messages simples en cas d'erreur.
 */

import { recupererCoursParId, recupererCoursParCode, coursEstDejaAffecte, typeSalleExiste, } from "../model/cours.model.js";

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
 * Vérifier que l'id est un entier positif.
 */
export function validerIdCours(request, response, next) {
  const id = Number(request.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return envoyerErreur(response, 400, "Identifiant invalide.");
  }

  next();
}

/**
 * Vérifier que le cours existe.
 */
export async function verifierCoursExiste(request, response, next) {
  const idCours = Number(request.params.id);
  const cours = await recupererCoursParId(idCours);

  if (!cours) {
    return envoyerErreur(response, 404, "Cours introuvable.");
  }

  request.cours = cours;
  next();
}

/**
 * Validation CREATE
 */
export async function validerCreateCours(request, response, next) {
  const { code, nom, duree, programme, etape_etude, type_salle } = request.body;

  // Champs obligatoires
  if (!code || code.trim() === "") {
    return envoyerErreur(response, 400, "Code obligatoire.");
  }

  if (!nom || nom.trim() === "" || /^\d+$/.test(nom)) {
    return envoyerErreur(response, 400, "Nom invalide.");
  }

  if (!programme || programme.trim() === "") {
    return envoyerErreur(response, 400, "Programme obligatoire.");
  }

  if (!type_salle || type_salle.trim() === "") {
    return envoyerErreur(response, 400, "Type de salle obligatoire.");
  }

  // Durée > 0
  const dureeInt = Number(duree);
  if (!Number.isInteger(dureeInt) || dureeInt <= 0) {
    return envoyerErreur(response, 400, "Durée invalide (> 0).");
  }

  // Étape 1 à 8
  const etapeInt = Number(etape_etude);
  if (!Number.isInteger(etapeInt) || etapeInt < 1 || etapeInt > 8) {
    return envoyerErreur(response, 400, "Étape invalide (1 à 8).");
  }

  // Code unique
  const dejaExiste = await recupererCoursParCode(code.trim());
  if (dejaExiste) {
    return envoyerErreur(response, 409, "Code déjà utilisé.");
  }

  // Type salle existant
  const typeExiste = await typeSalleExiste(type_salle.trim());
  if (!typeExiste) {
    return envoyerErreur(response, 400, "Type de salle inexistant.");
  }

  next();
}

/**
 * Validation UPDATE
 */
export async function validerUpdateCours(request, response, next) {
  const { code, nom, duree, programme, etape_etude, type_salle, archive } =
    request.body;

  // Archive interdit (annulé dans ton projet)
  if (archive !== undefined) {
    return envoyerErreur(response, 400, "Champ archive non autorisé.");
  }

  // Au moins un champ
  if (
    code === undefined &&
    nom === undefined &&
    duree === undefined &&
    programme === undefined &&
    etape_etude === undefined &&
    type_salle === undefined
  ) {
    return envoyerErreur(response, 400, "Aucun champ à modifier.");
  }

  // Code
  if (code !== undefined) {
    if (!code || code.trim() === "") {
      return envoyerErreur(response, 400, "Code invalide.");
    }

    const idCours = Number(request.params.id);
    const dejaExiste = await recupererCoursParCode(code.trim());

    if (dejaExiste && dejaExiste.id_cours !== idCours) {
      return envoyerErreur(response, 409, "Code déjà utilisé.");
    }
  }

  // Nom
  if (nom !== undefined) {
    if (!nom || nom.trim() === "" || /^\d+$/.test(nom)) {
      return envoyerErreur(response, 400, "Nom invalide.");
    }
  }

  // Durée
  if (duree !== undefined) {
    const dureeInt = Number(duree);
    if (!Number.isInteger(dureeInt) || dureeInt <= 0) {
      return envoyerErreur(response, 400, "Durée invalide (> 0).");
    }
  }

  // Programme
  if (programme !== undefined) {
    if (!programme || programme.trim() === "") {
      return envoyerErreur(response, 400, "Programme invalide.");
    }
  }

  // Étape
  if (etape_etude !== undefined) {
    const etapeInt = Number(etape_etude);
    if (!Number.isInteger(etapeInt) || etapeInt < 1 || etapeInt > 8) {
      return envoyerErreur(response, 400, "Étape invalide (1 à 8).");
    }
  }

  // Type salle
  if (type_salle !== undefined) {
    if (!type_salle || type_salle.trim() === "") {
      return envoyerErreur(response, 400, "Type de salle invalide.");
    }

    const typeExiste = await typeSalleExiste(type_salle.trim());
    if (!typeExiste) {
      return envoyerErreur(response, 400, "Type de salle inexistant.");
    }
  }

  next();
}

/**
 * Validation DELETE
 * Refuse si le cours est déjà affecté.
 */
export async function validerDeleteCours(request, response, next) {
  const idCours = Number(request.params.id);

  const estAffecte = await coursEstDejaAffecte(idCours);
  if (estAffecte) {
    return envoyerErreur(
      response,
      400,
      "Suppression impossible : cours déjà affecté."
    );
  }

  next();
}