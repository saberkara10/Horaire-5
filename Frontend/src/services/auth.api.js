/**
 * Service — Authentification.
 *
 * Ce service gère toutes les interactions avec l'API d'authentification :
 * connexion, récupération de l'utilisateur courant et déconnexion.
 *
 * Particularité de loginUtilisateur() :
 * Après un POST /auth/login réussi, on fait immédiatement un GET /auth/me
 * pour récupérer les données complètes de l'utilisateur (y compris ses rôles).
 * C'est nécessaire parce que le POST ne retourne pas les données utilisateur,
 * il crée seulement la session côté serveur.
 *
 * @module services/auth.api
 */

import { apiRequest } from "./api.js";

/**
 * URL de base pour toutes les routes d'authentification.
 * Centralisé ici pour faciliter les changements d'URL sans chercher dans tout le code.
 *
 * @type {string}
 */
const AUTH_BASE_URL = "/auth";

/**
 * Traduit un code d'erreur technique du backend en message lisible pour l'utilisateur.
 *
 * Le backend retourne des codes génériques ("wrong_user", "wrong_password")
 * pour des raisons de sécurité (ne pas révéler si c'est l'email ou le mot de
 * passe qui est incorrect). On fusionne les deux en un seul message neutre.
 *
 * @param {string} message - Le code ou message d'erreur reçu du backend
 * @returns {string} Un message d'erreur lisible en français
 */
function traduireErreurConnexion(message) {
  const code = String(message || "").trim();

  if (code === "wrong_user" || code === "wrong_password") {
    // On ne dit pas lequel des deux est incorrect pour des raisons de sécurité
    return "Adresse courriel ou mot de passe incorrect.";
  }

  return code || "Impossible de se connecter.";
}

/**
 * Connecte un utilisateur avec son email et mot de passe.
 *
 * Étapes :
 *  1. POST /auth/login → crée la session côté serveur
 *  2. GET /auth/me     → récupère les données et rôles de l'utilisateur
 *
 * En cas d'erreur, le message technique est traduit en français lisible.
 * Si la session n'est pas établie après le login (cas bizarre), on lance
 * une erreur explicite pour ne pas rester dans un état incohérent.
 *
 * @param {object} credentials - Les identifiants de connexion
 * @param {string} credentials.email - L'adresse email
 * @param {string} credentials.password - Le mot de passe en clair
 * @returns {Promise<object>} L'objet utilisateur complet avec ses rôles
 * @throws {Error} Si les identifiants sont incorrects ou la session ne s'établit pas
 */
export async function loginUtilisateur({ email, password }) {
  try {
    await apiRequest(`${AUTH_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    // Convertir l'erreur technique en message lisible pour l'utilisateur final
    throw new Error(traduireErreurConnexion(error.message));
  }

  // Récupérer les données complètes de l'utilisateur maintenant que la session existe
  const utilisateur = await recupererUtilisateurConnecte();

  if (!utilisateur) {
    // Cas théoriquement impossible après un login réussi, mais on gère quand même
    throw new Error("Session utilisateur non etablie.");
  }

  return utilisateur;
}

/**
 * Récupère l'utilisateur actuellement connecté depuis la session serveur.
 *
 * Utilisée au démarrage de l'application (App.jsx) pour savoir si une session
 * existe déjà (l'utilisateur était connecté avant de rafraîchir la page).
 *
 * Retourne null silencieusement si personne n'est connecté ou si une erreur
 * survient — l'appelant peut alors rediriger vers la page de connexion.
 *
 * @returns {Promise<object|null>} L'utilisateur connecté ou null
 */
export async function recupererUtilisateurConnecte() {
  try {
    const response = await apiRequest(`${AUTH_BASE_URL}/me`, {
      method: "GET",
      credentials: "include",
    });

    // Le backend peut retourner { user: {...} } ou directement l'objet utilisateur
    return response?.user ?? response;
  } catch {
    // Erreur 401 ou réseau → pas connecté, on retourne null sans logger
    return null;
  }
}

/**
 * Déconnecte l'utilisateur en invalidant la session côté serveur.
 *
 * Après cette appel, le cookie de session est supprimé côté serveur.
 * Le frontend doit ensuite nettoyer son état local et rediriger vers /login.
 *
 * @returns {Promise<void>}
 */
export async function logoutUtilisateur() {
  await apiRequest(`${AUTH_BASE_URL}/logout`, {
    method: "POST",
    credentials: "include",
  });
}
