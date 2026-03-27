import { apiRequest } from "./api.js";

const API_URL = "/api/horaires";

export async function recupererHoraires() {
  return apiRequest(API_URL, {
    credentials: "include",
  });
}

export async function recupererAffectation(idAffectation) {
  return apiRequest(`${API_URL}/${idAffectation}`, {
    credentials: "include",
  });
}

export async function genererHoraire(parametres = {}) {
  return apiRequest(`${API_URL}/generer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parametres),
    credentials: "include",
  });
}

export async function modifierAffectation(idAffectation, affectation) {
  return apiRequest(`${API_URL}/${idAffectation}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(affectation),
    credentials: "include",
  });
}

export async function supprimerAffectation(idAffectation) {
  return apiRequest(`${API_URL}/${idAffectation}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function resetHoraires() {
  return apiRequest(API_URL, {
    method: "DELETE",
    credentials: "include",
  });
}
