/**
 * ROUTES - Module Groupes (v2 — Production-ready)
 *
 * Règles d'ordre EXPRESS (CRITIQUE) :
 *   Routes statiques avant les routes paramétrées !
 *   /api/groupes/nettoyer        avant /api/groupes/:id
 *   /api/groupes/generer-cible   avant /api/groupes/:id
 *   /api/groupes/:id/etudiants/creer-ajouter  avant /:id/etudiants/:idEtudiant
 *
 * Colonnes obligatoires table etudiants (NOT NULL) :
 *   matricule, nom, prenom, programme, etape (INT), session (VARCHAR), annee (INT)
 */

import {
  recupererGroupes,
  recupererGroupeParId,
  recupererPlanningCompletGroupe,
} from "../src/model/groupes.model.js";
import pool from "../db.js";
import { userAuth, userAdminOrResponsable } from "../middlewares/auth.js";
import { assurerSchemaSchedulerAcademique } from "../src/services/academic-scheduler-schema.js";
import { analyserCompatibiliteChangementGroupePrincipalEtudiant } from "../src/services/etudiants/student-course-exchange.service.js";

const CAPACITE_MAX_GROUPE = 30;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Récupère la session active depuis la BD */
async function obtenirSessionActive(executor = pool) {
  const [[session]] = await executor.query(
    `SELECT id_session, nom, date_debut
     FROM sessions
     WHERE active = TRUE
     ORDER BY id_session DESC
     LIMIT 1`
  );
  return session || null;
}

/** Extrait la saison courte depuis le nom d'une session */
function extraireSaison(nomSession, dateDebut) {
  const val = String(nomSession || "").toLowerCase();
  if (val.includes("automne")) return "Automne";
  if (val.includes("hiver")) return "Hiver";
  if (val.includes("printemps")) return "Printemps";
  if (val.includes("ete") || val.includes("été")) return "Ete";
  const d = dateDebut ? new Date(dateDebut) : null;
  if (!d || isNaN(d.getTime())) return "Automne";
  const m = d.getUTCMonth() + 1;
  if (m >= 8 && m <= 12) return "Automne";
  if (m >= 1 && m <= 4) return "Hiver";
  if (m >= 5 && m <= 6) return "Printemps";
  return "Ete";
}

/**
 * Lit le mode d'optimisation transmis par un client HTTP.
 *
 * Les flux de generation groupe/cohorte doivent exposer scoring_v1 comme la
 * generation globale. Le moteur conserve la normalisation finale, mais la
 * route accepte les aliases historiques pour rester retrocompatible.
 *
 * @param {Object} [source={}] - body HTTP.
 * @returns {string} Mode demande ou fallback legacy.
 */
function lireModeOptimisation(source = {}) {
  return source.optimization_mode || source.mode_optimisation || "legacy";
}

function formaterHeureCourte(heure) {
  const valeur = String(heure || "").trim();
  return valeur ? valeur.slice(0, 5) : null;
}

function construireMessageRefusChangementGroupe(diagnostic) {
  const conflit = Array.isArray(diagnostic?.conflits) ? diagnostic.conflits[0] : null;
  const nomGroupe = diagnostic?.groupe_cible?.nom_groupe || "demande";

  if (!conflit) {
    return `Changement de groupe refuse : conflit avec cours echoue planifie dans le groupe "${nomGroupe}".`;
  }

  const libelleCoursEchoue = [
    conflit.code_cours_echoue || conflit.code_cours_conflit,
    conflit.nom_cours_echoue || conflit.nom_cours_conflit,
  ]
    .filter(Boolean)
    .join(" - ");
  const libelleCoursGroupe = [
    conflit.code_cours_groupe || conflit.code_cours_cible,
    conflit.nom_cours_groupe || conflit.nom_cours_cible,
  ]
    .filter(Boolean)
    .join(" - ");
  const dateConflit = conflit.date ? `le ${conflit.date}` : null;
  const plageConflit =
    conflit.heure_debut_conflit || conflit.heure_fin_conflit
      ? `de ${formaterHeureCourte(conflit.heure_debut_conflit || conflit.heure_debut)} a ${formaterHeureCourte(conflit.heure_fin_conflit || conflit.heure_fin)}`
      : null;

  return [
    "Changement de groupe refuse : conflit avec cours echoue planifie",
    libelleCoursEchoue || null,
    [dateConflit, plageConflit].filter(Boolean).join(" ") || null,
    libelleCoursGroupe ? `avec ${libelleCoursGroupe}` : null,
    `dans le groupe "${nomGroupe}".`,
  ]
    .filter(Boolean)
    .join(" ");
}

