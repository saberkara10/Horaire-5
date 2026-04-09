/**
 * run-migration-v8.js
 *
 * Migration v8:
 * - remplace l'unicite globale des groupes par une unicite par session
 * - ajoute les affectations individuelles etudiantes sur sections stables
 * - memorise le groupe de reprise choisi pour chaque cours echoue
 *
 * Usage : node Database/run-migration-v8.js
 */
import pool from "../db.js";
import { assurerSchemaSchedulerAcademique } from "../src/services/academic-scheduler-schema.js";

const connection = await pool.getConnection();

console.log("Application de la migration v8...\n");

try {
  await connection.beginTransaction();
  await assurerSchemaSchedulerAcademique(connection);
  await connection.commit();

  console.log("Migration v8 appliquee avec succes.");
  console.log(
    "   - Groupes uniques par session."
  );
  console.log(
    "   - Affectations individuelles etudiantes pretes pour les reprises."
  );
  console.log(
    "   - Lien stable entre cours echoue et groupe de reprise ajoute."
  );
} catch (error) {
  await connection.rollback();
  console.error("Erreur migration v8:", error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
  console.log("\nTermine.");
}
