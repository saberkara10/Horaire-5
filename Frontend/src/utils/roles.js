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

function normaliserRoles(source) {
  if (Array.isArray(source)) {
    return source.filter(Boolean);
  }

  if (typeof source === "string") {
    return source ? [source] : [];
  }

  if (Array.isArray(source?.roles)) {
    return source.roles.filter(Boolean);
  }

  return source?.role ? [source.role] : [];
}

export function getLibelleRoleFrontend(source) {
  const roles = normaliserRoles(source);

  if (
    roles.includes("ADMIN") ||
    roles.includes("RESPONSABLE") ||
    roles.includes("ADMIN_RESPONSABLE")
  ) {
    return "Administrateur";
  }

  return "Utilisateur";
}
