/**
 * Middleware d'autorisation basé sur les rôles.
 *
 * @param {string[]} rolesAutorise - Liste des rôles autorisés pour accéder à la route
 *
 * Ce middleware vérifie que l'utilisateur connecté
 * possède au moins un des rôles requis.
 *
 * @returns {Function} Middleware Express qui retourne 403 si non autorisé
 */

export default function authorize(rolesAutorise) {
  return (req, res, next) => {
    // Récupération des rôles de l'utilisateur depuis la session
    const roles = req.session?.user?.roles || [];

    const autorise = roles.some(role =>
      rolesAutorise.includes(role)
    );

    // Si aucun rôle ne correspond, accès interdit
    if (!autorise) {
      return res.status(403).json({ message: "Accès interdit" });
    }

    next();
  };
}
