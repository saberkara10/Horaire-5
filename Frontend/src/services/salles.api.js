import { requeteApi } from "./api.js";

export async function recupererSalles() {
  return requeteApi("/salles");
}

export async function creerSalle(donneesSalle) {
  return requeteApi("/salles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(donneesSalle),
  });
}

export async function modifierSalle(idSalle, donneesSalle) {
  return requeteApi(`/salles/${idSalle}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(donneesSalle),
  });
}

export async function supprimerSalle(idSalle) {
  return requeteApi(`/salles/${idSalle}`, {
    method: "DELETE",
  });
}
