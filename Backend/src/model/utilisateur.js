import pool from "../../db.js";

function estErreurSchema(error) {
  return (
    error?.code === "ER_BAD_FIELD_ERROR" ||
    error?.code === "ER_NO_SUCH_TABLE" ||
    error?.code === "ER_BAD_TABLE_ERROR"
  );
}

async function executerAvecFallback(requetePrincipale, requeteLegacy, params) {
  try {
    const [rows] = await pool.query(requetePrincipale, params);
    return rows;
  } catch (error) {
    if (!estErreurSchema(error)) {
      throw error;
    }

    const [rows] = await pool.query(requeteLegacy, params);
    return rows;
  }
}

function nettoyerRole(role) {
  if (typeof role !== "string") {
    return "";
  }

  return role.trim();
}

/**
 * Recherche un utilisateur par son courriel.
 * @param {string} email Le courriel de l'utilisateur à rechercher.
 * @returns {Promise<object|null>} Un utilisateur ou null.
 */
export async function findByEmail(email) {
  const rows = await executerAvecFallback(
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
  const rows = await executerAvecFallback(
    `SELECT
          id,
          email,
          nom,
          prenom,
          actif
       FROM utilisateurs
       WHERE id = ?
       LIMIT 1`,
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
  const rows = await executerAvecFallback(
    `SELECT r.code
       FROM utilisateur_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.utilisateur_id = ?
       ORDER BY r.code ASC`,
    `SELECT role
       FROM utilisateurs
       WHERE id_utilisateur = ?
       LIMIT 1`,
    [userId]
  );

  if (!rows.length) {
    return [];
  }

  const roles = rows
    .map((row) => nettoyerRole(row.code ?? row.role))
    .filter(Boolean);

  return [...new Set(roles)];
}
