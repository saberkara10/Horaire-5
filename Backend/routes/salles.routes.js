/**
 * Routes — Module Salles.
 *
 * Ce module définit toutes les routes HTTP liées à la gestion des salles.
 *
 * Architecture des accès :
 *  - Lecture  → tous les utilisateurs authentifiés (admins et responsables)
 *  - Écriture → administrateurs uniquement (création, modification, suppression)
 *
 * Ordre des routes important :
 *  /api/salles/types  → DOIT être avant /api/salles/:id
 *  Sinon Express interpréterait "types" comme une valeur d'ID, causant une erreur.
 *
 * Pipeline de middleware utilisé :
 *  1. Authentification (userAuth, userAdmin, userAdminOrResponsable)
 *  2. Validation de l'entrée (validerIdSalle, validerCreateSalle...)
 *  3. Vérification d'existence (verifierSalleExiste → met request.salle)
 *  4. Traitement métier (appel au modèle, réponse HTTP)
 *
 * @module routes/salles
 */
import {
  addSalle,
  deleteSalle,
  getAllSalles,
  getSalleByCode,
  getSalleById,
  getTypesSalles,
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

/**
 * Vérifie qu'une date est au format YYYY-MM-DD.
 *
 * @param {*} dateReference - La valeur à valider
 * @returns {boolean} true si le format est correct
 */
function dateReferenceValide(dateReference) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateReference || "").trim());
}

/**
 * Initialise et enregistre les routes des salles sur l'application Express.
 *
 * @param {import("express").Express} app - L'instance de l'application Express
 */
export default function sallesRoutes(app) {
  // Groupes de middlewares réutilisables pour ne pas répéter la logique d'accès
  const accesLectureSalles = [userAuth, userAdminOrResponsable];  // Lecture : admin ou responsable
  const accesGestionSalles = [userAuth, userAdmin];                // Écriture : admin seulement

  /**
   * GET /api/salles
   * Liste complète de toutes les salles.
   *
   * @returns {object[]} 200 - Liste des salles
   * @returns {object}   500 - Erreur serveur
   */
  app.get("/api/salles", ...accesLectureSalles, async (request, response) => {
    try {
      const salles = await getAllSalles();
      response.status(200).json(salles);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  /**
   * GET /api/salles/types
   * Liste des types de salles distincts (ex: "Laboratoire", "Salle de cours").
   *
   * IMPORTANT : Cette route DOIT être déclarée AVANT /api/salles/:id.
   * Sinon Express lirait "types" comme un ID numérique et échouerait la validation.
   *
   * @returns {string[]} 200 - Liste triée des types de salles
   * @returns {object}   500 - Erreur serveur
   */
  app.get("/api/salles/types", ...accesLectureSalles, async (request, response) => {
    try {
      const types = await getTypesSalles();
      response.status(200).json(types);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  /**
   * GET /api/salles/:id
   * Détails d'une salle spécifique.
   *
   * La salle est chargée par verifierSalleExiste() et mise dans request.salle.
   *
   * @param {number} id - Identifiant de la salle
   * @returns {object} 200 - La salle trouvée
   * @returns {object} 400 - ID invalide
   * @returns {object} 404 - Salle introuvable
   */
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
   * Vue complète de l'occupation d'une salle sur une session académique.
   *
   * Query params supportés :
   *  - id_session      → session cible (entier, utilise la session active si absent)
   *  - date_reference  → semaine de départ au format YYYY-MM-DD
   *
   * Le résultat inclut les séances planifiées, les indicateurs V2 et le
   * résumé dynamique V3, permettant la navigation hebdomadaire côté client
   * sans refaire d'appel API.
   *
   * @param {number} id - Identifiant de la salle
   * @returns {object} 200 - Vue complète d'occupation
   * @returns {object} 400 - id_session ou date_reference invalide
   * @returns {object} 404 - Salle introuvable
   * @returns {object} 500 - Erreur serveur
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

        // Valider l'ID de session si fourni
        if (
          request.query.id_session !== undefined &&
          (!Number.isInteger(idSession) || idSession <= 0)
        ) {
          return response.status(400).json({ message: "Session invalide." });
        }

        // Valider le format de la date de référence si fournie
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
            salle: request.salle, // Passé directement depuis verifierSalleExiste
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

  /**
   * POST /api/salles
   * Crée une nouvelle salle.
   *
   * Le code doit être unique. Si un doublon est détecté (ER_DUP_ENTRY),
   * on retourne 409 Conflict avec un message explicite.
   *
   * @body {string} code     - Code unique de la salle (ex: "A-101")
   * @body {string} type     - Type de salle (ex: "Laboratoire")
   * @body {number} capacite - Nombre de places
   * @returns {object} 201 - La salle créée
   * @returns {object} 409 - Code déjà utilisé
   * @returns {object} 500 - Erreur serveur
   */
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

        // Relire la salle créée pour retourner l'objet complet avec ID
        const salleAjoutee = await getSalleByCode(code);

        response.status(201).json(
          salleAjoutee || { code, type, capacite } // Fallback si la lecture échoue
        );
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          // MySQL retourne ER_DUP_ENTRY en cas de violation de contrainte UNIQUE
          return response.status(409).json({ message: "Code deja utilise." });
        }

        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * PUT /api/salles/:id
   * Modifie le type et/ou la capacité d'une salle existante.
   *
   * Note : le code de la salle est immuable — il ne peut pas être modifié.
   * La salle doit exister (verifierSalleExiste) et les nouvelles valeurs
   * sont validées par validerUpdateSalle avant traitement.
   *
   * Si un champ n'est pas fourni dans le body, la valeur actuelle de la salle
   * est conservée grâce à l'opérateur ?? (nullish coalescing).
   *
   * @param {number} id - Identifiant de la salle à modifier
   * @body {string} [type]     - Nouveau type (conservé si absent)
   * @body {number} [capacite] - Nouvelle capacité (conservée si absente)
   * @returns {object} 200 - La salle mise à jour
   * @returns {object} 404 - Salle introuvable
   * @returns {object} 500 - Erreur serveur
   */
  app.put(
    "/api/salles/:id",
    ...accesGestionSalles,
    validerIdSalle,
    verifierSalleExiste,
    validerUpdateSalle,
    async (request, response) => {
      try {
        // Si le champ n'est pas fourni, conserver la valeur actuelle de la salle
        const type = request.body.type ?? request.salle.type;
        const capacite = request.body.capacite ?? request.salle.capacite;

        await modifySalle(Number(request.params.id), type, Number(capacite));

        // Relire la salle pour retourner l'état à jour
        const salleModifiee = await getSalleById(Number(request.params.id));
        response.status(200).json(salleModifiee);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * DELETE /api/salles/:id
   * Supprime une salle.
   *
   * La suppression est refusée si la salle est référencée dans un horaire
   * (ER_ROW_IS_REFERENCED_2 = violation de clé étrangère MySQL).
   * Le middleware validerDeleteSalle peut également refuser selon des règles métier.
   *
   * @param {number} id - Identifiant de la salle à supprimer
   * @returns {object} 200 - { message: "Salle supprimee." }
   * @returns {object} 400 - Suppression impossible (salle utilisée dans un planning)
   * @returns {object} 404 - Salle introuvable
   * @returns {object} 500 - Erreur serveur
   */
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
          // La salle est encore utilisée dans affectation_cours ou cours.id_salle_reference
          return response.status(400).json({
            message: "Suppression impossible : salle deja affectee.",
          });
        }

        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );
}
