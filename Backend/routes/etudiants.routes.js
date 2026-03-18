/**
 * ROUTES — Module Étudiants
 *
 * Ce module définit les routes HTTP liées aux étudiants.
 * Ici, on gère la consultation de l'horaire d'un étudiant.
 */

import {
  recupererHoraireCompletEtudiant,
} from "../src/model/etudiants.model.js";

import {
  validerIdEtudiant,
  verifierEtudiantExiste,
} from "../src/validations/etudiants.validations.js";

/**
 * Initialiser les routes des étudiants.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function etudiantsRoutes(app) {
  /**
   * GET /api/etudiants/:id/horaire
   * Récupérer les informations d'un étudiant avec son horaire.
   */
  app.get(
    "/api/etudiants/:id/horaire",
    validerIdEtudiant,
    verifierEtudiantExiste,
    async (request, response) => {
      try {
        const horaireEtudiant = await recupererHoraireCompletEtudiant(
          Number(request.params.id)
        );

        response.status(200).json(horaireEtudiant);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );
}