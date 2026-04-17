/**
 * Service — Groupes API.
 *
 * Centralise tous les appels HTTP liés aux groupes d'étudiants.
 * Couvre les opérations de lecture, modification, génération d'horaire
 * et gestion des étudiants au sein d'un groupe.
 *
 * Chaque fonction retourne une Promise qui résout vers les données JSON
 * du backend, ou lance une Error en cas d'échec HTTP.
 *
 * @module services/groupes.api
 */

import { apiRequest } from "./api.js";

/**
 * URL de base pour toutes les routes de groupes.
 * @type {string}
 */
const BASE = "/api/groupes";

/**
 * Récupère la liste des groupes avec options de filtrage.
 *
 * Les options sont transmises au backend via des paramètres de requête URL.
 * Le mode `details = true` retourne les informations étendues :
 * programme, étape, session, effectif, nombre de séances et indicateur d'horaire.
 *
 * @param {boolean} [details=false] - Inclure les informations détaillées
 * @param {object} [options={}] - Options de filtrage
 * @param {boolean} [options.sessionActive] - Limiter à la session active
 * @param {boolean} [options.seulementAvecEffectif] - Exclure les groupes sans étudiant
 * @param {boolean} [options.seulementAvecPlanning] - Exclure sans planning
 * @param {boolean} [options.inclureGroupesSpeciaux] - Inclure les groupes spéciaux
 * @returns {Promise<object[]>} Liste des groupes selon les critères
 */
export async function recupererGroupes(details = false, options = {}) {
  const params = new URLSearchParams();
  if (details) params.set("details", "1");
  if (options.sessionActive) params.set("session_active", "1");
  if (options.seulementAvecEffectif) params.set("effectif_min", "1");
  if (options.seulementAvecPlanning) params.set("planning_only", "1");
  if (options.inclureGroupesSpeciaux) params.set("special_groups", "1");
  const suffixe = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`${BASE}${suffixe}`, { credentials: "include" });
}

/**
 * Récupère les informations détaillées d'un groupe (effectif, statut horaire, capacité).
 *
 * @param {number} idGroupe - L'identifiant du groupe
 * @returns {Promise<object>} Données détaillées du groupe
 */
export async function recupererDetailGroupe(idGroupe) {
  return apiRequest(`${BASE}/${idGroupe}`, { credentials: "include" });
}

/**
 * Récupère le planning complet d'un groupe (informations + liste de séances).
 *
 * @param {number} idGroupe - L'identifiant du groupe
 * @returns {Promise<{groupe: object, horaire: object[]}>} Planning du groupe
 */
export async function recupererPlanningGroupe(idGroupe) {
  return apiRequest(`${BASE}/${idGroupe}/planning`, { credentials: "include" });
}

/**
 * Récupère la liste des étudiants membres d'un groupe.
 *
 * @param {number} idGroupe - L'identifiant du groupe
 * @returns {Promise<object[]>} Liste des étudiants du groupe
 */
export async function recupererEtudiantsGroupe(idGroupe) {
  return apiRequest(`${BASE}/${idGroupe}/etudiants`, { credentials: "include" });
}

/**
 * Crée un groupe manuellement avec les données fournies.
 *
 * Contrairement aux groupes générés automatiquement par le scheduler,
 * les groupes manuels permettent de gérer des cas spéciaux ou des reprises.
 *
 * @param {object} data - Les données du groupe à créer
 * @returns {Promise<object>} Le groupe créé
 */
export async function creerGroupeManuel(data) {
  return apiRequest(`${BASE}/manuel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
}

/**
 * Ajoute un ou plusieurs étudiants existants à un groupe.
 *
 * Les étudiants doivent déjà exister dans la base de données.
 * Pour créer un nouvel étudiant et l'ajouter en même temps, utiliser
 * creerEtAjouterEtudiant() à la place.
 *
 * @param {number} idGroupe - L'identifiant du groupe cible
 * @param {number[]} etudiantsIds - Liste des IDs d'étudiants à ajouter
 * @returns {Promise<object>} Résultat de l'opération
 */
export async function ajouterEtudiantsAuGroupe(idGroupe, etudiantsIds) {
  return apiRequest(`${BASE}/${idGroupe}/etudiants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ etudiantsIds }),
    credentials: "include",
  });
}

/**
 * Crée un nouvel étudiant et l'ajoute directement à un groupe en une seule opération.
 *
 * Le backend gère l'atomicité : si l'ajout au groupe échoue, l'étudiant
 * n'est pas créé non plus (transaction).
 *
 * @param {number} idGroupe - L'identifiant du groupe cible
 * @param {object} etudiantData - Les données du nouvel étudiant
 * @returns {Promise<object>} L'étudiant créé et ajouté
 */
