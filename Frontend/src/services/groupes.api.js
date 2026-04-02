/**
 * SERVICE - Groupes API
 *
 * Ce service centralise les appels HTTP
 * lies aux groupes et a leurs horaires.
 */
import { apiRequest } from "./api.js";

const BASE_URL = "/api/groupes";

export async function recupererGroupes(details = false) {
  const suffixe = details ? "?details=1" : "";
  return apiRequest(`${BASE_URL}${suffixe}`, {
    credentials: "include",
  });
}

export async function recupererPlanningGroupe(idGroupe) {
  return apiRequest(`${BASE_URL}/${idGroupe}/planning`, {
    credentials: "include",
  });
}
