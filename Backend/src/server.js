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
import https from "node:https";
import { readFile } from "node:fs/promises";

// Lire le port depuis .env, sinon utiliser 3000 en fallback.
// En production, ce sera généralement défini par l'hébergeur (ex: Heroku, Railway).
const PORT = process.env.PORT || 3000;

const credentials = {
  key: await readFile("./security/localhost.key"),
  cert: await readFile("./security/localhost.cert"),
};

https.createServer(credentials, app).listen(PORT, () => {
  console.log(`Serveur HTTPS lancé sur https://localhost:${PORT}`);
});
