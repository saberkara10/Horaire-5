/**
 * VALIDATIONS — Module Étudiants
 *
 * Ce module contient les validations liées aux étudiants.
 */

import { recupererEtudiantParId } from "../model/etudiants.model.js";

/**
 * Valider l'identifiant de l'étudiant reçu dans l'URL.
 *
 * @param {import("express").Request} request Requête Express.
 * @param {import("express").Response} response Réponse Express.
 * @param {import("express").NextFunction} next Fonction suivante.
 * @returns {void}
 */
export function validerIdEtudiant(request, response, next) {
  const idEtudiant = Number(request.params.id);

  if (!Number.isInteger(idEtudiant) || idEtudiant <= 0) {
    return response.status(400).json({
      message: "Identifiant étudiant invalide.",
    });
  }

  next();
}

/**
 * Vérifier que l'étudiant existe.
 *
 * @param {import("express").Request} request Requête Express.
 * @param {import("express").Response} response Réponse Express.
 * @param {import("express").NextFunction} next Fonction suivante.
 * @returns {Promise<void>}
 */
export async function verifierEtudiantExiste(request, response, next) {
  try {
    const idEtudiant = Number(request.params.id);
    const etudiant = await recupererEtudiantParId(idEtudiant);

    if (!etudiant) {
      return response.status(404).json({
        message: "Étudiant introuvable.",
      });
    }

    next();
  } catch (error) {
    return response.status(500).json({
      message: "Erreur serveur.",
    });
  }
}