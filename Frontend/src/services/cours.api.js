/**
 * SERVICE - Cours API
 *
 * Ce service centralise les appels HTTP
 * lies aux cours.
 */
import { apiRequest } from "./api.js";

const BASE_URL = "/api/cours";

export async function recupererCours() {
  return apiRequest(BASE_URL);
}

export async function creerCours(cours) {
  return apiRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cours),
  });
}

export async function modifierCours(id, cours) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cours),
  });
}

export async function supprimerCours(id) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "DELETE",
  });
}
/**
 * SERVICE - Cours API
 *
 * Ce service centralise les appels HTTP
 * lies aux cours.
 */
