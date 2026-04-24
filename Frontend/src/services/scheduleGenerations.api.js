import { apiRequest } from "./api.js";

const BASE_URL = "/api/schedule-generations";

export function recupererGenerationsHoraires(params = {}) {
  const query = new URLSearchParams();

  if (params.id_session) {
    query.set("id_session", String(params.id_session));
  }

  if (params.status) {
    query.set("status", String(params.status));
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`${BASE_URL}${suffix}`);
}

export function recupererGenerationHoraire(idGeneration) {
  return apiRequest(`${BASE_URL}/${idGeneration}`);
}

export function mettreAJourGenerationHoraire(idGeneration, payload = {}) {
  return apiRequest(`${BASE_URL}/${idGeneration}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function comparerGenerationsHoraires(leftId, rightId) {
  return apiRequest(`${BASE_URL}/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      left_id: leftId,
      right_id: rightId,
    }),
  });
}

export function restaurerGenerationHoraire(idGeneration, payload = {}) {
  return apiRequest(`${BASE_URL}/${idGeneration}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function dupliquerGenerationHoraire(idGeneration) {
  return apiRequest(`${BASE_URL}/${idGeneration}/duplicate`, {
    method: "POST",
  });
}

export function archiverGenerationHoraire(idGeneration) {
  return apiRequest(`${BASE_URL}/${idGeneration}/archive`, {
    method: "PATCH",
  });
}

export function supprimerLogiquementGenerationHoraire(idGeneration) {
  return apiRequest(`${BASE_URL}/${idGeneration}`, {
    method: "DELETE",
  });
}
