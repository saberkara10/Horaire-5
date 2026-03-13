/**
 * Configuration de la stratégie d'authentification Passport.
 *
 * Ce module définit la stratégie locale (email/password),
 * la sérialisation et la désérialisation de l'utilisateur.
 */

import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import { findByEmail, findById, findRolesByUserId } from "./src/model/utilisateur.js";

// Configuration générale de la stratégie.
const config = {
    usernameField: "email",
    passwordField: "password"
};

// Configuration de la stratégie d'authentification locale
passport.use(new Strategy(config, async (email, password, done) => {
    try {
        const user = await findByEmail(email);
        if (!user) {
            return done(null, false, { error: "wrong_user" });
        }

        const isValid = await bcrypt.compare(password, user.mot_de_passe_hash);
        if (!isValid) {
            return done(null, false, { error: "wrong_password" });
        }

        return done(null, user);
    }
    catch (error) {
        return done(error);
    }
}));

// Sérialise l'identifiant de l'utilisateur dans la session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Désérialise l'utilisateur en allant le chercher dans la base de données
passport.deserializeUser(async (id, done) => {
    try {
        const user = await findById(id);
        if (user) {
            user.roles = await findRolesByUserId(id);
        }
        done(null, user);
    }
    catch (error) {
        done(error);
    }
});