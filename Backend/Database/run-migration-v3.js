/**
 * run-migration-v3.js
 * 
 * Applique la migration v3 (indices et contraintes optimizer du scheduler).
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
  console.log("Migration v3 appliquée avec succès !");
  console.log("   - Contrainte UNIQUE sur plages_horaires (date, heure_debut, heure_fin)");
  console.log("   - Index d'optimisation sur affectation_cours, groupes_etudiants, cours_echoues...");
} catch (err) {
  console.error("Erreur migration v3:", err.message);
  // Certaines erreurs sont normales (duplicate column, etc.)
  if (err.message.includes("Duplicate") || err.message.includes("already exists")) {
    console.log("   (Certains éléments existaient déjà — c'est normal)");
  } else {
    process.exit(1);
  }
} finally {
  await conn.end();
  console.log("\n✅ Terminé.");
}
