import { apiRequest } from "./api.js";

const BASE_URL = "/api/etudiants";

export async function recupererEtudiants() {
  return apiRequest(BASE_URL);
}

export async function importerEtudiants(fichier) {
  const formData = new FormData();
  formData.append("fichier", fichier);

  return apiRequest(`${BASE_URL}/import`, {
    method: "POST",
    body: formData,
  });
}