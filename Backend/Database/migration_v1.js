/**
 * Logique d'initialisation de la migration v1.
 *
 * Role:
 * - verifie que le schema canonique de base existe
 * - execute `migration_v1.sql` quand le projet part d'une base vide
 *
 * Impact sur le projet:
 * - cree le premier schema fonctionnel de GDH5
 * - installe les tables coeur requises par l'application
 */
const REQUIRED_TABLES = [
  "utilisateurs",
  "salles",
  "groupes_etudiants",
  "professeurs",
  "programmes_reference",
  "plages_horaires",
  "cours",
  "etudiants",
  "disponibilites_professeurs",
  "professeur_cours",
  "affectation_cours",
  "affectation_groupes",
];

export async function isApplied({ connection, tools }) {
  for (const tableName of REQUIRED_TABLES) {
    if (!(await tools.tableExists(connection, tableName))) {
      return false;
    }
  }

  return true;
}

export async function up(context) {
  await context.executeSqlFile();
}
