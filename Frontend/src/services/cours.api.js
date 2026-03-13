import { requeteApi } from "./api.js";

export async function recupererCours() {
  return requeteApi("/cours");
}

export async function recupererOptionsCours() {
  return requeteApi("/cours/options");
}

export async function creerCours(donneesCours) {
  return requeteApi("/cours", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(donneesCours),
  });
}

export async function modifierCours(idCours, donneesCours) {
  return requeteApi(`/cours/${idCours}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(donneesCours),
  });
}

export async function supprimerCours(idCours) {
  return requeteApi(`/cours/${idCours}`, {
    method: "DELETE",
  });
}
