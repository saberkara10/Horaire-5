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
import {
  validerIdCours,
  verifierCoursExiste,
  validerCreateCours,
  validerUpdateCours,
  validerDeleteCours,
} from "../src/validations/cours.validations.js";

/**
 * Initialise et enregistre les routes des cours sur l'application Express.
 *
 * @param {import("express").Express} app - L'instance de l'application Express
 */
export default function coursRoutes(app) {
  /**
   * GET /api/cours
   * Liste complète de tous les cours avec détails de salle de référence.
   *
   * @returns {object[]} 200 - Liste des cours triée par code
   * @returns {object}   500 - Erreur serveur
   */
  app.get("/api/cours", async (request, response) => {
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
  app.get("/api/cours/options", async (request, response) => {
    try {
      const typesSalleDisponibles = await recupererTypesSalleDisponibles();
      response.status(200).json({ types_salle: typesSalleDisponibles });
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

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
