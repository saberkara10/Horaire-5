/**
 * Configuration de la base de données MySQL.
 *
 * Gère la connexion à la base `gestion_horaires`
 * via un pool de connexions sécurisé.
 *
 * Les paramètres de connexion sont définis
 * dans le fichier .env.
 */

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

/**
 * Pool de connexions MySQL.
 * Utilisé par le serveur Node.js pour accéder
 * aux données du projet.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
