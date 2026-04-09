/**
 * Middlewares d'authentification et d'autorisation.
 */

function getUser(request) {
  return request.user || request.session?.user || null;
}

function getUserRoles(user) {
  if (!user) {
    return [];
  }

  if (Array.isArray(user.roles)) {
    return user.roles;
  }

  if (typeof user.role === "string" && user.role.trim()) {
    return [user.role.trim()];
  }

  return [];
}

function utilisateurPossedeUnRole(request, rolesAutorises) {
  const roles = getUserRoles(getUser(request));
  return rolesAutorises.some((role) => roles.includes(role));
}

function refuserAcces(response, statusCode, message) {
  response.status(statusCode);

  if (typeof response.json === "function") {
    return response.json({ message });
  }

  return response.end();
}

export function userAuth(request, response, next) {
  if (getUser(request)) {
    return next();
  }

  return refuserAcces(response, 401, "Non authentifie.");
}

export function userNotAuth(request, response, next) {
  if (!getUser(request)) {
    return next();
  }

  return refuserAcces(response, 401, "Utilisateur deja authentifie.");
}

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

export function userAdminResponsable(request, response, next) {
  if (utilisateurPossedeUnRole(request, ["ADMIN_RESPONSABLE"])) {
    return next();
  }

  return refuserAcces(response, 401, "Acces reserve a l'Admin Responsable.");
}

export function userResponsable(request, response, next) {
  if (utilisateurPossedeUnRole(request, ["RESPONSABLE", "ADMIN_RESPONSABLE"])) {
    return next();
  }

  return refuserAcces(response, 401, "Acces reserve au responsable.");
}

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
