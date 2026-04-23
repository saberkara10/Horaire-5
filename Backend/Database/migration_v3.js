/**
 * Logique d'optimisation de la migration v3.
 *
 * Role:
 * - garantit l'existence de l'index du scheduler sur `plages_horaires`
 *
 * Impact sur le projet:
 * - ameliore les performances sur les recherches de creneaux date/heure
 * - ajoute l'index `idx_plages_horaires_date_heure`
 */
export async function isApplied({ connection, tools }) {
  return tools.indexExists(
    connection,
    "plages_horaires",
    "idx_plages_horaires_date_heure"
  );
}

export async function up({ connection, tools }) {
  await tools.addIndexIfMissing(
    connection,
    "plages_horaires",
    "idx_plages_horaires_date_heure",
    `CREATE INDEX idx_plages_horaires_date_heure
     ON plages_horaires (date, heure_debut, heure_fin)`
  );
}
