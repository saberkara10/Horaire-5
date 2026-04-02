/**
 * MODEL - Gestion des utilisateurs
 *
 * Ce module gere les comptes utilisateurs,
 * les roles et les sous-admins.
 */
import bcrypt from "bcrypt";
import pool from "../../db.js";

const ROLE_ADMIN = "ADMIN";

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

function normaliserEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function executerEcritureAvecFallback(operationPrincipale, operationLegacy) {
  try {
    return await operationPrincipale();
  } catch (error) {
    if (!estErreurSchema(error)) {
      throw error;
    }

    return operationLegacy();
  }
}

async function recupererSousAdminParIdSchemaModerne(id, executor = pool) {
  const [rows] = await executor.query(
    `SELECT
        u.id,
        u.email,
        u.nom,
        u.prenom,
        u.actif,
        ? AS role
     FROM utilisateurs u
     INNER JOIN utilisateur_roles ur
       ON ur.utilisateur_id = u.id
     INNER JOIN roles r
       ON r.id = ur.role_id
     WHERE u.id = ?
       AND r.code = ?
     LIMIT 1`,
    [ROLE_ADMIN, id, ROLE_ADMIN]
  );

  return rows[0] ?? null;
}

async function recupererSousAdminParIdLegacy(id, executor = pool) {
  const [rows] = await executor.query(
    `SELECT
        id_utilisateur AS id,
        email,
        nom,
        prenom,
        1 AS actif,
        role
     FROM utilisateurs
     WHERE id_utilisateur = ?
       AND role = ?
     LIMIT 1`,
    [id, ROLE_ADMIN]
  );

  return rows[0] ?? null;
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

/**
 * Recupere tous les sous-admins.
 * @returns {Promise<Array<object>>} Liste des comptes ADMIN.
 */
export async function recupererSousAdmins() {
  return executerAvecFallback(
    `SELECT
        u.id,
        u.email,
        u.nom,
        u.prenom,
        u.actif,
        r.code AS role
     FROM utilisateurs u
     INNER JOIN utilisateur_roles ur
       ON ur.utilisateur_id = u.id
     INNER JOIN roles r
       ON r.id = ur.role_id
     WHERE r.code = ?
     ORDER BY u.nom ASC, u.prenom ASC, u.email ASC`,
    `SELECT
        id_utilisateur AS id,
        email,
        nom,
        prenom,
        1 AS actif,
        role
     FROM utilisateurs
     WHERE role = ?
     ORDER BY nom ASC, prenom ASC, email ASC`,
    [ROLE_ADMIN]
  );
}

/**
 * Recupere un sous-admin par son identifiant.
 * @param {number} id Identifiant du sous-admin.
 * @returns {Promise<object|null>} Le sous-admin ou null.
 */
export async function recupererSousAdminParId(id) {
  return executerEcritureAvecFallback(
    () => recupererSousAdminParIdSchemaModerne(id),
    () => recupererSousAdminParIdLegacy(id)
  );
}

/**
 * Cree un sous-admin.
 * @param {object} admin Donnees du sous-admin.
 * @returns {Promise<object>} Sous-admin cree.
 */
export async function creerSousAdmin(admin) {
  const email = normaliserEmail(admin.email);
  const hash = await bcrypt.hash(String(admin.password), 10);

  return executerEcritureAvecFallback(
    async () => {
      const connexion = await pool.getConnection();

      try {
        await connexion.beginTransaction();

        const [resultatInsertion] = await connexion.query(
          `INSERT INTO utilisateurs (email, mot_de_passe_hash, nom, prenom, actif)
           VALUES (?, ?, ?, ?, 1)`,
          [email, hash, admin.nom, admin.prenom]
        );

        const [roles] = await connexion.query(
          `SELECT id FROM roles WHERE code = ? LIMIT 1`,
          [ROLE_ADMIN]
        );

        if (!roles.length) {
          throw new Error("Role ADMIN introuvable.");
        }

        await connexion.query(
          `INSERT INTO utilisateur_roles (utilisateur_id, role_id)
           VALUES (?, ?)`,
          [resultatInsertion.insertId, roles[0].id]
        );

        const sousAdmin = await recupererSousAdminParIdSchemaModerne(
          resultatInsertion.insertId,
          connexion
        );

        await connexion.commit();
        return sousAdmin;
      } catch (error) {
        await connexion.rollback();
        throw error;
      } finally {
        connexion.release();
      }
    },
    async () => {
      const [resultatInsertion] = await pool.query(
        `INSERT INTO utilisateurs (nom, prenom, email, motdepasse, role)
         VALUES (?, ?, ?, ?, ?)`,
        [admin.nom, admin.prenom, email, hash, ROLE_ADMIN]
      );

      return recupererSousAdminParIdLegacy(resultatInsertion.insertId);
    }
  );
}

/**
 * Met a jour un sous-admin.
 * @param {number} id Identifiant du sous-admin.
 * @param {object} admin Donnees a mettre a jour.
 * @returns {Promise<object|null>} Sous-admin mis a jour ou null.
 */
export async function mettreAJourSousAdmin(id, admin) {
  const email = normaliserEmail(admin.email);
  const motDePasseFourni =
    typeof admin.password === "string" && admin.password.trim().length > 0;
  const hash = motDePasseFourni ? await bcrypt.hash(admin.password, 10) : null;

  return executerEcritureAvecFallback(
    async () => {
      const sousAdminExistant = await recupererSousAdminParIdSchemaModerne(id);

      if (!sousAdminExistant) {
        return null;
      }

      if (motDePasseFourni) {
        await pool.query(
          `UPDATE utilisateurs
           SET nom = ?, prenom = ?, email = ?, mot_de_passe_hash = ?
           WHERE id = ?`,
          [admin.nom, admin.prenom, email, hash, id]
        );
      } else {
        await pool.query(
          `UPDATE utilisateurs
           SET nom = ?, prenom = ?, email = ?
           WHERE id = ?`,
          [admin.nom, admin.prenom, email, id]
        );
      }

      return recupererSousAdminParIdSchemaModerne(id);
    },
    async () => {
      const sousAdminExistant = await recupererSousAdminParIdLegacy(id);

      if (!sousAdminExistant) {
        return null;
      }

      if (motDePasseFourni) {
        await pool.query(
          `UPDATE utilisateurs
           SET nom = ?, prenom = ?, email = ?, motdepasse = ?
           WHERE id_utilisateur = ?
             AND role = ?`,
          [admin.nom, admin.prenom, email, hash, id, ROLE_ADMIN]
        );
      } else {
        await pool.query(
          `UPDATE utilisateurs
           SET nom = ?, prenom = ?, email = ?
           WHERE id_utilisateur = ?
             AND role = ?`,
          [admin.nom, admin.prenom, email, id, ROLE_ADMIN]
        );
      }

      return recupererSousAdminParIdLegacy(id);
    }
  );
}

/**
 * Supprime un sous-admin.
 * @param {number} id Identifiant du sous-admin.
 * @returns {Promise<boolean>} True si supprime.
 */
export async function supprimerSousAdmin(id) {
  return executerEcritureAvecFallback(
    async () => {
      const sousAdminExistant = await recupererSousAdminParIdSchemaModerne(id);

      if (!sousAdminExistant) {
        return false;
      }

      const connexion = await pool.getConnection();

      try {
        await connexion.beginTransaction();
        await connexion.query(
          `DELETE FROM utilisateur_roles
           WHERE utilisateur_id = ?`,
          [id]
        );
        const [resultatSuppression] = await connexion.query(
          `DELETE FROM utilisateurs
           WHERE id = ?`,
          [id]
        );
        await connexion.commit();

        return resultatSuppression.affectedRows > 0;
      } catch (error) {
        await connexion.rollback();
        throw error;
      } finally {
        connexion.release();
      }
    },
    async () => {
      const [resultatSuppression] = await pool.query(
        `DELETE FROM utilisateurs
         WHERE id_utilisateur = ?
           AND role = ?`,
        [id, ROLE_ADMIN]
      );

      return resultatSuppression.affectedRows > 0;
    }
  );
}
/**
 * MODEL - Gestion des utilisateurs
 *
 * Ce module gere les comptes utilisateurs,
 * les roles et les sous-admins.
 */
