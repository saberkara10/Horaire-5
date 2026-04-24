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
import { userAdminOrResponsable, userAuth } from "../middlewares/auth.js";
import { journaliserActivite } from "../src/services/activity-log.service.js";

export default function etudiantsRoutes(app) {
  const accesEtudiants = [userAuth, userAdminOrResponsable];

  // Consultation globale des etudiants, avec filtre optionnel sur la session active.
  app.get("/api/etudiants", ...accesEtudiants, async (request, response) => {
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
  app.get("/api/etudiants/echange-cours/options", ...accesEtudiants, async (request, response) => {
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
  app.get("/api/etudiants/echange-cours/preview", ...accesEtudiants, async (request, response) => {
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
  app.post("/api/etudiants/echange-cours", ...accesEtudiants, async (request, response) => {
    try {
      const resultat = await executerEchangeCoursEtudiants({
        idEtudiantA: Number(request.body?.id_etudiant_a),
        idEtudiantB: Number(request.body?.id_etudiant_b),
        idCours: Number(request.body?.id_cours),
      });

      await journaliserActivite({
        request,
        actionType: "UPDATE",
        module: "Etudiants",
        targetType: "Echange cours",
        targetId: request.body?.id_cours,
        description: `Echange de cours entre les etudiants ${request.body?.id_etudiant_a} et ${request.body?.id_etudiant_b}.`,
        newValue: resultat,
      });

      return response.status(200).json(resultat);
    } catch (error) {
      await journaliserActivite({
        request,
        actionType: "UPDATE",
        module: "Etudiants",
        targetType: "Echange cours",
        targetId: request.body?.id_cours,
        description: "Echec d'un echange de cours entre etudiants.",
        status: "ERROR",
        errorMessage: error.message,
        newValue: request.body,
      });
      return response.status(error.statusCode || 500).json({
        message: error.message || "Erreur lors de l'echange cible du cours.",
        ...(error.code ? { code: error.code } : {}),
        ...(error.details?.length ? { details: error.details } : {}),
      });
    }
  });

  app.get("/api/etudiants/:id", ...accesEtudiants, async (request, response) => {
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
  app.get("/api/etudiants/:id/horaire", ...accesEtudiants, async (request, response) => {
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
    ...accesEtudiants,
    televerserFichierImportEtudiants,
    async (request, response) => {
      try {
        const resultat = await importerEtudiantsDepuisFichier(request.file);
        await journaliserActivite({
          request,
          actionType: "IMPORT",
          module: "Etudiants",
          targetType: "Fichier Excel",
          description: "Importation Excel des etudiants.",
          newValue: { fichier: request.file?.originalname, resultat },
        });
        return response.status(200).json(resultat);
      } catch (error) {
        await journaliserActivite({
          request,
          actionType: "IMPORT",
          module: "Etudiants",
          targetType: "Fichier Excel",
          description: "Echec de l'importation Excel des etudiants.",
          status: "ERROR",
          errorMessage: error.message,
          newValue: { fichier: request.file?.originalname },
        });
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

  app.delete("/api/etudiants", ...accesEtudiants, async (request, response) => {
    try {
      await supprimerTousLesEtudiants();
      await journaliserActivite({
        request,
        actionType: "RESET",
        module: "Etudiants",
        targetType: "Etudiants",
        description: "Suppression de tous les etudiants importes.",
      });
      response.status(200).json({
        message: "Tous les etudiants importes et leurs groupes orphelins ont ete supprimes.",
      });
    } catch (error) {
      await journaliserActivite({
        request,
        actionType: "RESET",
        module: "Etudiants",
        targetType: "Etudiants",
        description: "Echec de suppression de tous les etudiants importes.",
        status: "ERROR",
        errorMessage: error.message,
      });
      response.status(500).json({
        message: "Erreur lors de la suppression des etudiants.",
      });
    }
  });
}
