/**
 * Modèle de données — Gestion des utilisateurs et sous-admins.
 *
 * Ce module gère tout ce qui concerne les comptes utilisateurs :
 * recherche par email ou ID, récupération des rôles, création, modification
 * et suppression des sous-administrateurs.
 *
 * Particularité importante — Compatibilité avec deux schémas de base de données :
 * Le projet a subi une migration de schéma. L'ancien schéma utilisait des colonnes
 * différentes (ex: "id_utilisateur" au lieu de "id", "motdepasse" au lieu de
 * "mot_de_passe_hash", table plate avec colonne "role" au lieu de table jointure).
 * Les fonctions "legacy" gèrent l'ancien schéma, les fonctions "moderne" le nouveau.
 * La fonction executerAvecFallback essaie le nouveau schéma, et bascule sur l'ancien
 * si MySQL retourne une erreur de colonne ou de table manquante.
 *
 * @module model/utilisateur
 */

import bcrypt from "bcrypt";
import pool from "../../db.js";

/**
 * Identifiant du rôle administrateur dans la table des rôles.
 * Utilisé comme constante pour éviter les fautes de frappe dans les requêtes.
 *
 * @type {string}
 */
const ROLE_ADMIN = "ADMIN";

/**
 * Détecte si une erreur MySQL est due à un schéma de base de données différent.
 *
 * Utilisée pour basculer automatiquement sur les requêtes "legacy" quand le
 * nouveau schéma n'est pas encore appliqué (environnement non migré).
 *
 * @param {Error} error - L'erreur MySQL reçue
 * @returns {boolean} true si l'erreur vient d'un problème de schéma
 */
function estErreurSchema(error) {
  return (
    error?.code === "ER_BAD_FIELD_ERROR" || // colonne inexistante
    error?.code === "ER_NO_SUCH_TABLE" ||   // table inexistante
    error?.code === "ER_BAD_TABLE_ERROR"    // référence de table invalide
  );
}

/**
 * Exécute une requête SQL avec fallback automatique vers le schéma legacy.
 *
 * Tente d'abord la requête "moderne" (nouveau schéma).
 * Si MySQL retourne une erreur de schéma, bascule sur la requête "legacy".
 * Toute autre erreur est laissée remonter normalement.
 *
 * @param {string} requetePrincipale - Requête SQL pour le nouveau schéma
 * @param {string} requeteLegacy - Requête SQL pour l'ancien schéma
 * @param {Array} params - Paramètres partagés par les deux requêtes
 * @returns {Promise<object[]>} Les lignes retournées par la requête qui a fonctionné
 */
async function executerAvecFallback(requetePrincipale, requeteLegacy, params) {
  try {
    const [rows] = await pool.query(requetePrincipale, params);
    return rows;
  } catch (error) {
    if (!estErreurSchema(error)) {
      throw error; // Ce n'est pas un problème de schéma → on ne gère pas
    }

    // Schéma legacy détecté → on essaie l'ancienne requête
    const [rows] = await pool.query(requeteLegacy, params);
    return rows;
  }
}

/**
 * Nettoie une valeur de rôle en supprimant les espaces superflus.
 *
 * @param {*} role - Le rôle à nettoyer
 * @returns {string} Le rôle nettoyé, ou "" si le type n'est pas string
 */
function nettoyerRole(role) {
  if (typeof role !== "string") {
    return "";
  }

  return role.trim();
}

/**
 * Normalise une adresse email : suppression des espaces et conversion en minuscules.
 * On ne valide pas le format ici — ça se fait dans la couche de validation.
 *
 * @param {*} email - L'email à normaliser
 * @returns {string} L'email normalisé
 */
function normaliserEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Exécute une opération d'écriture avec fallback automatique vers le schéma legacy.
 *
 * Similaire à executerAvecFallback mais pour les opérations de modification
 * (INSERT, UPDATE, DELETE) qui utilisent des fonctions plutôt que des chaînes SQL.
 *
 * @param {Function} operationPrincipale - Fonction async pour le nouveau schéma
 * @param {Function} operationLegacy - Fonction async pour l'ancien schéma
 * @returns {Promise<*>} Résultat de l'opération qui a réussi
 */
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

