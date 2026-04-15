/**
 * Routes du module etudiants.
 *
 * Ce point d'entree regroupe :
 * - la consultation des etudiants ;
 * - l'horaire etudiant consolide ;
 * - l'import des cohortes ;
 * - les flux d'echange cible de cours entre etudiants.
 */

import { ImportEtudiantsError, importerEtudiantsDepuisFichier } from "../src/services/import-etudiants.service.js";
import { televerserFichierImportEtudiants } from "../src/validations/import-etudiants.validation.js";
import {
  recupererTousLesEtudiants,
  recupererEtudiantParId,
  recupererHoraireCompletEtudiant,
  supprimerTousLesEtudiants,
} from "../src/model/etudiants.model.js";
import {
  executerEchangeCoursEtudiants,
  listerCoursCommunsEchangeables,
  previsualiserEchangeCoursEtudiants,
} from "../src/services/etudiants/student-course-exchange.service.js";

export default function etudiantsRoutes(app) {
  // Consultation globale des etudiants, avec filtre optionnel sur la session active.
  app.get("/api/etudiants", async (request, response) => {
    try {
      const etudiants = await recupererTousLesEtudiants({
        sessionActive: request.query.session_active === "1",
      });
      response.status(200).json(etudiants);
    } catch (error) {
      response.status(500).json({
        message: "Erreur lors de la recuperation des etudiants.",
      });
    }
  });

  // Etape 1 du flux d'echange : lister les cours communs potentiellement echangeables.
  app.get("/api/etudiants/echange-cours/options", async (request, response) => {
    try {
      const resultat = await listerCoursCommunsEchangeables(
        Number(request.query.etudiant_a),
        Number(request.query.etudiant_b)
      );

      return response.status(200).json(resultat);
    } catch (error) {
      return response.status(error.statusCode || 500).json({
        message: error.message || "Erreur lors du chargement des cours communs.",
        ...(error.code ? { code: error.code } : {}),
        ...(error.details?.length ? { details: error.details } : {}),
      });
    }
  });

  // Etape 2 du flux d'echange : construire le diagnostic avant toute ecriture.
  app.get("/api/etudiants/echange-cours/preview", async (request, response) => {
    try {
      const resultat = await previsualiserEchangeCoursEtudiants({
        idEtudiantA: Number(request.query.etudiant_a),
        idEtudiantB: Number(request.query.etudiant_b),
        idCours: Number(request.query.id_cours),
      });

      return response.status(200).json(resultat);
    } catch (error) {
      return response.status(error.statusCode || 500).json({
        message: error.message || "Erreur lors de la previsualisation de l'echange.",
        ...(error.code ? { code: error.code } : {}),
        ...(error.details?.length ? { details: error.details } : {}),
      });
    }
  });

  // Etape 3 du flux d'echange : persister l'echange transactionnel.
  app.post("/api/etudiants/echange-cours", async (request, response) => {
    try {
      const resultat = await executerEchangeCoursEtudiants({
        idEtudiantA: Number(request.body?.id_etudiant_a),
        idEtudiantB: Number(request.body?.id_etudiant_b),
        idCours: Number(request.body?.id_cours),
      });

      return response.status(200).json(resultat);
    } catch (error) {
      return response.status(error.statusCode || 500).json({
        message: error.message || "Erreur lors de l'echange cible du cours.",
        ...(error.code ? { code: error.code } : {}),
        ...(error.details?.length ? { details: error.details } : {}),
      });
    }
  });

  app.get("/api/etudiants/:id", async (request, response) => {
    try {
      const etudiant = await recupererEtudiantParId(Number(request.params.id));

      if (!etudiant) {
        return response.status(404).json({ message: "Etudiant introuvable." });
      }

      response.status(200).json(etudiant);
    } catch (error) {
      response.status(500).json({
        message: "Erreur lors de la recuperation de l'etudiant.",
      });
    }
  });

  // Vue aggregatee de l'horaire effectif, incluant reprises et exceptions individuelles.
  app.get("/api/etudiants/:id/horaire", async (request, response) => {
    try {
      const resultat = await recupererHoraireCompletEtudiant(Number(request.params.id));

      if (!resultat) {
        return response.status(404).json({ message: "Etudiant introuvable." });
      }

      return response.status(200).json(resultat);
    } catch (error) {
      return response.status(500).json({
        message: "Erreur lors de la recuperation de l'horaire etudiant.",
      });
    }
  });

  app.post(
    "/api/etudiants/import",
    televerserFichierImportEtudiants,
    async (request, response) => {
      try {
        const resultat = await importerEtudiantsDepuisFichier(request.file);
        return response.status(200).json(resultat);
      } catch (error) {
        if (error instanceof ImportEtudiantsError) {
          return response.status(error.status || 400).json({
            message: error.message,
            ...(error.erreurs?.length ? { erreurs: error.erreurs } : {}),
          });
        }

        return response.status(500).json({
          message: error.message || "Erreur lors de l'import des etudiants.",
        });
      }
    }
  );

  app.delete("/api/etudiants", async (request, response) => {
    try {
      await supprimerTousLesEtudiants();
      response.status(200).json({
        message: "Tous les etudiants importes et leurs groupes orphelins ont ete supprimes.",
      });
    } catch (error) {
      response.status(500).json({
        message: "Erreur lors de la suppression des etudiants.",
      });
    }
  });
}
