/**
 * Service — Professeurs API.
 *
 * Centralise tous les appels HTTP liés à la gestion des professeurs,
 * de leurs disponibilités et de leurs cours affectés.
 *
 * Architecture des disponibilités :
 * Un professeur peut avoir des disponibilités "standards" (semaine type récurrente)
 * et des disponibilités "temporaires" (modifiées pour une semaine précise).
 * La `semaine_cible` dans les options permet de cibler une semaine spécifique.
 *
 * @module services/professeurs.api
 */

import { apiRequest } from "./api.js";

/**
 * URL de base pour toutes les routes professeurs.
 * @type {string}
 */
const BASE_URL = "/api/professeurs";

/**
 * Récupère la liste complète de tous les professeurs.
 *
 * @returns {Promise<object[]>} Liste des professeurs avec leurs attributs (nom, matricule, spécialité...)
 */
export async function recupererProfesseurs() {
  return apiRequest(BASE_URL);
}

/**
 * Récupère les disponibilités d'un professeur pour une semaine donnée.
 *
 * Si `semaine_cible` n'est pas fournie, le backend retourne les disponibilités
 * standards (semaine type). Sinon, les disponibilités temporaires pour cette
 * semaine précise sont retournées en priorité.
 *
 * @param {number} id - L'identifiant du professeur
 * @param {object} [options={}] - Options de lecture
 * @param {string} [options.semaine_cible] - Date ISO du lundi de la semaine ciblée
 * @returns {Promise<object[]>} Liste des disponibilités pour la semaine demandée
 */
export async function recupererDisponibilitesProfesseur(id, options = {}) {
  const params = new URLSearchParams();

  if (options.semaine_cible) {
    params.set("semaine_cible", String(options.semaine_cible));
  }

  const suffixe = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`${BASE_URL}/${id}/disponibilites${suffixe}`);
}

/**
 * Récupère le journal des modifications de disponibilités d'un professeur.
 *
 * Le journal liste l'historique des changements avec leur date, leur portée
 * (temporaire ou permanente) et l'impact sur les séances planifiées.
 *
 * @param {number} id - L'identifiant du professeur
 * @param {object} [options={}] - Options de lecture
 * @param {number} [options.limit] - Nombre maximum d'entrées à retourner
 * @returns {Promise<object[]>} Historique des modifications de disponibilités
 */
export async function recupererJournalDisponibilitesProfesseur(id, options = {}) {
  const params = new URLSearchParams();

  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  const suffixe = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`${BASE_URL}/${id}/disponibilites/journal${suffixe}`);
}

/**
 * Récupère la liste des cours affectés à un professeur.
 *
 * @param {number} id - L'identifiant du professeur
 * @returns {Promise<object[]>} Liste des cours que le professeur peut enseigner
 */
export async function recupererCoursProfesseur(id) {
  return apiRequest(`${BASE_URL}/${id}/cours`);
}

/**
 * Met à jour la liste des cours qu'un professeur peut enseigner.
 *
 * Remplace complètement la liste existante par celle fournie.
 * Pour ajouter un cours sans perdre les autres, récupérer d'abord la liste
 * avec recupererCoursProfesseur() et y ajouter le nouvel ID avant d'envoyer.
 *
 * @param {number} id - L'identifiant du professeur
 * @param {number[]} coursIds - Liste complète des IDs de cours à assigner
 * @returns {Promise<object>} Résultat de la mise à jour
 */
export async function mettreAJourCoursProfesseur(id, coursIds) {
  return apiRequest(`${BASE_URL}/${id}/cours`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cours_ids: coursIds }),
  });
}

/**
 * Met à jour les disponibilités d'un professeur avec une portée configurable.
 *
 * Paramètres de portée temporelle (dans `options`) :
 *  - mode_application : "permanente" (semaine type) ou "temporaire" (semaine unique)
 *  - semaine_cible    : date du lundi de la semaine concernée
 *  - date_debut_effet : date de début d'application (pour les changements progressifs)
 *  - date_fin_effet   : date de fin d'application
 *
 * @param {number} id - L'identifiant du professeur
 * @param {object[]} disponibilites - Les nouvelles disponibilités à enregistrer
 * @param {object} [options={}] - Options de portée temporelle
 * @param {string} [options.semaine_cible] - Date ISO du lundi de la semaine ciblée
 * @param {string} [options.mode_application] - "permanente" ou "temporaire"
 * @param {string} [options.date_debut_effet] - Date ISO de début d'application
 * @param {string} [options.date_fin_effet] - Date ISO de fin d'application
 * @returns {Promise<object>} Résumé des disponibilités mises à jour et séances impactées
 */
export async function mettreAJourDisponibilitesProfesseur(
  id,
  disponibilites,
  options = {}
) {
  return apiRequest(`${BASE_URL}/${id}/disponibilites`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      disponibilites,
      semaine_cible: options.semaine_cible,
      mode_application: options.mode_application,
      date_debut_effet: options.date_debut_effet,
      date_fin_effet: options.date_fin_effet,
    }),
  });
}

/**
 * Récupère l'horaire complet d'un professeur pour la session active.
 *
 * Retourne toutes les séances planifiées avec détails (cours, groupe, salle, horaire).
 *
 * @param {number} id - L'identifiant du professeur
 * @returns {Promise<object[]>} Liste des séances planifiées pour ce professeur
 */
export async function recupererHoraireProfesseur(id) {
  return apiRequest(`${BASE_URL}/${id}/horaire`);
}

/**
 * Crée un nouveau professeur.
 *
 * @param {object} professeur - Les données du professeur à créer
 * @param {string} professeur.nom - Nom de famille
 * @param {string} professeur.prenom - Prénom
 * @param {string} professeur.matricule - Matricule unique du professeur
 * @param {string} [professeur.specialite] - Spécialité ou programme enseigné
 * @returns {Promise<object>} Le professeur créé avec son ID
 */
export async function creerProfesseur(professeur) {
  return apiRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(professeur),
  });
}

/**
 * Met à jour les informations d'un professeur existant.
 *
 * @param {number} id - L'identifiant du professeur à modifier
 * @param {object} professeur - Les nouvelles données du professeur
 * @returns {Promise<object>} Le professeur mis à jour
 */
export async function modifierProfesseur(id, professeur) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(professeur),
  });
}

/**
 * Supprime un professeur du système.
 *
 * Le backend vérifie que le professeur n'a pas de séances actives planifiées
 * avant de procéder à la suppression.
 *
 * @param {number} id - L'identifiant du professeur à supprimer
 * @returns {Promise<object>} Résultat de la suppression
 */
export async function supprimerProfesseur(id) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "DELETE",
  });
}
