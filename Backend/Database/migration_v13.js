/**
 * Migration v13 - module help.
 *
 * Cette migration introduit:
 * - help_categories
 * - help_videos
 * - le stockage relatif des medias du centre d'aide
 */

export async function isApplied({ connection, tools }) {
  const hasCategoriesTable = await tools.tableExists(connection, "help_categories");
  const hasVideosTable = await tools.tableExists(connection, "help_videos");

  if (!hasCategoriesTable || !hasVideosTable) {
    return false;
  }

  const requiredColumns = [
    ["help_categories", "display_order"],
    ["help_categories", "is_active"],
    ["help_videos", "video_path"],
    ["help_videos", "thumbnail_path"],
    ["help_videos", "keywords_json"],
    ["help_videos", "module_key"],
    ["help_videos", "display_order"],
    ["help_videos", "is_active"],
    ["help_videos", "is_published"],
  ];

  for (const [tableName, columnName] of requiredColumns) {
    if (!(await tools.columnExists(connection, tableName, columnName))) {
      return false;
    }
  }

  const requiredIndexes = [
    ["help_categories", "idx_help_categories_active_order"],
    ["help_videos", "uq_help_videos_slug"],
    ["help_videos", "idx_help_videos_active"],
    ["help_videos", "idx_help_videos_module_key"],
  ];

  for (const [tableName, indexName] of requiredIndexes) {
    if (!(await tools.indexExists(connection, tableName, indexName))) {
      return false;
    }
  }

  return tools.constraintExists(
    connection,
    "help_videos",
    "fk_help_videos_category"
  );
}

export async function up(context) {
  context.log("Creation du schema help...");
  await context.executeSqlFile();
  context.log("Schema help cree.");
}
