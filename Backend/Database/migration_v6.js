/**
 * Logique d'initialisation du journal pour la migration v6.
 *
 * Role:
 * - cree la table d'audit utilisee apres replanification liee aux disponibilites
 *
 * Impact sur le projet:
 * - ajoute `journal_replanifications_disponibilites`
 * - rend tracables les replanifications dues aux disponibilites des professeurs
 */
export async function isApplied({ connection, tools }) {
  return tools.tableExists(
    connection,
    "journal_replanifications_disponibilites"
  );
}

export async function up(context) {
  await context.executeSqlFile();
}
