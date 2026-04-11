/**
 * SERVICE - Horaire API
 *
 * Ce service centralise les appels HTTP
 * lies aux horaires et affectations.
 */
import { apiRequest } from "./api.js";

const API_URL = "/api/horaires";

function construireUrlHoraires(options = {}) {
  const params = new URLSearchParams();

  if (options.sessionActive) {
    params.set("session_active", "1");
  }

  if (options.deleteStudents) {
    params.set("delete_students", "1");
  }

  const suffixe = params.toString() ? `?${params.toString()}` : "";
  return `${API_URL}${suffixe}`;
}

export async function recupererHoraires(options = {}) {
  return apiRequest(construireUrlHoraires(options), {
    credentials: "include",
  });
}

export async function recupererAffectation(idAffectation) {
  return apiRequest(`${API_URL}/${idAffectation}`, {
    credentials: "include",
  });
}

export async function creerAffectation(affectation) {
  return apiRequest(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(affectation),
    credentials: "include",
  });
}

export async function recupererCoursEchouesEtudiant(idEtudiant) {
  return apiRequest(`${API_URL}/etudiants/${idEtudiant}/cours-echoues`, {
    credentials: "include",
  });
}

export async function recupererEtudiantsPlanificationReprise() {
  return apiRequest(`${API_URL}/reprises/etudiants`, {
    credentials: "include",
  });
}

export async function recupererGroupesCompatiblesReprise(
  idEtudiant,
  idCoursEchoue
) {
  return apiRequest(
    `${API_URL}/etudiants/${idEtudiant}/cours-echoues/${idCoursEchoue}/groupes-compatibles`,
    {
      credentials: "include",
    }
  );
}

export async function planifierRepriseEtudiant(payload) {
  return apiRequest(`${API_URL}/reprises`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

export async function resetHoraires(options = {}) {
  return apiRequest(construireUrlHoraires(options), {
    method: "DELETE",
    credentials: "include",
  });
}
