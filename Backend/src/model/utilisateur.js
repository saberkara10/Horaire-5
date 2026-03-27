import pool from "../../db.js";

/**
 * Recherche un utilisateur par son courriel.
 * @param {string} email Le courriel de l'utilisateur à rechercher.
 * @returns {Promise<object|null>} Un utilisateur ou null.
 */
export async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT 
        id,
        email,
        mot_de_passe_hash,
        nom,
        prenom,
        actif
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
        id,
        email,
        nom,
        prenom,
        actif
     FROM utilisateurs
     WHERE id = ?
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
    `SELECT r.code
     FROM utilisateur_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.utilisateur_id = ?
     ORDER BY r.code ASC`,
    [userId]
  );

  if (!rows.length) {
    return [];
  }

  return rows
    .map((row) => row.code)
    .filter((code) => typeof code === "string" && code.trim() !== "");
}
