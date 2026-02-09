/**
 * Routes d'authentification de l'application.
 *
 * Ce module gère :
 * la connexion des utilisateurs (login)
 * la récupération de l'utilisateur connecté via la session
 * la déconnexion (logout)
 *
 */

import { Router } from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";

const router = Router();

/**
 * Récupère un utilisateur par email
 */
const findUserByEmail = async (email) => {
  const [rows] = await pool.query(
    `SELECT id, email, mot_de_passe_hash, nom, prenom, actif
     FROM utilisateurs
     WHERE email = ?`,
    [email]
  );
  return rows[0] ?? null;
};

/**
 * Récupère les rôles d’un utilisateur
 */
const fetchRoles = async (userId) => {
  const [rows] = await pool.query(
    `SELECT r.code
     FROM utilisateur_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.utilisateur_id = ?`,
    [userId]
  );
  return rows.map(r => r.code);
};

/**
 * POST /auth/login
 * Authentifie un utilisateur et initialise la session
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const user = await findUserByEmail(cleanEmail);

    
    if (!user) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    if (!user.actif) {
      return res.status(401).json({ message: "Compte désactivé" });
    }

    const passwordOk = await bcrypt.compare(password, user.mot_de_passe_hash);

    if (!passwordOk) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const roles = await fetchRoles(user.id);

    req.session.user = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      roles,
    };

    return res.json({
      message: "Connexion réussie",
      user: req.session.user,
    });

  } catch (err) {
    console.error("Erreur login :", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * POST /auth/logout
 * Détruit la session utilisateur
 */
router.post("/logout", (req, res) => {
  if (!req.session) {
    return res.json({ message: "Aucune session active" });
  }

  req.session.destroy(() => {
    res.clearCookie("sid");
    res.json({ message: "Déconnexion réussie" });
  });
});

/**
 * GET /auth/me
 * Retourne l’utilisateur connecté
 */
router.get("/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Authentification requise" });
  }
  res.json({ user: req.session.user });
});

export default router;

