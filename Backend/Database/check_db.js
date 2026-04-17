/**
 * Script manuel de diagnostic lecture seule de la base.
 *
 * Role:
 * - charge Backend/.env
 * - ouvre une connexion MySQL
 * - affiche un petit etat des tables clefs pour verification manuelle
 *
 * Impact sur le projet:
 * - ce fichier n'ajoute aucun changement de schema
 * - il sert uniquement d'outil local d'inspection pour les developpeurs
 */
import { createConnection } from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: join(__dirname, "../.env"),
  quiet: true,
});

const connection = await createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "gdh5",
  port: Number(process.env.DB_PORT) || 3306,
});

console.log("Verification lecture seule de la base en cours...");

const [users] = await connection.query(
  "SELECT id_utilisateur, email, role, actif FROM utilisateurs ORDER BY id_utilisateur ASC"
);
console.log("Utilisateurs:", JSON.stringify(users));

const [sessions] = await connection.query(
  "SELECT id_session, nom, date_debut, date_fin, active FROM sessions ORDER BY id_session ASC"
);
console.log("Sessions:", JSON.stringify(sessions));

const [reports] = await connection.query(
  "SELECT COUNT(*) AS n FROM rapports_generation"
);
console.log("Rapports:", JSON.stringify(reports));

await connection.end();
console.log("\nBase de donnees OK !");
