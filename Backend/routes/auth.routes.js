/**
 * ROUTES - Module Authentification
 *
 * Ce module definit toutes les routes HTTP liees a l'authentification.
 * 
 */

import passport from "passport";
import { userAuth, userNotAuth } from "../middlewares/auth.js";
import { emailIsValid, passwordIsValid } from "../src/validations/auth.validation.js";

/**
 * Initialiser les routes d'authentification.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function authRoutes(app) {
  /**
   * POST /auth/login
   * Authentifier un utilisateur.
   */
  app.post(
    "/auth/login",
    userNotAuth,
    emailIsValid,
    passwordIsValid,
    (request, response, next) => {
      passport.authenticate("local", (error, user, info) => {
        if (error) {
          return next(error);
        }

        if (!user) {
          return response.status(401).json(info);
        }

        request.logIn(user, (erreur) => {
          if (erreur) {
            return next(erreur);
          }

          return response.sendStatus(200);
        });
      })(request, response, next);
    }
  );

  /**
   * POST /auth/logout
   * Deconnecter l'utilisateur.
   */
  app.post(
    "/auth/logout",
    userAuth,
    (request, response, next) => {
      request.logOut((erreur) => {
        if (erreur) {
          return next(erreur);
        }

        return response.status(200).end();
      });
    }
  );

  /**
   * GET /auth/me
   * Recuperer l'utilisateur connecte.
   */
  app.get(
    "/auth/me",
    userAuth,
    (request, response) => {
      response.status(200).json(request.user);
    }
  );
}
