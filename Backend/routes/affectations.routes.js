import {
  creerAffectation,
  recupererToutesLesAffectations,
  supprimerAffectation,
} from "../src/model/affectations.model.js";
import { validerAffectation } from "../src/validations/affectations.validation.js";

export default function affectationsRoutes(app) {

  // GET /api/affectations
  app.get("/api/affectations", async (request, response) => {
    try {
      const affectations = await recupererToutesLesAffectations();
      response.status(200).json(affectations);
    } catch (error) {
      response.status(500).json({ message: "Erreur lors de la recuperation des affectations." });
    }
  });

  // POST /api/affectations
  app.post("/api/affectations", async (request, response) => {
    try {
      validerAffectation(request.body);
      const resultat = await creerAffectation(request.body);
      response.status(201).json({ message: "Affectation creee", ...resultat });
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  });

  // DELETE /api/affectations/:id
  app.delete("/api/affectations/:id", async (request, response) => {
    try {
      const id = parseInt(request.params.id);
      if (isNaN(id)) return response.status(400).json({ message: "ID invalide." });
      await supprimerAffectation(id);
      response.status(200).json({ message: "Affectation supprimee." });
    } catch (error) {
      response.status(500).json({ message: error.message });
    }
  });
}