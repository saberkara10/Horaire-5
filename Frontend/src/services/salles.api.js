/**
 * SERVICE - Salles API
 *
 * Ce service centralise les appels HTTP
 * lies aux salles.
 */
import { apiRequest } from "./api.js";

const BASE_URL = "/api/salles";

export async function recupererSalles() {
  return apiRequest(BASE_URL);
}

/**
 * Lecture metier de l'occupation d'une salle.
 *
 * Le backend renvoie a la fois :
 * - les occupations detaillees de la session ;
 * - une vue hebdomadaire initiale ;
 * - les indicateurs V2 ;
 * - le resume dynamique V3.
 *
 * Le frontend reutilise ensuite la liste `occupations` pour naviguer de
 * semaine en semaine sans reconstruire un systeme parallele.
 *
 * @param {number|string} id Identifiant de la salle.
 * @param {Object} [options={}] Parametres de lecture.
 * @param {number|string} [options.id_session] Session cible.
 * @param {string} [options.date_reference] Date ISO de la semaine initiale.
 * @returns {Promise<Object>} Vue complete d'occupation.
 */
export async function recupererOccupationSalle(id, options = {}) {
  const params = new URLSearchParams();

  if (options.id_session ?? options.idSession) {
    params.set("id_session", String(options.id_session ?? options.idSession));
  }

  if (options.date_reference ?? options.dateReference) {
    params.set(
      "date_reference",
      String(options.date_reference ?? options.dateReference)
    );
  }

  const suffixe = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`${BASE_URL}/${id}/occupation${suffixe}`);
}

export async function creerSalle(salle) {
  return apiRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(salle),
  });
}

export async function modifierSalle(id, salle) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(salle),
  });
}

export async function supprimerSalle(id) {
  return apiRequest(`${BASE_URL}/${id}`, {
    method: "DELETE",
  });
}
