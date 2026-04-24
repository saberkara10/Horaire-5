import { apiRequest } from "./api.js";

const BASE_URL = "/api/concurrency";

export async function verifierDisponibiliteRessource(resourceType, resourceId) {
  const params = new URLSearchParams({
    resource_type: resourceType,
    resource_id: String(resourceId),
  });

  return apiRequest(`${BASE_URL}/availability?${params.toString()}`);
}

export async function creerVerrouRessource(payload) {
  return apiRequest(`${BASE_URL}/locks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function prolongerVerrou(idLock) {
  return apiRequest(`${BASE_URL}/locks/${idLock}/heartbeat`, {
    method: "POST",
  });
}

export async function libererVerrou(idLock) {
  return apiRequest(`${BASE_URL}/locks/${idLock}`, {
    method: "DELETE",
  });
}

export async function rejoindreFileAttente(payload) {
  return apiRequest(`${BASE_URL}/wait-queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function envoyerHeartbeatPresence(payload = {}) {
  return apiRequest(`${BASE_URL}/presence/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function recupererEtatConcurrenceAdmin() {
  return apiRequest("/api/admin/concurrency");
}
