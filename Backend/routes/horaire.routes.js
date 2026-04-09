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
  updateAffectationValidee,
} from "../src/model/horaire.js";

/**
 * Initialiser les routes des horaires.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function horaireRoutes(app) {
  const accesLectureHoraires = [userAuth, userAdminOrResponsable];
  const accesGestionHoraires = [userAuth, userAdmin];

  function payloadAffectationValide(body = {}) {
    return (
      body.id_cours &&
      body.id_professeur &&
      body.id_salle &&
      body.id_groupes_etudiants &&
      body.date &&
      body.heure_debut &&
      body.heure_fin
    );
  }

  function dateGenerationValide(date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(date || ""));
  }

  /**
   * GET /api/horaires
   * Recuperer toutes les affectations de cours.
   */
  app.get("/api/horaires", ...accesLectureHoraires, async (request, response) => {
    try {
      const affectations = await getAllAffectations({
        sessionActive: request.query.session_active === "1",
      });
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
        id_groupes_etudiants,
        date,
        heure_debut,
        heure_fin,
      } = request.body;

      if (
        !id_cours ||
        !id_professeur ||
        !id_salle ||
        !id_groupes_etudiants ||
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
        idGroupeEtudiants: Number(id_groupes_etudiants),
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

  app.put(
    "/api/horaires/:id",
    ...accesGestionHoraires,
    async (request, response) => {
      try {
        const idAffectation = Number(request.params.id);

        if (!Number.isInteger(idAffectation) || idAffectation <= 0) {
          return response.status(400).json({ message: "Identifiant invalide." });
        }

        if (!payloadAffectationValide(request.body)) {
          return response.status(400).json({ message: "Champs manquants." });
        }

        const resultat = await updateAffectationValidee(idAffectation, {
          idCours: Number(request.body.id_cours),
          idProfesseur: Number(request.body.id_professeur),
          idSalle: Number(request.body.id_salle),
          idGroupeEtudiants: Number(request.body.id_groupes_etudiants),
          date: request.body.date,
          heureDebut: request.body.heure_debut,
          heureFin: request.body.heure_fin,
        });

        return response.status(200).json(resultat);
      } catch (error) {
        console.error("Erreur modification horaire :", error);
        return response
          .status(error.statusCode || 500)
          .json({ message: error.message || "Erreur serveur." });
      }
    }
  );

  /**
   * POST /api/horaires/generer
   * Generer automatiquement l'horaire pour tous les cours.
   */
  app.post(
    "/api/horaires/generer",
    ...accesGestionHoraires,
    async (request, response) => {
      try {
        const { programme, etape, session, date_debut } = request.body || {};

        if (!programme || !etape || !session) {
          return response.status(400).json({
            message:
              "Le programme, l'etape et la session sont obligatoires pour generer l'horaire.",
          });
        }

        if (date_debut && !dateGenerationValide(date_debut)) {
          return response.status(400).json({
            message: "La date de debut est invalide.",
          });
        }

        const resultat = await genererHoraireAutomatiquement({
          programme,
          etape,
          session,
          dateDebut: date_debut || null,
        });
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
      await deleteAllAffectations({
        deleteStudents: request.query.delete_students === "1",
        sessionActive: request.query.session_active === "1",
      });
      response.status(200).json({ message: "Horaires reinitialises." });
    } catch (error) {
      console.error("Erreur reset horaires :", error);
      response.status(500).json({ message: "Erreur serveur." });
    }
  });
}
