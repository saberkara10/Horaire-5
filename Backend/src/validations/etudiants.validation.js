/**
 * VALIDATIONS - Module Étudiants
 *
 * Role :
 * - Vérifier les données avant d'appeler le modèle.
 * - Retourner des messages simples en cas d'erreur.
 */

import { recupererEtudiantParId } from "../model/etudiants.model.js";

function envoyerErreur(response, status, message) {
  response.status(status).json({ message });
}

export function validerIdEtudiant(request, response, next) {
  const idEtudiant = Number(request.params.id);

  if (!Number.isInteger(idEtudiant) || idEtudiant <= 0) {
    return envoyerErreur(response, 400, "Identifiant invalide.");
  }

  next();
}

export async function verifierEtudiantExiste(request, response, next) {
  const idEtudiant = Number(request.params.id);
  const etudiant = await recupererEtudiantParId(idEtudiant);

  if (!etudiant) {
    return envoyerErreur(response, 404, "Étudiant introuvable.");
  }

  request.etudiant = etudiant;
  next();
}
