/**
 * SERVICE - API Core
 *
 * Ce service centralise les appels HTTP
 * generiques de l'application.
 */
async function lireReponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

export async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });
  const data = await lireReponse(response);

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || "Une erreur est survenue."
    );
  }

  return data;
}
/**
 * SERVICE - API Core
 *
 * Ce service centralise les appels HTTP
 * generiques de l'application.
 */