// ─── Routes ─────────────────────────────────────────────────────────────────
export default function groupesRoutes(app) {

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/groupes  —  Liste des groupes avec détails
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/groupes", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const details = req.query.details === "1";
      const groupes = await recupererGroupes(details, {
        sessionActive: req.query.session_active === "1",
        seulementAvecEffectif: req.query.effectif_min === "1",
        seulementAvecPlanning: req.query.planning_only === "1",
        inclureGroupesSpeciaux: req.query.special_groups === "1",
      });
      // Ajouter le champ a_horaire s'il manque (pour le modèle simplifié)
      const enrichis = details
        ? groupes.map((g) => ({
            ...g,
            a_horaire: (g.nb_seances || 0) > 0,
          }))
        : groupes;
      return res.json(enrichis);
    } catch (err) {
      console.error("[groupes] GET /api/groupes:", err);
      return res.status(500).json({ message: "Erreur lors de la recuperation des groupes." });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ROUTES STATIQUES AVANT LES PARAMÉTRÉES (règle critique Express)
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/groupes/manuel  —  Créer un groupe manuellement
  app.post("/api/groupes/manuel", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      await assurerSchemaSchedulerAcademique();
      const {
        nom_groupe,
        programme,
        etape,
        taille_max = CAPACITE_MAX_GROUPE,
        id_session,
        est_groupe_special = false,
      } = req.body;

      if (!nom_groupe?.trim()) return res.status(400).json({ message: "Le nom du groupe est requis." });
      if (!programme?.trim()) return res.status(400).json({ message: "Le programme est requis." });

      const tailleFinale = Math.min(Number(taille_max) || CAPACITE_MAX_GROUPE, CAPACITE_MAX_GROUPE);

      let sessionCible = id_session ? Number(id_session) : null;
      if (!sessionCible) {
        const session = await obtenirSessionActive();
        sessionCible = session?.id_session || null;
      }

      // Vérifier doublon sur (nom + session)
      const [doublons] = await pool.query(
        `SELECT id_groupes_etudiants FROM groupes_etudiants
         WHERE nom_groupe = ? AND (id_session = ? OR (id_session IS NULL AND ? IS NULL))`,
        [nom_groupe.trim(), sessionCible, sessionCible]
      );
      if (doublons.length > 0) {
        return res.status(409).json({
          message: `Un groupe nommé "${nom_groupe}" existe déjà pour cette session.`,
        });
      }

      const [result] = await pool.query(
        `INSERT INTO groupes_etudiants (nom_groupe, taille_max, est_groupe_special, programme, etape, id_session)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nom_groupe.trim(), tailleFinale, est_groupe_special ? 1 : 0, programme.trim(), etape ?? null, sessionCible]
      );
      return res.status(201).json({ message: "Groupe créé avec succès.", id_groupes_etudiants: result.insertId });
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Un groupe avec ce nom existe déjà pour cette session." });
      }
      console.error("[groupes] POST /manuel:", err);
      return res.status(500).json({ message: "Erreur serveur lors de la création du groupe." });
    }
  });

  // POST /api/groupes/nettoyer  —  Nettoyage des groupes vides
  // DOIT être déclaré avant /api/groupes/:id
  app.post("/api/groupes/nettoyer", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const { mode = "preview", inclure_vides = true } = req.body;

      if (!inclure_vides) {
        return res.status(400).json({ message: "Aucun critère de nettoyage sélectionné." });
      }

      const [candidats] = await pool.query(
        `SELECT ge.id_groupes_etudiants, ge.nom_groupe, ge.programme, ge.etape,
                (SELECT COUNT(*) FROM etudiants e WHERE e.id_groupes_etudiants = ge.id_groupes_etudiants) AS effectif,
                (SELECT COUNT(*) FROM affectation_groupes ag WHERE ag.id_groupes_etudiants = ge.id_groupes_etudiants) AS nb_affectations
         FROM groupes_etudiants ge
         WHERE (SELECT COUNT(*) FROM etudiants e WHERE e.id_groupes_etudiants = ge.id_groupes_etudiants) = 0
         ORDER BY ge.nom_groupe ASC`
      );

      if (mode === "preview") {
        return res.json({ message: `${candidats.length} groupe(s) sont candidats au nettoyage.`, candidats, mode: "preview" });
      }

      let nbSupprimes = 0;
      const erreurs = [];
      for (const g of candidats) {
        if (g.nb_affectations > 0) {
          erreurs.push({ nom_groupe: g.nom_groupe, raison: `Possède ${g.nb_affectations} affectations horaires — protégé.` });
          continue;
        }
        try {
          await pool.query(`DELETE FROM groupes_etudiants WHERE id_groupes_etudiants = ?`, [g.id_groupes_etudiants]);
          nbSupprimes++;
        } catch (e) {
          erreurs.push({ nom_groupe: g.nom_groupe, raison: e.message });
        }
      }
      return res.json({ message: `${nbSupprimes} groupe(s) supprimé(s).`, nb_supprimes: nbSupprimes, erreurs, mode: "suppression" });
    } catch (err) {
      console.error("[groupes] POST /nettoyer:", err);
      return res.status(500).json({ message: "Erreur serveur lors du nettoyage." });
    }
  });

  // POST /api/groupes/generer-cible  —  Génération par programme/étape
  // DOIT être déclaré avant /api/groupes/:id
  app.post("/api/groupes/generer-cible", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const { programme, etape } = req.body;
      const modeOptimisation = lireModeOptimisation(req.body || {});
      if (!programme && etape == null) {
        return res.status(400).json({ message: "Au moins un critère est requis : programme ou étape." });
      }

      const conditions = [];
      const valeurs = [];
      if (programme) { conditions.push(`COALESCE(MAX(e.programme), ge.programme) = ?`); valeurs.push(programme); }
      if (etape != null) { conditions.push(`COALESCE(MAX(e.etape), ge.etape) = ?`); valeurs.push(String(etape)); }

      const [groupesCibles] = await pool.query(
        `SELECT ge.id_groupes_etudiants, ge.nom_groupe,
                COALESCE(MAX(e.programme), ge.programme) AS programme,
                COALESCE(MAX(e.etape), ge.etape) AS etape,
                COUNT(e.id_etudiant) AS effectif
         FROM groupes_etudiants ge
         LEFT JOIN etudiants e ON e.id_groupes_etudiants = ge.id_groupes_etudiants
         WHERE COALESCE(ge.est_groupe_special, 0) = 0
         GROUP BY ge.id_groupes_etudiants
         ${conditions.length > 0 ? "HAVING " + conditions.join(" AND ") : ""}
         ORDER BY ge.nom_groupe ASC`,
        valeurs
      );

      if (groupesCibles.length === 0) {
        return res.status(404).json({ message: `Aucun groupe trouvé pour les critères spécifiés.` });
      }

      const { SchedulerEngine } = await import("../src/services/scheduler/SchedulerEngine.js");
      const user = req.user || req.session?.user || null;
      const resultats = [];
      const erreurs = [];

      for (const g of groupesCibles) {
        if (!g.effectif || g.effectif === 0) {
          erreurs.push({ nom_groupe: g.nom_groupe, raison: "Groupe vide, ignoré." });
          continue;
        }
        try {
          const rapport = await SchedulerEngine.genererGroupe({
            idGroupe: g.id_groupes_etudiants,
            idUtilisateur: user?.id || null,
            optimizationMode: modeOptimisation,
          });
          resultats.push({
            nom_groupe: g.nom_groupe,
            nb_cours_planifies: rapport.nb_cours_planifies,
            nb_cours_non_planifies: rapport.nb_cours_non_planifies,
            score_qualite: rapport.score_qualite,
            mode_optimisation_utilise:
              rapport?.details?.modeOptimisationUtilise || modeOptimisation,
          });
        } catch (e) {
          erreurs.push({ nom_groupe: g.nom_groupe, raison: e.message });
        }
      }

      const totalPlanifies = resultats.reduce((s, r) => s + r.nb_cours_planifies, 0);
      return res.status(201).json({
        message: `Génération ciblée terminée : ${resultats.length} groupe(s) traité(s), ${totalPlanifies} séances planifiées.`,
        mode_optimisation_utilise: modeOptimisation,
        nb_groupes_traites: resultats.length, nb_groupes_erreur: erreurs.length,
        total_planifies: totalPlanifies, resultats, erreurs,
      });
    } catch (err) {
      console.error("[groupes] POST /generer-cible:", err);
      return res.status(500).json({ message: err.message || "Erreur serveur lors de la génération ciblée." });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/groupes/:id  —  Détail complet d'un groupe
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/groupes/:id", userAuth, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      const modeOptimisation = lireModeOptimisation(req.body || {});
      if (!Number.isInteger(idGroupe) || idGroupe <= 0) return res.status(400).json({ message: "Identifiant invalide." });

      const groupe = await recupererGroupeParId(idGroupe);
      if (!groupe) return res.status(404).json({ message: "Groupe introuvable." });

      const [[{ effectif }]] = await pool.query(
        `SELECT COUNT(*) AS effectif FROM etudiants WHERE id_groupes_etudiants = ?`, [idGroupe]
      );
      const [[{ nb_seances }]] = await pool.query(
        `SELECT COUNT(*) AS nb_seances FROM affectation_groupes ag WHERE ag.id_groupes_etudiants = ?`, [idGroupe]
      );

      return res.json({
        ...groupe,
        effectif_actuel: Number(effectif),
        taille_max: CAPACITE_MAX_GROUPE,
        a_horaire: Number(nb_seances) > 0,
        nb_seances_planifiees: Number(nb_seances),
        est_complet: Number(effectif) >= CAPACITE_MAX_GROUPE,
      });
    } catch (err) {
      console.error("[groupes] GET /:id:", err);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/groupes/:id/planning  —  Horaire du groupe
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/groupes/:id/planning", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      const modeOptimisation = lireModeOptimisation(req.body || {});
      if (!Number.isInteger(idGroupe) || idGroupe <= 0) return res.status(400).json({ message: "Identifiant invalide." });
      const resultat = await recupererPlanningCompletGroupe(idGroupe);
      if (!resultat) return res.status(404).json({ message: "Groupe introuvable." });
      return res.json(resultat);
    } catch (err) {
      return res.status(500).json({ message: "Erreur lors de la récupération du planning." });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/groupes/:id/etudiants  —  Membres d'un groupe
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/groupes/:id/etudiants", userAuth, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      const modeOptimisation = lireModeOptimisation(req.body || {});
      if (!Number.isInteger(idGroupe) || idGroupe <= 0) return res.status(400).json({ message: "Identifiant invalide." });

      const [etudiants] = await pool.query(
        `SELECT e.id_etudiant,
                e.matricule,
                e.nom,
                e.prenom,
                e.email,
                e.programme,
                e.etape,
                e.session,
                e.annee,
                e.id_groupes_etudiants,
                COALESCE(
                  (SELECT COUNT(*) FROM cours_echoues ce
                   WHERE ce.id_etudiant = e.id_etudiant AND ce.statut = 'a_reprendre'),
                  0
                ) AS nb_cours_echoues
         FROM etudiants e
         WHERE e.id_groupes_etudiants = ?
         ORDER BY e.nom ASC, e.prenom ASC`,
        [idGroupe]
      );
      return res.json(etudiants);
    } catch (err) {
      console.error("[groupes] GET /:id/etudiants:", err);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/groupes/:id/etudiants  —  Ajouter un étudiant existant
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/groupes/:id/etudiants", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      const { etudiantsIds } = req.body;

      if (!Array.isArray(etudiantsIds) || etudiantsIds.length === 0) {
        return res.status(400).json({ message: "Veuillez fournir une liste d'ID d'étudiants." });
      }

      const [[{ effectif }]] = await pool.query(
        `SELECT COUNT(*) AS effectif FROM etudiants WHERE id_groupes_etudiants = ?`, [idGroupe]
      );
      if (Number(effectif) + etudiantsIds.length > CAPACITE_MAX_GROUPE) {
        return res.status(422).json({
          message: `Capacité maximale dépassée. Le groupe contient déjà ${effectif} étudiants (max: ${CAPACITE_MAX_GROUPE}).`,
          effectif_actuel: Number(effectif),
          places_disponibles: Math.max(0, CAPACITE_MAX_GROUPE - Number(effectif)),
        });
      }

      await pool.query(
        `UPDATE etudiants SET id_groupes_etudiants = ? WHERE id_etudiant IN (?)`,
        [idGroupe, etudiantsIds]
      );
      return res.json({ message: "Étudiants assignés avec succès.", nb_ajoutes: etudiantsIds.length });
    } catch (err) {
      console.error("[groupes] POST /:id/etudiants:", err);
      return res.status(500).json({ message: "Erreur serveur lors de l'assignation." });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/groupes/:id/etudiants/creer-ajouter
  // Créer un nouvel étudiant + l'ajouter au groupe + enregistrer cours échoués
  // DOIT être déclaré AVANT /:id/etudiants/:idEtudiant
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/groupes/:id/etudiants/creer-ajouter", userAuth, userAdminOrResponsable, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const idGroupe = Number(req.params.id);

      // Récupérer le groupe cible avec son effectif
      const [[groupe]] = await conn.query(
        `SELECT ge.id_groupes_etudiants, ge.nom_groupe, ge.programme, ge.etape, ge.id_session,
                COALESCE(ge.taille_max, ?) AS taille_max,
                COUNT(e.id_etudiant) AS effectif
         FROM groupes_etudiants ge
         LEFT JOIN etudiants e ON e.id_groupes_etudiants = ge.id_groupes_etudiants
         WHERE ge.id_groupes_etudiants = ?
         GROUP BY ge.id_groupes_etudiants`,
        [CAPACITE_MAX_GROUPE, idGroupe]
      );

      if (!groupe) {
        await conn.rollback();
        return res.status(404).json({ message: "Groupe introuvable." });
      }

      if (Number(groupe.effectif) >= CAPACITE_MAX_GROUPE) {
        await conn.rollback();
        return res.status(422).json({ message: `Ce groupe est complet (${groupe.effectif}/${CAPACITE_MAX_GROUPE}).` });
      }

      // ── Extraction des données de l'étudiant ──
      const {
        nom,
        prenom,
        matricule,
        email,
        programme,
        etape,
        cours_echoues = [],   // [{code, note_echec?}] ou [{id_cours, note_echec?}]
      } = req.body;

      if (!nom?.trim()) { await conn.rollback(); return res.status(400).json({ message: "Le nom est requis." }); }
      if (!prenom?.trim()) { await conn.rollback(); return res.status(400).json({ message: "Le prénom est requis." }); }
      if (!matricule?.trim()) { await conn.rollback(); return res.status(400).json({ message: "Le matricule est requis." }); }

      // Programme et étape : ceux du groupe si non spécifiés
      const programmeEtudiant = (programme?.trim()) || groupe.programme || "";
      const etapeEtudiant = etape != null ? Number(etape) : (Number(groupe.etape) || 1);

      if (!programmeEtudiant) {
        await conn.rollback();
        return res.status(400).json({ message: "Le programme est requis (non défini dans le groupe non plus)." });
      }

      // Valider cohérence programme/étape avec le groupe
      if (groupe.programme && programmeEtudiant &&
          groupe.programme.trim().toUpperCase() !== programmeEtudiant.trim().toUpperCase()) {
        await conn.rollback();
        return res.status(422).json({
          message: `Le programme de l'étudiant ("${programmeEtudiant}") est incompatible avec le groupe ("${groupe.programme}").`,
        });
      }

      // ── Session & Année depuis la session active (colonnes obligatoires !) ──
      const sessionActive = await obtenirSessionActive(conn);
      const saisonSession = sessionActive
        ? extraireSaison(sessionActive.nom, sessionActive.date_debut)
        : "Automne";
      const anneeSession = sessionActive
        ? new Date(sessionActive.date_debut).getUTCFullYear()
        : new Date().getFullYear();

      // ── Vérifier doublon matricule ──
      const [[doublon]] = await conn.query(
        `SELECT id_etudiant, id_groupes_etudiants FROM etudiants WHERE matricule = ? LIMIT 1`,
        [matricule.trim()]
      );

      if (doublon) {
        // L'étudiant existe déjà
        if (doublon.id_groupes_etudiants === idGroupe) {
          await conn.rollback();
          return res.status(409).json({
            message: `Un étudiant avec le matricule "${matricule}" est déjà dans ce groupe.`,
            existant: true,
            id_etudiant: doublon.id_etudiant,
          });
        }
        // Il est dans un autre groupe → proposer de le déplacer
        await conn.rollback();
        return res.status(409).json({
          message: `Un étudiant avec le matricule "${matricule}" existe déjà (dans un autre groupe). Utilisez la fonction "Déplacer" pour le changer de groupe.`,
          existant: true,
          id_etudiant: doublon.id_etudiant,
          id_groupe_actuel: doublon.id_groupes_etudiants,
        });
      }

      // ── Vérifier doublon email si fourni ──
      if (email?.trim()) {
        const [[doublonEmail]] = await conn.query(
          `SELECT id_etudiant FROM etudiants WHERE email = ? LIMIT 1`,
          [email.trim()]
        );
        if (doublonEmail) {
          await conn.rollback();
          return res.status(409).json({
            message: `Un étudiant avec l'email "${email}" existe déjà.`,
            existant: true,
            id_etudiant: doublonEmail.id_etudiant,
          });
        }
      }

      // ── Insérer le nouvel étudiant ──
      const [result] = await conn.query(
        `INSERT INTO etudiants (matricule, nom, prenom, email, programme, etape, session, annee, id_groupes_etudiants)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          matricule.trim(),
          nom.trim(),
          prenom.trim(),
          email?.trim() || null,
          programmeEtudiant,
          etapeEtudiant,
          saisonSession,
          anneeSession,
          idGroupe,
        ]
      );

      const idEtudiant = result.insertId;

      // ── Enregistrer les cours échoués s'ils sont fournis ──
      const codesEchouesInseres = [];
      const erreursCoursEchoues = [];

      if (Array.isArray(cours_echoues) && cours_echoues.length > 0) {
        // Récupérer l'id_session de la session active pour référencer dans cours_echoues
        const idSession = sessionActive?.id_session || null;

        for (const ce of cours_echoues) {
          try {
            // L'entrée peut contenir : {code, note_echec} ou {id_cours, note_echec}
            let idCours = null;
            let codeCours = null;

            if (ce.id_cours && Number.isInteger(Number(ce.id_cours))) {
              idCours = Number(ce.id_cours);
            } else if (ce.code) {
              const [[coursRow]] = await conn.query(
                `SELECT id_cours FROM cours WHERE code = ? LIMIT 1`,
                [String(ce.code).trim()]
              );
              if (coursRow) {
                idCours = coursRow.id_cours;
                codeCours = ce.code;
              }
            }

            if (!idCours) {
              erreursCoursEchoues.push({ code: ce.code || ce.id_cours, raison: "Cours introuvable dans le catalogue." });
              continue;
            }

            const noteEchec = ce.note_echec != null ? Number(ce.note_echec) : null;

            await conn.query(
              `INSERT INTO cours_echoues (id_etudiant, id_cours, id_session, statut, note_echec)
               VALUES (?, ?, ?, 'a_reprendre', ?)
               ON DUPLICATE KEY UPDATE statut = 'a_reprendre', note_echec = VALUES(note_echec)`,
              [idEtudiant, idCours, idSession, noteEchec]
            );
            codesEchouesInseres.push(codeCours || idCours);
          } catch (ceErr) {
            erreursCoursEchoues.push({ code: ce.code || ce.id_cours, raison: ceErr.message });
          }
        }
      }

      await conn.commit();

      return res.status(201).json({
        message: `${prenom.trim()} ${nom.trim()} ajouté au groupe avec succès.`,
        id_etudiant: idEtudiant,
        matricule: matricule.trim(),
        groupe: groupe.nom_groupe,
        cours_echoues_inseres: codesEchouesInseres,
        erreurs_cours_echoues: erreursCoursEchoues,
        existant: false,
      });
    } catch (err) {
      await conn.rollback();
      if (err?.code === "ER_DUP_ENTRY") {
        const field = err.message?.includes("email") ? "email" : "matricule";
        return res.status(409).json({ message: `Un étudiant avec ce ${field} existe déjà.` });
      }
      console.error("[groupes] POST /:id/etudiants/creer-ajouter:", err);
      return res.status(500).json({ message: "Erreur serveur : " + err.message });
    } finally {
      conn.release();
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PUT /api/groupes/:id/etudiants/:idEtudiant/deplacer
  // Déplacer un étudiant vers un autre groupe (validations métier strictes)
  // ══════════════════════════════════════════════════════════════════════════
  app.put("/api/groupes/:id/etudiants/:idEtudiant/deplacer", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const idGroupeSource = Number(req.params.id);
      const idEtudiant = Number(req.params.idEtudiant);
      const { id_groupe_cible } = req.body;

      if (!id_groupe_cible) return res.status(400).json({ message: "Le groupe cible est requis." });
      const idGroupeCible = Number(id_groupe_cible);

      if (idGroupeSource === idGroupeCible) return res.status(400).json({ message: "L'étudiant est déjà dans ce groupe." });

      // Charger source & cible
      const [[gs]] = await pool.query(
        `SELECT ge.id_groupes_etudiants,
                COALESCE(MAX(e.programme), ge.programme) AS programme,
                COALESCE(MAX(e.etape), ge.etape) AS etape
         FROM groupes_etudiants ge
         LEFT JOIN etudiants e ON e.id_groupes_etudiants = ge.id_groupes_etudiants
         WHERE ge.id_groupes_etudiants = ?
         GROUP BY ge.id_groupes_etudiants`,
        [idGroupeSource]
      );
      const [[gc]] = await pool.query(
        `SELECT ge.id_groupes_etudiants, ge.nom_groupe,
                ge.id_session,
                COALESCE(MAX(e.programme), ge.programme) AS programme,
                COALESCE(MAX(e.etape), ge.etape) AS etape,
                COUNT(e.id_etudiant) AS effectif
         FROM groupes_etudiants ge
         LEFT JOIN etudiants e ON e.id_groupes_etudiants = ge.id_groupes_etudiants
         WHERE ge.id_groupes_etudiants = ?
         GROUP BY ge.id_groupes_etudiants`,
        [idGroupeCible]
      );

      if (!gs) return res.status(404).json({ message: "Groupe source introuvable." });
      if (!gc) return res.status(404).json({ message: "Groupe cible introuvable." });

      const normaliser = (s) => String(s || "").trim().toUpperCase();
      if (gs.programme && gc.programme && normaliser(gs.programme) !== normaliser(gc.programme)) {
        return res.status(422).json({ message: `Déplacement interdit : programmes différents ("${gs.programme}" ≠ "${gc.programme}").` });
      }
      if (gs.etape != null && gc.etape != null && String(gs.etape) !== String(gc.etape)) {
        return res.status(422).json({ message: `Déplacement interdit : étapes différentes (${gs.etape} ≠ ${gc.etape}).` });
      }
      if (Number(gc.effectif) >= CAPACITE_MAX_GROUPE) {
        return res.status(422).json({ message: `Le groupe "${gc.nom_groupe}" est complet (${gc.effectif}/${CAPACITE_MAX_GROUPE}).` });
      }

      // Vérifier que l'étudiant appartient bien au groupe source
      const [[etudiant]] = await pool.query(
        `SELECT id_etudiant, nom, prenom FROM etudiants WHERE id_etudiant = ? AND id_groupes_etudiants = ?`,
        [idEtudiant, idGroupeSource]
      );
      if (!etudiant) return res.status(404).json({ message: "Étudiant introuvable dans le groupe source." });

      const diagnosticChangement = await analyserCompatibiliteChangementGroupePrincipalEtudiant(
        {
          idEtudiant,
          idGroupeCible,
          idSession: Number(gc.id_session) || null,
          nomGroupeCible: gc.nom_groupe,
        },
        pool
      );

      if (!diagnosticChangement.changement_autorise) {
        console.warn("[groupes] deplacement refuse pour conflit avec reprise planifiee", {
          id_etudiant: idEtudiant,
          id_groupe_source: idGroupeSource,
          id_groupe_cible: idGroupeCible,
          nb_conflits: diagnosticChangement.conflits.length,
        });

        return res.status(409).json({
          message: construireMessageRefusChangementGroupe(diagnosticChangement),
          code: "GROUP_CHANGE_FAILED_COURSE_CONFLICT",
          details: diagnosticChangement.conflits,
        });
      }

      await pool.query(`UPDATE etudiants SET id_groupes_etudiants = ? WHERE id_etudiant = ?`, [idGroupeCible, idEtudiant]);

      return res.json({
        message: `${etudiant.prenom} ${etudiant.nom} déplacé vers "${gc.nom_groupe}".`,
        id_etudiant: idEtudiant,
        id_groupe_source: idGroupeSource,
        id_groupe_cible: idGroupeCible,
        nom_groupe_cible: gc.nom_groupe,
        etudiants_impactes: [idEtudiant],
        groupes_impactes: [idGroupeSource, idGroupeCible],
        synchronisation: {
          type: "deplacement_etudiant_groupe",
          etudiants_impactes: [idEtudiant],
          groupes_impactes: [idGroupeSource, idGroupeCible],
        },
      });
    } catch (err) {
      console.error("[groupes] PUT /:id/etudiants/:idEtudiant/deplacer:", err);
      return res.status(err.statusCode || 500).json({
        message: err.message || "Erreur serveur lors du deplacement.",
        ...(err.code ? { code: err.code } : {}),
        ...(err.details?.length ? { details: err.details } : {}),
      });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE /api/groupes/:id/etudiants/:idEtudiant  —  Retirer un étudiant
  // ══════════════════════════════════════════════════════════════════════════
  app.delete("/api/groupes/:id/etudiants/:idEtudiant", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      const idEtudiant = Number(req.params.idEtudiant);
      await pool.query(
        `UPDATE etudiants SET id_groupes_etudiants = NULL WHERE id_etudiant = ? AND id_groupes_etudiants = ?`,
        [idEtudiant, idGroupe]
      );
      return res.json({ message: "Étudiant retiré du groupe." });
    } catch (err) {
      return res.status(500).json({ message: "Erreur serveur lors du retrait." });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE /api/groupes/:id  —  Supprimer un groupe
  // ══════════════════════════════════════════════════════════════════════════
  app.delete("/api/groupes/:id", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      await pool.query(`UPDATE etudiants SET id_groupes_etudiants = NULL WHERE id_groupes_etudiants = ?`, [idGroupe]);
      await pool.query(`DELETE FROM affectation_groupes WHERE id_groupes_etudiants = ?`, [idGroupe]);
      await pool.query(`DELETE FROM groupes_etudiants WHERE id_groupes_etudiants = ?`, [idGroupe]);
      return res.json({ message: "Groupe supprimé avec succès." });
    } catch (err) {
      console.error("[groupes] DELETE /:id:", err);
      return res.status(500).json({ message: "Erreur serveur lors de la suppression." });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/groupes/:id/generer-horaire  —  Génération ciblée pour 1 groupe
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/groupes/:id/generer-horaire", userAuth, userAdminOrResponsable, async (req, res) => {
    try {
      const idGroupe = Number(req.params.id);
      const modeOptimisation = lireModeOptimisation(req.body || {});
      if (!Number.isInteger(idGroupe) || idGroupe <= 0) return res.status(400).json({ message: "Identifiant invalide." });

      const [[groupe]] = await pool.query(
        `SELECT ge.id_groupes_etudiants, ge.nom_groupe, ge.programme, ge.etape,
                COUNT(e.id_etudiant) AS effectif
         FROM groupes_etudiants ge
         LEFT JOIN etudiants e ON e.id_groupes_etudiants = ge.id_groupes_etudiants
         WHERE ge.id_groupes_etudiants = ?
         GROUP BY ge.id_groupes_etudiants`,
        [idGroupe]
      );
      if (!groupe) return res.status(404).json({ message: "Groupe introuvable." });

      const { SchedulerEngine } = await import("../src/services/scheduler/SchedulerEngine.js");
      const user = req.user || req.session?.user || null;
      const rapport = await SchedulerEngine.genererGroupe({
        idGroupe,
        idUtilisateur: user?.id || null,
        optimizationMode: modeOptimisation,
      });

      return res.status(201).json({
        message: `Horaire généré pour "${groupe.nom_groupe}" : ${rapport.nb_cours_planifies} séances planifiées.`,
        message:
          `Horaire genere pour "${groupe.nom_groupe}" : ${rapport.nb_cours_planifies} seance(s) planifiee(s). ` +
          `Mode ${rapport?.details?.modeOptimisationUtilise || modeOptimisation}.`,
        mode_optimisation_utilise:
          rapport?.details?.modeOptimisationUtilise || modeOptimisation,
        rapport,
        groupe: groupe.nom_groupe,
      });
    } catch (err) {
      console.error("[groupes] POST /:id/generer-horaire:", err);
      return res.status(err.statusCode || 500).json({ message: err.message || "Erreur serveur." });
    }
  });
}
