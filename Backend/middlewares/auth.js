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

function utilisateurPossedeUnRole(request, rolesAutorises) {
    const roles = Array.isArray(request.user?.roles) ? request.user.roles : [];
    return rolesAutorises.some((role) => roles.includes(role));
}

/**
 * Middleware qui valide que l'utilisateur possède le rôle ADMIN.
 * @param {import("express").Request} request Objet de requête HTTP.
 * @param {import("express").Response} response Objet de réponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function userAdmin(request, response, next) {
    if (request.user && utilisateurPossedeUnRole(request, ['ADMIN', 'RESPONSABLE'])) {
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
    if (request.user && utilisateurPossedeUnRole(request, ['RESPONSABLE'])) {
        return next();
    }

    response.status(401).end();
}

/**
 * Middleware qui valide que l'utilisateur possede le role ADMIN ou RESPONSABLE.
 * @param {import("express").Request} request Objet de requete HTTP.
 * @param {import("express").Response} response Objet de reponse HTTP.
 * @param {import("express").NextFunction} next Fonction pour passer au prochain middleware.
 */
export function userAdminOrResponsable(request, response, next) {
    if (utilisateurPossedeUnRole(request, ["ADMIN", "RESPONSABLE"])) {
        return next();
    }

    response.status(403).json({ message: "Acces refuse." });
}
