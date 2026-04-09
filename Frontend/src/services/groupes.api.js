/**
 * SERVICE - Groupes API (enrichi)
 *
 * Centralise tous les appels HTTP liés à la gestion des groupes,
 * des étudiants et de la génération ciblée d'horaires.
 */
import { apiRequest } from "./api.js";

const BASE = "/api/groupes";

/** Liste des groupes (avec options de filtrage) */
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

/** Détail complet d'un groupe (effectif, statut horaire, capacité) */
export async function recupererDetailGroupe(idGroupe) {
  return apiRequest(`${BASE}/${idGroupe}`, { credentials: "include" });
}

/** Horaire d'un groupe */
export async function recupererPlanningGroupe(idGroupe) {
  return apiRequest(`${BASE}/${idGroupe}/planning`, { credentials: "include" });
}

/** Étudiants members d'un groupe */
export async function recupererEtudiantsGroupe(idGroupe) {
  return apiRequest(`${BASE}/${idGroupe}/etudiants`, { credentials: "include" });
}

/** Créer un groupe manuel */
export async function creerGroupeManuel(data) {
  return apiRequest(`${BASE}/manuel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
}

/** Ajouter un ou plusieurs étudiants existants à un groupe */
export async function ajouterEtudiantsAuGroupe(idGroupe, etudiantsIds) {
  return apiRequest(`${BASE}/${idGroupe}/etudiants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ etudiantsIds }),
    credentials: "include",
  });
}

/** Créer un nouvel étudiant et l'ajouter directement au groupe */
export async function creerEtAjouterEtudiant(idGroupe, etudiantData) {
  return apiRequest(`${BASE}/${idGroupe}/etudiants/creer-ajouter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(etudiantData),
    credentials: "include",
  });
}

/**
 * Déplacer un étudiant d'un groupe vers un autre groupe compatible.
 * Validations métier : même programme, même étape, capacité cible non atteinte.
 */
export async function deplacerEtudiant(idGroupeSource, idEtudiant, idGroupeCible) {
  return apiRequest(`${BASE}/${idGroupeSource}/etudiants/${idEtudiant}/deplacer`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_groupe_cible: idGroupeCible }),
    credentials: "include",
  });
}

/** Retirer un étudiant d'un groupe */
export async function retirerEtudiantDuGroupe(idGroupe, idEtudiant) {
  return apiRequest(`${BASE}/${idGroupe}/etudiants/${idEtudiant}`, {
    method: "DELETE",
    credentials: "include",
  });
}

/** Supprimer un groupe */
export async function supprimerGroupe(idGroupe) {
  return apiRequest(`${BASE}/${idGroupe}`, {
    method: "DELETE",
    credentials: "include",
  });
}

/**
 * Nettoyage des groupes invalides.
 * @param {"preview"|"suppression"} mode
 * @param {boolean} inclureVides
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
 * Générer l'horaire pour un groupe précis (génération ciblée).
 * Les autres groupes restent intacts.
 */
export async function genererHoraireGroupe(idGroupe) {
  return apiRequest(`${BASE}/${idGroupe}/generer-horaire`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    credentials: "include",
  });
}

/**
 * Génération ciblée par programme et/ou étape.
 * Génère tous les groupes correspondant aux critères.
 * @param {Object} criteres - { programme?, etape? }
 */
export async function genererParCriteres(criteres = {}) {
  return apiRequest(`${BASE}/generer-cible`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(criteres),
    credentials: "include",
  });
}
