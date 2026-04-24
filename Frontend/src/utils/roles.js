/**
 * Helpers frontend pour verifier les roles de l'utilisateur.
 */

export function utilisateurEstResponsable(utilisateur) {
  const roles = Array.isArray(utilisateur?.roles) ? utilisateur.roles : [];

  return (
    roles.includes("RESPONSABLE") ||
    roles.includes("ADMIN_RESPONSABLE") ||
    utilisateur?.role === "RESPONSABLE" ||
    utilisateur?.role === "ADMIN_RESPONSABLE"
  );
}

export function utilisateurEstAdminResponsable(utilisateur) {
  const roles = Array.isArray(utilisateur?.roles) ? utilisateur.roles : [];

  return roles.includes("ADMIN_RESPONSABLE") || utilisateur?.role === "ADMIN_RESPONSABLE";
}


function normaliserRoles(source) {
  if (Array.isArray(source)) {
    return source.flatMap(normaliserRoles).filter(Boolean);
  }

  if (typeof source === "string") {
    return source
      .split(",")
      .map((role) => role.trim().toUpperCase())
      .filter(Boolean);
  }

  if (Array.isArray(source?.roles)) {
    return normaliserRoles(source.roles);
  }

  return source?.role ? normaliserRoles(source.role) : [];
}

export function getLibelleRoleFrontend(source) {
  const roles = normaliserRoles(source);

  if (roles.includes("RESPONSABLE") || roles.includes("ADMIN_RESPONSABLE")) {
    return "Administrateur";
  }

  if (roles.includes("ADMIN")) {
    return "Admin";
  }

  return "Utilisateur";
}
