/**
 * Connexion à la base de données MySQL.
 *
 * Ce fichier crée et exporte un pool de connexions partagé entre tous
 * les modules backend. Un pool, c'est un groupe de connexions déjà ouvertes
 * qu'on réutilise plutôt que d'en créer une nouvelle à chaque requête.
 * C'est beaucoup plus performant et ça évite de saturer MySQL.
 *
 * Les informations de connexion (hôte, mot de passe, etc.) viennent du
 * fichier .env situé dans le dossier Backend. Ne jamais écrire ces valeurs
 * directement dans le code source.
 *
 * @module db
 */

import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";

// En ESModules, __dirname n'existe pas nativement — on le recrée manuellement
// à partir de l'URL du fichier courant. C'est le pattern standard.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement depuis Backend/.env
// L'option "quiet: true" évite d'afficher une erreur si le .env est absent
// en développement local (par exemple sur un serveur CI).
dotenv.config({
  path: path.join(__dirname, ".env"),
  quiet: true,
});

/**
 * Pool de connexions MySQL partagé pour toute l'application.
 *
 * Configuration choisie :
 *  - waitForConnections: true  → si toutes les connexions sont occupées,
 *    la requête attend plutôt que de planter immédiatement.
 *  - connectionLimit: 10       → maximum 10 connexions simultanées à MySQL.
 *    Au-delà, les requêtes attendent. Ajuster selon la charge réelle.
 *  - queueLimit: 0             → file d'attente illimitée (0 = pas de limite).
 *    En production avec fort trafic, mettre une limite pour éviter la saturation.
 *
 * @type {import("mysql2/promise").Pool}
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306), // 3306 = port MySQL par défaut
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export default pool;
