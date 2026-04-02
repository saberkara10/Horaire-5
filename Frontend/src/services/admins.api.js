/**
 * SERVICE - Admins API
 *
 * Ce service centralise les appels HTTP
 * lies a la gestion des sous-admins.
 */
import { apiRequest } from "./api.js";

const ADMINS_BASE_URL = "/api/admins";

export function recupererAdmins() {
  return apiRequest(ADMINS_BASE_URL, {
    method: "GET",
    credentials: "include",
  });
}

export function creerAdmin(payload) {
  return apiRequest(ADMINS_BASE_URL, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function modifierAdmin(id, payload) {
  return apiRequest(`${ADMINS_BASE_URL}/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function supprimerAdmin(id) {
  return apiRequest(`${ADMINS_BASE_URL}/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
}
/**
 * SERVICE - Admins API
 *
 * Ce service centralise les appels HTTP
 * lies a la gestion des sous-admins.
 */
