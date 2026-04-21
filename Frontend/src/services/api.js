/**
 * Service - Couche d'acces HTTP generique.
 *
 * Ce fichier est le socle de toutes les communications reseau du frontend.
 * Chaque appel API passe par ici, ce qui permet de centraliser :
 *  - L'envoi des cookies de session (credentials: "include")
 *  - La lecture intelligente de la reponse (JSON ou non)
 *  - La gestion unifiee des erreurs HTTP
 *  - La propagation des metadonnees d'erreur (statut, details, replanification...)
 *
 * Convention d'erreur :
 * Quand le serveur retourne un statut >= 400, on leve une Error() enrichie
 * avec des proprietes supplementaires :
 *  - error.status          -> code HTTP (400, 401, 404, 500...)
 *  - error.details         -> tableau de messages d'erreur detailles
 *  - error.replanification -> donnees de replanification renvoyees par le backend
 *  - error.synchronisation -> donnees de synchronisation temps reel
 *  - error.payload         -> le corps complet de la reponse d'erreur
 *
 * @module services/api
 */

export const SESSION_EXPIREE_EVENT = "gdh:session-expiree";

function notifierSessionExpiree(url, response) {
  if (typeof window === "undefined" || response.status !== 401) {
    return;
  }

  const normalizedUrl = String(url || "").trim();

  // Un mauvais mot de passe au login ne doit pas declencher une deconnexion globale.
  if (normalizedUrl === "/auth/login") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIREE_EVENT, {
      detail: {
        status: response.status,
        url: normalizedUrl,
      },
    })
  );
}

/**
 * Lit le corps d'une reponse HTTP selon son Content-Type.
 *
 * Si la reponse est en JSON, on la parse. Sinon on retourne null.
 * Cela evite des erreurs de parsing sur des reponses vides ou HTML
 * (par exemple, une erreur 500 qui retourne une page HTML de debug).
 *
 * @param {Response} response - L'objet Response de l'API Fetch
 * @returns {Promise<object|null>} Les donnees parsees ou null
 */
async function lireReponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

/**
 * Effectue un appel HTTP vers l'API backend avec gestion d'erreur unifiee.
 *
 * Les cookies de session sont toujours envoyes (credentials: "include") pour
 * maintenir l'authentification. Cette option peut etre surchargee via `options`.
 *
 * En cas d'erreur HTTP (status >= 400) :
 *  - Le message du corps de la reponse est utilise comme message d'erreur
 *  - Des proprietes supplementaires sont attachees a l'objet Error
 *  - L'erreur est lancee (throw) pour que l'appelant la gere
 *
 * @param {string} url - L'URL de l'endpoint API (relative, ex: "/api/groupes")
 * @param {RequestInit} [options={}] - Options fetch standard (method, headers, body...)
 * @returns {Promise<object|null>} Les donnees de la reponse JSON, ou null
 * @throws {Error} Erreur enrichie avec statut HTTP et details en cas d'echec
 */
export async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  const data = await lireReponse(response);

  if (!response.ok) {
    notifierSessionExpiree(url, response);

    const error = new Error(
      data?.message || data?.error || "Une erreur est survenue."
    );

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
 * Telecharge un fichier binaire depuis le backend en conservant la gestion
 * d'erreur unifiee utilisee par le reste du frontend.
 *
 * Cette fonction sert notamment aux modeles Excel d'import exposes par les
 * modules CRUD. Le nom final privilegie l'entete Content-Disposition quand il
 * est fourni par le serveur.
 *
 * @param {string} url - Endpoint backend du fichier a telecharger
 * @param {RequestInit} [options={}] - Options fetch standard
 * @param {string} [nomFichierParDefaut="telechargement.bin"] - Nom de secours
 * @returns {Promise<{ filename: string }>} Nom du fichier telecharge
 */
export async function telechargerFichier(
  url,
  options = {},
  nomFichierParDefaut = "telechargement.bin"
) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    notifierSessionExpiree(url, response);

    const data = await lireReponse(response);
    const error = new Error(
      data?.message || data?.error || "Une erreur est survenue."
    );

    error.status = response.status;
    error.details = data?.erreurs || data?.details || [];
    error.replanification = data?.replanification || null;
    error.synchronisation = data?.synchronisation || null;
    error.payload = data || null;

    throw error;
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const disposition = response.headers.get("content-disposition") || "";
  const correspondance = disposition.match(/filename="?([^";\n]+)"?/i);
  const filename = correspondance?.[1]?.trim() || nomFichierParDefaut;

  const lien = document.createElement("a");
  lien.href = objectUrl;
  lien.download = filename;
  lien.style.display = "none";
  document.body.appendChild(lien);
  lien.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    document.body.removeChild(lien);
  }, 300);

  return { filename };
}

/**
 * Alias de apiRequest pour la compatibilite avec les anciens modules
 * qui utilisent le nom "requeteApi".
 *
 * @see apiRequest
 */
export const requeteApi = apiRequest;