/**
 * Récupère un sous-admin par son ID en utilisant le nouveau schéma (avec jointures).
 *
 * @param {number} id - L'ID de l'utilisateur
 * @param {object} [executor=pool] - Connexion MySQL à utiliser (pool ou transaction)
 * @returns {Promise<object|null>} Le sous-admin ou null s'il n'existe pas
 */
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

/**
 * Récupère un sous-admin par son ID en utilisant l'ancien schéma (table plate).
 *
 * @param {number} id - L'ID de l'utilisateur
 * @param {object} [executor=pool] - Connexion MySQL à utiliser
 * @returns {Promise<object|null>} Le sous-admin ou null
 */
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
 * Recherche un utilisateur par son adresse email.
 *
 * Utilisée par Passport lors de l'authentification. On récupère le hash du
 * mot de passe pour le comparer ensuite avec bcrypt.compare().
 *
 * Gère les deux schémas de base de données (moderne et legacy).
 *
 * @param {string} email - L'email de l'utilisateur à rechercher
 * @returns {Promise<object|null>} L'utilisateur avec son hash de mot de passe, ou null
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
    // Schéma legacy : colonne "motdepasse" au lieu de "mot_de_passe_hash"
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
 * Recherche un utilisateur par son identifiant numérique.
 *
 * Utilisée par Passport lors de la désérialisation de la session
 * (à chaque requête authentifiée, pour recharger l'utilisateur depuis la BDD).
 *
 * @param {number} id - L'identifiant de l'utilisateur
 * @returns {Promise<object|null>} L'utilisateur ou null s'il n'existe pas
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
 * Récupère la liste des rôles d'un utilisateur.
 *
 * Nouveau schéma : jointure avec les tables "utilisateur_roles" et "roles".
 * Legacy        : lecture du champ "role" directement dans la table utilisateurs.
 *
 * Dans les deux cas, on déduplique les rôles retournés avec Set.
 *
 * @param {number} userId - L'identifiant de l'utilisateur
 * @returns {Promise<string[]>} Liste dédupliquée des codes de rôles (ex: ["ADMIN", "RESPONSABLE"])
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

  // Normaliser et dédupliquer (les deux schémas utilisent des colonnes différentes)
  const roles = rows
    .map((row) => nettoyerRole(row.code ?? row.role))
    .filter(Boolean);

  return [...new Set(roles)]; // Set supprime les doublons automatiquement
}

/**
 * Récupère la liste de tous les sous-administrateurs du système.
 *
 * Retourne uniquement les utilisateurs avec le rôle ADMIN, triés par nom.
 * Compatible avec les deux schémas de base de données.
 *
 * @returns {Promise<object[]>} Liste des comptes administrateurs
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
 * Récupère un sous-administrateur par son identifiant.
 *
 * @param {number} id - L'identifiant du sous-admin à récupérer
 * @returns {Promise<object|null>} Le sous-admin ou null s'il n'existe pas
 */
export async function recupererSousAdminParId(id) {
  return executerEcritureAvecFallback(
    () => recupererSousAdminParIdSchemaModerne(id),
    () => recupererSousAdminParIdLegacy(id)
  );
}

/**
 * Crée un nouveau compte sous-administrateur.
 *
 * Le mot de passe fourni est haché avec bcrypt avant l'insertion.
 * Dans le nouveau schéma, on utilise une transaction pour insérer l'utilisateur
 * ET son rôle atomiquement (tout ou rien). Si le rôle ADMIN n'existe pas en base,
 * la transaction échoue et un rollback est effectué.
 *
 * @param {object} admin - Les données du nouveau sous-admin
 * @param {string} admin.email - Email (sera normalisé en minuscules)
 * @param {string} admin.password - Mot de passe en clair (sera haché)
 * @param {string} admin.nom - Nom de famille
 * @param {string} admin.prenom - Prénom
 * @returns {Promise<object>} Le sous-admin créé avec ses données complètes
 */
