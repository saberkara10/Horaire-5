/**
 * Routes — Module Authentification.
 *
 * Ce module définit les trois routes HTTP qui gèrent l'authentification :
 *  - POST /auth/login  → connexion avec email + mot de passe
 *  - POST /auth/logout → déconnexion
 *  - GET  /auth/me     → infos de l'utilisateur connecté
 *
 * Architecture Passport utilisée ici :
 * On utilise passport.authenticate("local") en mode "callback" (pas en mode middleware direct).
 * Cela permet de gérer les erreurs et les réponses de manière plus fine.
 * Le callback reçoit (error, user, info) :
 *  - error : erreur technique (BDD inaccessible, etc.)
 *  - user  : l'utilisateur si authentifié, false sinon
 *  - info  : objet avec le code d'erreur en cas d'échec (ex: { error: "wrong_password" })
 *
 * @module routes/auth
 */

import passport from "passport";
import { userAuth, userNotAuth } from "../middlewares/auth.js";
import { createLoginRateLimit } from "../middlewares/loginRateLimit.js";
import {
  emailIsValid,
  passwordIsValid,
} from "../src/validations/auth.validation.js";

async function journaliserActiviteAuth(options) {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.FORCE_AUDIT_LOGS_IN_TESTS !== "1"
  ) {
    return null;
  }

  const { journaliserActivite } = await import(
    "../src/services/activity-log.service.js"
  );
  return journaliserActivite(options);
}

async function fermerSessionConcurrenceSafe(request) {
  if (process.env.NODE_ENV === "test") {
    return { released_locks: 0 };
  }

  const { fermerSessionConcurrence } = await import(
    "../src/services/concurrency.service.js"
  );
  return fermerSessionConcurrence(request);
}

/**
 * Initialise et enregistre les routes d'authentification sur l'application Express.
 *
 * @param {import("express").Express} app - L'instance de l'application Express
 */
