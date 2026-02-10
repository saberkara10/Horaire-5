/**
 * Middleware d'authentification.
 *
 * Protège les routes nécessitant une connexion utilisateur.
 * Vérifie l'existence d'une session active.
 *
 * Utilisation :
 *   app.get("/protected", authRequired, (req, res) => { ... });
 *
 * @param {Request} req - Objet requête Express (contient req.session)
 * @param {Response} res - Objet réponse Express
 * @param {NextFunction} next - Fonction pour passer au middleware suivant
 * @returns {void} - Retourne 401 si non authentifié, sinon passe au suivant
 */

export default function authRequired(req, res, next) {
  // Vérification de l'existence de la session et de l'utilisateur
  if (!req.session?.user) {
    return res.status(401).json({ message: "Authentification requise" });
  }
  
 
  next();
}
