async function lireReponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

export async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const data = await lireReponse(response);

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || "Une erreur est survenue."
    );
  }

  return data;
}