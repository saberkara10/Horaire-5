/**
 * SERVICE - Salles API
 *
 * Ce service centralise les appels HTTP
 * lies aux salles.
 */
import { apiRequest } from "./api.js";

const BASE_URL = "/api/salles";

export async function recupererSalles() {
  return apiRequest(BASE_URL);
}

export async function creerSalle(salle) {
  return apiRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(salle),
  });
}

export async function modifierSalle(id, salle) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(salle),
  });
}

export async function supprimerSalle(id) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "DELETE",
  });
}
/**
 * SERVICE - Salles API
 *
 * Ce service centralise les appels HTTP
 * lies aux salles.
 */
