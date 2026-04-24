/**
 * Routes — Module Cours.
 *
 * Ce module définit les routes HTTP pour la gestion CRUD des cours.
 * Les validations sont appliquées comme middlewares avant d'appeler le modèle,
 * ce qui garantit qu'aucune donnée invalide n'atteint la couche BDD.
 *
 * Particularité de ce module :
 * Contrairement aux routes salles/professeurs, les routes cours ne nécessitent
 * pas de vérification de rôle explicite sur chaque route (la protection est
 * gérée globalement ou via les middlewares d'authentification de session).
 * À renforcer si des exigences de contrôle d'accès spécifiques apparaissent.
 *
 * Routes disponibles :
 *  - GET    /api/cours         → liste tous les cours
 *  - GET    /api/cours/options → types de salles disponibles (pour les formulaires)
 *  - GET    /api/cours/:id     → détail d'un cours
 *  - POST   /api/cours         → créer un cours
 *  - PUT    /api/cours/:id     → modifier un cours
 *  - DELETE /api/cours/:id     → supprimer un cours
 *
 * @module routes/cours
 */

import {
  recupererTousLesCours,
  recupererTypesSalleDisponibles,
  ajouterCours,
  modifierCours,
  supprimerCours,
} from "../src/model/cours.model.js";
import { ImportExcelError } from "../src/services/import-excel.shared.js";
import { genererModeleImportExcel } from "../src/services/import-excel-template.service.js";
import { importerCoursDepuisFichier } from "../src/services/import-cours.service.js";
import {
  validerIdCours,
  verifierCoursExiste,
  validerCreateCours,
  validerUpdateCours,
  validerDeleteCours,
} from "../src/validations/cours.validations.js";
import { televerserFichierImportExcel } from "../src/validations/import-excel.validation.js";
import { userAdminOrResponsable, userAuth } from "../middlewares/auth.js";
import { requireResourceLock } from "../middlewares/concurrency.js";
import { journaliserActivite } from "../src/services/activity-log.service.js";

/**
 * Initialise et enregistre les routes des cours sur l'application Express.
 *
 * @param {import("express").Express} app - L'instance de l'application Express
 */
