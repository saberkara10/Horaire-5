/**
 * ROUTES - Module Horaires
 *
 * Ce module definit toutes les routes HTTP liees aux horaires.
 */

import {
  userAdmin,
  userAdminOrResponsable,
  userAuth,
} from "../middlewares/auth.js";
import {
  deleteAffectation,
  deleteAllAffectations,
  genererHoraireAutomatiquement,
  getAffectationById,
  getAllAffectations,
  planifierAffectationManuelle,
  planifierRepriseEtudiant,
  recupererCoursEchouesEtudiantPlanifiables,
  recupererEtudiantsPourPlanificationReprise,
  recupererGroupesCompatiblesPourCoursEchoueEtudiant,
  replanifierAffectationManuelle,
} from "../src/model/horaire.js";

const CHAMPS_AFFECTATION_OBLIGATOIRES = [
  "id_cours",
  "id_professeur",
  "id_groupes_etudiants",
  "date",
  "heure_debut",
  "heure_fin",
];
const FORMAT_HEURE = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function champEstVide(valeur) {
  return (
    valeur === undefined ||
    valeur === null ||
    (typeof valeur === "string" && valeur.trim() === "")
  );
}

function heureVersMinutes(heure) {
  const [heures, minutes] = String(heure).split(":");
  return Number(heures) * 60 + Number(minutes);
}

function normaliserIdentifiantOptionnel(value) {
  const identifiant = Number(value);
  return Number.isInteger(identifiant) && identifiant > 0 ? identifiant : null;
}

function validerPayloadAffectation(body = {}) {
  const champsManquants = CHAMPS_AFFECTATION_OBLIGATOIRES.filter((champ) =>
    champEstVide(body[champ])
  );

  if (champsManquants.length > 0) {
    return {
      valide: false,
      message: `Champs obligatoires manquants: ${champsManquants.join(", ")}.`,
    };
  }

  if (!FORMAT_HEURE.test(String(body.heure_debut)) || !FORMAT_HEURE.test(String(body.heure_fin))) {
    return {
      valide: false,
      message: "Format d'heure invalide. Utilisez HH:MM ou HH:MM:SS.",
    };
  }

  const debutMinutes = heureVersMinutes(body.heure_debut);
  const finMinutes = heureVersMinutes(body.heure_fin);

  if (debutMinutes === finMinutes) {
    return {
      valide: false,
      message: "La duree du creneau doit etre superieure a 0.",
    };
  }

  if (finMinutes < debutMinutes) {
    return {
      valide: false,
      message: "L'heure de fin doit etre apres l'heure de debut.",
    };
  }

  return { valide: true };
}

