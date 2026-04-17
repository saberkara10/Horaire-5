/**
 * Middlewares d'authentification et d'autorisation.
 *
 * Ce fichier regroupe toutes les fonctions middleware qui protègent les routes.
 * Chaque middleware suit le même schéma Express : (req, res, next).
 *   - Si la vérification passe → on appelle next() pour passer à la suite.
 *   - Si elle échoue → on renvoie une erreur HTTP sans appeler next().
 *
 * Hiérarchie des rôles dans ce projet :
 *   ADMIN            → gestion technique et configuration
 *   RESPONSABLE      → gestion pédagogique (programmes, groupes)
 *   ADMIN_RESPONSABLE → cumule les deux rôles ci-dessus
 *
 * @module middlewares/auth
 */

/**
 * Récupère l'utilisateur connecté depuis la requête.
 *
 * On vérifie deux endroits : req.user (Passport) et req.session.user
 * (au cas où certains modules stockeraient l'utilisateur différemment).
 * Retourne null si personne n'est connecté.
 *
 * @param {import("express").Request} request - La requête Express entrante
 * @returns {object|null} L'objet utilisateur ou null si non connecté
 */
function getUser(request) {
  return request.user || request.session?.user || null;
}

/**
 * Récupère la liste des rôles d'un utilisateur.
 *
 * Gère deux formats possibles :
 *  - user.roles → tableau de chaînes (format standard de Passport après deserializeUser)
 *  - user.role  → chaîne simple (format alternatif possible dans certains contextes)
 *
 * Si aucun rôle n'est trouvé, retourne un tableau vide pour éviter les erreurs.
 *
 * @param {object|null} user - L'objet utilisateur
 * @returns {string[]} Liste des rôles (peut être vide, jamais null)
 */
function getUserRoles(user) {
  if (!user) {
    return [];
  }

  // Format principal : tableau de rôles (ex: ["ADMIN", "RESPONSABLE"])
  if (Array.isArray(user.roles)) {
    return user.roles;
  }

  // Format secondaire : rôle unique comme chaîne (ex: "ADMIN")
  if (typeof user.role === "string" && user.role.trim()) {
    return [user.role.trim()];
  }

  return [];
}

/**
 * Vérifie si l'utilisateur courant possède au moins un des rôles autorisés.
 *
 * @param {import("express").Request} request - La requête Express
 * @param {string[]} rolesAutorises - Les rôles acceptés (un seul suffit)
 * @returns {boolean} true si l'utilisateur a le droit, false sinon
 */
function utilisateurPossedeUnRole(request, rolesAutorises) {
  const roles = getUserRoles(getUser(request));
  return rolesAutorises.some((role) => roles.includes(role));
}

/**
 * Envoie une réponse de refus HTTP avec un message d'erreur.
 *
 * Si le serveur peut envoyer du JSON, il le fait.
 * Sinon, il termine la réponse sans corps (cas des tests ou des streams HTTP).
 *
 * @param {import("express").Response} response - La réponse Express
 * @param {number} statusCode - Le code HTTP à retourner (401, 403, etc.)
 * @param {string} message - Le message d'erreur à inclure dans la réponse
 */
function refuserAcces(response, statusCode, message) {
  response.status(statusCode);

  if (typeof response.json === "function") {
    return response.json({ message });
  }

  return response.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// Middlewares exportés — à utiliser dans les routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware : vérifie que l'utilisateur est connecté.
 *
 * À placer en premier sur toute route qui requiert une connexion.
 * Si l'utilisateur n'est pas authentifié, on retourne 401 immédiatement.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next - Passage au middleware suivant si OK
 */
export function userAuth(request, response, next) {
  if (getUser(request)) {
    return next();
  }

  return refuserAcces(response, 401, "Non authentifie.");
}

/**
 * Middleware : vérifie que l'utilisateur N'EST PAS connecté.
 *
 * Utile pour bloquer l'accès à /login si on est déjà connecté —
 * évite une double connexion accidentelle.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export function userNotAuth(request, response, next) {
  if (!getUser(request)) {
    return next();
  }

  return refuserAcces(response, 401, "Utilisateur deja authentifie.");
}

/**
 * Middleware : vérifie que l'utilisateur a un rôle administrateur.
 *
 * Les rôles ADMIN, RESPONSABLE et ADMIN_RESPONSABLE sont tous considérés
 * comme des "admins" dans ce contexte — ils peuvent accéder aux données
 * de configuration du système.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export function userAdmin(request, response, next) {
  if (
    utilisateurPossedeUnRole(request, [
      "ADMIN",
      "RESPONSABLE",
      "ADMIN_RESPONSABLE",
    ])
  ) {
    return next();
  }

  return refuserAcces(response, 401, "Acces reserve aux administrateurs.");
}

/**
 * Middleware : vérifie que l'utilisateur a le rôle ADMIN_RESPONSABLE uniquement.
 *
 * Ce rôle cumule ADMIN et RESPONSABLE. Il donne accès aux fonctions les plus
 * sensibles comme la gestion des comptes utilisateurs.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export function userAdminResponsable(request, response, next) {
  if (utilisateurPossedeUnRole(request, ["ADMIN_RESPONSABLE"])) {
    return next();
  }

  return refuserAcces(response, 401, "Acces reserve a l'Admin Responsable.");
}

/**
 * Middleware : vérifie que l'utilisateur a un rôle pédagogique (responsable).
 *
 * Donne accès aux actions liées aux programmes, groupes et planning.
 * Les rôles RESPONSABLE et ADMIN_RESPONSABLE sont acceptés.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export function userResponsable(request, response, next) {
  if (utilisateurPossedeUnRole(request, ["RESPONSABLE", "ADMIN_RESPONSABLE"])) {
    return next();
  }

  return refuserAcces(response, 401, "Acces reserve au responsable.");
}

/**
 * Middleware : autorise l'accès aux administrateurs ET aux responsables.
 *
 * Version moins restrictive que userAdmin — retourne 403 (Forbidden)
 * plutôt que 401 (Unauthorized), ce qui est sémantiquement plus correct
 * pour un utilisateur connecté mais sans le bon rôle.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export function userAdminOrResponsable(request, response, next) {
  if (
    utilisateurPossedeUnRole(request, [
      "ADMIN",
      "RESPONSABLE",
      "ADMIN_RESPONSABLE",
    ])
  ) {
    return next();
  }

  return refuserAcces(response, 403, "Acces refuse.");
}
