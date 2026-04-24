export async function isApplied({ connection, tools }) {
  const tables = [
    "schedule_generations",
    "schedule_generation_items",
    "schedule_generation_conflicts",
    "schedule_generation_metrics",
    "schedule_generation_actions",
  ];

  for (const tableName of tables) {
    if (!(await tools.tableExists(connection, tableName))) {
      return false;
    }
  }

  return (
    (await tools.indexExists(
      connection,
      "schedule_generations",
      "uniq_schedule_generations_session_version"
    )) &&
    (await tools.indexExists(
      connection,
      "schedule_generation_items",
      "idx_schedule_generation_items_compare"
    )) &&
    (await tools.indexExists(
      connection,
      "schedule_generation_conflicts",
      "idx_schedule_generation_conflicts_generation"
    )) &&
    (await tools.indexExists(
      connection,
      "schedule_generation_metrics",
      "uniq_schedule_generation_metrics_key"
    )) &&
    (await tools.indexExists(
      connection,
      "schedule_generation_actions",
      "idx_schedule_generation_actions_generation"
    ))
  );
}

export async function up({ executeSqlFile }) {
  await executeSqlFile();
}

export default { isApplied, up };
