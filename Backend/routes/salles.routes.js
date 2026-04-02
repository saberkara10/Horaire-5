/**
 * ROUTES - Module Salles
 *
 * Ce module definit les routes HTTP liees
 * a la gestion des salles.
 */
import {
  addSalle,
  deleteSalle,
  getAllSalles,
  getSalleByCode,
  getSalleById,
  modifySalle,
} from "../src/model/salle.js";
import {
  validerCreateSalle,
  validerDeleteSalle,
  validerIdSalle,
  validerUpdateSalle,
  verifierSalleExiste,
} from "../src/validations/salles.validation.js";
import { userAdmin, userAuth } from "../middlewares/auth.js";

export default function sallesRoutes(app) {
  const accesGestionSalles = [userAuth, userAdmin];

  app.get("/api/salles", ...accesGestionSalles, async (request, response) => {
    try {
      const salles = await getAllSalles();
      response.status(200).json(salles);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get(
    "/api/salles/:id",
    ...accesGestionSalles,
    validerIdSalle,
    verifierSalleExiste,
    async (request, response) => {
      try {
        response.status(200).json(request.salle);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.post(
    "/api/salles",
    ...accesGestionSalles,
    validerCreateSalle,
    async (request, response) => {
      try {
        const code = String(request.body.code).trim();
        const type = String(request.body.type).trim();
        const capacite = Number(request.body.capacite);

        await addSalle(code, type, capacite);
        const salleAjoutee = await getSalleByCode(code);

        response.status(201).json(
          salleAjoutee || {
            code,
            type,
            capacite,
          }
        );
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          return response.status(409).json({ message: "Code deja utilise." });
        }

        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.put(
    "/api/salles/:id",
    ...accesGestionSalles,
    validerIdSalle,
    verifierSalleExiste,
    validerUpdateSalle,
    async (request, response) => {
      try {
        const type = request.body.type ?? request.salle.type;
        const capacite = request.body.capacite ?? request.salle.capacite;

        await modifySalle(Number(request.params.id), type, Number(capacite));
        const salleModifiee = await getSalleById(Number(request.params.id));

        response.status(200).json(salleModifiee);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.delete(
    "/api/salles/:id",
    ...accesGestionSalles,
    validerIdSalle,
    verifierSalleExiste,
    validerDeleteSalle,
    async (request, response) => {
      try {
        await deleteSalle(Number(request.params.id));
        response.status(200).json({ message: "Salle supprimee." });
      } catch (error) {
        if (error.code === "ER_ROW_IS_REFERENCED_2") {
          return response.status(400).json({
            message: "Suppression impossible : salle deja affectee.",
          });
        }

        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );
}
/**
 * ROUTES - Module Salles
 *
 * Ce module definit les routes HTTP liees
 * a la gestion des salles.
 */
