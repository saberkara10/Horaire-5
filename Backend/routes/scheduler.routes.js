/**
 * ROUTES — Scheduler avancé
 *
 * POST /api/scheduler/generer  — Lance la génération complète
 * GET  /api/scheduler/rapports — Historique des générations
 * GET  /api/scheduler/sessions — Gestion des sessions
 * POST /api/scheduler/sessions — Créer une session
 * POST /api/scheduler/cours-echoues — Enregistrer cours échoués
 * POST /api/scheduler/absences — Gérer absences professeurs
 * POST /api/scheduler/salles-indisponibles — Gérer salles HS
 * GET  /api/scheduler/prerequis — Prérequis cours
 * POST /api/scheduler/prerequis — Ajouter prérequis
 */

import { userAuth, userAdmin, userAdminOrResponsable } from "../middlewares/auth.js";
import { SchedulerEngine } from "../src/services/scheduler/SchedulerEngine.js";
import { SchedulerDataBootstrap } from "../src/services/scheduler/SchedulerDataBootstrap.js";
import { FailedCourseDebugService } from "../src/services/scheduler/FailedCourseDebugService.js";
import { SchedulerReportService } from "../src/services/scheduler/SchedulerReportService.js";
import { assurerSchemaSchedulerAcademique } from "../src/services/academic-scheduler-schema.js";
import pool from "../db.js";

function getUser(req) {
  return req.user || req.session?.user || null;
}

