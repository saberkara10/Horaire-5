/**
 * UTILS - Roles
 *
 * Ce module fournit les helpers
 * de detection des roles utilisateurs.
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
