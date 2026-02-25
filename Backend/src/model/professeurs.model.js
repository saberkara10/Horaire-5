/**
 * ROUTES — Module Professeurs
 *
 * Ce module définit toutes les routes HTTP liées aux professeurs.
 * Les validations sont appliquées avant l'appel au modèle.
 */

import {
  recupererTousLesProfesseurs,
  recupererProfesseurParId,
  ajouterProfesseur,
  modifierProfesseur,
  supprimerProfesseur,
} from "../src/model/professeurs.model.js";

import {
  validerIdProfesseur,
  verifierProfesseurExiste,
  validerCreateProfesseur,
  validerUpdateProfesseur,
  validerDeleteProfesseur,
} from "../src/validations/professeurs.validations.js";

/**
 * Initialiser les routes des professeurs.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function professeursRoutes(app) {
  /**
   * GET /api/professeurs
   * Récupérer tous les professeurs.
   */
  app.get("/api/professeurs", async (request, response) => {
    try {
      const professeurs = await recupererTousLesProfesseurs();
      response.status(200).json(professeurs);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  /**
   * GET /api/professeurs/:id
   * Récupérer un professeur par son identifiant.
   */
  app.get(
    "/api/professeurs/:id",
    validerIdProfesseur,
    verifierProfesseurExiste,
    async (request, response) => {
      try {
        response.status(200).json(request.professeur);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * POST /api/professeurs
   * Ajouter un nouveau professeur.
   */
  app.post(
    "/api/professeurs",
    validerCreateProfesseur,
    async (request, response) => {
      try {
        const professeurAjoute = await ajouterProfesseur(request.body);
        response.status(201).json(professeurAjoute);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * PUT /api/professeurs/:id
   * Modifier un professeur existant.
   */
  app.put(
    "/api/professeurs/:id",
    validerIdProfesseur,
    verifierProfesseurExiste,
    validerUpdateProfesseur,
    async (request, response) => {
      try {
        const professeurModifie = await modifierProfesseur(
          Number(request.params.id),
          request.body
        );

        response.status(200).json(professeurModifie);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * DELETE /api/professeurs/:id
   * Supprimer un professeur (DELETE réel).
   */
  app.delete(
    "/api/professeurs/:id",
    validerIdProfesseur,
    verifierProfesseurExiste,
    validerDeleteProfesseur,
    async (request, response) => {
      try {
        await supprimerProfesseur(Number(request.params.id));
        response.status(200).json({ message: "Professeur supprimé." });
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );
}