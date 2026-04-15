export async function isApplied({ connection, tools }) {
  return tools.tableExists(
    connection,
    "journal_replanifications_disponibilites"
  );
}

export async function up(context) {
  await context.executeSqlFile();
}
