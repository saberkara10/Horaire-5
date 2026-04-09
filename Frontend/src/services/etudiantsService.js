/**
 * SERVICE - Etudiants API
 *
 * Ce service centralise les appels HTTP
 * lies aux etudiants et groupes.
 */
import { apiRequest } from "./api.js";

const BASE_URL = "/api/etudiants";

function construireUrlEtudiants(options = {}) {
  const params = new URLSearchParams();

  if (options.sessionActive) {
    params.set("session_active", "1");
  }

  const suffixe = params.toString() ? `?${params.toString()}` : "";
  return `${BASE_URL}${suffixe}`;
}

export async function recupererEtudiants(options = {}) {
  return apiRequest(construireUrlEtudiants(options));
}

export async function recupererEtudiant(idEtudiant) {
  return apiRequest(`${BASE_URL}/${idEtudiant}`);
}

export async function recupererHoraireEtudiant(idEtudiant) {
  return apiRequest(`${BASE_URL}/${idEtudiant}/horaire`);
}

export async function importerEtudiants(fichier) {
  const formData = new FormData();
  formData.append("fichier", fichier);

  return apiRequest(`${BASE_URL}/import`, {
    method: "POST",
    body: formData,
  });
}

export async function supprimerTousLesEtudiants() {
  return apiRequest(BASE_URL, {
    method: "DELETE",
  });
}