/**
 * Initialiser les routes des horaires.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function horaireRoutes(app) {
  const accesLectureHoraires = [userAuth, userAdminOrResponsable];
  const accesGestionHoraires = [userAuth, userAdmin];

  function dateGenerationValide(date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(date || ""));
  }

  function extrairePortee(body = {}) {
    const portee = body.portee || {};

    return {
      mode: portee.mode || portee.type || body.portee_mode || "single",
      date_debut: portee.date_debut || body.date_debut_portee || null,
      date_fin: portee.date_fin || body.date_fin_portee || null,
    };
  }

  /**
   * GET /api/horaires
   * Recuperer toutes les affectations de cours.
   */
  app.get("/api/horaires", ...accesLectureHoraires, async (request, response) => {
    try {
      const affectations = await getAllAffectations({
        sessionActive: request.query.session_active === "1",
      });
      response.status(200).json(affectations);
    } catch (error) {
      console.error("Erreur consultation horaires :", error);
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get(
    "/api/horaires/reprises/etudiants",
    ...accesLectureHoraires,
    async (_request, response) => {
      try {
        const etudiants = await recupererEtudiantsPourPlanificationReprise();
        return response.status(200).json(etudiants);
      } catch (error) {
        console.error("Erreur lecture etudiants planification reprise :", error);
        return response
          .status(error.statusCode || 500)
          .json({ message: error.message || "Erreur serveur." });
      }
    }
  );

  /**
   * GET /api/horaires/:id
   * Recuperer une affectation par son identifiant.
   */
  app.get("/api/horaires/:id", ...accesLectureHoraires, async (request, response) => {
    try {
      const idAffectation = Number(request.params.id);

      if (!Number.isInteger(idAffectation) || idAffectation <= 0) {
        return response.status(400).json({ message: "Identifiant invalide." });
      }

      const affectation = await getAffectationById(idAffectation);

      if (affectation) {
        response.status(200).json(affectation);
      } else {
        response.status(404).json({ message: "Affectation introuvable." });
      }
    } catch (error) {
      console.error("Erreur consultation horaire :", error);
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  /**
   * POST /api/horaires
   * Creer une affectation de cours (ajouter un creneau a l'horaire).
   */
  app.post("/api/horaires", ...accesGestionHoraires, async (request, response) => {
    try {
      const {
        id_cours,
        id_professeur,
        id_salle,
        id_groupes_etudiants,
        date,
        heure_debut,
        heure_fin,
      } = request.body;

      const validation = validerPayloadAffectation(request.body);

      if (!validation.valide) {
        return response.status(400).json({ message: validation.message });
      }

      const resultat = await planifierAffectationManuelle({
        idCours: Number(id_cours),
        idProfesseur: Number(id_professeur),
        idSalle: normaliserIdentifiantOptionnel(id_salle),
        idGroupeEtudiants: Number(id_groupes_etudiants),
        date,
        heureDebut: heure_debut,
        heureFin: heure_fin,
        portee: extrairePortee(request.body),
      });

      return response.status(201).json(resultat);
    } catch (error) {
      console.error("Erreur creation horaire :", error);
      return response
        .status(error.statusCode || 500)
        .json({ message: error.message || "Erreur serveur." });
    }
  });

  app.put(
    "/api/horaires/:id",
    ...accesGestionHoraires,
    async (request, response) => {
      try {
        const idAffectation = Number(request.params.id);

        if (!Number.isInteger(idAffectation) || idAffectation <= 0) {
          return response.status(400).json({ message: "Identifiant invalide." });
        }

        const validation = validerPayloadAffectation(request.body);

        if (!validation.valide) {
          return response.status(400).json({ message: validation.message });
        }

        const resultat = await replanifierAffectationManuelle(
          idAffectation,
          {
            idCours: Number(request.body.id_cours),
            idProfesseur: Number(request.body.id_professeur),
            idSalle: normaliserIdentifiantOptionnel(request.body.id_salle),
            idGroupeEtudiants: Number(request.body.id_groupes_etudiants),
            date: request.body.date,
            heureDebut: request.body.heure_debut,
            heureFin: request.body.heure_fin,
            portee: extrairePortee(request.body),
          }
        );

        return response.status(200).json(resultat);
      } catch (error) {
        console.error("Erreur modification horaire :", error);
        return response
          .status(error.statusCode || 500)
          .json({ message: error.message || "Erreur serveur." });
      }
    }
  );

  app.get(
    "/api/horaires/etudiants/:id/cours-echoues",
    ...accesLectureHoraires,
    async (request, response) => {
      try {
        const idEtudiant = Number(request.params.id);

        if (!Number.isInteger(idEtudiant) || idEtudiant <= 0) {
          return response.status(400).json({ message: "Identifiant invalide." });
        }

        const reprises = await recupererCoursEchouesEtudiantPlanifiables(idEtudiant);
        return response.status(200).json(reprises);
      } catch (error) {
        console.error("Erreur lecture cours echoues :", error);
        return response
          .status(error.statusCode || 500)
          .json({ message: error.message || "Erreur serveur." });
      }
    }
  );

  app.get(
    "/api/horaires/etudiants/:id/cours-echoues/:idCoursEchoue/groupes-compatibles",
    ...accesLectureHoraires,
    async (request, response) => {
      try {
        const idEtudiant = Number(request.params.id);
        const idCoursEchoue = Number(request.params.idCoursEchoue);

        if (!Number.isInteger(idEtudiant) || idEtudiant <= 0) {
          return response.status(400).json({ message: "Identifiant invalide." });
        }

        if (!Number.isInteger(idCoursEchoue) || idCoursEchoue <= 0) {
          return response.status(400).json({ message: "Identifiant invalide." });
        }

        const groupesCompatibles =
          await recupererGroupesCompatiblesPourCoursEchoueEtudiant(
            idEtudiant,
            idCoursEchoue
          );
        return response.status(200).json(groupesCompatibles);
      } catch (error) {
        console.error("Erreur lecture groupes compatibles reprise :", error);
        return response
          .status(error.statusCode || 500)
          .json({ message: error.message || "Erreur serveur." });
      }
    }
  );

  app.post(
    "/api/horaires/reprises",
    ...accesGestionHoraires,
    async (request, response) => {
      try {
        const { id_etudiant, id_cours_echoue, id_groupes_etudiants } = request.body || {};

        if (!id_etudiant || !id_cours_echoue || !id_groupes_etudiants) {
          return response.status(400).json({
            message:
              "id_etudiant, id_cours_echoue et id_groupes_etudiants sont obligatoires.",
          });
        }

        const resultat = await planifierRepriseEtudiant({
          idEtudiant: Number(id_etudiant),
          idCoursEchoue: Number(id_cours_echoue),
          idGroupeEtudiants: Number(id_groupes_etudiants),
        });

        return response.status(201).json(resultat);
      } catch (error) {
        console.error("Erreur planification reprise etudiant :", error);
        return response
          .status(error.statusCode || 500)
          .json({ message: error.message || "Erreur serveur." });
      }
    }
  );

  /**
   * POST /api/horaires/generer
   * Generer automatiquement l'horaire pour tous les cours.
   */
  app.post(
    "/api/horaires/generer",
    ...accesGestionHoraires,
    async (request, response) => {
      try {
        const { programme, etape, session, date_debut } = request.body || {};

        if (!programme || !etape || !session) {
          return response.status(400).json({
            message:
              "Le programme, l'etape et la session sont obligatoires pour generer l'horaire.",
          });
        }

        if (date_debut && !dateGenerationValide(date_debut)) {
          return response.status(400).json({
            message: "La date de debut est invalide.",
          });
        }

        const resultat = await genererHoraireAutomatiquement({
          programme,
          etape,
          session,
          dateDebut: date_debut || null,
        });
        response.status(201).json(resultat);
      } catch (error) {
        console.error("Erreur generation horaire :", error);
        response
          .status(error.statusCode || 500)
          .json({ message: error.message || "Erreur serveur." });
      }
    }
  );

  /**
   * DELETE /api/horaires/:id
   * Supprimer une affectation de cours.
   */
  app.delete(
    "/api/horaires/:id",
    ...accesGestionHoraires,
    async (request, response) => {
      try {
        const idAffectation = Number(request.params.id);

        if (!Number.isInteger(idAffectation) || idAffectation <= 0) {
          return response.status(400).json({ message: "Identifiant invalide." });
        }

        const affectation = await getAffectationById(idAffectation);

        if (!affectation) {
          return response.status(404).json({ message: "Affectation introuvable." });
        }

        await deleteAffectation(idAffectation);
        return response.status(200).json({ message: "Affectation supprimee." });
      } catch (error) {
        console.error("Erreur suppression horaire :", error);
        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * DELETE /api/horaires
   * Supprimer tous les horaires (reset).
   */
  app.delete("/api/horaires", ...accesGestionHoraires, async (request, response) => {
    try {
      await deleteAllAffectations({
        deleteStudents: request.query.delete_students === "1",
        sessionActive: request.query.session_active === "1",
      });
      response.status(200).json({ message: "Horaires reinitialises." });
    } catch (error) {
      console.error("Erreur reset horaires :", error);
      response.status(500).json({ message: "Erreur serveur." });
    }
  });
}
