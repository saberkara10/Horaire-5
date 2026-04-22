/**
 * Configuration de l'authentification avec Passport.js.
 *
 * Passport est la bibliothèque d'authentification standard pour Express.
 * Ce fichier configure trois choses essentielles :
 *
 *  1. La STRATÉGIE d'authentification : on utilise "local" (email + mot de passe).
 *     D'autres stratégies existent (Google OAuth, JWT, etc.) mais on n'en a pas besoin ici.
 *
 *  2. serializeUser : quand l'utilisateur se connecte, on décide quoi stocker dans
 *     la session. On stocke juste l'ID (pas le mot de passe ni les données sensibles).
 *
 *  3. deserializeUser : à chaque requête suivante, Passport prend l'ID stocké en session
 *     et recharge l'utilisateur complet depuis la base de données, avec ses rôles.
 *
 * @module auth
 */

import passport from "passport";
import { Strategy } from "passport-local";
import pool from "./db.js";
import {
  findByEmail,
  findById,
  findRolesByUserId,
} from "./src/model/utilisateur.js";
import {
  hashPassword,
  isBcryptHash,
  verifyPassword,
} from "./src/utils/passwords.js";

// Configuration de la stratégie locale.
// Par défaut, Passport cherche les champs "username" et "password" dans le body.
// Ici on overide pour utiliser "email" à la place de "username".
const config = {
  usernameField: "email",
  passwordField: "password",
};

function estErreurSchema(error) {
  return (
    error?.code === "ER_BAD_FIELD_ERROR" ||
    error?.code === "ER_NO_SUCH_TABLE" ||
    error?.code === "ER_BAD_TABLE_ERROR"
  );
}

async function migrerMotDePasseLegacySiNecessaire(user, plainPassword) {
  const storedPassword = user?.mot_de_passe_hash;

  if (typeof storedPassword !== "string" || typeof plainPassword !== "string") {
    return false;
  }

  if (isBcryptHash(storedPassword) || storedPassword !== plainPassword) {
    return false;
  }

  const nouveauHash = await hashPassword(plainPassword);

  try {
    await pool.query(
      `UPDATE utilisateurs
       SET mot_de_passe_hash = ?
       WHERE id = ?`,
      [nouveauHash, user.id]
    );
  } catch (error) {
    if (!estErreurSchema(error)) {
      throw error;
    }

    await pool.query(
      `UPDATE utilisateurs
       SET motdepasse = ?
       WHERE id_utilisateur = ?`,
      [nouveauHash, user.id]
    );
  }

  user.mot_de_passe_hash = nouveauHash;
  return true;
}

/**
 * Stratégie d'authentification locale (email + mot de passe).
 *
 * Appelée automatiquement par Passport lors de passport.authenticate("local").
 * Vérifie que l'email existe et que le mot de passe hashé correspond.
 *
 * @param {string} email - L'email soumis dans le formulaire de connexion
 * @param {string} password - Le mot de passe en clair soumis dans le formulaire
 * @param {Function} done - Callback Passport : done(erreur, utilisateur, infos)
 */
passport.use(new Strategy(config, async (email, password, done) => {
  try {
    // Rechercher l'utilisateur par email dans la base de données
    const user = await findByEmail(email);

    // Si aucun utilisateur trouvé avec cet email → on refuse sans révéler pourquoi
    // (pour ne pas indiquer à un attaquant si l'email existe ou non)
    if (!user) {
      return done(null, false, { error: "wrong_user" });
    }

    // Comparer le mot de passe fourni avec le hash stocké en base (bcrypt)
    let isValid = await verifyPassword(password, user.mot_de_passe_hash);

    if (!isValid) {
      isValid = await migrerMotDePasseLegacySiNecessaire(user, password);
    }

    // Mot de passe incorrect → refus
    if (!isValid) {
      return done(null, false, { error: "wrong_password" });
    }

    // Tout est correct → on retourne l'utilisateur à Passport
    return done(null, user);
  } catch (error) {
    // Erreur technique (base de données inaccessible, etc.)
    return done(error);
  }
}));

/**
 * Sérialisation de l'utilisateur dans la session.
 *
 * Appelée une seule fois lors de la connexion réussie.
 * On stocke uniquement l'ID en session pour garder le cookie léger.
 * À chaque requête suivante, deserializeUser recharge l'utilisateur complet.
 *
 * @param {object} user - L'objet utilisateur retourné par la stratégie
 * @param {Function} done - Callback : done(erreur, valeurÀStocker)
 */
passport.serializeUser((user, done) => {
  done(null, user.id); // On ne stocke que l'ID, pas les données sensibles
});

/**
 * Désérialisation de l'utilisateur depuis la session.
 *
 * Appelée à chaque requête authentifiée. Passport récupère l'ID stocké
 * en session, recharge l'utilisateur depuis la BDD et y ajoute ses rôles.
 * Le résultat est disponible dans req.user dans toutes les routes protégées.
 *
 * @param {number} id - L'ID utilisateur stocké dans la session
 * @param {Function} done - Callback : done(erreur, utilisateurComplet)
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await findById(id);

    if (user) {
      // Charger les rôles associés (admin, responsable, etc.)
      // et les attacher à l'objet utilisateur, accessible via req.user.roles
      user.roles = await findRolesByUserId(id);
    }

    done(null, user);
  } catch (error) {
    done(error);
  }
});
