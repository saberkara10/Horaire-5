/**
 * Routes du scheduler academique.
 *
 * Ce fichier expose les flux d'administration et d'exploitation du moteur
 * intelligent :
 * - bootstrap du schema et du dataset operationnel ;
 * - generation complete avec ou sans SSE ;
 * - lecture des rapports ;
 * - gestion des sessions, reprises, absences, indisponibilites et prerequis.
 */

import { userAuth, userAdmin, userAdminOrResponsable } from "../middlewares/auth.js";
import { SchedulerEngine } from "../src/services/scheduler/SchedulerEngine.js";
import { SchedulerDataBootstrap } from "../src/services/scheduler/SchedulerDataBootstrap.js";
import { FailedCourseDebugService } from "../src/services/scheduler/FailedCourseDebugService.js";
import { SchedulerReportService } from "../src/services/scheduler/SchedulerReportService.js";
import { ScheduleModificationController } from "../src/controllers/scheduler/ScheduleModificationController.js";
import { ScheduleModificationService } from "../src/services/scheduler/planning/ScheduleModificationService.js";
import { ScenarioSimulator } from "../src/services/scheduler/simulation/ScenarioSimulator.js";
import { assurerSchemaSchedulerAcademique } from "../src/services/academic-scheduler-schema.js";
import pool from "../db.js";

function getUser(request) {
  return request.user || request.session?.user || null;
}

/**
 * Lit le mode d'optimisation d'un payload HTTP.
 *
 * La generation globale doit proposer les memes profils que les flux
 * intelligents de modification. Le moteur reste responsable de la
 * normalisation finale, mais les routes acceptent les alias historiques
 * pour rester retrocompatibles.
 *
 * @param {Object} [source={}] - body ou query source.
 * @returns {string} Mode demande ou fallback legacy.
 */
function readOptimizationMode(source = {}) {
  return source.optimization_mode || source.mode_optimisation || "legacy";
}