export async function creerSousAdmin(admin) {
  const email = normaliserEmail(admin.email);
  const hash = await bcrypt.hash(String(admin.password), 10);

  return executerEcritureAvecFallback(
    async () => {
      // Nouveau schéma — transaction pour garantir l'atomicité
      const connexion = await pool.getConnection();

      try {
        await connexion.beginTransaction();

        // 1. Insérer l'utilisateur dans la table principale
        const [resultatInsertion] = await connexion.query(
          `INSERT INTO utilisateurs (email, mot_de_passe_hash, nom, prenom, actif)
           VALUES (?, ?, ?, ?, 1)`,
          [email, hash, admin.nom, admin.prenom]
        );

        // 2. Trouver l'ID du rôle ADMIN dans la table des rôles
        const [roles] = await connexion.query(
          `SELECT id FROM roles WHERE code = ? LIMIT 1`,
          [ROLE_ADMIN]
        );

        if (!roles.length) {
          throw new Error("Role ADMIN introuvable.");
        }

        // 3. Associer l'utilisateur au rôle ADMIN
        await connexion.query(
          `INSERT INTO utilisateur_roles (utilisateur_id, role_id)
           VALUES (?, ?)`,
          [resultatInsertion.insertId, roles[0].id]
        );

        // 4. Relire l'utilisateur complet créé pour le retourner
        const sousAdmin = await recupererSousAdminParIdSchemaModerne(
          resultatInsertion.insertId,
          connexion
        );

        await connexion.commit();
        return sousAdmin;
      } catch (error) {
        await connexion.rollback(); // Annuler si quelque chose a planté
        throw error;
      } finally {
        connexion.release(); // Toujours remettre la connexion dans le pool
      }
    },
    async () => {
      // Schéma legacy — insertion simple sans table de rôles
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
 * Met à jour les informations d'un sous-administrateur existant.
 *
 * Si un nouveau mot de passe est fourni, il est haché avant la mise à jour.
 * Si le champ password est vide ou absent, le mot de passe actuel est conservé.
 * Retourne null si le sous-admin n'existe pas.
 *
 * @param {number} id - L'identifiant du sous-admin à modifier
 * @param {object} admin - Les nouvelles données
 * @param {string} admin.email - Nouvel email
 * @param {string} [admin.password] - Nouveau mot de passe (optionnel)
 * @param {string} admin.nom - Nouveau nom
 * @param {string} admin.prenom - Nouveau prénom
 * @returns {Promise<object|null>} Le sous-admin mis à jour, ou null s'il n'existe pas
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
        return null; // On ne peut pas modifier ce qui n'existe pas
      }

      if (motDePasseFourni) {
        // Mise à jour avec changement de mot de passe
        await pool.query(
          `UPDATE utilisateurs
           SET nom = ?, prenom = ?, email = ?, mot_de_passe_hash = ?
           WHERE id = ?`,
          [admin.nom, admin.prenom, email, hash, id]
        );
      } else {
        // Mise à jour sans toucher au mot de passe
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
 * Supprime un compte sous-administrateur.
 *
 * Dans le nouveau schéma, on supprime d'abord les rôles associés (table
 * utilisateur_roles) avant de supprimer l'utilisateur, dans une transaction.
 * Retourne false si le sous-admin n'existe pas (aucune ligne affectée).
 *
 * @param {number} id - L'identifiant du sous-admin à supprimer
 * @returns {Promise<boolean>} true si supprimé avec succès, false sinon
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

        // Supprimer d'abord les entrées dans la table de liaison (contrainte FK)
        await connexion.query(
          `DELETE FROM utilisateur_roles
           WHERE utilisateur_id = ?`,
          [id]
        );

        // Puis supprimer l'utilisateur lui-même
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
      // Legacy : suppression directe, pas de table de liaison
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
