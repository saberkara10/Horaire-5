/**
 * ROUTES — Export d'horaires (PDF & Excel)
 *
 * GET /api/export/groupe/:id/pdf
 * GET /api/export/groupe/:id/excel
 * GET /api/export/professeur/:id/pdf
 * GET /api/export/professeur/:id/excel
 * GET /api/export/etudiant/:id/pdf
 * GET /api/export/etudiant/:id/excel
 */

import pool from "../db.js";
import { userAuth } from "../middlewares/auth.js";
import {
  genererPDFGroupe,
  genererPDFProfesseur,
  genererPDFEtudiant,
  genererExcelGroupe,
  genererExcelProfesseur,
  genererExcelEtudiant,
} from "../src/services/ExportService.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Slug propre pour le nom de fichier */
function slug(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function nomFichier(type, identifiant, session, ext) {
  const i = slug(identifiant);
  const s = slug(session);
  return `horaire-${type}-${i}${s ? `-${s}` : ""}.${ext}`;
}

/** Récupère la session active */
async function sessionActive() {
  const [[row]] = await pool.query(
    `SELECT nom, YEAR(date_debut) AS annee FROM sessions WHERE active = TRUE ORDER BY id_session DESC LIMIT 1`
  );
  return row || null;
}

// ─── Données Groupe ────────────────────────────────────────────────────────────
async function chargerDonneesGroupe(idGroupe) {
  // Infos groupe
  const [[groupe]] = await pool.query(
    `SELECT ge.id_groupes_etudiants, ge.nom_groupe, ge.programme, ge.etape,
            COALESCE(MAX(e.session), s.nom) AS session,
            COALESCE(MAX(e.annee), YEAR(s.date_debut)) AS annee,
            COUNT(e.id_etudiant) AS effectif
     FROM groupes_etudiants ge
     LEFT JOIN etudiants e ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     LEFT JOIN sessions s ON s.id_session = ge.id_session
     WHERE ge.id_groupes_etudiants = ?
     GROUP BY ge.id_groupes_etudiants`,
    [idGroupe]
  );
  if (!groupe) return null;

  // Horaire complet
  const [horaire] = await pool.query(
    `SELECT ac.id_affectation_cours,
            c.code AS code_cours, c.nom AS nom_cours,
            p.nom AS nom_professeur, p.prenom AS prenom_professeur,
            s.code AS code_salle, s.type AS type_salle,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            TIME_FORMAT(ph.heure_debut, '%H:%i') AS heure_debut,
            TIME_FORMAT(ph.heure_fin, '%H:%i') AS heure_fin
     FROM affectation_groupes ag
     JOIN affectation_cours ac ON ac.id_affectation_cours = ag.id_affectation_cours
     JOIN cours c ON c.id_cours = ac.id_cours
     JOIN professeurs p ON p.id_professeur = ac.id_professeur
     LEFT JOIN salles s ON s.id_salle = ac.id_salle
     JOIN plages_horaires ph ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ag.id_groupes_etudiants = ?
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [idGroupe]
  );

  return { groupe, horaire };
}

// ─── Données Professeur ────────────────────────────────────────────────────────
async function chargerDonneesProfesseur(idProf) {
  const [[professeur]] = await pool.query(
    `SELECT id_professeur, matricule, nom, prenom, specialite FROM professeurs WHERE id_professeur = ?`,
    [idProf]
  );
  if (!professeur) return null;

  const sess = await sessionActive();
  if (sess) professeur.session = `${sess.nom}`;

  const [horaire] = await pool.query(
    `SELECT ac.id_affectation_cours,
            c.code AS code_cours, c.nom AS nom_cours,
            GROUP_CONCAT(DISTINCT ge.nom_groupe ORDER BY ge.nom_groupe SEPARATOR ', ') AS groupes,
            sl.code AS code_salle, sl.type AS type_salle,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            TIME_FORMAT(ph.heure_debut, '%H:%i') AS heure_debut,
            TIME_FORMAT(ph.heure_fin, '%H:%i') AS heure_fin
     FROM affectation_cours ac
     JOIN cours c ON c.id_cours = ac.id_cours
     LEFT JOIN salles sl ON sl.id_salle = ac.id_salle
     JOIN plages_horaires ph ON ph.id_plage_horaires = ac.id_plage_horaires
     LEFT JOIN affectation_groupes ag ON ag.id_affectation_cours = ac.id_affectation_cours
     LEFT JOIN groupes_etudiants ge ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     WHERE ac.id_professeur = ?
     GROUP BY ac.id_affectation_cours, c.code, c.nom, sl.code, sl.type, ph.date, ph.heure_debut, ph.heure_fin
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [idProf]
  );

  return { professeur, horaire };
}

// ─── Données Étudiant ──────────────────────────────────────────────────────────
async function chargerDonneesEtudiant(idEtudiant) {
  const [[etudiant]] = await pool.query(
    `SELECT e.id_etudiant, e.matricule, e.nom, e.prenom, e.programme, e.etape, e.session, e.annee,
            ge.nom_groupe AS groupe
     FROM etudiants e
     LEFT JOIN groupes_etudiants ge ON ge.id_groupes_etudiants = e.id_groupes_etudiants
     WHERE e.id_etudiant = ?`,
    [idEtudiant]
  );
  if (!etudiant) return null;

  const SESSION_ACTIVE = `(SELECT id_session FROM sessions WHERE active = TRUE ORDER BY id_session DESC LIMIT 1)`;

  // Horaire groupe principal
  const [horaire] = await pool.query(
    `SELECT ac.id_affectation_cours,
            c.id_cours, c.code AS code_cours, c.nom AS nom_cours,
            p.nom AS nom_professeur, p.prenom AS prenom_professeur,
            sl.code AS code_salle,
            ge.nom_groupe,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            TIME_FORMAT(ph.heure_debut, '%H:%i') AS heure_debut,
            TIME_FORMAT(ph.heure_fin, '%H:%i') AS heure_fin,
            0 AS est_reprise,
            'groupe' AS source_horaire,
            NULL AS groupe_source,
            NULL AS statut_reprise
     FROM etudiants e
     JOIN groupes_etudiants ge ON ge.id_groupes_etudiants = e.id_groupes_etudiants
     JOIN affectation_groupes ag ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
     JOIN affectation_cours ac ON ac.id_affectation_cours = ag.id_affectation_cours
     JOIN cours c ON c.id_cours = ac.id_cours
     JOIN professeurs p ON p.id_professeur = ac.id_professeur
     LEFT JOIN salles sl ON sl.id_salle = ac.id_salle
     JOIN plages_horaires ph ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE e.id_etudiant = ?
       AND ge.id_session = ${SESSION_ACTIVE}
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [idEtudiant]
  );

  // Horaire reprises
  const [horaireReprises] = await pool.query(
    `SELECT ac.id_affectation_cours,
            c.id_cours, c.code AS code_cours, c.nom AS nom_cours,
            p.nom AS nom_professeur, p.prenom AS prenom_professeur,
            sl.code AS code_salle,
            ge.nom_groupe AS groupe_source,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            TIME_FORMAT(ph.heure_debut, '%H:%i') AS heure_debut,
            TIME_FORMAT(ph.heure_fin, '%H:%i') AS heure_fin,
            1 AS est_reprise,
            'reprise' AS source_horaire,
            ce.statut AS statut_reprise,
            ae.id_cours_echoue
     FROM affectation_etudiants ae
     JOIN groupes_etudiants ge ON ge.id_groupes_etudiants = ae.id_groupes_etudiants
     JOIN affectation_groupes ag ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
     JOIN affectation_cours ac ON ac.id_affectation_cours = ag.id_affectation_cours
                               AND ac.id_cours = ae.id_cours
     JOIN cours c ON c.id_cours = ac.id_cours
     JOIN professeurs p ON p.id_professeur = ac.id_professeur
     LEFT JOIN salles sl ON sl.id_salle = ac.id_salle
     JOIN plages_horaires ph ON ph.id_plage_horaires = ac.id_plage_horaires
     LEFT JOIN cours_echoues ce ON ce.id = ae.id_cours_echoue
     WHERE ae.id_etudiant = ?
       AND ae.id_session = ${SESSION_ACTIVE}
       AND ae.source_type = 'reprise'
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [idEtudiant]
  );

  // Cours échoués (à reprendre + planifiés)
  const [reprises] = await pool.query(
    `SELECT ce.id, ce.statut, ce.note_echec,
            c.id_cours, c.code AS code_cours, c.nom AS nom_cours, c.etape_etude,
            ge.nom_groupe AS groupe_reprise
     FROM cours_echoues ce
     JOIN cours c ON c.id_cours = ce.id_cours
     LEFT JOIN groupes_etudiants ge ON ge.id_groupes_etudiants = ce.id_groupe_reprise
     WHERE ce.id_etudiant = ?
       AND ce.id_session = ${SESSION_ACTIVE}
     ORDER BY c.etape_etude ASC, c.code ASC`,
    [idEtudiant]
  );

  return { etudiant, horaire, horaire_reprises: horaireReprises, reprises };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Enregistrement des routes
// ═══════════════════════════════════════════════════════════════════════════════
export default function exportRoutes(app) {

  // ── GROUPE PDF ──────────────────────────────────────────────────────────────
  app.get("/api/export/groupe/:id/pdf", userAuth, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      if (!Number.isInteger(idGroupe) || idGroupe <= 0)
        return res.status(400).json({ message: "ID invalide." });

      const data = await chargerDonneesGroupe(idGroupe);
      if (!data) return res.status(404).json({ message: "Groupe introuvable." });

      const buffer = await genererPDFGroupe(data);
      const filename = nomFichier(
        "groupe", data.groupe.nom_groupe,
        `${data.groupe.session || ""}-${data.groupe.annee || ""}`, "pdf"
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    } catch (err) {
      console.error("[export] groupe PDF:", err);
      return res.status(500).json({ message: "Erreur lors de la génération du PDF." });
    }
  });

  // ── GROUPE EXCEL ────────────────────────────────────────────────────────────
  app.get("/api/export/groupe/:id/excel", userAuth, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      if (!Number.isInteger(idGroupe) || idGroupe <= 0)
        return res.status(400).json({ message: "ID invalide." });

      const data = await chargerDonneesGroupe(idGroupe);
      if (!data) return res.status(404).json({ message: "Groupe introuvable." });

      const buffer = genererExcelGroupe(data);
      const filename = nomFichier(
        "groupe", data.groupe.nom_groupe,
        `${data.groupe.session || ""}-${data.groupe.annee || ""}`, "xlsx"
      );
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    } catch (err) {
      console.error("[export] groupe Excel:", err);
      return res.status(500).json({ message: "Erreur lors de la génération Excel." });
    }
  });

  // ── PROFESSEUR PDF ──────────────────────────────────────────────────────────
  app.get("/api/export/professeur/:id/pdf", userAuth, async (req, res) => {
    try {
      const idProf = Number(req.params.id);
      if (!Number.isInteger(idProf) || idProf <= 0)
        return res.status(400).json({ message: "ID invalide." });

      const data = await chargerDonneesProfesseur(idProf);
      if (!data) return res.status(404).json({ message: "Professeur introuvable." });

      const buffer = await genererPDFProfesseur(data);
      const { professeur } = data;
      const filename = nomFichier(
        "professeur", `${professeur.prenom}-${professeur.nom}`,
        professeur.session || "", "pdf"
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    } catch (err) {
      console.error("[export] professeur PDF:", err);
      return res.status(500).json({ message: "Erreur lors de la génération du PDF." });
    }
  });

  // ── PROFESSEUR EXCEL ────────────────────────────────────────────────────────
  app.get("/api/export/professeur/:id/excel", userAuth, async (req, res) => {
    try {
      const idProf = Number(req.params.id);
      if (!Number.isInteger(idProf) || idProf <= 0)
        return res.status(400).json({ message: "ID invalide." });

      const data = await chargerDonneesProfesseur(idProf);
      if (!data) return res.status(404).json({ message: "Professeur introuvable." });

      const buffer = genererExcelProfesseur(data);
      const { professeur } = data;
      const filename = nomFichier(
        "professeur", `${professeur.prenom}-${professeur.nom}`,
        professeur.session || "", "xlsx"
      );
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    } catch (err) {
      console.error("[export] professeur Excel:", err);
      return res.status(500).json({ message: "Erreur lors de la génération Excel." });
    }
  });

  // ── ÉTUDIANT PDF ────────────────────────────────────────────────────────────
  app.get("/api/export/etudiant/:id/pdf", userAuth, async (req, res) => {
    try {
      const idEtudiant = Number(req.params.id);
      if (!Number.isInteger(idEtudiant) || idEtudiant <= 0)
        return res.status(400).json({ message: "ID invalide." });

      const data = await chargerDonneesEtudiant(idEtudiant);
      if (!data) return res.status(404).json({ message: "Étudiant introuvable." });

      const buffer = await genererPDFEtudiant(data);
      const { etudiant } = data;
      const filename = nomFichier(
        "etudiant", `${etudiant.prenom}-${etudiant.nom}`,
        `${etudiant.session || ""}-${etudiant.annee || ""}`, "pdf"
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    } catch (err) {
      console.error("[export] étudiant PDF:", err);
      return res.status(500).json({ message: "Erreur lors de la génération du PDF." });
    }
  });

  // ── ÉTUDIANT EXCEL ──────────────────────────────────────────────────────────
  app.get("/api/export/etudiant/:id/excel", userAuth, async (req, res) => {
    try {
      const idEtudiant = Number(req.params.id);
      if (!Number.isInteger(idEtudiant) || idEtudiant <= 0)
        return res.status(400).json({ message: "ID invalide." });

      const data = await chargerDonneesEtudiant(idEtudiant);
      if (!data) return res.status(404).json({ message: "Étudiant introuvable." });

      const buffer = genererExcelEtudiant(data);
      const { etudiant } = data;
      const filename = nomFichier(
        "etudiant", `${etudiant.prenom}-${etudiant.nom}`,
        `${etudiant.session || ""}-${etudiant.annee || ""}`, "xlsx"
      );
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    } catch (err) {
      console.error("[export] étudiant Excel:", err);
      return res.status(500).json({ message: "Erreur lors de la génération Excel." });
    }
  });
}
