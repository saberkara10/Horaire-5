import { apiRequest } from "./api.js";

const AUTH_BASE_URL = "/auth";

export async function loginUtilisateur({ email, password }) {
  await apiRequest(`${AUTH_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  return recupererUtilisateurConnecte();
}

export async function recupererUtilisateurConnecte() {
  try {
    const response = await apiRequest(`${AUTH_BASE_URL}/me`, {
      method: "GET",
      credentials: "include",
    });

    return response?.user ?? response;
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
