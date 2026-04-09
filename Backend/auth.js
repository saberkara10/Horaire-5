/**
 * Configuration de la strategie d'authentification Passport.
 *
 * Ce module definit la strategie locale (email/password),
 * la serialisation et la deserialisation de l'utilisateur.
 */

import passport from "passport";
import { Strategy } from "passport-local";
import {
  findByEmail,
  findById,
  findRolesByUserId,
} from "./src/model/utilisateur.js";
import { verifyPassword } from "./src/utils/passwords.js";

const config = {
  usernameField: "email",
  passwordField: "password",
};

passport.use(new Strategy(config, async (email, password, done) => {
  try {
    const user = await findByEmail(email);

    if (!user) {
      return done(null, false, { error: "wrong_user" });
    }

    const isValid = await verifyPassword(password, user.mot_de_passe_hash);

    if (!isValid) {
      return done(null, false, { error: "wrong_password" });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await findById(id);

    if (user) {
      user.roles = await findRolesByUserId(id);
    }

    done(null, user);
  } catch (error) {
    done(error);
  }
});
