/**
 * ROUTES — Administration des utilisateurs
 *
 * Accessible uniquement par ADMIN_RESPONSABLE pour gérer les admins.
 *
 * GET    /api/admin/utilisateurs       — Lister tous les utlisateurs
 * POST   /api/admin/utilisateurs       — Créer un admin
 * PUT    /api/admin/utilisateurs/:id   — Modifier un utilisateur
 * DELETE /api/admin/utilisateurs/:id   — Désactiver un utilisateur
 * GET    /api/admin/statistiques       — Stats globales
 */

import { userAuth } from "../middlewares/auth.js";
import pool from "../db.js";
import { hashPassword } from "../src/utils/passwords.js";

function getUser(req) {
  return req.user || req.session?.user || null;
}

function userResponsable(req, res, next) {
  const user = getUser(req);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  if (roles.includes("ADMIN_RESPONSABLE")) return next();
  return res.status(403).json({ message: "Accès réservé à l'Admin Responsable." });
}

export default function adminRoutes(app) {

  // ── GET /api/admin/utilisateurs ─────────────────────────────────────────
  app.get("/api/admin/utilisateurs", userAuth, userResponsable, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT u.id_utilisateur, u.nom, u.prenom, u.email, u.role,
                u.actif, u.created_at,
                c.nom AS cree_par_nom, c.prenom AS cree_par_prenom
         FROM utilisateurs u
         LEFT JOIN utilisateurs c ON c.id_utilisateur = u.created_by
         ORDER BY u.role DESC, u.nom ASC`
      );
      return res.json(rows);
    } catch (error) {
      console.error("Erreur liste utilisateurs:", error);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── POST /api/admin/utilisateurs ────────────────────────────────────────
  app.post("/api/admin/utilisateurs", userAuth, userResponsable, async (req, res) => {
    try {
      const creator = getUser(req);
      const { nom, prenom, email, motdepasse, role = "ADMIN" } = req.body ?? {};

      if (!nom || !prenom || !email || !motdepasse) {
        return res.status(400).json({ message: "Tous les champs sont requis (nom, prenom, email, motdepasse)." });
      }

      const rolesValides = ["ADMIN", "ADMIN_RESPONSABLE"];
      if (!rolesValides.includes(role)) {
        return res.status(400).json({ message: `Rôle invalide. Valeurs acceptées : ${rolesValides.join(", ")}` });
      }

      // Vérifier email unique
      const [existing] = await pool.query(
        `SELECT id_utilisateur FROM utilisateurs WHERE email = ?`,
        [email.toLowerCase().trim()]
      );
      if (existing.length > 0) {
        return res.status(409).json({ message: "Cet email est déjà utilisé." });
      }

      const passwordHash = await hashPassword(motdepasse);

      const [result] = await pool.query(
        `INSERT INTO utilisateurs (nom, prenom, email, motdepasse, role, actif, created_by)
         VALUES (?, ?, ?, ?, ?, TRUE, ?)`,
        [nom.trim(), prenom.trim(), email.toLowerCase().trim(), passwordHash, role, creator?.id || null]
      );

      return res.status(201).json({
        message: `Utilisateur ${role} créé avec succès.`,
        id_utilisateur: result.insertId,
        nom,
        prenom,
        email,
        role,
      });
    } catch (error) {
      console.error("Erreur création utilisateur:", error);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── PUT /api/admin/utilisateurs/:id ─────────────────────────────────────
  app.put("/api/admin/utilisateurs/:id", userAuth, userResponsable, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { nom, prenom, email, role, actif, motdepasse } = req.body ?? {};

      const champs = [];
      const valeurs = [];

      if (nom !== undefined) { champs.push("nom = ?"); valeurs.push(nom); }
      if (prenom !== undefined) { champs.push("prenom = ?"); valeurs.push(prenom); }
      if (email !== undefined) { champs.push("email = ?"); valeurs.push(email.toLowerCase().trim()); }
      if (role !== undefined) {
        const rolesValides = ["ADMIN", "ADMIN_RESPONSABLE"];
        if (!rolesValides.includes(role)) return res.status(400).json({ message: "Rôle invalide." });
        champs.push("role = ?");
        valeurs.push(role);
      }
      if (actif !== undefined) { champs.push("actif = ?"); valeurs.push(actif ? 1 : 0); }
      if (motdepasse !== undefined && motdepasse.trim() !== "") {
        const passwordHash = await hashPassword(motdepasse.trim());
        champs.push("motdepasse = ?");
        valeurs.push(passwordHash);
      }

      if (champs.length === 0) return res.status(400).json({ message: "Aucun champ à modifier." });

      valeurs.push(id);
      await pool.query(`UPDATE utilisateurs SET ${champs.join(", ")} WHERE id_utilisateur = ?`, valeurs);

      return res.json({ message: "Utilisateur mis à jour." });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── DELETE /api/admin/utilisateurs/:id ──────────────────────────────────
  app.delete("/api/admin/utilisateurs/:id", userAuth, userResponsable, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const creator = getUser(req);

      if (creator?.id === id) {
        return res.status(400).json({ message: "Vous ne pouvez pas vous supprimer vous-même." });
      }

      // On désactive plutôt que supprimer (traçabilité)
      await pool.query(`UPDATE utilisateurs SET actif = FALSE WHERE id_utilisateur = ?`, [id]);
      return res.json({ message: "Utilisateur désactivé." });
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── GET /api/admin/statistiques ─────────────────────────────────────────
  app.get("/api/admin/statistiques", userAuth, userResponsable, async (req, res) => {
    try {
      const [[statsUsers]] = await pool.query(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END) AS admins,
           SUM(CASE WHEN role = 'ADMIN_RESPONSABLE' THEN 1 ELSE 0 END) AS responsables,
           SUM(CASE WHEN actif = 1 THEN 1 ELSE 0 END) AS actifs
         FROM utilisateurs`
      );

      const [[statsGlobales]] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM cours WHERE archive = 0) AS nb_cours,
           (SELECT COUNT(*) FROM professeurs) AS nb_professeurs,
           (SELECT COUNT(*) FROM etudiants) AS nb_etudiants,
           (SELECT COUNT(*) FROM salles) AS nb_salles,
           (SELECT COUNT(*) FROM groupes_etudiants) AS nb_groupes,
           (SELECT COUNT(*) FROM affectation_cours) AS nb_affectations,
           (SELECT COUNT(*) FROM cours_echoues WHERE statut = 'a_reprendre') AS cours_echoues_en_attente`
      );

      const [dernierRapport] = await pool.query(
        `SELECT score_qualite, date_generation, nb_cours_planifies
         FROM rapports_generation
         ORDER BY date_generation DESC LIMIT 1`
      );

      return res.json({
        utilisateurs: statsUsers,
        global: statsGlobales,
        dernier_rapport: dernierRapport[0] || null,
      });
    } catch (error) {
      console.error("Erreur stats:", error);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });
}
