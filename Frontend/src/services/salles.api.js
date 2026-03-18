const API_URL = "http://localhost:3000/api/salles";

async function handleResponse(response) {
  if (!response.ok) {
    if (response.status === 409) {
      throw new Error("Ce code de salle existe deja.");
    }
    if (response.status === 404) {
      throw new Error("Salle non trouvee.");
    }
    throw new Error("Une erreur est survenue.");
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function recupererSalles() {
  const response = await fetch(API_URL, { credentials: "include" });
  return handleResponse(response);
}

export async function creerSalle(donneesSalle) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(donneesSalle),
  });
  return handleResponse(response);
}

export async function modifierSalle(idSalle, donneesSalle) {
  const response = await fetch(`${API_URL}/${idSalle}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(donneesSalle),
  });
  return handleResponse(response);
}

export async function supprimerSalle(idSalle) {
  const response = await fetch(`${API_URL}/${idSalle}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse(response);
}