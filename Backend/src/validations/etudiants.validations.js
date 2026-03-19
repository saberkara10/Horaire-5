/**
 * VALIDATIONS - Module Etudiants
 *
 * Ce module regroupe les validations communes du module etudiants.
 * Il se concentre sur les routes de consultation, pas sur l'import de fichier.
 */

import { recupererEtudiantParId } from "../model/etudiants.model.js";

/**
 * Valider l'identifiant de l'etudiant recu dans l'URL.
 *
 * @param {import("express").Request} request Requete Express.
 * @param {import("express").Response} response Reponse Express.
 * @param {import("express").NextFunction} next Fonction suivante.
 * @returns {void}
 */
export function validerIdEtudiant(request, response, next) {
  const idEtudiant = Number(request.params.id);

  if (!Number.isInteger(idEtudiant) || idEtudiant <= 0) {
    return response.status(400).json({
      message: "Identifiant etudiant invalide.",
    });
  }

  return next();
}

/**
 * Verifier que l'etudiant existe.
 *
 * @param {import("express").Request} request Requete Express.
 * @param {import("express").Response} response Reponse Express.
 * @param {import("express").NextFunction} next Fonction suivante.
 * @returns {Promise<void>}
 */
export async function verifierEtudiantExiste(request, response, next) {
  try {
    const idEtudiant = Number(request.params.id);
    const etudiant = await recupererEtudiantParId(idEtudiant);

    if (!etudiant) {
      return response.status(404).json({
        message: "Etudiant introuvable.",
      });
    }

    return next();
  } catch (error) {
    return response.status(500).json({
      message: "Erreur serveur.",
    });
  }
}
