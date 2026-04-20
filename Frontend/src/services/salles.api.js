/**
 * Service — Salles API.
 *
 * Centralise tous les appels HTTP liés à la gestion des salles.
 * Couvre les opérations CRUD de base et la lecture de l'occupation.
 *
 * @module services/salles.api
 */

import { apiRequest, telechargerFichier } from "./api.js";

/**
 * URL de base pour toutes les routes des salles.
 * @type {string}
 */
const BASE_URL = "/api/salles";

/**
 * Récupère la liste complète de toutes les salles.
 *
 * @returns {Promise<object[]>} Liste des salles avec leurs attributs
 */
export async function recupererSalles() {
  return apiRequest(BASE_URL);
}

/**
 * Importe un fichier Excel/CSV de salles.
 *
 * Le backend applique une strategie partielle afin de conserver les lignes
 * valides meme si certaines salles du fichier sont en erreur.
 *
 * @param {File} fichier - Fichier .xlsx, .xls ou .csv
 * @returns {Promise<object>} Resume complet de l'import
 */
export async function importerSalles(fichier) {
  const formData = new FormData();
  formData.append("fichier", fichier);

  return apiRequest(`${BASE_URL}/import`, {
    method: "POST",
    body: formData,
  });
}

/**
 * Telecharge le modele officiel d'import du module Salles.
 *
 * @returns {Promise<{ filename: string }>} Nom de fichier telecharge
 */
export async function telechargerModeleImportSalles() {
  return telechargerFichier(
    `${BASE_URL}/import/template`,
    {},
    "modele-import-salles.xlsx"
  );
}

/**
 * Récupère la liste des types de salles distincts enregistrés dans la base.
 *
 * Utilisée pour alimenter le sélecteur de type dans le formulaire d'ajout
 * de salle ou de cours. Retourne uniquement les types existants (pas de suggestion).
 *
 * @returns {Promise<string[]>} Liste triée des types (ex: ["Classe", "Laboratoire"])
 */
export async function recupererTypesSalles() {
  return apiRequest(`${BASE_URL}/types`);
}

/**
 * Récupère la vue complète d'occupation d'une salle.
 *
 * Le backend retourne un objet riche incluant :
 *  - `occupations` : toutes les séances planifiées dans cette salle pour la session
 *  - Une vue hebdomadaire initiale pour affichage immédiat
 *  - Des indicateurs de taux d'utilisation (V2)
 *  - Un résumé dynamique calculé côté serveur (V3)
 *
 * Le frontend utilise la liste `occupations` pour naviguer entre les semaines
 * sans avoir à refaire un appel API à chaque changement de semaine.
 *
 * @param {number|string} id - L'identifiant de la salle
 * @param {object} [options={}] - Options de filtrage
 * @param {number|string} [options.id_session] - ID de la session à afficher
 * @param {string} [options.date_reference] - Date ISO de la semaine initiale (YYYY-MM-DD)
 * @returns {Promise<object>} Vue complète d'occupation de la salle
 */
export async function recupererOccupationSalle(id, options = {}) {
  const params = new URLSearchParams();

  // Accepter les deux formats de clé (snake_case et camelCase) pour compatibilité
  if (options.id_session ?? options.idSession) {
    params.set("id_session", String(options.id_session ?? options.idSession));
  }

  if (options.date_reference ?? options.dateReference) {
    params.set(
      "date_reference",
      String(options.date_reference ?? options.dateReference)
    );
  }

  const suffixe = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`${BASE_URL}/${id}/occupation${suffixe}`);
}

/**
 * Crée une nouvelle salle.
 *
 * @param {object} salle - Les données de la salle à créer
 * @param {string} salle.code - Code unique de la salle (ex: "A-101")
 * @param {string} salle.type - Type de salle (ex: "Classe", "Laboratoire")
 * @param {number} salle.capacite - Nombre de places disponibles
 * @returns {Promise<object>} La salle créée avec son ID
 */
export async function creerSalle(salle) {
  return apiRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(salle),
  });
}

/**
 * Met à jour les informations d'une salle existante.
 *
 * @param {number|string} id - L'identifiant de la salle à modifier
 * @param {object} salle - Les nouvelles données de la salle
 * @returns {Promise<object>} La salle mise à jour
 */
export async function modifierSalle(id, salle) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(salle),
  });
}

/**
 * Supprime une salle.
 *
 * Le backend vérifie que la salle n'est pas utilisée dans un horaire actif
 * avant de la supprimer. Si c'est le cas, la suppression est refusée.
 *
 * @param {number|string} id - L'identifiant de la salle à supprimer
 * @returns {Promise<object>} Résultat de la suppression
 */
export async function supprimerSalle(id) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "DELETE",
  });
}
