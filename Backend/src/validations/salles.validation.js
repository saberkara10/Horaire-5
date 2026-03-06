/**
 * Validations - Module Salles
 *
 * Ce module regroupe les middlewares qui valident
 * les données envoyées par le client avant de les
 * traiter dans les routes de gestion des salles.
 */

/**
 * Middleware validant le code de la salle dans le body.
 * @param {import("express").Request} request Objet de requête HTTP.
 * @param {import("express").Response} response Objet de réponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function codeSalleIsValide(request, response, next) {
  if (request.body.code && typeof request.body.code === "string" && request.body.code.trim().length > 0) {
    return next();
  }
  response.status(400).end();
}

/**
 * Middleware validant le type de la salle dans le body.
 * @param {import("express").Request} request Objet de requête HTTP.
 * @param {import("express").Response} response Objet de réponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function typeSalleIsValide(request, response, next) {
  if (request.body.type && typeof request.body.type === "string" && request.body.type.trim().length > 0) {
    return next();
  }
  response.status(400).end();
}

/**
 * Middleware validant la capacité de la salle dans le body.
 * @param {import("express").Request} request Objet de requête HTTP.
 * @param {import("express").Response} response Objet de réponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function capaciteSalleIsValide(request, response, next) {
  if (request.body.capacite && typeof request.body.capacite === "number" && request.body.capacite > 0) {
    return next();
  }
  response.status(400).end();
}