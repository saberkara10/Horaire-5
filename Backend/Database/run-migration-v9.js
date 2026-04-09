/**
 * Migration v9 — Ajout colonne email (optionnelle) sur etudiants
 * et correction du schéma pour la gestion des groupes.
 *
 * Lance : node Backend/Database/run-migration-v9.js
 */

import { createConnection } from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const conn = await createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "gdh5",
  port: Number(process.env.DB_PORT) || 3306,
});

console.log("[OK] Connexion BD réussie.\n");

async function step(label, sql) {
  try {
    await conn.query(sql);
    console.log(`  [OK]   ${label}`);
  } catch (err) {
    const ignorable = [
      "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME",
      "ER_TABLE_EXISTS_ERROR", "ER_FK_DUP_NAME",
      "ER_CANT_DROP_FIELD_OR_KEY",
    ];
    if (ignorable.includes(err.code) || err.message.includes("already exists") || err.message.includes("Duplicate")) {
      console.log(`  [SKIP] ${label} (déjà fait)`);
    } else {
      console.error(`  [ERR]  ${label}: ${err.message}`);
    }
  }
}

// 1. Ajouter email (optionnel) sur la table etudiants
await step(
  "etudiants: ADD COLUMN email",
  "ALTER TABLE etudiants ADD COLUMN email VARCHAR(150) NULL UNIQUE"
);

// 2. S'assurer que session et annee ont bien des valeurs par défaut sensées
await step(
  "etudiants: session par défaut",
  `UPDATE etudiants SET session = 'Automne' WHERE session IS NULL OR TRIM(session) = ''`
);
await step(
  "etudiants: annee par défaut",
  `UPDATE etudiants SET annee = 2026 WHERE annee IS NULL OR annee < 2000 OR annee > 2100`
);

// 3. Index de recherche sur email (si la colonne a été créée)
await step(
  "etudiants: INDEX email",
  "CREATE INDEX idx_etudiants_email ON etudiants(email)"
);

await conn.end();
console.log("\n[DONE] Migration v9 terminée.");