export default function schedulerRoutes(app) {

  // ── GET /api/scheduler/bootstrap ────────────────────────────────────────
  app.post("/api/scheduler/bootstrap", userAuth, userAdmin, async (req, res) => {
    try {
      const report = await SchedulerDataBootstrap.ensureOperationalDataset();
      return res.json({ message: "Bootstrap terminé.", report });
    } catch (error) {
      console.error("ERREUR Bootstrap:", error);
      return res.status(500).json({ message: error.message || "Erreur serveur." });
    }
  });

  // ── POST /api/scheduler/generer-stream (SSE) ────────────────────────────
  app.get("/api/scheduler/generer-stream", userAuth, userAdmin, async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const user = getUser(req);
    const { id_session, inclure_weekend, sa_params } = req.query;
    const saParams = sa_params ? JSON.parse(sa_params) : {};

    try {
      const rapport = await SchedulerEngine.generer({
        idSession: id_session ? Number(id_session) : null,
        idUtilisateur: user?.id || null,
        inclureWeekend: inclure_weekend === "true",
        saParams,
        onProgress: (info) => sendEvent({ type: "progress", ...info }),
      });
      sendEvent({ type: "done", rapport });
    } catch (error) {
      sendEvent({ type: "error", message: error.message || "Erreur serveur." });
    } finally {
      res.end();
    }
  });

  // ── POST /api/scheduler/generer ─────────────────────────────────────────
  app.post("/api/scheduler/generer", userAuth, userAdmin, async (req, res) => {
    try {
      const user = getUser(req);
      const {
        id_session = null,
        inclure_weekend = false,
        sa_params = {},
      } = req.body ?? {};

      const rapport = await SchedulerEngine.generer({
        idSession: id_session ? Number(id_session) : null,
        idUtilisateur: user?.id || null,
        inclureWeekend: Boolean(inclure_weekend),
        saParams: sa_params,
        onProgress: null,
      });

      return res.status(201).json({
        message: `✅ ${rapport.nb_cours_planifies} affectations générées. Score qualité : ${rapport.score_qualite}/100`,
        rapport,
      });
    } catch (error) {
      console.error("ERREUR Génération:", error);
      return res.status(error.statusCode || 500).json({ message: error.message || "Erreur serveur." });
    }
  });

  // ── GET /api/scheduler/rapports ─────────────────────────────────────────
  app.get("/api/scheduler/rapports", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const rapports = await SchedulerReportService.listerRapports(pool);
      return res.json(rapports);
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get("/api/scheduler/rapports/:id", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const rapport = await SchedulerReportService.lireRapport(
        Number(req.params.id),
        pool
      );

      if (!rapport) {
        return res.status(404).json({ message: "Rapport introuvable." });
      }

      return res.json(rapport);
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur." });
    }
  });

  // ── GET /api/scheduler/sessions ─────────────────────────────────────────
  app.get("/api/scheduler/sessions", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const [sessions] = await pool.query(
        `SELECT id_session, nom, date_debut, date_fin, active, created_at
         FROM sessions ORDER BY date_debut DESC`
      );
      return res.json(sessions);
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── POST /api/scheduler/sessions ────────────────────────────────────────
  app.post("/api/scheduler/sessions", userAuth, userAdmin, async (req, res) => {
    try {
      const { nom, date_debut, date_fin } = req.body ?? {};
      if (!nom || !date_debut || !date_fin) {
        return res.status(400).json({ message: "Champs requis : nom, date_debut, date_fin." });
      }
      // Désactiver les autres sessions
      await pool.query(`UPDATE sessions SET active = FALSE`);
      const [result] = await pool.query(
        `INSERT INTO sessions (nom, date_debut, date_fin, active) VALUES (?, ?, ?, TRUE)`,
        [nom, date_debut, date_fin]
      );
      return res.status(201).json({ id_session: result.insertId, nom, date_debut, date_fin, active: true });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── PUT /api/scheduler/sessions/:id/activer ─────────────────────────────
  app.put("/api/scheduler/sessions/:id/activer", userAuth, userAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await pool.query(`UPDATE sessions SET active = FALSE`);
      await pool.query(`UPDATE sessions SET active = TRUE WHERE id_session = ?`, [id]);
      return res.json({ message: "Session activée." });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── GET /api/scheduler/cours-echoues ────────────────────────────────────
  app.get("/api/scheduler/cours-echoues", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      await assurerSchemaSchedulerAcademique();
      const [rows] = await pool.query(
        `SELECT ce.*, e.nom AS etudiant_nom, e.prenom AS etudiant_prenom,
                e.matricule, c.code AS cours_code, c.nom AS cours_nom,
                c.est_cours_cle, ge.nom_groupe AS groupe_reprise
         FROM cours_echoues ce
         JOIN etudiants e ON e.id_etudiant = ce.id_etudiant
         JOIN cours c ON c.id_cours = ce.id_cours
         LEFT JOIN groupes_etudiants ge
           ON ge.id_groupes_etudiants = ce.id_groupe_reprise
         ORDER BY c.est_cours_cle DESC, e.nom, c.code`
      );
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── POST /api/scheduler/cours-echoues ───────────────────────────────────
  app.get("/api/scheduler/debug/reprises", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const rapport = await FailedCourseDebugService.genererRapport({
        codes: req.query.codes,
        matricules: req.query.matricules,
        idEtudiant: req.query.id_etudiant,
        statut: req.query.statut || "resolution_manuelle",
      });
      return res.json(rapport);
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur." });
    }
  });

  app.post("/api/scheduler/cours-echoues", userAuth, userAdmin, async (req, res) => {
    try {
      await assurerSchemaSchedulerAcademique();
      const { id_etudiant, id_cours, id_session, note_echec } = req.body ?? {};
      if (!id_etudiant || !id_cours) {
        return res.status(400).json({ message: "id_etudiant et id_cours requis." });
      }
      const [result] = await pool.query(
        `INSERT INTO cours_echoues (id_etudiant, id_cours, id_session, note_echec, statut)
         VALUES (?, ?, ?, ?, 'a_reprendre')
         ON DUPLICATE KEY UPDATE note_echec = VALUES(note_echec), statut = 'a_reprendre'`,
        [Number(id_etudiant), Number(id_cours), id_session ? Number(id_session) : null, note_echec || null]
      );
      return res.status(201).json({ message: "Cours échoué enregistré.", id: result.insertId });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── DELETE /api/scheduler/cours-echoues/:id ─────────────────────────────
  app.delete("/api/scheduler/cours-echoues/:id", userAuth, userAdmin, async (req, res) => {
    try {
      await pool.query(`DELETE FROM cours_echoues WHERE id = ?`, [Number(req.params.id)]);
      return res.json({ message: "Supprimé." });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── GET /api/scheduler/absences ─────────────────────────────────────────
  app.get("/api/scheduler/absences", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT ap.*, p.nom AS prof_nom, p.prenom AS prof_prenom, p.matricule
         FROM absences_professeurs ap
         JOIN professeurs p ON p.id_professeur = ap.id_professeur
         ORDER BY ap.date_debut DESC`
      );
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── POST /api/scheduler/absences ────────────────────────────────────────
  app.post("/api/scheduler/absences", userAuth, userAdmin, async (req, res) => {
    try {
      const user = getUser(req);
      const { id_professeur, date_debut, date_fin, type = "autre", commentaire } = req.body ?? {};
      if (!id_professeur || !date_debut || !date_fin) {
        return res.status(400).json({ message: "id_professeur, date_debut, date_fin requis." });
      }
      const [result] = await pool.query(
        `INSERT INTO absences_professeurs (id_professeur, date_debut, date_fin, type, commentaire, approuve_par)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(id_professeur), date_debut, date_fin, type, commentaire || null, user?.id || null]
      );
      return res.status(201).json({ message: "Absence enregistrée.", id: result.insertId });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── DELETE /api/scheduler/absences/:id ──────────────────────────────────
  app.delete("/api/scheduler/absences/:id", userAuth, userAdmin, async (req, res) => {
    try {
      await pool.query(`DELETE FROM absences_professeurs WHERE id = ?`, [Number(req.params.id)]);
      return res.json({ message: "Absence supprimée." });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── GET /api/scheduler/salles-indisponibles ──────────────────────────────
  app.get("/api/scheduler/salles-indisponibles", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT si.*, s.code AS salle_code, s.type AS salle_type
         FROM salles_indisponibles si
         JOIN salles s ON s.id_salle = si.id_salle
         ORDER BY si.date_debut DESC`
      );
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── POST /api/scheduler/salles-indisponibles ─────────────────────────────
  app.post("/api/scheduler/salles-indisponibles", userAuth, userAdmin, async (req, res) => {
    try {
      const { id_salle, date_debut, date_fin, raison = "autre", commentaire } = req.body ?? {};
      if (!id_salle || !date_debut || !date_fin) {
        return res.status(400).json({ message: "id_salle, date_debut, date_fin requis." });
      }
      const [result] = await pool.query(
        `INSERT INTO salles_indisponibles (id_salle, date_debut, date_fin, raison, commentaire)
         VALUES (?, ?, ?, ?, ?)`,
        [Number(id_salle), date_debut, date_fin, raison, commentaire || null]
      );
      return res.status(201).json({ message: "Salle marquée indisponible.", id: result.insertId });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── DELETE /api/scheduler/salles-indisponibles/:id ───────────────────────
  app.delete("/api/scheduler/salles-indisponibles/:id", userAuth, userAdmin, async (req, res) => {
    try {
      await pool.query(`DELETE FROM salles_indisponibles WHERE id = ?`, [Number(req.params.id)]);
      return res.json({ message: "Supprimé." });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── GET /api/scheduler/prerequis ────────────────────────────────────────
  app.get("/api/scheduler/prerequis", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT p.id, cp.code AS code_prerequis, cp.nom AS nom_prerequis,
                cs.code AS code_cours_suivant, cs.nom AS nom_cours_suivant,
                p.est_bloquant
         FROM prerequis_cours p
         JOIN cours cp ON cp.id_cours = p.id_cours_prerequis
         JOIN cours cs ON cs.id_cours = p.id_cours_suivant
         ORDER BY cp.code, cs.code`
      );
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── POST /api/scheduler/prerequis ───────────────────────────────────────
  app.post("/api/scheduler/prerequis", userAuth, userAdmin, async (req, res) => {
    try {
      const { id_cours_prerequis, id_cours_suivant, est_bloquant = true } = req.body ?? {};
      if (!id_cours_prerequis || !id_cours_suivant) {
        return res.status(400).json({ message: "id_cours_prerequis et id_cours_suivant requis." });
      }
      const [result] = await pool.query(
        `INSERT INTO prerequis_cours (id_cours_prerequis, id_cours_suivant, est_bloquant)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE est_bloquant = VALUES(est_bloquant)`,
        [Number(id_cours_prerequis), Number(id_cours_suivant), est_bloquant ? 1 : 0]
      );
      return res.status(201).json({ message: "Prérequis ajouté.", id: result.insertId });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── DELETE /api/scheduler/prerequis/:id ─────────────────────────────────
  app.delete("/api/scheduler/prerequis/:id", userAuth, userAdmin, async (req, res) => {
    try {
      await pool.query(`DELETE FROM prerequis_cours WHERE id = ?`, [Number(req.params.id)]);
      return res.json({ message: "Prérequis supprimé." });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });
}
