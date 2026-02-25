/**
 * VALIDATIONS — Module Professeurs
 *
 * Ce module contient les middlewares de validation
 * pour les routes liées aux professeurs.
 */

import {
  recupererProfesseurParId,
  recupererProfesseurParMatricule,
} from "../model/professeurs.model.js";

const MAX_MATRICULE = 50;
const MAX_NOM = 100;
const MAX_PRENOM = 100;
const MAX_SPECIALITE = 100;

function nettoyerTexte(valeur) {
  if (valeur === undefined || valeur === null) return null;
  return String(valeur).trim();
}

function estTexteNonVide(valeur) {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

/**
 * Middleware — Valider :id
 */
export function validerIdProfesseur(request, response, next) {
  const id = Number(request.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return response.status(400).json({ message: "Identifiant invalide." });
  }

  next();
}

/**
 * Middleware — Vérifier l'existence du professeur
 * Stocke l'objet dans request.professeur
 */
export async function verifierProfesseurExiste(request, response, next) {
  try {
    const id = Number(request.params.id);
    const professeur = await recupererProfesseurParId(id);

    if (!professeur) {
      return response.status(404).json({ message: "Professeur introuvable." });
    }

    request.professeur = professeur;
    next();
  } catch (error) {
    return response.status(500).json({ message: "Erreur serveur." });
  }
}

/**
 * Middleware — Valider création professeur (POST)
 */
export async function validerCreateProfesseur(request, response, next) {
  try {
    const matricule = nettoyerTexte(request.body?.matricule);
    const nom = nettoyerTexte(request.body?.nom);
    const prenom = nettoyerTexte(request.body?.prenom);
    const specialite = nettoyerTexte(request.body?.specialite);

    if (!estTexteNonVide(matricule) || !estTexteNonVide(nom) || !estTexteNonVide(prenom)) {
      return response
        .status(400)
        .json({ message: "matricule, nom et prenom sont obligatoires." });
    }

    if (matricule.length > MAX_MATRICULE) {
      return response
        .status(400)
        .json({ message: `matricule : maximum ${MAX_MATRICULE} caractères.` });
    }

    if (nom.length > MAX_NOM) {
      return response
        .status(400)
        .json({ message: `nom : maximum ${MAX_NOM} caractères.` });
    }

    if (prenom.length > MAX_PRENOM) {
      return response
        .status(400)
        .json({ message: `prenom : maximum ${MAX_PRENOM} caractères.` });
    }

    if (specialite && specialite.length > MAX_SPECIALITE) {
      return response
        .status(400)
        .json({ message: `specialite : maximum ${MAX_SPECIALITE} caractères.` });
    }

    // Unicité matricule
    const existe = await recupererProfesseurParMatricule(matricule);
    if (existe) {
      return response.status(409).json({ message: "Matricule déjà existant." });
    }

    // On remet dans request.body une version propre
    request.body = {
      matricule,
      nom,
      prenom,
      specialite: specialite ? specialite : null,
    };

    next();
  } catch (error) {
    return response.status(500).json({ message: "Erreur serveur." });
  }
}

/**
 * Middleware — Valider modification professeur (PUT)
 */
export async function validerUpdateProfesseur(request, response, next) {
  try {
    const body = request.body ?? {};

    const aAuMoinsUnChamp =
      body.matricule !== undefined ||
      body.nom !== undefined ||
      body.prenom !== undefined ||
      body.specialite !== undefined;

    if (!aAuMoinsUnChamp) {
      return response.status(400).json({ message: "Aucun champ à modifier." });
    }

    const donnees = {};

    if (body.matricule !== undefined) {
      const matricule = nettoyerTexte(body.matricule);

      if (!estTexteNonVide(matricule)) {
        return response.status(400).json({ message: "matricule invalide." });
      }
      if (matricule.length > MAX_MATRICULE) {
        return response
          .status(400)
          .json({ message: `matricule : maximum ${MAX_MATRICULE} caractères.` });
      }

      // Unicité matricule (sauf lui-même)
      const existe = await recupererProfesseurParMatricule(matricule);
      const idActuel = Number(request.params.id);

      if (existe && existe.id_professeur !== idActuel) {
        return response.status(409).json({ message: "Matricule déjà existant." });
      }

      donnees.matricule = matricule;
    }

    if (body.nom !== undefined) {
      const nom = nettoyerTexte(body.nom);

      if (!estTexteNonVide(nom)) {
        return response.status(400).json({ message: "nom invalide." });
      }
      if (nom.length > MAX_NOM) {
        return response
          .status(400)
          .json({ message: `nom : maximum ${MAX_NOM} caractères.` });
      }

      donnees.nom = nom;
    }

    if (body.prenom !== undefined) {
      const prenom = nettoyerTexte(body.prenom);

      if (!estTexteNonVide(prenom)) {
        return response.status(400).json({ message: "prenom invalide." });
      }
      if (prenom.length > MAX_PRENOM) {
        return response
          .status(400)
          .json({ message: `prenom : maximum ${MAX_PRENOM} caractères.` });
      }

      donnees.prenom = prenom;
    }

    if (body.specialite !== undefined) {
      const specialite = nettoyerTexte(body.specialite);

      if (specialite && specialite.length > MAX_SPECIALITE) {
        return response
          .status(400)
          .json({ message: `specialite : maximum ${MAX_SPECIALITE} caractères.` });
      }

      donnees.specialite = specialite ? specialite : null;
    }

    request.body = donnees;
    next();
  } catch (error) {
    return response.status(500).json({ message: "Erreur serveur." });
  }
}

/**
 * Middleware — Valider suppression (DELETE)
 * (Préparé pour les futures dépendances)
 */
export function validerDeleteProfesseur(request, response, next) {
  next();
}