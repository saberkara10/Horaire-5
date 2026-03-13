/**
 * Validations - Module Authentification
 *
 * Ce module regroupe les middlewares qui valident
 * les données envoyées par le client avant de les
 * traiter dans les routes d'authentification.
 */

/**
 * Middleware validant le courriel dans le body.
 * @param {import("express").Request} request Objet de requête HTTP.
 * @param {import("express").Response} response Objet de réponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function emailIsValid(request, response, next) {
  const email = request.body.email;

  if (email && typeof email === "string" && email.trim().length > 0) {
    return next();
  }

  response.status(400).json({ message: "Courriel invalide" });
}

/**
 * Middleware validant le mot de passe dans le body.
 * @param {import("express").Request} request Objet de requête HTTP.
 * @param {import("express").Response} response Objet de réponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function passwordIsValid(request, response, next) {
  const password = request.body.password;

  if (password && typeof password === "string" && password.length >= 6) {
    return next();
  }

  response.status(400).json({ message: "Mot de passe invalide" });
}