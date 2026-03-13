import pool from "../../db.js";

/**
 * Recherche un utilisateur par son courriel.
 * @param {string} email Le courriel de l'utilisateur à rechercher.
 * @returns Un utilisateur ou null si aucun utilisateur n'est trouvé.
 */
export async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, email, mot_de_passe_hash, nom, prenom, actif
     FROM utilisateurs
     WHERE email = ?`,
    [email]
  );

  return rows[0] ?? null;
}

/**
 * Recherche un utilisateur par son identifiant.
 * @param {number} id L'identifiant de l'utilisateur.
 * @returns Un utilisateur ou null si aucun utilisateur n'est trouvé.
 */
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, email, nom, prenom, actif
     FROM utilisateurs
     WHERE id = ?`,
    [id]
  );

  return rows[0] ?? null;
}

/**
 * Récupère les rôles d'un utilisateur par son identifiant.
 * @param {number} userId L'identifiant de l'utilisateur.
 * @returns Une liste de codes de rôles (ex: ["ADMIN"]).
 */
export async function findRolesByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT r.code
     FROM utilisateur_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.utilisateur_id = ?`,
    [userId]
  );

  return rows.map((r) => r.code);
}