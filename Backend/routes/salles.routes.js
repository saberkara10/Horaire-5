/**
 * ROUTES - Module Salles
 *
 * Ce module definit toutes les routes HTTP liees aux salles.
 * Les validations sont appliquees avant l'appel au modele.
 */

import {
  codeSalleIsValide,
  typeSalleIsValide,
  capaciteSalleIsValide,
} from "../src/validations/salles.validation.js";
import {
  getAllSalles,
  getSalleById,
  addSalle,
  modifySalle,
  deleteSalle,
} from "../src/model/salle.js";

/**
 * Initialiser les routes des salles.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function sallesRoutes(app) {
  app.get("/api/salles", async (request, response) => {
    try {
      const salles = await getAllSalles();
      response.status(200).json(salles);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get("/api/salles/:id", async (request, response) => {
    try {
      const salle = await getSalleById(Number(request.params.id));

      if (!salle) {
        return response.status(404).json({ message: "Salle introuvable." });
      }

      response.status(200).json(salle);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.post(
    "/api/salles",
    codeSalleIsValide,
    typeSalleIsValide,
    capaciteSalleIsValide,
    async (request, response) => {
      try {
        const resultatInsertion = await addSalle(
          request.body.code,
          request.body.type,
          request.body.capacite
        );
        const salleAjoutee = await getSalleById(resultatInsertion.insertId);

        response.status(201).json(salleAjoutee);
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          return response
            .status(409)
            .json({ message: "Le code de salle existe deja." });
        }

        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.put(
    "/api/salles/:id",
    typeSalleIsValide,
    capaciteSalleIsValide,
    async (request, response) => {
      try {
        const idSalle = Number(request.params.id);
        const salle = await getSalleById(idSalle);

        if (!salle) {
          return response.status(404).json({ message: "Salle introuvable." });
        }

        await modifySalle(idSalle, request.body.type, request.body.capacite);

        const salleModifiee = await getSalleById(idSalle);
        response.status(200).json(salleModifiee);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.delete("/api/salles/:id", async (request, response) => {
    try {
      const idSalle = Number(request.params.id);
      const salle = await getSalleById(idSalle);

      if (!salle) {
        return response.status(404).json({ message: "Salle introuvable." });
      }

      await deleteSalle(idSalle);
      response.status(200).json({ message: "Salle supprimee." });
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });
}
