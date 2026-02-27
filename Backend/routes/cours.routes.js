/**
 * ROUTES — Module Cours
 *
 * Ce module définit toutes les routes HTTP liées aux cours.
 * Les validations sont appliquées avant l'appel au modèle.
 */

import { recupererTousLesCours, ajouterCours, modifierCours, supprimerCours, } from "../src/model/cours.model.js";

import { validerIdCours, verifierCoursExiste, validerCreateCours, validerUpdateCours, validerDeleteCours, } from "../src/validations/cours.validations.js";

/**
 * Initialiser les routes des cours.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function coursRoutes(app) {
  /**
   * GET /api/cours
   * Récupérer tous les cours.
   */
  app.get("/api/cours", async (request, response) => {
    try {
      const cours = await recupererTousLesCours();
      response.status(200).json(cours);
    } catch (error) {
      console.error("ERREUR GET /api/cours :", error);  
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  /**
   * GET /api/cours/:id
   * Récupérer un cours par son identifiant.
   */
  app.get(
    "/api/cours/:id",
    validerIdCours,
    verifierCoursExiste,
    async (request, response) => {
      try {
        response.status(200).json(request.cours);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * POST /api/cours
   * Ajouter un nouveau cours.
   */
  app.post(
    "/api/cours",
    validerCreateCours,
    async (request, response) => {
      try {
        const nouveauCours = await ajouterCours(request.body);
        response.status(201).json(nouveauCours);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * PUT /api/cours/:id
   * Modifier un cours existant.
   */
  app.put(
    "/api/cours/:id",
    validerIdCours,
    verifierCoursExiste,
    validerUpdateCours,
    async (request, response) => {
      try {
        const coursModifie = await modifierCours(
          Number(request.params.id),
          request.body
        );

        response.status(200).json(coursModifie);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * DELETE /api/cours/:id
   * Supprimer un cours (DELETE réel).
   */
  app.delete(
    "/api/cours/:id",
    validerIdCours,
    verifierCoursExiste,
    validerDeleteCours,
    async (request, response) => {
      try {
        await supprimerCours(Number(request.params.id));
        response.status(200).json({ message: "Cours supprimé." });
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );
}