import pool from "../db.js";
import { userAuth } from "../middlewares/auth.js";
import { recupererPlanningCompletGroupe } from "../src/model/groupes.model.js";
import {
  recupererHoraireProfesseur,
  recupererProfesseurParId,
} from "../src/model/professeurs.model.js";
import { recupererHoraireCompletEtudiant } from "../src/model/etudiants.model.js";
import {
  genererPDFGroupe,
  genererPDFProfesseur,
  genererPDFEtudiant,
  genererExcelGroupe,
  genererExcelProfesseur,
  genererExcelEtudiant,
} from "../src/services/ExportService.js";

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function composerLibelleSession(session, annee) {
  const sessionLabel = String(session || "").trim();
  const yearLabel = String(annee || "").trim();

  if (!sessionLabel) {
    return yearLabel;
  }

  if (!yearLabel || sessionLabel.includes(yearLabel)) {
    return sessionLabel;
  }

  return `${sessionLabel} ${yearLabel}`;
}

function nomFichier(type, identifiant, session, ext) {
  const identifiantSlug = slug(identifiant);
  const sessionSlug = slug(session);
  return `horaire-${type}-${identifiantSlug}${sessionSlug ? `-${sessionSlug}` : ""}.${ext}`;
}

async function recupererSessionActive() {
  const [[row]] = await pool.query(
    `SELECT nom, YEAR(date_debut) AS annee
     FROM sessions
     WHERE active = TRUE
     ORDER BY id_session DESC
     LIMIT 1`
  );

  return row || null;
}

async function chargerDonneesGroupe(idGroupe) {
  const resultat = await recupererPlanningCompletGroupe(idGroupe);
  if (!resultat) {
    return null;
  }

  const sessionActive = await recupererSessionActive();
  return {
    ...resultat,
    groupe: {
      ...resultat.groupe,
      annee: resultat.groupe?.annee || sessionActive?.annee || null,
      session: resultat.groupe?.session || sessionActive?.nom || null,
    },
  };
}

async function chargerDonneesProfesseur(idProfesseur) {
  const [professeur, horaire, sessionActive] = await Promise.all([
    recupererProfesseurParId(idProfesseur),
    recupererHoraireProfesseur(idProfesseur),
    recupererSessionActive(),
  ]);

  if (!professeur) {
    return null;
  }

  return {
    professeur: {
      ...professeur,
      session: professeur.session || sessionActive?.nom || null,
      annee: professeur.annee || sessionActive?.annee || null,
    },
    horaire,
  };
}

async function chargerDonneesEtudiant(idEtudiant) {
  const [resultat, sessionActive] = await Promise.all([
    recupererHoraireCompletEtudiant(idEtudiant),
    recupererSessionActive(),
  ]);

  if (!resultat) {
    return null;
  }

  return {
    ...resultat,
    etudiant: {
      ...resultat.etudiant,
      session: resultat.etudiant?.session || sessionActive?.nom || null,
      annee: resultat.etudiant?.annee || sessionActive?.annee || null,
    },
  };
}

function envoyerFichier(res, filename, contentType, buffer) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", buffer.length);
  return res.send(buffer);
}

