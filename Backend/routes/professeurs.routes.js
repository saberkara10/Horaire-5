/**
 * Routes — Gestion des professeurs
 *
 * Ce module gère :
 * - CRUD des professeurs
 * - Validation des données
 * - Vérification d'unicité du matricule
 */

import { Router } from "express";

import {
  recupererTousLesProfesseurs,
  recupererProfesseurParId,
  recupererProfesseurParMatricule,
  ajouterProfesseur,
  modifierProfesseur,
  supprimerProfesseur,
} from "../src/model/professeurs.model.js";

import {
  validerIdProfesseur,
  validerCreationProfesseur,
  validerModificationProfesseur,
} from "../src/validations/professeurs.validation.js";

const router = Router();

/**
 * GET /api/professeurs
 * Retourne la liste des professeurs.
 */
router.get("/", async (request, response) => {
  try {
    const professeurs = await recupererTousLesProfesseurs();
    return response.json(professeurs);
  } catch (error) {
    console.error("Erreur recupererTousLesProfesseurs :", error);
    return response.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * GET /api/professeurs/:id
 * Retourne un professeur par identifiant.
 */
router.get("/:id", async (request, response) => {
  try {
    const validationId = validerIdProfesseur(request.params.id);

    if (!validationId.ok) {
      return response.status(400).json({ message: validationId.message });
    }

    const professeur = await recupererProfesseurParId(validationId.value);

    if (!professeur) {
      return response.status(404).json({ message: "Professeur introuvable" });
    }

    return response.json(professeur);
  } catch (error) {
    console.error("Erreur recupererProfesseurParId :", error);
    return response.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * POST /api/professeurs
 * Ajoute un nouveau professeur.
 */
router.post("/", async (request, response) => {
  try {
    const validation = validerCreationProfesseur(request.body);

    if (!validation.ok) {
      return response.status(400).json({ message: validation.message });
    }

    // Vérifier l’unicité du matricule
    const existe = await recupererProfesseurParMatricule(validation.value.matricule);

    if (existe) {
      return response.status(409).json({ message: "Matricule déjà existant" });
    }

    const professeurAjoute = await ajouterProfesseur(validation.value);

    return response.status(201).json({
      message: "Professeur ajouté avec succès",
      professeur: professeurAjoute,
    });
  } catch (error) {
    console.error("Erreur ajouterProfesseur :", error);
    return response.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * PUT /api/professeurs/:id
 * Modifie un professeur existant.
 */
router.put("/:id", async (request, response) => {
  try {
    const validationId = validerIdProfesseur(request.params.id);

    if (!validationId.ok) {
      return response.status(400).json({ message: validationId.message });
    }

    const validationBody = validerModificationProfesseur(request.body);

    if (!validationBody.ok) {
      return response.status(400).json({ message: validationBody.message });
    }

    // Si modification du matricule → vérifier unicité
    if (validationBody.value.matricule !== undefined) {
      const profAvecMemeMatricule =
        await recupererProfesseurParMatricule(validationBody.value.matricule);

      if (
        profAvecMemeMatricule &&
        profAvecMemeMatricule.id_professeur !== validationId.value
      ) {
        return response.status(409).json({ message: "Matricule déjà existant" });
      }
    }

    const professeurModifie = await modifierProfesseur(
      validationId.value,
      validationBody.value
    );

    if (!professeurModifie) {
      return response.status(404).json({ message: "Professeur introuvable" });
    }

    return response.json({
      message: "Professeur modifié avec succès",
      professeur: professeurModifie,
    });
  } catch (error) {
    console.error("Erreur modifierProfesseur :", error);
    return response.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * DELETE /api/professeurs/:id
 * Supprime un professeur.
 */
router.delete("/:id", async (request, response) => {
  try {
    const validationId = validerIdProfesseur(request.params.id);

    if (!validationId.ok) {
      return response.status(400).json({ message: validationId.message });
    }

    const supprime = await supprimerProfesseur(validationId.value);

    if (!supprime) {
      return response.status(404).json({ message: "Professeur introuvable" });
    }

    return response.json({
      message: "Professeur supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur supprimerProfesseur :", error);

    return response.status(409).json({
      message: "Suppression impossible (professeur lié à d'autres données)",
    });
  }
});

export default router;