/**
 * run-migration-v3.js
 *
 * Applique la migration v3 du scheduler.
 * Usage : node Database/run-migration-v3.js
 */

import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const sqlFile = join(__dirname, "migration_v3.sql");
const sql = readFileSync(sqlFile, "utf-8");

const conn = await createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "gdh5",
  port: Number(process.env.DB_PORT) || 3306,
  multipleStatements: true,
});

console.log("Application de la migration v3...\n");

try {
  await conn.query(sql);
  console.log("Migration v3 appliquee avec succes.");
  console.log("   - Index sur plages_horaires (date, heure_debut, heure_fin)");
  console.log("   - Plus de blocage artificiel sur plusieurs cours au meme creneau");
} catch (err) {
  console.error("Erreur migration v3:", err.message);

  if (err.message.includes("Duplicate") || err.message.includes("already exists")) {
    console.log("   (Certains elements existaient deja, c'est normal)");
  } else {
    process.exit(1);
  }
} finally {
  await conn.end();
  console.log("\nTermine.");
}
