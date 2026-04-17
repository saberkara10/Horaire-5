/**
 * Logique de nettoyage de la migration v5.
 *
 * Role:
 * - supprime les liaisons obsoletes professeur/cours vers des cours archives
 *
 * Impact sur le projet:
 * - garde `professeur_cours` aligne avec les donnees d'enseignement actives
 * - reduit le bruit et les relations perimees dans les fonctions d'affectation
 */
async function compterAffectationsArchives(connection) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM professeur_cours pc
     INNER JOIN cours c
       ON c.id_cours = pc.id_cours
     WHERE COALESCE(c.archive, 0) = 1`
  );

  return Number(rows[0]?.total || 0);
}

export async function isApplied({ connection }) {
  return (await compterAffectationsArchives(connection)) === 0;
}

export async function up({ connection, tools }) {
  await tools.withTransaction(connection, async () => {
    await connection.query(
      `DELETE pc
       FROM professeur_cours pc
       INNER JOIN cours c
         ON c.id_cours = pc.id_cours
       WHERE COALESCE(c.archive, 0) = 1`
    );
  });
}
