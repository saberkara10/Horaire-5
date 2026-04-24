export async function isApplied({ connection, tools }) {
  const requirements = [
    ["resource_locks", "idx_resource_locks_user_id"],
    ["resource_locks", "idx_resource_locks_expires_at"],
    ["resource_locks", "idx_resource_locks_session_id"],
    ["resource_wait_queue", "idx_resource_wait_queue_resource_status"],
    ["resource_wait_queue", "idx_resource_wait_queue_user_id"],
    ["resource_wait_queue", "idx_resource_wait_queue_expires_at"],
    ["user_presence", "idx_user_presence_user_id"],
    ["user_presence", "idx_user_presence_last_activity"],
    ["user_presence", "idx_user_presence_status"],
  ];

  if (
    !(await tools.tableExists(connection, "resource_locks")) ||
    !(await tools.tableExists(connection, "resource_wait_queue")) ||
    !(await tools.tableExists(connection, "user_presence"))
  ) {
    return false;
  }

  for (const [tableName, indexName] of requirements) {
    if (!(await tools.indexExists(connection, tableName, indexName))) {
      return false;
    }
  }

  return true;
}

export async function up({ connection }) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS resource_locks (
      id_lock BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      resource_type VARCHAR(40) NOT NULL,
      resource_id VARCHAR(120) NOT NULL,
      user_id INT NULL,
      user_nom VARCHAR(100) NULL,
      user_prenom VARCHAR(100) NULL,
      user_role VARCHAR(255) NULL,
      session_id VARCHAR(128) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      metadata JSON NULL,
      PRIMARY KEY (id_lock),
      UNIQUE KEY uniq_resource_locks_resource (resource_type, resource_id),
      KEY idx_resource_locks_user_id (user_id),
      KEY idx_resource_locks_expires_at (expires_at),
      KEY idx_resource_locks_session_id (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS resource_wait_queue (
      id_queue BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      resource_type VARCHAR(40) NOT NULL,
      resource_id VARCHAR(120) NOT NULL,
      user_id INT NULL,
      user_nom VARCHAR(100) NULL,
      user_prenom VARCHAR(100) NULL,
      user_role VARCHAR(255) NULL,
      session_id VARCHAR(128) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'en_attente',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      activated_at DATETIME NULL,
      cancelled_at DATETIME NULL,
      expires_at DATETIME NULL,
      metadata JSON NULL,
      PRIMARY KEY (id_queue),
      UNIQUE KEY uniq_resource_wait_queue_waiting_user (resource_type, resource_id, user_id, status),
      KEY idx_resource_wait_queue_resource_status (resource_type, resource_id, status, requested_at),
      KEY idx_resource_wait_queue_user_id (user_id),
      KEY idx_resource_wait_queue_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS user_presence (
      id_presence BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      session_id VARCHAR(128) NOT NULL,
      user_id INT NULL,
      user_nom VARCHAR(100) NULL,
      user_prenom VARCHAR(100) NULL,
      user_email VARCHAR(255) NULL,
      user_role VARCHAR(255) NULL,
      connected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      current_module VARCHAR(100) NULL,
      current_page VARCHAR(255) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'actif',
      ip_address VARCHAR(80) NULL,
      user_agent TEXT NULL,
      PRIMARY KEY (id_presence),
      UNIQUE KEY uniq_user_presence_session (session_id),
      KEY idx_user_presence_user_id (user_id),
      KEY idx_user_presence_last_activity (last_activity_at),
      KEY idx_user_presence_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

export default { isApplied, up };
