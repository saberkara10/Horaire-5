/**
 * ROUTES - Module Professeurs
 */

import {
  ajouterProfesseur,
  TYPES_ABSENCE_PROFESSEUR,
  recupererAbsencesProfesseur,
  modifierProfesseur,
  recupererCoursProfesseur,
  recupererDisponibilitesProfesseur,
  recupererJournalDisponibilitesProfesseur,
  recupererHoraireProfesseur,
  recupererProfesseurParId,
  recupererTousLesProfesseurs,
  remplacerAbsencesProfesseur,
  remplacerCoursProfesseur,
  remplacerDisponibilitesProfesseur,
  supprimerProfesseur,
  validerContrainteCoursProfesseur,
} from "../src/model/professeurs.model.js";
import { ImportExcelError } from "../src/services/import-excel.shared.js";
import { genererModeleImportExcel } from "../src/services/import-excel-template.service.js";
import { importerProfesseursDepuisFichier } from "../src/services/import-professeurs.service.js";
import {
  validerCreateProfesseur,
  validerDeleteProfesseur,
  validerIdProfesseur,
  validerUpdateProfesseur,
  verifierProfesseurExiste,
} from "../src/validations/professeurs.validation.js";
import { televerserFichierImportExcel } from "../src/validations/import-excel.validation.js";
import {
  userAdmin,
  userAuth,
  userAdminOrResponsable,
} from "../middlewares/auth.js";
import { requireResourceLock } from "../middlewares/concurrency.js";
import { journaliserActivite } from "../src/services/activity-log.service.js";

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

    if (!Number.isInteger(jourSemaine) || jourSemaine < 1 || jourSemaine > 7) {
      return "Chaque disponibilite doit avoir un jour_semaine entre 1 et 7.";
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

function validerSemaineCible(valeur) {
  if (valeur === undefined || valeur === null || valeur === "") {
    return "";
  }

  const semaineCible = Number(valeur);

  if (!Number.isInteger(semaineCible) || semaineCible < 1) {
    return "La semaine_cible doit etre un entier positif.";
  }

  return "";
}

function validerModeApplicationDisponibilites(mode) {
  if (mode === undefined || mode === null || mode === "") {
    return "";
  }

  if (
    mode !== "semaine_unique" &&
    mode !== "semaine_et_suivantes" &&
    mode !== "a_partir_date" &&
    mode !== "plage_dates" &&
    mode !== "permanente"
  ) {
    return "Le mode_application doit valoir semaine_unique, semaine_et_suivantes, a_partir_date, plage_dates ou permanente.";
  }

  return "";
}

function dateIsoValide(valeur) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valeur || "").trim());
}

function validerPorteeTemporelleDisponibilites(body = {}) {
  const mode = String(body?.mode_application || "").trim();

  if (!mode || mode === "semaine_unique" || mode === "semaine_et_suivantes") {
    return validerSemaineCible(body?.semaine_cible);
  }

  if (mode === "a_partir_date") {
    if (!dateIsoValide(body?.date_debut_effet)) {
      return "La date_debut_effet est obligatoire au format YYYY-MM-DD.";
    }

    return "";
  }

  if (mode === "plage_dates") {
    if (!dateIsoValide(body?.date_debut_effet) || !dateIsoValide(body?.date_fin_effet)) {
      return "Les dates_debut_effet et date_fin_effet sont obligatoires au format YYYY-MM-DD.";
    }

    if (String(body.date_debut_effet) > String(body.date_fin_effet)) {
      return "La date_fin_effet doit etre posterieure ou egale a la date_debut_effet.";
    }
  }

  return "";
}

function validerCoursPayload(coursIds) {
  if (!Array.isArray(coursIds)) {
    return "Le champ cours_ids doit etre un tableau.";
  }

  const ids = coursIds.map((idCours) => Number(idCours));
  const idsValides = ids.filter(
    (idCours) => Number.isInteger(idCours) && idCours > 0
  );

  if (ids.length !== idsValides.length) {
    return "Chaque cours assigne doit etre un identifiant positif.";
  }

  if (new Set(idsValides).size !== idsValides.length) {
    return "Les cours assignes dupliques ne sont pas autorises.";
  }

  return "";
}

