/**
 * run-migration-v10.js
 *
 * Migration v10:
 * - ajoute la table des series de planification
 * - rattache les affectations de cours a une recurrence optionnelle
 *
 * Usage : node Database/run-migration-v10.js
 */
import pool from "../db.js";
import { assurerSchemaSchedulerAcademique } from "../src/services/academic-scheduler-schema.js";

const connection = await pool.getConnection();

console.log("Application de la migration v10...\n");

try {
  await connection.beginTransaction();
  await assurerSchemaSchedulerAcademique(connection);
  await connection.commit();

  console.log("Migration v10 appliquee avec succes.");
  console.log(
    "   - Table planification_series creee."
  );
  console.log(
    "   - Colonne id_planification_serie ajoutee a affectation_cours."
  );
  console.log(
    "   - Replanification recurrente disponible pour la planification manuelle."
  );
} catch (error) {
  await connection.rollback();
  console.error("Erreur migration v10:", error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
  console.log("\nTermine.");
}
