function normaliserBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

const baseParDefaut = "/api";

export const API_BASE_URL = normaliserBaseUrl(
  import.meta.env.VITE_API_BASE_URL || baseParDefaut
);

export class ApiError extends Error {
  constructor(message, { status = 500, details = [] } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function requeteApi(chemin, options = {}) {
  const cheminNormalise = chemin.startsWith("/") ? chemin : `/${chemin}`;
  const { headers, ...resteOptions } = options;

  const response = await fetch(`${API_BASE_URL}${cheminNormalise}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...headers,
    },
    ...resteOptions,
  });

  const contenu = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      contenu?.message ||
        "Une erreur est survenue lors de la communication avec le serveur.",
      {
        status: response.status,
        details: Array.isArray(contenu?.erreurs) ? contenu.erreurs : [],
      }
    );
  }

  return contenu;
}
