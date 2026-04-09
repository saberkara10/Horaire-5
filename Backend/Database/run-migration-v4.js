/**
 * run-migration-v4.js
 *
 * Migration v4:
 * - fusionne les professeurs en doublon sur prenom + nom
 * - ajoute une contrainte unique sur (nom, prenom)
 *
 * Usage : node Database/run-migration-v4.js
 */
import pool from "../db.js";
import {
  assurerUniciteNomPrenomProfesseurs,
  fusionnerDoublonsProfesseurs,
} from "../src/model/professeurs.model.js";

async function compterDoublonsProfesseurs(executor) {
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS total
     FROM (
       SELECT LOWER(TRIM(nom)) AS nom_normalise,
              LOWER(TRIM(prenom)) AS prenom_normalise
       FROM professeurs
       GROUP BY LOWER(TRIM(nom)), LOWER(TRIM(prenom))
       HAVING COUNT(*) > 1
     ) AS doublons`
  );

  return Number(rows[0]?.total || 0);
}

const connection = await pool.getConnection();

console.log("Application de la migration v4...\n");

try {
  await connection.beginTransaction();

  const doublonsAvant = await compterDoublonsProfesseurs(connection);
  const fusion = await fusionnerDoublonsProfesseurs(connection);
  await assurerUniciteNomPrenomProfesseurs(connection);
  const doublonsApres = await compterDoublonsProfesseurs(connection);

  await connection.commit();

  console.log("Migration v4 appliquee avec succes.");
  console.log(`   - Doublons avant: ${doublonsAvant}`);
  console.log(`   - Groupes fusionnes: ${fusion.groupesFusionnes}`);
  console.log(`   - Professeurs fusionnes: ${fusion.professeursFusionnes}`);
  console.log(`   - Doublons apres: ${doublonsApres}`);
} catch (error) {
  await connection.rollback();
  console.error("Erreur migration v4:", error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
  console.log("\nTermine.");
}
