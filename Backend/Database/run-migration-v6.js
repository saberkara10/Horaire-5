/**
 * run-migration-v6.js
 *
 * Migration v6:
 * - ajoute le journal des replanifications de disponibilites professeurs
 *
 * Usage : node Database/run-migration-v6.js
 */
import pool from "../db.js";
import { assurerTableJournalReplanificationsDisponibilites } from "../src/services/professeurs/availability-replanning-journal.js";

const connection = await pool.getConnection();

console.log("Application de la migration v6...\n");

try {
  await connection.beginTransaction();
  await assurerTableJournalReplanificationsDisponibilites(connection);
  await connection.commit();

  console.log("Migration v6 appliquee avec succes.");
  console.log(
    "   - Table journal_replanifications_disponibilites prete pour le suivi des replanifications."
  );
} catch (error) {
  await connection.rollback();
  console.error("Erreur migration v6:", error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
  console.log("\nTermine.");
}
