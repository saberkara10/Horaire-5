const API_URL = "http://localhost:3000/api/horaires";

async function handleResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      throw new Error(data.message || "Une erreur est survenue.");
    } catch {
      throw new Error("Une erreur est survenue.");
    }
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function recupererHoraires() {
  const response = await fetch(API_URL, { credentials: "include" });
  return handleResponse(response);
}

export async function genererHoraire() {
  const response = await fetch(`${API_URL}/generer`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(response);
}

export async function supprimerAffectation(idAffectation) {
  const response = await fetch(`${API_URL}/${idAffectation}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse(response);
}

export async function resetHoraires() {
  const response = await fetch(API_URL, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse(response);
}