export default function authRoutes(app) {
  const loginRateLimit = createLoginRateLimit();

  /**
   * POST /auth/login
   * Connexion d'un utilisateur avec email + mot de passe.
   *
   * Middlewares appliqués dans l'ordre :
   *  1. userNotAuth    → refuse si déjà connecté
   *  2. emailIsValid   → valide le format de l'email (400 si invalide)
   *  3. passwordIsValid → valide le mot de passe (400 si vide)
   *  4. passport.authenticate → vérifie les identifiants contre la BDD
   *
   * Réponses possibles :
   *  - 200 OK             → connexion réussie (session créée)
   *  - 400 Bad Request    → champs manquants ou invalides
   *  - 401 Unauthorized   → email ou mot de passe incorrect
   *  - 500 Internal Error → erreur technique
   */
  app.post(
    "/auth/login",
    userNotAuth,
    emailIsValid,
    passwordIsValid,
    loginRateLimit,
    (request, response, next) => {
      // Mode "callback" pour contrôler manuellement la réponse
      passport.authenticate("local", async (error, user, info) => {
        if (error) {
          await journaliserActiviteAuth({
            request,
            actionType: "LOGIN",
            module: "Authentification",
            targetType: "Utilisateur",
            description: `Erreur technique lors de la connexion de ${request.body?.email || "utilisateur inconnu"}.`,
            status: "ERROR",
            errorMessage: error.message,
            userName: request.body?.email || null,
          });
          return next(error); // Erreur technique → Express gère l'erreur 500
        }

        if (!user) {
          // Authentification échouée — info contient { error: "wrong_user" } ou "wrong_password"
          const rateLimitInfo =
            typeof loginRateLimit.enregistrerEchec === "function"
              ? loginRateLimit.enregistrerEchec(request)
              : null;

          if (rateLimitInfo?.estBloque) {
            await journaliserActiviteAuth({
              request,
              actionType: "LOGIN",
              module: "Authentification",
              targetType: "Utilisateur",
              description: `Tentative de connexion bloquee pour ${request.body?.email || "utilisateur inconnu"}.`,
              status: "ERROR",
              errorMessage: "Trop de tentatives de connexion.",
              userName: request.body?.email || null,
            });
            return response.status(429).json({
              message: "Trop de tentatives de connexion. Reessayez plus tard.",
              tentatives_restantes: 0,
              attente_secondes: rateLimitInfo.attente_secondes,
            });
          }

          await journaliserActiviteAuth({
            request,
            actionType: "LOGIN",
            module: "Authentification",
            targetType: "Utilisateur",
            description: `Tentative de connexion echouee pour ${request.body?.email || "utilisateur inconnu"}.`,
            status: "ERROR",
            errorMessage: info?.error || "Identifiants invalides.",
            userName: request.body?.email || null,
          });

          return response.status(401).json({
            ...info,
            tentatives_restantes: rateLimitInfo?.tentatives_restantes ?? null,
          });
        }

        // Authentification réussie → créer la session (sérialise user.id dans le cookie)
        request.logIn(user, async (erreur) => {
          if (erreur) {
            await journaliserActiviteAuth({
              request,
              user,
              actionType: "LOGIN",
              module: "Authentification",
              targetType: "Utilisateur",
              targetId: user?.id,
              description: `Erreur lors de l'ouverture de session de ${user?.email || "utilisateur"}.`,
              status: "ERROR",
              errorMessage: erreur.message,
            });
            return next(erreur);
          }

          // 200 sans corps — le frontend appelera /auth/me pour récupérer les données utilisateur
          if (typeof loginRateLimit.reinitialiser === "function") {
            loginRateLimit.reinitialiser(request);
          }

          await journaliserActiviteAuth({
            request,
            user,
            actionType: "LOGIN",
            module: "Authentification",
            targetType: "Utilisateur",
            targetId: user?.id,
            description: `Connexion reussie pour ${user?.email || "utilisateur"}.`,
            status: "SUCCESS",
          });

          return response.sendStatus(200);
        });
      })(request, response, next);
    }
  );

  /**
   * POST /auth/logout
   * Déconnecte l'utilisateur en invalidant sa session.
   *
   * Middlewares :
   *  - userAuth → refuse si personne n'est connecté (401)
   *
   * Réponses :
   *  - 200 OK  → déconnexion réussie (cookie de session supprimé)
   *  - 401     → non connecté
   *  - 500     → erreur technique lors de la destruction de session
   */
  app.post(
    "/auth/logout",
    userAuth,
    async (request, response, next) => {
      const utilisateurAvantLogout = request.user;

      await journaliserActiviteAuth({
        request,
        user: utilisateurAvantLogout,
        actionType: "LOGOUT",
        module: "Authentification",
        targetType: "Utilisateur",
        targetId: utilisateurAvantLogout?.id,
        description: `Deconnexion de ${utilisateurAvantLogout?.email || "utilisateur"}.`,
        status: "SUCCESS",
      });

      await fermerSessionConcurrenceSafe(request);

      request.logOut(async (erreur) => {
        if (erreur) {
          await journaliserActiviteAuth({
            request,
            user: utilisateurAvantLogout,
            actionType: "LOGOUT",
            module: "Authentification",
            targetType: "Utilisateur",
            targetId: utilisateurAvantLogout?.id,
            description: "Erreur lors de la fermeture de session.",
            status: "ERROR",
            errorMessage: erreur.message,
          });
          return next(erreur);
        }

        // Fin de réponse sans corps — la session est détruite côté serveur
        return response.status(200).end();
      });
    }
  );

  /**
   * GET /auth/me
   * Retourne les informations de l'utilisateur actuellement connecté.
   *
   * Utilisée par le frontend au démarrage pour savoir si une session existe
   * (et récupérer les rôles de l'utilisateur sans refaire de login).
   *
   * Middlewares :
   *  - userAuth → refuse si personne n'est connecté (401)
   *
   * L'objet retourné est request.user tel qu'assigné par Passport après
   * deserializeUser() — contient id, email, nom, prenom, roles[].
   *
   * Réponses :
   *  - 200 OK  → objet utilisateur JSON
   *  - 401     → non connecté
   */
  app.get(
    "/auth/me",
    userAuth,
    (request, response) => {
      response.status(200).json(request.user);
    }
  );
}
