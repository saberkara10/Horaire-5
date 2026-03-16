/**
 * Test de connexion à la base de données MySQL.
 *
 * Exécute une requête simple pour vérifier que
 * la connexion avec la base fonctionne correctement.
 */

import db from "./db.js";

/**
 * Fonction auto-exécutée pour tester la connexion MySQL.
 */
(async () => {
  try {
    await db.query("SELECT 1");
    console.log("Connexion MySQL OK");
    process.exit(0);
  } catch (err) {
    console.error("Erreur MySQL :", err.message);
    process.exit(1);
  }
})();
