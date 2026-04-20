/**
 * Utilitaires de vérification des rôles utilisateurs (côté frontend).
 *
 * Ce module expose des helpers simples pour vérifier les droits d'accès
 * dans les composants React, sans avoir à dupliquer la logique de rôle partout.
 *
 * Gère deux formats possibles selon la version d'authentification :
 *  - user.roles → tableau de chaînes (format principal Passport)
 *  - user.role  → chaîne simple (format legacy)
 *
 * @module utils/roles
 */

/**
 * Vérifie si un utilisateur a le rôle de "responsable" (ou supérieur).
 *
 * Retourne true pour les rôles RESPONSABLE et ADMIN_RESPONSABLE,
 * qui donnent accès aux actions pédagogiques (groupes, horaires, programmes).
 *
 * Gère les deux formats de stockage de rôle pour la compatibilité :
 *  - user.roles = ["RESPONSABLE"]      (format Passport moderne)
 *  - user.role = "RESPONSABLE"         (format legacy)
 *
 * @param {object|null|undefined} utilisateur - L'objet utilisateur courant (req.user ou state)
 * @returns {boolean} true si l'utilisateur est responsable ou admin-responsable
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