export default function schedulerRoutes(app) {
  // Bootstrap technique du schema et des donnees minimales du scheduler.
  app.post("/api/scheduler/bootstrap", userAuth, userAdmin, async (request, response) => {
    try {
      const report = await SchedulerDataBootstrap.ensureOperationalDataset();
      return response.json({ message: "Bootstrap termine.", report });
    } catch (error) {
      console.error("ERREUR Bootstrap:", error);
      return response.status(500).json({ message: error.message || "Erreur serveur." });
    }
  });

  // Generation complete avec suivi de progression SSE.
  app.get("/api/scheduler/generer-stream", userAuth, userAdmin, async (request, response) => {
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const sendEvent = (data) => {
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const user = getUser(request);
    const { id_session, inclure_weekend, sa_params } = request.query;
    const saParams = sa_params ? JSON.parse(sa_params) : {};
    const optimizationMode = readOptimizationMode(request.query || {});

    try {
      const rapport = await SchedulerEngine.generer({
        idSession: id_session ? Number(id_session) : null,
        idUtilisateur: user?.id || null,
        inclureWeekend: inclure_weekend === "true",
        optimizationMode,
        saParams,
        onProgress: (info) => sendEvent({ type: "progress", ...info }),
      });
      sendEvent({ type: "done", rapport });
    } catch (error) {
      sendEvent({ type: "error", message: error.message || "Erreur serveur." });
    } finally {
      response.end();
    }
  });

  // Generation complete sans canal SSE.
  app.post("/api/scheduler/generer", userAuth, userAdmin, async (request, response) => {
    try {
      const user = getUser(request);
      const {
        id_session = null,
        inclure_weekend = false,
        mode_optimisation = "legacy",
        optimization_mode = undefined,
        sa_params = {},
      } = request.body ?? {};

      const rapport = await SchedulerEngine.generer({
        idSession: id_session ? Number(id_session) : null,
        idUtilisateur: user?.id || null,
        inclureWeekend: Boolean(inclure_weekend),
        optimizationMode: optimization_mode || mode_optimisation || "legacy",
        saParams: sa_params,
        onProgress: null,
      });

      return response.status(201).json({
        message: `OK ${rapport.nb_cours_planifies} affectations generees. Score qualite : ${rapport.score_qualite}/100`,
        mode_optimisation_utilise:
          rapport?.details?.modeOptimisationUtilise || "legacy",
        rapport,
      });
    } catch (error) {
      console.error("ERREUR Generation:", error);
      return response
        .status(error.statusCode || 500)
        .json({ message: error.message || "Erreur serveur." });
    }
  });

  // Previsualisation read-only d'un scenario what-if.
  app.post(
    "/api/scheduler/what-if",
    userAuth,
    userAdminOrResponsable,
    async (request, response) => {
      try {
        const {
          id_session = null,
          mode_optimisation = "legacy",
          optimization_mode = undefined,
          scenario = null,
        } = request.body ?? {};

        if (!scenario || typeof scenario !== "object") {
          return response.status(400).json({
            message: "Le body doit contenir un scenario valide.",
            code: "SCENARIO_REQUIRED",
          });
        }

        const scenarioType = String(
          scenario.type || scenario.scenario_type || ""
        )
          .trim()
          .toUpperCase();

        if (scenarioType === "MODIFIER_AFFECTATION") {
          const rapport = await ScheduleModificationService.previewAssignmentModification(
            {
              idSeance:
                scenario.idSeance ||
                scenario.id_seance ||
                scenario.idAffectationCours ||
                scenario.id_affectation_cours,
              modifications: scenario.modifications || scenario.changements || {},
              portee: scenario.portee || scenario.scope || scenario.scope_mode,
              modeOptimisation:
                optimization_mode ||
                mode_optimisation ||
                scenario.modeOptimisation ||
                scenario.mode_optimisation ||
                "legacy",
            },
            pool
          );

          return response.status(200).json(rapport);
        }

        const rapport = await ScenarioSimulator.simulateOfficialScenario(
          {
            idSession: id_session ? Number(id_session) : null,
            optimizationMode: optimization_mode || mode_optimisation || "legacy",
            scenario,
          },
          pool
        );

        return response.status(200).json(rapport);
      } catch (error) {
        return response.status(error.statusCode || 500).json({
          message: error.message || "Erreur lors de la simulation what-if.",
          ...(error.code ? { code: error.code } : {}),
          ...(error.details?.simulation ? { simulation: error.details.simulation } : {}),
          ...(error.details?.warnings ? { warnings: error.details.warnings } : {}),
          ...(error.details ? { details: error.details } : {}),
        });
      }
    }
  );

  // Replanification intelligente d'une affectation existante.
  app.post(
    "/api/scheduler/modify-assignment",
    userAuth,
    userAdmin,
    (request, response) => ScheduleModificationController.modifyAssignment(request, response)
  );

  // Lecture des rapports historises du moteur.
  app.get("/api/scheduler/rapports", userAuth, userAdminOrResponsable, async (request, response) => {
    try {
      const rapports = await SchedulerReportService.listerRapports(pool);
      return response.json(rapports);
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get("/api/scheduler/rapports/:id", userAuth, userAdminOrResponsable, async (request, response) => {
    try {
      const rapport = await SchedulerReportService.lireRapport(
        Number(request.params.id),
        pool
      );

      if (!rapport) {
        return response.status(404).json({ message: "Rapport introuvable." });
      }

      return response.json(rapport);
    } catch (error) {
      return response.status(500).json({ message: error.message || "Erreur serveur." });
    }
  });

  // Gestion des sessions academiques.
  app.get("/api/scheduler/sessions", userAuth, userAdminOrResponsable, async (request, response) => {
    try {
      const [sessions] = await pool.query(
        `SELECT id_session, nom, date_debut, date_fin, active, created_at
         FROM sessions ORDER BY date_debut DESC`
      );
      return response.json(sessions);
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.post("/api/scheduler/sessions", userAuth, userAdmin, async (request, response) => {
    try {
      const { nom, date_debut, date_fin } = request.body ?? {};
      if (!nom || !date_debut || !date_fin) {
        return response.status(400).json({
          message: "Champs requis : nom, date_debut, date_fin.",
        });
      }

      await pool.query(`UPDATE sessions SET active = FALSE`);
      const [result] = await pool.query(
        `INSERT INTO sessions (nom, date_debut, date_fin, active) VALUES (?, ?, ?, TRUE)`,
        [nom, date_debut, date_fin]
      );

      return response.status(201).json({
        id_session: result.insertId,
        nom,
        date_debut,
        date_fin,
        active: true,
      });
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.put("/api/scheduler/sessions/:id/activer", userAuth, userAdmin, async (request, response) => {
    try {
      const id = Number(request.params.id);
      await pool.query(`UPDATE sessions SET active = FALSE`);
      await pool.query(`UPDATE sessions SET active = TRUE WHERE id_session = ?`, [id]);
      return response.json({ message: "Session activee." });
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  // Gestion des reprises / cours echoues.
  app.get("/api/scheduler/cours-echoues", userAuth, userAdminOrResponsable, async (request, response) => {
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
      return response.json(rows);
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.get("/api/scheduler/debug/reprises", userAuth, userAdminOrResponsable, async (request, response) => {
    try {
      const rapport = await FailedCourseDebugService.genererRapport({
        codes: request.query.codes,
        matricules: request.query.matricules,
        idEtudiant: request.query.id_etudiant,
        statut: request.query.statut || "resolution_manuelle",
      });
      return response.json(rapport);
    } catch (error) {
      return response.status(500).json({ message: error.message || "Erreur serveur." });
    }
  });

  app.post("/api/scheduler/cours-echoues", userAuth, userAdmin, async (request, response) => {
    try {
      await assurerSchemaSchedulerAcademique();
      const { id_etudiant, id_cours, id_session, note_echec } = request.body ?? {};
      if (!id_etudiant || !id_cours) {
        return response.status(400).json({ message: "id_etudiant et id_cours requis." });
      }

      const [result] = await pool.query(
        `INSERT INTO cours_echoues (id_etudiant, id_cours, id_session, note_echec, statut)
         VALUES (?, ?, ?, ?, 'a_reprendre')
         ON DUPLICATE KEY UPDATE note_echec = VALUES(note_echec), statut = 'a_reprendre'`,
        [Number(id_etudiant), Number(id_cours), id_session ? Number(id_session) : null, note_echec || null]
      );
      return response.status(201).json({
        message: "Cours echoue enregistre.",
        id: result.insertId,
      });
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.delete("/api/scheduler/cours-echoues/:id", userAuth, userAdmin, async (request, response) => {
    try {
      await pool.query(`DELETE FROM cours_echoues WHERE id = ?`, [Number(request.params.id)]);
      return response.json({ message: "Supprime." });
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  // Gestion des absences professeurs.
  app.get("/api/scheduler/absences", userAuth, userAdminOrResponsable, async (request, response) => {
    try {
      const [rows] = await pool.query(
        `SELECT ap.*, p.nom AS prof_nom, p.prenom AS prof_prenom, p.matricule
         FROM absences_professeurs ap
         JOIN professeurs p ON p.id_professeur = ap.id_professeur
         ORDER BY ap.date_debut DESC`
      );
      return response.json(rows);
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.post("/api/scheduler/absences", userAuth, userAdmin, async (request, response) => {
    try {
      const user = getUser(request);
      const { id_professeur, date_debut, date_fin, type = "autre", commentaire } = request.body ?? {};
      if (!id_professeur || !date_debut || !date_fin) {
        return response.status(400).json({
          message: "id_professeur, date_debut, date_fin requis.",
        });
      }

      const [result] = await pool.query(
        `INSERT INTO absences_professeurs (id_professeur, date_debut, date_fin, type, commentaire, approuve_par)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(id_professeur), date_debut, date_fin, type, commentaire || null, user?.id || null]
      );
      return response.status(201).json({
        message: "Absence enregistree.",
        id: result.insertId,
      });
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.delete("/api/scheduler/absences/:id", userAuth, userAdmin, async (request, response) => {
    try {
      await pool.query(`DELETE FROM absences_professeurs WHERE id = ?`, [Number(request.params.id)]);
      return response.json({ message: "Absence supprimee." });
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  // Gestion des indisponibilites de salles.
  app.get("/api/scheduler/salles-indisponibles", userAuth, userAdminOrResponsable, async (request, response) => {
    try {
      const [rows] = await pool.query(
        `SELECT si.*, s.code AS salle_code, s.type AS salle_type
         FROM salles_indisponibles si
         JOIN salles s ON s.id_salle = si.id_salle
         ORDER BY si.date_debut DESC`
      );
      return response.json(rows);
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.post("/api/scheduler/salles-indisponibles", userAuth, userAdmin, async (request, response) => {
    try {
      const { id_salle, date_debut, date_fin, raison = "autre", commentaire } = request.body ?? {};
      if (!id_salle || !date_debut || !date_fin) {
        return response.status(400).json({
          message: "id_salle, date_debut, date_fin requis.",
        });
      }

      const [result] = await pool.query(
        `INSERT INTO salles_indisponibles (id_salle, date_debut, date_fin, raison, commentaire)
         VALUES (?, ?, ?, ?, ?)`,
        [Number(id_salle), date_debut, date_fin, raison, commentaire || null]
      );
      return response.status(201).json({
        message: "Salle marquee indisponible.",
        id: result.insertId,
      });
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.delete("/api/scheduler/salles-indisponibles/:id", userAuth, userAdmin, async (request, response) => {
    try {
      await pool.query(`DELETE FROM salles_indisponibles WHERE id = ?`, [Number(request.params.id)]);
      return response.json({ message: "Supprime." });
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  // Gestion des prerequis du catalogue.
  app.get("/api/scheduler/prerequis", userAuth, userAdminOrResponsable, async (request, response) => {
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
      return response.json(rows);
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.post("/api/scheduler/prerequis", userAuth, userAdmin, async (request, response) => {
    try {
      const { id_cours_prerequis, id_cours_suivant, est_bloquant = true } = request.body ?? {};
      if (!id_cours_prerequis || !id_cours_suivant) {
        return response.status(400).json({
          message: "id_cours_prerequis et id_cours_suivant requis.",
        });
      }

      const [result] = await pool.query(
        `INSERT INTO prerequis_cours (id_cours_prerequis, id_cours_suivant, est_bloquant)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE est_bloquant = VALUES(est_bloquant)`,
        [Number(id_cours_prerequis), Number(id_cours_suivant), est_bloquant ? 1 : 0]
      );
      return response.status(201).json({
        message: "Prerequis ajoute.",
        id: result.insertId,
      });
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.delete("/api/scheduler/prerequis/:id", userAuth, userAdmin, async (request, response) => {
    try {
      await pool.query(`DELETE FROM prerequis_cours WHERE id = ?`, [Number(request.params.id)]);
      return response.json({ message: "Prerequis supprime." });
    } catch (error) {
      return response.status(500).json({ message: "Erreur serveur." });
    }
  });
}
