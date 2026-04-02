/**
 * ROUTES - Module Groupes
 *
 * Ce module definit les routes HTTP
 * liees aux groupes et a leurs horaires.
 */

import {
  recupererGroupes,
  recupererPlanningCompletGroupe,
} from "../src/model/groupes.model.js";

/**
 * Initialiser les routes des groupes.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function groupesRoutes(app) {
  /**
   * GET /api/groupes
   * Recuperer la liste des groupes.
   */
  app.get("/api/groupes", async (request, response) => {
    try {
      const detailsDemandes = request.query.details === "1";
      const groupes = await recupererGroupes(detailsDemandes);
      response.status(200).json(groupes);
    } catch (error) {
      response
        .status(500)
        .json({ message: "Erreur lors de la recuperation des groupes." });
    }
  });

  /**
   * GET /api/groupes/:id/planning
   * Recuperer l'horaire d'un groupe.
   */
  app.get(
    "/api/groupes/:id/planning",
    async (request, response) => {
      try {
        const idGroupe = Number(request.params.id);

        if (!Number.isInteger(idGroupe) || idGroupe <= 0) {
          return response.status(400).json({ message: "Identifiant invalide." });
        }

        const resultat = await recupererPlanningCompletGroupe(idGroupe);

        if (!resultat) {
          return response.status(404).json({ message: "Groupe introuvable." });
        }

        return response.status(200).json(resultat);
      } catch (error) {
        return response
          .status(500)
          .json({ message: "Erreur lors de la recuperation du planning groupe." });
      }
    }
  );
}
