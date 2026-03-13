function normaliserBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

const baseParDefaut = import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

export const API_BASE_URL = normaliserBaseUrl(
  import.meta.env.VITE_API_BASE_URL || baseParDefaut
);

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
    throw new Error(
      contenu?.message ||
        "Une erreur est survenue lors de la communication avec le serveur."
    );
  }

  return contenu;
}
