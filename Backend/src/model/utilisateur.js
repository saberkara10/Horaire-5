import pool from "../../db.js";

/**
 * Recherche un utilisateur par son courriel.
 * @param {string} email Le courriel de l'utilisateur à rechercher.
 * @returns {Promise<object|null>} Un utilisateur ou null.
 */
export async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT 
        id_utilisateur AS id,
        email,
        motdepasse AS mot_de_passe_hash,
        nom,
        prenom,
        1 AS actif,
        role
     FROM utilisateurs
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  return rows[0] ?? null;
}

/**
 * Recherche un utilisateur par son identifiant.
 * @param {number} id L'identifiant de l'utilisateur.
 * @returns {Promise<object|null>} Un utilisateur ou null.
 */
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT
        id_utilisateur AS id,
        email,
        nom,
        prenom,
        1 AS actif,
        role
     FROM utilisateurs
     WHERE id_utilisateur = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
}

/**
 * Récupère les rôles d'un utilisateur par son identifiant.
 * @param {number} userId L'identifiant de l'utilisateur.
 * @returns {Promise<string[]>} Une liste de rôles.
 */
export async function findRolesByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT role
     FROM utilisateurs
     WHERE id_utilisateur = ?
     LIMIT 1`,
    [userId]
  );

  if (!rows.length || !rows[0].role) {
    return [];
  }

  return [rows[0].role];
}