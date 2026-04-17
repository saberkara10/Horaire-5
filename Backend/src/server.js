/**
 * Point d'entrée du serveur backend Express.
 *
 * Ce fichier fait une seule chose : démarrer le serveur HTTP sur le port
 * configuré dans les variables d'environnement (ou 3000 par défaut).
 * Toute la configuration de l'application (middlewares, routes, etc.)
 * est dans app.js — on sépare les deux pour faciliter les tests.
 *
 * Pourquoi séparer server.js et app.js ?
 * Parce que dans les tests automatisés, on importe app.js directement
 * sans démarrer un vrai serveur. Si tout était dans server.js, on ne
 * pourrait pas tester sans lancer l'application entière.
 *
 * @module server
 */

import app from "./app.js";

// Lire le port depuis .env, sinon utiliser 3000 en fallback.
// En production, ce sera généralement défini par l'hébergeur (ex: Heroku, Railway).
const PORT = process.env.PORT || 3000;

// Démarrer le serveur HTTP. Le callback confirme dans la console que tout est OK.
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
