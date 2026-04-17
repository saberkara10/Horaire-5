/**
 * Service — Couche d'accès HTTP générique.
 *
 * Ce fichier est le socle de toutes les communications réseau du frontend.
 * Chaque appel API passe par ici, ce qui permet de centraliser :
 *  - L'envoi des cookies de session (credentials: "include")
 *  - La lecture intelligente de la réponse (JSON ou non)
 *  - La gestion unifiée des erreurs HTTP
 *  - La propagation des métadonnées d'erreur (statut, détails, replanification...)
 *
 * Convention d'erreur :
 * Quand le serveur retourne un statut >= 400, on lève une Error() enrichie
 * avec des propriétés supplémentaires :
 *  - error.status          → code HTTP (400, 401, 404, 500...)
 *  - error.details         → tableau de messages d'erreur détaillés
 *  - error.replanification → données de replanification renvoyées par le backend
 *  - error.synchronisation → données de synchronisation temps réel
 *  - error.payload         → le corps complet de la réponse d'erreur
 *
 * @module services/api
 */

/**
 * Lit le corps d'une réponse HTTP selon son Content-Type.
 *
 * Si la réponse est en JSON, on la parse. Sinon on retourne null.
 * Cela évite des erreurs de parsing sur des réponses vides ou HTML
 * (par exemple, une erreur 500 qui retourne une page HTML de debug).
 *
 * @param {Response} response - L'objet Response de l'API Fetch
 * @returns {Promise<object|null>} Les données parsées ou null
 */
async function lireReponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null; // Réponse vide ou non-JSON → on retourne null sans planter
}

/**
 * Effectue un appel HTTP vers l'API backend avec gestion d'erreur unifiée.
 *
 * Les cookies de session sont toujours envoyés (credentials: "include") pour
 * maintenir l'authentification. Cette option peut être surchargée via `options`.
 *
 * En cas d'erreur HTTP (status >= 400) :
 *  - Le message du corps de la réponse est utilisé comme message d'erreur
 *  - Des propriétés supplémentaires sont attachées à l'objet Error
 *  - L'erreur est lancée (throw) pour que l'appelant la gère
 *
 * @param {string} url - L'URL de l'endpoint API (relative, ex: "/api/groupes")
 * @param {RequestInit} [options={}] - Options fetch standard (method, headers, body...)
 * @returns {Promise<object|null>} Les données de la réponse JSON, ou null
 * @throws {Error} Erreur enrichie avec statut HTTP et détails en cas d'échec
 */
export async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include", // Envoyer les cookies de session à chaque appel
    ...options,
  });

  const data = await lireReponse(response);

  if (!response.ok) {
    // Construire un objet Error avec le message du serveur
    const error = new Error(
      data?.message || data?.error || "Une erreur est survenue."
    );

    // Enrichir l'erreur avec des métadonnées pour que les composants React
    // puissent afficher des informations précises sans re-parser la réponse
    error.status = response.status;
    error.details = data?.erreurs || data?.details || [];
    error.replanification = data?.replanification || null;
    error.synchronisation = data?.synchronisation || null;
    error.payload = data || null;

    throw error;
  }

  return data;
}

/**
 * Alias de apiRequest pour la compatibilité avec les anciens modules
 * qui utilisent le nom "requeteApi".
 *
 * @see apiRequest
 */
export const requeteApi = apiRequest;