export async function creerEtAjouterEtudiant(idGroupe, etudiantData) {
  return apiRequest(`${BASE}/${idGroupe}/etudiants/creer-ajouter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(etudiantData),
    credentials: "include",
  });
}

/**
 * Déplace un étudiant d'un groupe source vers un groupe cible.
 *
 * Le backend valide que les deux groupes sont compatibles (même programme,
 * même étape) et que le groupe cible n'est pas plein avant d'effectuer
 * le déplacement.
 *
 * @param {number} idGroupeSource - Le groupe d'origine de l'étudiant
 * @param {number} idEtudiant - L'identifiant de l'étudiant à déplacer
 * @param {number} idGroupeCible - Le groupe de destination
 * @returns {Promise<object>} Résultat du déplacement avec détails
 */
export async function deplacerEtudiant(idGroupeSource, idEtudiant, idGroupeCible) {
  return apiRequest(`${BASE}/${idGroupeSource}/etudiants/${idEtudiant}/deplacer`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_groupe_cible: idGroupeCible }),
    credentials: "include",
  });
}

/**
 * Retire un étudiant d'un groupe sans le supprimer du système.
 *
 * L'étudiant reste dans la base de données mais n'est plus membre du groupe.
 * Il peut être réassigné à un autre groupe ensuite.
 *
 * @param {number} idGroupe - L'identifiant du groupe
 * @param {number} idEtudiant - L'identifiant de l'étudiant à retirer
 * @returns {Promise<object>} Résultat de l'opération
 */
export async function retirerEtudiantDuGroupe(idGroupe, idEtudiant) {
  return apiRequest(`${BASE}/${idGroupe}/etudiants/${idEtudiant}`, {
    method: "DELETE",
    credentials: "include",
  });
}

/**
 * Supprime un groupe complètement du système.
 *
 * Le backend vérifie qu'aucun étudiant n'est encore membre du groupe
 * avant de le supprimer, pour éviter des données orphelines.
 *
 * @param {number} idGroupe - L'identifiant du groupe à supprimer
 * @returns {Promise<object>} Résultat de la suppression
 */
export async function supprimerGroupe(idGroupe) {
  return apiRequest(`${BASE}/${idGroupe}`, {
    method: "DELETE",
    credentials: "include",
  });
}

/**
 * Lance un nettoyage des groupes invalides ou vides.
 *
 * Mode "preview" : retourne ce qui serait supprimé, sans rien faire.
 * Mode "suppression" : supprime réellement les groupes invalides.
 *
 * @param {"preview"|"suppression"} [mode="preview"] - Mode d'exécution
 * @param {boolean} [inclureVides=true] - Inclure les groupes sans étudiant
 * @returns {Promise<object>} Rapport du nettoyage effectué ou prévu
 */
export async function nettoyerGroupes(mode = "preview", inclureVides = true) {
  return apiRequest(`${BASE}/nettoyer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, inclure_vides: inclureVides }),
    credentials: "include",
  });
}

/**
 * Génère l'horaire pour un groupe précis (génération ciblée).
 *
 * Contrairement à la génération globale (scheduler), cette fonction
 * ne touche qu'à un seul groupe. Les autres groupes déjà planifiés
 * restent intacts. Utile pour régénérer l'horaire d'un groupe modifié.
 *
 * @param {number} idGroupe - L'identifiant du groupe à planifier
 * @param {object} [options={}] - Options de génération
 * @param {string} [options.modeOptimisation="legacy"] - Algorithme à utiliser
 * @returns {Promise<object>} Résultat de la génération avec statistiques
 */
export async function genererHoraireGroupe(idGroupe, options = {}) {
  return apiRequest(`${BASE}/${idGroupe}/generer-horaire`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode_optimisation:
        options.modeOptimisation ?? options.mode_optimisation ?? "legacy",
    }),
    credentials: "include",
  });
}

/**
 * Génère les horaires pour tous les groupes correspondant à des critères.
 *
 * Permet de cibler un programme et/ou une étape pour générer en masse
 * sans toucher aux autres groupes du système.
 *
 * @param {object} [criteres={}] - Critères de sélection des groupes
 * @param {string} [criteres.programme] - Nom du programme à cibler
 * @param {string} [criteres.etape] - Étape d'études à cibler
 * @param {string} [criteres.modeOptimisation] - Algorithme à utiliser
 * @returns {Promise<object>} Rapport de génération pour tous les groupes traités
 */
export async function genererParCriteres(criteres = {}) {
  const payload = {
    ...criteres,
    mode_optimisation:
      criteres.modeOptimisation ?? criteres.mode_optimisation ?? "legacy",
  };

  return apiRequest(`${BASE}/generer-cible`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
}
