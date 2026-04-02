/**
 * SERVICE - Auth API
 *
 * Ce service centralise les appels HTTP
 * lies a l'authentification.
 */
import { apiRequest } from "./api.js";

const AUTH_BASE_URL = "/auth";

function traduireErreurConnexion(message) {
  const code = String(message || "").trim();

  if (code === "wrong_user" || code === "wrong_password") {
    return "Adresse courriel ou mot de passe incorrect.";
  }

  return code || "Impossible de se connecter.";
}

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
    throw new Error(traduireErreurConnexion(error.message));
  }

  const utilisateur = await recupererUtilisateurConnecte();

  if (!utilisateur) {
    throw new Error("Session utilisateur non etablie.");
  }

  return utilisateur;
}

export async function recupererUtilisateurConnecte() {
  try {
    return await apiRequest(`${AUTH_BASE_URL}/me`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return null;
  }
}

export async function logoutUtilisateur() {
  await apiRequest(`${AUTH_BASE_URL}/logout`, {
    method: "POST",
    credentials: "include",
  });
}
/**
 * SERVICE - Auth API
 *
 * Ce service centralise les appels HTTP
 * lies a l'authentification.
 */
