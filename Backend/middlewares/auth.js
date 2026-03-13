/**
 * Middlewares d'authentification et d'autorisation.
 *
 * Ce module regroupe les middlewares qui contrôlent
 * l'accès aux routes selon l'état de connexion et
 * les rôles de l'utilisateur.
 */

/**
 * Middleware qui valide que l'utilisateur est connecté.
 * @param {import("express").Request} request Objet de requête HTTP.
 * @param {import("express").Response} response Objet de réponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function userAuth(request, response, next) {
    if (request.user) {
        return next();
    }

    response.status(401).end();
}

/**
 * Middleware qui valide que l'utilisateur n'est pas connecté.
 * @param {import("express").Request} request Objet de requête HTTP.
 * @param {import("express").Response} response Objet de réponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function userNotAuth(request, response, next) {
    if (!request.user) {
        return next();
    }

    response.status(401).end();
}

/**
 * Middleware qui valide que l'utilisateur possède le rôle ADMIN.
 * @param {import("express").Request} request Objet de requête HTTP.
 * @param {import("express").Response} response Objet de réponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function userAdmin(request, response, next) {
    if (request.user && request.user.roles.includes('ADMIN')) {
        return next();
    }

    response.status(401).end();
}

/**
 * Middleware qui valide que l'utilisateur possède le rôle RESPONSABLE.
 * @param {import("express").Request} request Objet de requête HTTP.
 * @param {import("express").Response} response Objet de réponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function userResponsable(request, response, next) {
    if (request.user && request.user.roles.includes('RESPONSABLE')) {
        return next();
    }

    response.status(401).end();
}