/**
 * ROUTES - Module Cours
 *
 * Ce module definit toutes les routes HTTP liees aux cours.
 * Les validations sont appliquees avant l'appel au modele.
 */

import {
  recupererTousLesCours,
  recupererTypesSalleDisponibles,
  ajouterCours,
  modifierCours,
  supprimerCours,
} from "../src/model/cours.model.js";
import {
  validerIdCours,
  verifierCoursExiste,
  validerCreateCours,
  validerUpdateCours,
  validerDeleteCours,
} from "../src/validations/cours.validations.js";

export default function coursRoutes(app) {
  app.get("/api/cours", async (request, response) => {
    try {
      const cours = await recupererTousLesCours();
      response.status(200).json(cours);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get("/api/cours/options", async (request, response) => {
    try {
      const typesSalleDisponibles = await recupererTypesSalleDisponibles();
      response.status(200).json({ types_salle: typesSalleDisponibles });
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

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

  app.delete(
    "/api/cours/:id",
    validerIdCours,
    verifierCoursExiste,
    validerDeleteCours,
    async (request, response) => {
      try {
        await supprimerCours(Number(request.params.id));
        response.status(200).json({ message: "Cours supprime." });
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );
}
