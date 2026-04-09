/**
 * run-migration-v7.js
 *
 * Migration v7:
 * - ajoute les colonnes date_debut_effet / date_fin_effet
 *   sur les disponibilites professeurs
 * - migre les disponibilites existantes vers des plages datees
 *
 * Usage : node Database/run-migration-v7.js
 */
import pool from "../db.js";
import { assurerTableDisponibilitesProfesseurs } from "../src/model/professeurs.model.js";

async function compterDisponibilitesSansEffet(executor) {
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS total
     FROM disponibilites_professeurs
     WHERE date_debut_effet IS NULL
        OR date_fin_effet IS NULL`
  );

  return Number(rows[0]?.total || 0);
}

const connection = await pool.getConnection();

console.log("Application de la migration v7...\n");

try {
  await connection.beginTransaction();

  let avant = 0;

  try {
    avant = await compterDisponibilitesSansEffet(connection);
  } catch {
    avant = 0;
  }

  await assurerTableDisponibilitesProfesseurs(connection);

  const apres = await compterDisponibilitesSansEffet(connection);

  await connection.commit();

  console.log("Migration v7 appliquee avec succes.");
  console.log(
    "   - Table disponibilites_professeurs etendue avec des plages d'effet datees."
  );
  console.log(`   - Lignes sans date d'effet avant migration: ${avant}`);
  console.log(`   - Lignes sans date d'effet apres migration: ${apres}`);
} catch (error) {
  await connection.rollback();
  console.error("Erreur migration v7:", error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
  console.log("\nTermine.");
}
