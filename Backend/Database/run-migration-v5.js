/**
 * run-migration-v5.js
 *
 * Migration v5:
 * - retire les affectations professeur_cours vers les cours archives
 *
 * Usage : node Database/run-migration-v5.js
 */
import pool from "../db.js";
import { nettoyerAffectationsCoursArchivesProfesseurs } from "../src/model/professeurs.model.js";

async function compterAffectationsVersCoursArchives(executor) {
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS total
     FROM professeur_cours pc
     INNER JOIN cours c
       ON c.id_cours = pc.id_cours
     WHERE COALESCE(c.archive, 0) = 1`
  );

  return Number(rows[0]?.total || 0);
}

const connection = await pool.getConnection();

console.log("Application de la migration v5...\n");

try {
  await connection.beginTransaction();

  const avant = await compterAffectationsVersCoursArchives(connection);
  const suppressions = await nettoyerAffectationsCoursArchivesProfesseurs(connection);
  const apres = await compterAffectationsVersCoursArchives(connection);

  await connection.commit();

  console.log("Migration v5 appliquee avec succes.");
  console.log(`   - Affectations archivees avant: ${avant}`);
  console.log(`   - Affectations supprimees: ${suppressions}`);
  console.log(`   - Affectations archivees apres: ${apres}`);
} catch (error) {
  await connection.rollback();
  console.error("Erreur migration v5:", error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
  console.log("\nTermine.");
}
