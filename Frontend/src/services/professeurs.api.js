/**
 * SERVICE - Professeurs API
 *
 * Ce service centralise les appels HTTP
 * lies aux professeurs.
 */
import { apiRequest } from "./api.js";

const BASE_URL = "/api/professeurs";

export async function recupererProfesseurs() {
  return apiRequest(BASE_URL);
}

export async function recupererDisponibilitesProfesseur(id, options = {}) {
  const params = new URLSearchParams();

  if (options.semaine_cible) {
    params.set("semaine_cible", String(options.semaine_cible));
  }

  const suffixe = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`${BASE_URL}/${id}/disponibilites${suffixe}`);
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
    }),
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
/**
 * SERVICE - Professeurs API
 *
 * Ce service centralise les appels HTTP
 * lies aux professeurs.
 */
