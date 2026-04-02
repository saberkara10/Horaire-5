/**
 * Démarrage du serveur backend.
 *
 * Lance l'application Express sur le port défini
 * dans les variables d'environnement.
 */

import app from "./app.js";

/**
 * Port d'écoute du serveur.
 */
const PORT = process.env.PORT || 3000;

/**
 * Lancement du serveur HTTP.
 */
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
/**
 * SERVER - Demarrage HTTP
 *
 * Ce fichier demarre l'application Express
 * sur le port configure.
 */
