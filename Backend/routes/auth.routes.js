/**
 * Routes d'authentification.
 *
 * Gère :
 * - La connexion utilisateur
 * - La déconnexion
 * - La récupération de l'utilisateur connecté
 *
 * Table utilisée : utilisateurs
 */

import { Router } from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";

const router = Router();

/**
 * Recherche un utilisateur par email.
 *
 * @param {string} email - Email de l'utilisateur
 * @returns {Promise<Object|null>} Utilisateur trouvé ou null
 */
const findUserByEmail = async (email) => {

  const [rows] = await pool.query(
    `SELECT id_utilisateur, email, motdepasse, nom, prenom, role
     FROM utilisateurs
     WHERE email = ?`,
    [email]
  );

  return rows[0] ?? null;
};


/**
 * Route POST /auth/login
 *
 * @param {Request} request - Contient email et password dans request.body
 * @param {Response} response - Retourne le résultat JSON
 * @returns {void}
 */
router.post("/login", async (request, response) => {

  try {

    const { email, password } = request.body ?? {};

    if (!email || !password) {
      return response.status(400).json({
        message: "Email et mot de passe requis"
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await findUserByEmail(cleanEmail);

    if (!user) {
      return response.status(401).json({
        message: "Identifiants invalides"
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.motdepasse
    );

    if (!passwordValid) {
      return response.status(401).json({
        message: "Identifiants invalides"
      });
    }

    request.session.user = {
      id: user.id_utilisateur,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
    };

    return response.status(200).json({
      message: "Connexion réussie",
      user: request.session.user
    });

  } catch (error) {

    return response.status(500).json({
      message: "Erreur interne du serveur"
    });
  }
});


/**
 * Route POST /auth/logout
 *
 * @param {Request} request
 * @param {Response} response
 * @returns {void}
 */
router.post("/logout", (request, response) => {

  request.session.destroy(() => {
    response.clearCookie("sid");
    response.json({
      message: "Déconnexion réussie"
    });
  });
});


/**
 * Route GET /auth/me
 *
 * @param {Request} request
 * @param {Response} response
 * @returns {void}
 */
router.get("/me", (request, response) => {

  if (!request.session?.user) {
    return response.status(401).json({
      message: "Authentification requise"
    });
  }

  response.json({ user: request.session.user });
});

export default router;