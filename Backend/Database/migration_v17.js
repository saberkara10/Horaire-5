export async function isApplied({ connection, tools }) {
  return (
    (await tools.tableExists(connection, "activity_logs")) &&
    (await tools.indexExists(
      connection,
      "activity_logs",
      "idx_activity_logs_created_at"
    )) &&
    (await tools.indexExists(connection, "activity_logs", "idx_activity_logs_user_id")) &&
    (await tools.indexExists(
      connection,
      "activity_logs",
      "idx_activity_logs_action_type"
    )) &&
    (await tools.indexExists(connection, "activity_logs", "idx_activity_logs_module")) &&
    (await tools.indexExists(connection, "activity_logs", "idx_activity_logs_status"))
  );
}

export async function up({ connection }) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id_log BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NULL,
      user_name VARCHAR(255) NULL,
      user_role VARCHAR(255) NULL,
      action_type VARCHAR(40) NOT NULL,
      module VARCHAR(100) NOT NULL,
      target_type VARCHAR(100) NULL,
      target_id VARCHAR(100) NULL,
      description TEXT NOT NULL,
      old_value JSON NULL,
      new_value JSON NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
      error_message TEXT NULL,
      ip_address VARCHAR(80) NULL,
      user_agent TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_log),
      INDEX idx_activity_logs_created_at (created_at),
      INDEX idx_activity_logs_user_id (user_id),
      INDEX idx_activity_logs_action_type (action_type),
      INDEX idx_activity_logs_module (module),
      INDEX idx_activity_logs_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

export default { isApplied, up };
