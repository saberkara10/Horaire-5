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
  recupererOccupationSalle,
} from "../src/model/salle.js";
import {
  validerCreateSalle,
  validerDeleteSalle,
  validerIdSalle,
  validerUpdateSalle,
  verifierSalleExiste,
} from "../src/validations/salles.validation.js";
import { userAdmin, userAdminOrResponsable, userAuth } from "../middlewares/auth.js";

function dateReferenceValide(dateReference) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateReference || "").trim());
}

export default function sallesRoutes(app) {
  const accesLectureSalles = [userAuth, userAdminOrResponsable];
  const accesGestionSalles = [userAuth, userAdmin];

  app.get("/api/salles", ...accesLectureSalles, async (request, response) => {
    try {
      const salles = await getAllSalles();
      response.status(200).json(salles);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get(
    "/api/salles/:id",
    ...accesLectureSalles,
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

  /**
   * GET /api/salles/:id/occupation
   * Retourne l'occupation complete d'une salle pour une session academique.
   *
   * Query params supportes :
   * - id_session     session explicite a consulter ;
   * - date_reference semaine initiale au format YYYY-MM-DD.
   */
  app.get(
    "/api/salles/:id/occupation",
    ...accesLectureSalles,
    validerIdSalle,
    verifierSalleExiste,
    async (request, response) => {
      try {
        const idSession = request.query.id_session
          ? Number(request.query.id_session)
          : null;
        const dateReference = String(request.query.date_reference || "").trim() || null;

        if (
          request.query.id_session !== undefined &&
          (!Number.isInteger(idSession) || idSession <= 0)
        ) {
          return response.status(400).json({ message: "Session invalide." });
        }

        if (dateReference && !dateReferenceValide(dateReference)) {
          return response.status(400).json({
            message: "La date_reference doit etre au format YYYY-MM-DD.",
          });
        }

        const occupation = await recupererOccupationSalle(
          Number(request.params.id),
          {
            id_session: idSession,
            date_reference: dateReference,
            salle: request.salle,
          }
        );

        return response.status(200).json(occupation);
      } catch (error) {
        return response
          .status(error.statusCode || 500)
          .json({ message: error.message || "Erreur serveur." });
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
