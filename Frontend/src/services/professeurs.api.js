import { apiRequest } from "./api.js";

const BASE_URL = "/api/professeurs";

export async function recupererProfesseurs() {
  return apiRequest(BASE_URL);
}

export async function creerProfesseur(professeur) {
  return apiRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(professeur),
  });
}

export async function modifierProfesseur(id, professeur) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(professeur),
  });
}

export async function supprimerProfesseur(id) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "DELETE",
  });
}