function dateAbsenceValide(dateAbsence) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateAbsence || "").trim());
}

function validerAbsencesPayload(absences) {
  if (!Array.isArray(absences)) {
    return "Le champ absences doit etre un tableau.";
  }

  const periodesVues = new Set();

  for (const absence of absences) {
    const dateDebut = String(absence?.date_debut || "").trim();
    const dateFin = String(absence?.date_fin || "").trim();
    const typeAbsence = String(absence?.type_absence || "").trim();

    if (!dateAbsenceValide(dateDebut) || !dateAbsenceValide(dateFin)) {
      return "Chaque absence doit avoir une date de debut et une date de fin valides.";
    }

    if (dateDebut > dateFin) {
      return "La date de fin doit etre apres ou egale a la date de debut.";
    }

    if (!typeAbsence) {
      return "Chaque absence doit avoir un type d'absence.";
    }

    if (!TYPES_ABSENCE_PROFESSEUR.includes(typeAbsence)) {
      return "Le type d'absence est invalide.";
    }

    const cle = `${dateDebut}-${dateFin}`;

    if (periodesVues.has(cle)) {
      return "Les absences dupliquees sur la meme periode ne sont pas autorisees.";
    }

    periodesVues.add(cle);
  }

  return "";
}

export default function professeursRoutes(app) {
  const accesLectureProfesseurs = [userAuth, userAdminOrResponsable];
  const accesGestionProfesseurs = [userAuth, userAdmin];
  const verrouProfesseur = requireResourceLock("professeur", (request) => request.params.id);

  app.get("/api/professeurs", ...accesLectureProfesseurs, async (request, response) => {
    try {
      const professeurs = await recupererTousLesProfesseurs();
      response.status(200).json(professeurs);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get(
    "/api/professeurs/import/template",
    ...accesGestionProfesseurs,
    async (request, response) => {
      try {
        const modele = genererModeleImportExcel("professeurs");
        response.setHeader("Content-Type", modele.contentType);
        response.setHeader(
          "Content-Disposition",
          `attachment; filename="${modele.filename}"`
        );
        return response.status(200).send(modele.buffer);
      } catch (error) {
        return response.status(error.status || 500).json({
          message: error.message || "Erreur serveur.",
          ...(error.erreurs?.length ? { erreurs: error.erreurs } : {}),
        });
      }
    }
  );

  app.post(
    "/api/professeurs/import",
    ...accesGestionProfesseurs,
    televerserFichierImportExcel,
    async (request, response) => {
      try {
        const resultat = await importerProfesseursDepuisFichier(request.file);
        await journaliserActivite({
          request,
          actionType: "IMPORT",
          module: "Professeurs",
          targetType: "Fichier Excel",
          description: "Importation Excel des professeurs.",
          newValue: { fichier: request.file?.originalname, resultat },
        });
        return response.status(200).json(resultat);
      } catch (error) {
        await journaliserActivite({
          request,
          actionType: "IMPORT",
          module: "Professeurs",
          targetType: "Fichier Excel",
          description: "Echec de l'importation Excel des professeurs.",
          status: "ERROR",
          errorMessage: error.message,
          newValue: { fichier: request.file?.originalname },
        });
        if (error instanceof ImportExcelError) {
          return response.status(error.status || 400).json({
            message: error.message,
            ...(error.erreurs?.length ? { erreurs: error.erreurs } : {}),
          });
        }

        return response.status(500).json({
          message: error.message || "Erreur serveur.",
        });
      }
    }
  );

  app.get(
    "/api/professeurs/:id",
    ...accesLectureProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    async (request, response) => {
      response.status(200).json(request.professeur);
    }
  );

  app.get(
    "/api/professeurs/:id/cours",
    ...accesLectureProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    async (request, response) => {
      try {
        const cours = await recupererCoursProfesseur(Number(request.params.id));
        response.status(200).json(cours);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.put(
    "/api/professeurs/:id/cours",
    ...accesGestionProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    verrouProfesseur,
    async (request, response) => {
      try {
        const messageErreur = validerCoursPayload(request.body?.cours_ids);

        if (messageErreur) {
          return response.status(400).json({ message: messageErreur });
        }

        const messageErreurContraintes = await validerContrainteCoursProfesseur(
          request.body.cours_ids
        );

        if (messageErreurContraintes) {
          return response.status(400).json({ message: messageErreurContraintes });
        }

        const cours = await remplacerCoursProfesseur(
          Number(request.params.id),
          request.body.cours_ids
        );

        return response.status(200).json(cours);
      } catch (error) {
        return response.status(500).json({ message: "Erreur serveur." });
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
        const messageErreurSemaine = validerSemaineCible(
          request.query?.semaine_cible
        );

        if (messageErreurSemaine) {
          return response.status(400).json({ message: messageErreurSemaine });
        }

        const disponibilites = await recupererDisponibilitesProfesseur(
          Number(request.params.id),
          {
            format: "detail",
            semaine_cible: request.query?.semaine_cible,
          }
        );

        response.status(200).json(disponibilites);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.get(
    "/api/professeurs/:id/disponibilites/journal",
    ...accesLectureProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    async (request, response) => {
      try {
        const journal = await recupererJournalDisponibilitesProfesseur(
          Number(request.params.id),
          {
            limit: request.query?.limit,
          }
        );

        return response.status(200).json(journal);
      } catch (error) {
        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.put(
    "/api/professeurs/:id/disponibilites",
    ...accesGestionProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    verrouProfesseur,
    async (request, response) => {
      try {
        const messageErreur = validerDisponibilitesPayload(
          request.body?.disponibilites
        );
        const messageErreurMode = validerModeApplicationDisponibilites(
          request.body?.mode_application
        );
        const messageErreurPortee = validerPorteeTemporelleDisponibilites(
          request.body
        );

        if (messageErreur) {
          return response.status(400).json({ message: messageErreur });
        }

        if (messageErreurMode) {
          return response.status(400).json({ message: messageErreurMode });
        }

        if (messageErreurPortee) {
          return response.status(400).json({ message: messageErreurPortee });
        }

        const disponibilites = await remplacerDisponibilitesProfesseur(
          Number(request.params.id),
          request.body.disponibilites,
          {
            semaine_cible: request.body?.semaine_cible,
            mode_application: request.body?.mode_application,
            date_debut_effet: request.body?.date_debut_effet,
            date_fin_effet: request.body?.date_fin_effet,
          }
        );

        await journaliserActivite({
          request,
          actionType: "UPDATE",
          module: "Disponibilites professeurs",
          targetType: "Professeur",
          targetId: request.params.id,
          description: `Modification des disponibilites du professeur ${request.professeur?.prenom || ""} ${request.professeur?.nom || ""}.`.trim(),
          oldValue: { professeur: request.professeur },
          newValue: {
            disponibilites,
            mode_application: request.body?.mode_application,
            semaine_cible: request.body?.semaine_cible,
          },
        });

        return response.status(200).json(disponibilites);
      } catch (error) {
        await journaliserActivite({
          request,
          actionType: "UPDATE",
          module: "Disponibilites professeurs",
          targetType: "Professeur",
          targetId: request.params.id,
          description: "Echec de modification des disponibilites professeur.",
          status: "ERROR",
          errorMessage: error.message,
          oldValue: { professeur: request.professeur },
          newValue: request.body,
        });
        const payload = {
          message: error.message || "Erreur serveur.",
          details: Array.isArray(error.details) ? error.details : [],
        };

        if (error.replanification) {
          payload.replanification = error.replanification;
        }

        return response.status(error.statusCode || 500).json(payload);
      }
    }
  );

  app.get(
    "/api/professeurs/:id/absences",
    ...accesLectureProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    async (request, response) => {
      try {
        const absences = await recupererAbsencesProfesseur(Number(request.params.id));
        response.status(200).json(absences);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  app.put(
    "/api/professeurs/:id/absences",
    ...accesGestionProfesseurs,
    validerIdProfesseur,
    verifierProfesseurExiste,
    verrouProfesseur,
    async (request, response) => {
      try {
        const messageErreur = validerAbsencesPayload(request.body?.absences);

        if (messageErreur) {
          return response.status(400).json({ message: messageErreur });
        }

        const absences = await remplacerAbsencesProfesseur(
          Number(request.params.id),
          request.body.absences
        );

        return response.status(200).json(absences);
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
        await journaliserActivite({
          request,
          actionType: "CREATE",
          module: "Professeurs",
          targetType: "Professeur",
          targetId: professeurAjoute?.id_professeur,
          description: `Creation du professeur ${professeurAjoute?.prenom || ""} ${professeurAjoute?.nom || ""}.`.trim(),
          newValue: professeurAjoute,
        });
        response.status(201).json(professeurAjoute);
      } catch (error) {
        await journaliserActivite({
          request,
          actionType: "CREATE",
          module: "Professeurs",
          targetType: "Professeur",
          description: "Echec de creation d'un professeur.",
          status: "ERROR",
          errorMessage: error.message,
          newValue: request.body,
        });
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
    verrouProfesseur,
    async (request, response) => {
      try {
        const ancienProfesseur = request.professeur;
        const professeurModifie = await modifierProfesseur(
          Number(request.params.id),
          request.body
        );

        await journaliserActivite({
          request,
          actionType: "UPDATE",
          module: "Professeurs",
          targetType: "Professeur",
          targetId: request.params.id,
          description: `Modification du professeur ${professeurModifie?.prenom || ""} ${professeurModifie?.nom || ""}.`.trim(),
          oldValue: ancienProfesseur,
          newValue: professeurModifie,
        });

        response.status(200).json(professeurModifie);
      } catch (error) {
        await journaliserActivite({
          request,
          actionType: "UPDATE",
          module: "Professeurs",
          targetType: "Professeur",
          targetId: request.params.id,
          description: "Echec de modification d'un professeur.",
          status: "ERROR",
          errorMessage: error.message,
          oldValue: request.professeur,
          newValue: request.body,
        });
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
    verrouProfesseur,
    async (request, response) => {
      try {
        const ancienProfesseur = request.professeur;
        await supprimerProfesseur(Number(request.params.id));
        await journaliserActivite({
          request,
          actionType: "DELETE",
          module: "Professeurs",
          targetType: "Professeur",
          targetId: request.params.id,
          description: `Suppression du professeur ${ancienProfesseur?.prenom || ""} ${ancienProfesseur?.nom || ""}.`.trim(),
          oldValue: ancienProfesseur,
        });
        response.status(200).json({ message: "Professeur supprime." });
      } catch (error) {
        await journaliserActivite({
          request,
          actionType: "DELETE",
          module: "Professeurs",
          targetType: "Professeur",
          targetId: request.params.id,
          description: "Echec de suppression d'un professeur.",
          status: "ERROR",
          errorMessage: error.message,
          oldValue: request.professeur,
        });
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

        if (!Number.isInteger(idProfesseur) || idProfesseur <= 0) {
          return response.status(400).json({ message: "Identifiant invalide." });
        }

        const professeur = await recupererProfesseurParId(idProfesseur);

        if (!professeur) {
          return response.status(404).json({ message: "Professeur introuvable." });
        }

        const horaire = await recupererHoraireProfesseur(idProfesseur);

        return response.status(200).json(horaire);
      } catch (error) {
        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );
}
