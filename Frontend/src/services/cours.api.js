/**
 * Service — Cours API.
 *
 * Centralise tous les appels HTTP liés à la gestion des cours.
 * Un cours représente une matière enseignée dans un programme donné.
 * Les opérations CRUD sont simples : pas de logique métier côté frontend,
 * tout est géré par le backend (normalisation, validation du type de salle...).
 *
 * @module services/cours.api
 */

import { apiRequest, telechargerFichier } from "./api.js";

/**
 * URL de base pour toutes les routes des cours.
 * @type {string}
 */
const BASE_URL = "/api/cours";

/**
 * Récupère la liste complète de tous les cours.
 *
 * Inclut les informations de la salle de référence (code et type)
 * via une jointure réalisée côté backend.
 *
 * @returns {Promise<object[]>} Liste des cours triée par code
 */
export async function recupererCours() {
  return apiRequest(BASE_URL);
}

/**
 * Importe un fichier Excel/CSV de cours.
 *
 * Les codes de salle references doivent deja exister dans le module Salles.
 *
 * @param {File} fichier - Fichier .xlsx, .xls ou .csv
 * @returns {Promise<object>} Resume complet de l'import
 */
export async function importerCours(fichier) {
  const formData = new FormData();
  formData.append("fichier", fichier);

  return apiRequest(`${BASE_URL}/import`, {
    method: "POST",
    body: formData,
  });
}

/**
 * Telecharge le modele officiel d'import du module Cours.
 *
 * @returns {Promise<{ filename: string }>} Nom de fichier telecharge
 */
export async function telechargerModeleImportCours() {
  return telechargerFichier(
    `${BASE_URL}/import/template`,
    {},
    "modele-import-cours.xlsx"
  );
}

/**
 * Crée un nouveau cours.
 *
 * Le backend déduit automatiquement le `type_salle` depuis la salle de référence
 * fournie. Il n'est donc pas nécessaire de l'envoyer explicitement.
 *
 * @param {object} cours - Les données du cours à créer
 * @param {string} cours.code - Code unique du cours (ex: "INF-1001")
 * @param {string} cours.nom - Nom complet du cours
 * @param {number} cours.duree - Durée en heures
 * @param {string} cours.programme - Programme associé
 * @param {string} cours.etape_etude - Étape d'études (ex: "1", "2")
 * @param {number} cours.id_salle_reference - ID de la salle de référence
 * @returns {Promise<object>} Le cours créé avec son ID et les détails de salle
 */
export async function creerCours(cours) {
  return apiRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cours),
  });
}

/**
 * Met à jour les informations d'un cours existant.
 *
 * Seuls les champs fournis dans `cours` sont mis à jour — les autres
 * conservent leurs valeurs actuelles (mise à jour partielle côté backend).
 *
 * @param {number} id - L'identifiant du cours à modifier
 * @param {object} cours - Les champs à mettre à jour
 * @returns {Promise<object>} Le cours mis à jour
 */
export async function modifierCours(id, cours) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cours),
  });
}

/**
 * Supprime un cours.
 *
 * Le backend refuse la suppression si le cours est déjà utilisé dans un horaire.
 * Vérifier avec coursEstDejaAffecte() côté backend avant si nécessaire.
 *
 * @param {number} id - L'identifiant du cours à supprimer
 * @returns {Promise<object>} Résultat de la suppression
 */
export async function supprimerCours(id) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "DELETE",
  });
}
