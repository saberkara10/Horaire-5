import { apiRequest } from "./api.js";

const BASE_URL = "/api/professeurs";

export async function recupererProfesseurs() {
  return apiRequest(BASE_URL);
}

export async function recupererDisponibilitesProfesseur(id) {
  return apiRequest(`${BASE_URL}/${id}/disponibilites`);
}

export async function recupererCoursProfesseur(id) {
  return apiRequest(`${BASE_URL}/${id}/cours`);
}

export async function mettreAJourCoursProfesseur(id, coursIds) {
  return apiRequest(`${BASE_URL}/${id}/cours`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cours_ids: coursIds }),
  });
}

export async function mettreAJourDisponibilitesProfesseur(id, disponibilites) {
  return apiRequest(`${BASE_URL}/${id}/disponibilites`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disponibilites }),
  });
}

export async function recupererHoraireProfesseur(id) {
  return apiRequest(`${BASE_URL}/${id}/horaire`);
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