export default function coursRoutes(app) {
  const accesCours = [userAuth, userAdminOrResponsable];
  const verrouCours = requireResourceLock("cours", (request) => request.params.id);

  /**
   * GET /api/cours
   * Liste complète de tous les cours avec détails de salle de référence.
   *
   * @returns {object[]} 200 - Liste des cours triée par code
   * @returns {object}   500 - Erreur serveur
   */
  app.get("/api/cours", ...accesCours, async (request, response) => {
    try {
      const cours = await recupererTousLesCours();
      response.status(200).json(cours);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  /**
   * GET /api/cours/options
   * Options pour les formulaires — retourne les types de salles distincts.
   *
   * Utilisée par le formulaire de création/modification de cours pour alimenter
   * la liste déroulante des types de salles requis.
   *
   * Note : déclarée AVANT /api/cours/:id pour éviter qu'Express interprète
   * "options" comme un ID numérique.
   *
   * @returns {{ types_salle: string[] }} 200 - Types de salles disponibles
   * @returns {object}                   500 - Erreur serveur
   */
  app.get("/api/cours/options", ...accesCours, async (request, response) => {
    try {
      const typesSalleDisponibles = await recupererTypesSalleDisponibles();
      response.status(200).json({ types_salle: typesSalleDisponibles });
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get("/api/cours/import/template", ...accesCours, async (request, response) => {
    try {
      const modele = genererModeleImportExcel("cours");
      response.setHeader("Content-Type", modele.contentType);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${modele.filename}"`
      );
      return response.status(200).send(modele.buffer);
    } catch (error) {
      return response.status(error.status || 500).json({
        message: error.message || "Erreur serveur.",
        ...(error.erreurs?.length ? { erreurs: error.erreurs } : {}),
      });
    }
  });

  app.post(
    "/api/cours/import",
    ...accesCours,
    televerserFichierImportExcel,
    async (request, response) => {
      try {
        const resultat = await importerCoursDepuisFichier(request.file);
        await journaliserActivite({
          request,
          actionType: "IMPORT",
          module: "Cours",
          targetType: "Fichier Excel",
          description: "Importation Excel des cours.",
          newValue: {
            fichier: request.file?.originalname,
            resultat,
          },
        });
        return response.status(200).json(resultat);
      } catch (error) {
        await journaliserActivite({
          request,
          actionType: "IMPORT",
          module: "Cours",
          targetType: "Fichier Excel",
          description: "Echec de l'importation Excel des cours.",
          status: "ERROR",
          errorMessage: error.message,
          newValue: { fichier: request.file?.originalname },
        });
        if (error instanceof ImportExcelError) {
          return response.status(error.status || 400).json({
            message: error.message,
            ...(error.erreurs?.length ? { erreurs: error.erreurs } : {}),
          });
        }

        return response.status(500).json({
          message: error.message || "Erreur serveur.",
        });
      }
    }
  );

  /**
   * GET /api/cours/:id
   * Détail d'un cours par son identifiant.
   *
   * Le middleware verifierCoursExiste charge le cours et le met dans request.cours.
   * Si le cours n'existe pas, verifierCoursExiste retourne 404 directement.
   *
   * @param {number} id - Identifiant du cours
   * @returns {object} 200 - Le cours trouvé
   * @returns {object} 400 - ID invalide
   * @returns {object} 404 - Cours introuvable
   */
  app.get(
    "/api/cours/:id",
    ...accesCours,
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

  /**
   * POST /api/cours
   * Crée un nouveau cours.
   *
   * Le modèle déduit automatiquement le `type_salle` depuis la salle de référence
   * et normalise le programme via `assurerProgrammeReference()`.
   *
   * @body {object} corps de la requête — validé par validerCreateCours
   * @returns {object} 201 - Le cours créé avec son ID
   * @returns {object} 400 - Données invalides
   * @returns {object} 500 - Erreur serveur (ou salle de référence introuvable)
   */
  app.post(
    "/api/cours",
    ...accesCours,
    validerCreateCours,
    async (request, response) => {
      try {
        const nouveauCours = await ajouterCours(request.body);
        await journaliserActivite({
          request,
          actionType: "CREATE",
          module: "Cours",
          targetType: "Cours",
          targetId: nouveauCours?.id_cours,
          description: `Creation du cours ${nouveauCours?.code || request.body?.code || ""}.`.trim(),
          newValue: nouveauCours,
        });
        response.status(201).json(nouveauCours);
      } catch (error) {
        await journaliserActivite({
          request,
          actionType: "CREATE",
          module: "Cours",
          targetType: "Cours",
          description: "Echec de creation d'un cours.",
          status: "ERROR",
          errorMessage: error.message,
          newValue: request.body,
        });
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * PUT /api/cours/:id
   * Modifie un cours existant (mise à jour partielle).
   *
   * Seuls les champs présents dans le body sont modifiés — les absents
   * conservent leur valeur actuelle (UPDATE partiel dans le modèle).
   *
   * @param {number} id - Identifiant du cours à modifier
   * @body {object} donneesModification - Champs à mettre à jour
   * @returns {object} 200 - Le cours mis à jour
   * @returns {object} 404 - Cours introuvable
   * @returns {object} 500 - Erreur serveur
   */
  app.put(
    "/api/cours/:id",
    ...accesCours,
    validerIdCours,
    verifierCoursExiste,
    validerUpdateCours,
    verrouCours,
    async (request, response) => {
      try {
        const ancienCours = request.cours;
        const coursModifie = await modifierCours(
          Number(request.params.id),
          request.body
        );

        await journaliserActivite({
          request,
          actionType: "UPDATE",
          module: "Cours",
          targetType: "Cours",
          targetId: request.params.id,
          description: `Modification du cours ${coursModifie?.code || ancienCours?.code || request.params.id}.`,
          oldValue: ancienCours,
          newValue: coursModifie,
        });

        response.status(200).json(coursModifie);
      } catch (error) {
        await journaliserActivite({
          request,
          actionType: "UPDATE",
          module: "Cours",
          targetType: "Cours",
          targetId: request.params.id,
          description: "Echec de modification d'un cours.",
          status: "ERROR",
          errorMessage: error.message,
          oldValue: request.cours,
          newValue: request.body,
        });
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * DELETE /api/cours/:id
   * Supprime un cours.
   *
   * Le middleware validerDeleteCours vérifie que le cours n'est pas déjà
   * utilisé dans un horaire planifié avant d'autoriser la suppression.
   *
   * @param {number} id - Identifiant du cours à supprimer
   * @returns {object} 200 - { message: "Cours supprime." }
   * @returns {object} 400 - Cours déjà affecté dans un planning (suppression refusée)
   * @returns {object} 404 - Cours introuvable
   * @returns {object} 500 - Erreur serveur
   */
  app.delete(
    "/api/cours/:id",
    ...accesCours,
    validerIdCours,
    verifierCoursExiste,
    validerDeleteCours,
    verrouCours,
    async (request, response) => {
      try {
        const ancienCours = request.cours;
        await supprimerCours(Number(request.params.id));
        await journaliserActivite({
          request,
          actionType: "DELETE",
          module: "Cours",
          targetType: "Cours",
          targetId: request.params.id,
          description: `Suppression du cours ${ancienCours?.code || request.params.id}.`,
          oldValue: ancienCours,
        });
        response.status(200).json({ message: "Cours supprime." });
      } catch (error) {
        await journaliserActivite({
          request,
          actionType: "DELETE",
          module: "Cours",
          targetType: "Cours",
          targetId: request.params.id,
          description: "Echec de suppression d'un cours.",
          status: "ERROR",
          errorMessage: error.message,
          oldValue: request.cours,
        });
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );
}
