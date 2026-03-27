/**
 * ROUTES - Module Horaires
 *
 * Ce module definit toutes les routes HTTP liees aux horaires.
 */

import {
  userAdmin,
  userAdminOrResponsable,
  userAuth,
} from "../middlewares/auth.js";
import {
  creerAffectationValidee,
  deleteAffectation,
  deleteAllAffectations,
  genererHoraireAutomatiquement,
  getAffectationById,
  getAllAffectations,
} from "../src/model/horaire.js";

/**
 * Initialiser les routes des horaires.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function horaireRoutes(app) {
  const accesLectureHoraires = [userAuth, userAdminOrResponsable];
  const accesGestionHoraires = [userAuth, userAdmin];

  /**
   * GET /api/horaires
   * Recuperer toutes les affectations de cours.
   */
  app.get("/api/horaires", ...accesLectureHoraires, async (request, response) => {
    try {
      const affectations = await getAllAffectations();
      response.status(200).json(affectations);
    } catch (error) {
      console.error("Erreur consultation horaires :", error);
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  /**
   * GET /api/horaires/:id
   * Recuperer une affectation par son identifiant.
   */
  app.get("/api/horaires/:id", ...accesLectureHoraires, async (request, response) => {
    try {
      const idAffectation = Number(request.params.id);

      if (!Number.isInteger(idAffectation) || idAffectation <= 0) {
        return response.status(400).json({ message: "Identifiant invalide." });
      }

      const affectation = await getAffectationById(idAffectation);

      if (affectation) {
        response.status(200).json(affectation);
      } else {
        response.status(404).json({ message: "Affectation introuvable." });
      }
    } catch (error) {
      console.error("Erreur consultation horaire :", error);
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  /**
   * POST /api/horaires
   * Creer une affectation de cours (ajouter un creneau a l'horaire).
   */
  app.post("/api/horaires", ...accesGestionHoraires, async (request, response) => {
    try {
      const {
        id_cours,
        id_professeur,
        id_salle,
        date,
        heure_debut,
        heure_fin,
      } = request.body;

      if (
        !id_cours ||
        !id_professeur ||
        !id_salle ||
        !date ||
        !heure_debut ||
        !heure_fin
      ) {
        return response.status(400).json({ message: "Champs manquants." });
      }

      const resultat = await creerAffectationValidee({
        idCours: Number(id_cours),
        idProfesseur: Number(id_professeur),
        idSalle: Number(id_salle),
        date,
        heureDebut: heure_debut,
        heureFin: heure_fin,
      });

      return response.status(201).json(resultat);
    } catch (error) {
      console.error("Erreur creation horaire :", error);
      return response
        .status(error.statusCode || 500)
        .json({ message: error.message || "Erreur serveur." });
    }
  });

  /**
   * POST /api/horaires/generer
   * Generer automatiquement l'horaire pour tous les cours.
   */
  app.post(
    "/api/horaires/generer",
    ...accesGestionHoraires,
    async (request, response) => {
      try {
        const resultat = await genererHoraireAutomatiquement();
        response.status(201).json(resultat);
      } catch (error) {
        console.error("Erreur generation horaire :", error);
        response
          .status(error.statusCode || 500)
          .json({ message: error.message || "Erreur serveur." });
      }
    }
  );

  /**
   * DELETE /api/horaires/:id
   * Supprimer une affectation de cours.
   */
  app.delete(
    "/api/horaires/:id",
    ...accesGestionHoraires,
    async (request, response) => {
      try {
        const idAffectation = Number(request.params.id);

        if (!Number.isInteger(idAffectation) || idAffectation <= 0) {
          return response.status(400).json({ message: "Identifiant invalide." });
        }

        const affectation = await getAffectationById(idAffectation);

        if (!affectation) {
          return response.status(404).json({ message: "Affectation introuvable." });
        }

        await deleteAffectation(idAffectation);
        return response.status(200).json({ message: "Affectation supprimee." });
      } catch (error) {
        console.error("Erreur suppression horaire :", error);
        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * DELETE /api/horaires
   * Supprimer tous les horaires (reset).
   */
  app.delete("/api/horaires", ...accesGestionHoraires, async (request, response) => {
    try {
      await deleteAllAffectations();
      response.status(200).json({ message: "Horaires reinitialises." });
    } catch (error) {
      console.error("Erreur reset horaires :", error);
      response.status(500).json({ message: "Erreur serveur." });
    }
  });
}
