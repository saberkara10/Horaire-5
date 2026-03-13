import { requeteApi } from "./api.js";

export async function recupererProfesseurs() {
  return requeteApi("/professeurs");
}

export async function creerProfesseur(donneesProfesseur) {
  return requeteApi("/professeurs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(donneesProfesseur),
  });
}

export async function modifierProfesseur(idProfesseur, donneesProfesseur) {
  return requeteApi(`/professeurs/${idProfesseur}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(donneesProfesseur),
  });
}

export async function supprimerProfesseur(idProfesseur) {
  return requeteApi(`/professeurs/${idProfesseur}`, {
    method: "DELETE",
  });
}
