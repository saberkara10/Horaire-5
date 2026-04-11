/**
 * run-migration-v11.js
 *
 * Migration v11:
 * - ajoute la table des echanges cibles de cours entre etudiants
 * - rattache les affectations individuelles a un echange si besoin
 *
 * Usage : node Database/run-migration-v11.js
 */
import pool from "../db.js";
import { assurerSchemaSchedulerAcademique } from "../src/services/academic-scheduler-schema.js";

const connection = await pool.getConnection();

console.log("Application de la migration v11...\n");

try {
  await connection.beginTransaction();
  await assurerSchemaSchedulerAcademique(connection);
  await connection.commit();

  console.log("Migration v11 appliquee avec succes.");
  console.log("   - Table echanges_cours_etudiants creee.");
  console.log("   - Colonne id_echange_cours ajoutee a affectation_etudiants.");
  console.log("   - Les echanges cibles de cours sont maintenant tracables.");
} catch (error) {
  await connection.rollback();
  console.error("Erreur migration v11:", error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
  console.log("\nTermine.");
}
