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