export default function exportRoutes(app) {
  app.get("/api/export/groupe/:id/pdf", userAuth, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      if (!Number.isInteger(idGroupe) || idGroupe <= 0) {
        return res.status(400).json({ message: "ID invalide." });
      }

      const data = await chargerDonneesGroupe(idGroupe);
      if (!data) {
        return res.status(404).json({ message: "Groupe introuvable." });
      }

      const buffer = await genererPDFGroupe(data);
      const filename = nomFichier(
        "groupe",
        data.groupe.nom_groupe,
        composerLibelleSession(data.groupe.session, data.groupe.annee),
        "pdf"
      );
      return envoyerFichier(res, filename, "application/pdf", buffer);
    } catch (error) {
      console.error("[export] groupe PDF:", error);
      return res.status(500).json({ message: "Erreur lors de la generation du PDF." });
    }
  });

  app.get("/api/export/groupe/:id/excel", userAuth, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      if (!Number.isInteger(idGroupe) || idGroupe <= 0) {
        return res.status(400).json({ message: "ID invalide." });
      }

      const data = await chargerDonneesGroupe(idGroupe);
      if (!data) {
        return res.status(404).json({ message: "Groupe introuvable." });
      }

      const buffer = genererExcelGroupe(data);
      const filename = nomFichier(
        "groupe",
        data.groupe.nom_groupe,
        composerLibelleSession(data.groupe.session, data.groupe.annee),
        "xlsx"
      );
      return envoyerFichier(
        res,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer
      );
    } catch (error) {
      console.error("[export] groupe Excel:", error);
      return res.status(500).json({ message: "Erreur lors de la generation Excel." });
    }
  });

  app.get("/api/export/professeur/:id/pdf", userAuth, async (req, res) => {
    try {
      const idProfesseur = Number(req.params.id);
      if (!Number.isInteger(idProfesseur) || idProfesseur <= 0) {
        return res.status(400).json({ message: "ID invalide." });
      }

      const data = await chargerDonneesProfesseur(idProfesseur);
      if (!data) {
        return res.status(404).json({ message: "Professeur introuvable." });
      }

      const buffer = await genererPDFProfesseur(data);
      const identifiant = `${data.professeur.prenom || ""}-${data.professeur.nom || ""}`.trim();
      const filename = nomFichier(
        "professeur",
        identifiant,
        composerLibelleSession(data.professeur.session, data.professeur.annee),
        "pdf"
      );
      return envoyerFichier(res, filename, "application/pdf", buffer);
    } catch (error) {
      console.error("[export] professeur PDF:", error);
      return res.status(500).json({ message: "Erreur lors de la generation du PDF." });
    }
  });

  app.get("/api/export/professeur/:id/excel", userAuth, async (req, res) => {
    try {
      const idProfesseur = Number(req.params.id);
      if (!Number.isInteger(idProfesseur) || idProfesseur <= 0) {
        return res.status(400).json({ message: "ID invalide." });
      }

      const data = await chargerDonneesProfesseur(idProfesseur);
      if (!data) {
        return res.status(404).json({ message: "Professeur introuvable." });
      }

      const buffer = genererExcelProfesseur(data);
      const identifiant = `${data.professeur.prenom || ""}-${data.professeur.nom || ""}`.trim();
      const filename = nomFichier(
        "professeur",
        identifiant,
        composerLibelleSession(data.professeur.session, data.professeur.annee),
        "xlsx"
      );
      return envoyerFichier(
        res,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer
      );
    } catch (error) {
      console.error("[export] professeur Excel:", error);
      return res.status(500).json({ message: "Erreur lors de la generation Excel." });
    }
  });

  app.get("/api/export/etudiant/:id/pdf", userAuth, async (req, res) => {
    try {
      const idEtudiant = Number(req.params.id);
      if (!Number.isInteger(idEtudiant) || idEtudiant <= 0) {
        return res.status(400).json({ message: "ID invalide." });
      }

      const data = await chargerDonneesEtudiant(idEtudiant);
      if (!data) {
        return res.status(404).json({ message: "Etudiant introuvable." });
      }

      const buffer = await genererPDFEtudiant(data);
      const identifiant = `${data.etudiant.prenom || ""}-${data.etudiant.nom || ""}`.trim();
      const filename = nomFichier(
        "etudiant",
        identifiant,
        composerLibelleSession(data.etudiant.session, data.etudiant.annee),
        "pdf"
      );
      return envoyerFichier(res, filename, "application/pdf", buffer);
    } catch (error) {
      console.error("[export] etudiant PDF:", error);
      return res.status(500).json({ message: "Erreur lors de la generation du PDF." });
    }
  });

  app.get("/api/export/etudiant/:id/excel", userAuth, async (req, res) => {
    try {
      const idEtudiant = Number(req.params.id);
      if (!Number.isInteger(idEtudiant) || idEtudiant <= 0) {
        return res.status(400).json({ message: "ID invalide." });
      }

      const data = await chargerDonneesEtudiant(idEtudiant);
      if (!data) {
        return res.status(404).json({ message: "Etudiant introuvable." });
      }

      const buffer = genererExcelEtudiant(data);
      const identifiant = `${data.etudiant.prenom || ""}-${data.etudiant.nom || ""}`.trim();
      const filename = nomFichier(
        "etudiant",
        identifiant,
        composerLibelleSession(data.etudiant.session, data.etudiant.annee),
        "xlsx"
      );
      return envoyerFichier(
        res,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer
      );
    } catch (error) {
      console.error("[export] etudiant Excel:", error);
      return res.status(500).json({ message: "Erreur lors de la generation Excel." });
    }
  });
}
