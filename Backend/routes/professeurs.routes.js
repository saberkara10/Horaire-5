/**
 * ROUTES - Module Professeurs
 *
 * Ce module definit toutes les routes HTTP liees aux professeurs.
 * Les validations sont appliquees avant l'appel au modele.
 */

import {
  ajouterProfesseur,
  modifierProfesseur,
  recupererDisponibilitesProfesseur,
  recupererHoraireProfesseur,
  recupererProfesseurParId,
  recupererTousLesProfesseurs,
  remplacerDisponibilitesProfesseur,
  supprimerProfesseur,
} from "../src/model/professeurs.model.js";
import {
  validerCreateProfesseur,
  validerDeleteProfesseur,
  validerIdProfesseur,
  validerUpdateProfesseur,
  verifierProfesseurExiste,
} from "../src/validations/professeurs.validation.js";
import {
  userAdmin,
  userAuth,
  userAdminOrResponsable,
} from "../middlewares/auth.js";

function normaliserHeure(heure) {
  const valeur = String(heure || "").trim();

  if (!valeur) {
    return "";
  }

  if (valeur.length === 5) {
    return `${valeur}:00`;
  }

  return valeur.slice(0, 8);
}

function validerDisponibilitesPayload(disponibilites) {
  if (!Array.isArray(disponibilites)) {
    return "Le champ disponibilites doit etre un tableau.";
  }

  const clesVues = new Set();

  for (const disponibilite of disponibilites) {
    const jourSemaine = Number(disponibilite?.jour_semaine);
    const heureDebut = normaliserHeure(disponibilite?.heure_debut);
    const heureFin = normaliserHeure(disponibilite?.heure_fin);

    if (!Number.isInteger(jourSemaine) || jourSemaine < 1 || jourSemaine > 5) {
      return "Chaque disponibilite doit avoir un jour_semaine entre 1 et 5.";
    }

    if (!heureDebut || !heureFin) {
      return "Chaque disponibilite doit inclure heure_debut et heure_fin.";
    }

    if (heureDebut >= heureFin) {
      return "Chaque disponibilite doit avoir une heure de fin apres l'heure de debut.";
    }

    const cle = `${jourSemaine}-${heureDebut}-${heureFin}`;
    if (clesVues.has(cle)) {
      return "Les disponibilites dupliquees ne sont pas autorisees.";
    }

    clesVues.add(cle);
  }

  return "";
}

/**
 * Initialiser les routes des professeurs.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function professeursRoutes(app) {
  const accesLectureProfesseurs = [userAuth, userAdminOrResponsable];
  const accesGestionProfesseurs = [userAuth, userAdmin];

  app.get("/api/professeurs", ...accesLectureProfesseurs, async (request, response) => {
    try {
      const professeurs = await recupererTousLesProfesseurs();
      response.status(200).json(professeurs);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get(
    "/api/professeurs/:id",
    ...accesLectureProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    async (request, response) => {
      try {
        response.status(200).json(request.professeur);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.get(
    "/api/professeurs/:id/disponibilites",
    ...accesLectureProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    async (request, response) => {
      try {
        const disponibilites = await recupererDisponibilitesProfesseur(
          Number(request.params.id)
        );

        response.status(200).json(disponibilites);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.put(
    "/api/professeurs/:id/disponibilites",
    ...accesGestionProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    async (request, response) => {
      try {
        const messageErreur = validerDisponibilitesPayload(
          request.body?.disponibilites
        );

        if (messageErreur) {
          return response.status(400).json({ message: messageErreur });
        }

        const disponibilites = await remplacerDisponibilitesProfesseur(
          Number(request.params.id),
          request.body.disponibilites
        );

        return response.status(200).json(disponibilites);
      } catch (error) {
        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.post(
    "/api/professeurs",
    ...accesGestionProfesseurs,
    validerCreateProfesseur,
    async (request, response) => {
      try {
        const professeurAjoute = await ajouterProfesseur(request.body);
        response.status(201).json(professeurAjoute);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.put(
    "/api/professeurs/:id",
    ...accesGestionProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    validerUpdateProfesseur,
    async (request, response) => {
      try {
        const professeurModifie = await modifierProfesseur(
          Number(request.params.id),
          request.body
        );

        response.status(200).json(professeurModifie);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.delete(
    "/api/professeurs/:id",
    ...accesGestionProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    validerDeleteProfesseur,
    async (request, response) => {
      try {
        await supprimerProfesseur(Number(request.params.id));
        response.status(200).json({ message: "Professeur supprime." });
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.get(
    "/api/professeurs/:id/horaire",
    ...accesLectureProfesseurs,
    async (request, response) => {
      try {
        const idProfesseur = Number(request.params.id);

        if (Number.isNaN(idProfesseur)) {
          return response.status(400).json({ message: "Identifiant invalide." });
        }

        const professeur = await recupererProfesseurParId(idProfesseur);

        if (!professeur) {
          return response.status(404).json({ message: "Professeur introuvable." });
        }

        const horaire = await recupererHoraireProfesseur(idProfesseur);

        return response.status(200).json(horaire);
      } catch (error) {
        console.error("ERREUR GET /api/professeurs/:id/horaire :", error);
        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );
}
