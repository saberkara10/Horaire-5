import { requeteApi } from "./api.js";

// Ce fichier isole les points d'entree HTTP du module etudiants afin que les
// composants React restent centres sur l'affichage et non sur la construction
// des requetes fetch.
export async function recupererEtudiants() {
  return requeteApi("/etudiants");
}

export async function recupererEtudiant(idEtudiant) {
  return requeteApi(`/etudiants/${idEtudiant}`);
}

export async function recupererHoraireEtudiant(idEtudiant) {
  return requeteApi(`/etudiants/${idEtudiant}/horaire`);
}

export async function importerEtudiants(fichier) {
  const formData = new FormData();
  formData.append("file", fichier);

  // L'API attend un formulaire multipart pour recevoir le fichier brut.
  return requeteApi("/etudiants/import", {
    method: "POST",
    body: formData,
  });
}
