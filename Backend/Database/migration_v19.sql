-- =============================================================================
-- Migration v19 - Historique, versioning et restauration des generations
-- =============================================================================

CREATE TABLE IF NOT EXISTS schedule_generations (
  id_generation BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_session INT NOT NULL,
  version_number INT NOT NULL,
  generation_name VARCHAR(160) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT NULL,
  parent_generation_id BIGINT UNSIGNED NULL,
  restored_from_generation_id BIGINT UNSIGNED NULL,
  source_report_id INT NULL,
  source_kind VARCHAR(40) NOT NULL DEFAULT 'automatic_generation',
  optimization_mode VARCHAR(40) NULL,
  quality_score DECIMAL(7,2) NULL,
  conflict_count INT NOT NULL DEFAULT 0,
  placement_count INT NOT NULL DEFAULT 0,
  teacher_count INT NOT NULL DEFAULT 0,
  room_count INT NOT NULL DEFAULT 0,
  group_count INT NOT NULL DEFAULT 0,
  student_count INT NOT NULL DEFAULT 0,
  constraint_ok_count INT NOT NULL DEFAULT 0,
  constraint_warning_count INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  activated_at DATETIME NULL,
  archived_at DATETIME NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id_generation),
  UNIQUE KEY uniq_schedule_generations_session_version (id_session, version_number),
  KEY idx_schedule_generations_session_created (id_session, created_at),
  KEY idx_schedule_generations_status (status),
  KEY idx_schedule_generations_active (id_session, is_active),
  KEY idx_schedule_generations_created_by (created_by),
  CONSTRAINT fk_schedule_generations_session
    FOREIGN KEY (id_session) REFERENCES sessions (id_session),
  CONSTRAINT fk_schedule_generations_created_by
    FOREIGN KEY (created_by) REFERENCES utilisateurs (id_utilisateur)
      ON DELETE SET NULL
      ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_generations_parent
    FOREIGN KEY (parent_generation_id) REFERENCES schedule_generations (id_generation)
      ON DELETE SET NULL
      ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_generations_restored_from
    FOREIGN KEY (restored_from_generation_id) REFERENCES schedule_generations (id_generation)
      ON DELETE SET NULL
      ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_generations_report
    FOREIGN KEY (source_report_id) REFERENCES rapports_generation (id)
      ON DELETE SET NULL
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_generation_items (
  id_generation_item BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_generation BIGINT UNSIGNED NOT NULL,
  item_type VARCHAR(30) NOT NULL,
  comparison_key VARCHAR(255) NULL,
  item_order INT NOT NULL DEFAULT 0,
  id_cours INT NULL,
  id_professeur INT NULL,
  id_salle INT NULL,
  id_groupes_etudiants INT NULL,
  id_etudiant INT NULL,
  id_session INT NULL,
  source_type VARCHAR(30) NULL,
  date_cours DATE NULL,
  heure_debut TIME NULL,
  heure_fin TIME NULL,
  payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_generation_item),
  KEY idx_schedule_generation_items_generation (id_generation, item_type, item_order),
  KEY idx_schedule_generation_items_compare (id_generation, comparison_key),
  KEY idx_schedule_generation_items_course (id_cours),
  KEY idx_schedule_generation_items_group (id_groupes_etudiants),
  KEY idx_schedule_generation_items_student (id_etudiant),
  CONSTRAINT fk_schedule_generation_items_generation
    FOREIGN KEY (id_generation) REFERENCES schedule_generations (id_generation)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_generation_items_session
    FOREIGN KEY (id_session) REFERENCES sessions (id_session)
      ON DELETE SET NULL
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_generation_conflicts (
  id_generation_conflict BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_generation BIGINT UNSIGNED NOT NULL,
  conflict_category VARCHAR(40) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  conflict_code VARCHAR(100) NULL,
  label VARCHAR(255) NOT NULL,
  item_reference VARCHAR(255) NULL,
  payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_generation_conflict),
  KEY idx_schedule_generation_conflicts_generation (id_generation, conflict_category),
  KEY idx_schedule_generation_conflicts_code (conflict_code),
  CONSTRAINT fk_schedule_generation_conflicts_generation
    FOREIGN KEY (id_generation) REFERENCES schedule_generations (id_generation)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_generation_metrics (
  id_generation_metric BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_generation BIGINT UNSIGNED NOT NULL,
  metric_key VARCHAR(100) NOT NULL,
  metric_type VARCHAR(20) NOT NULL DEFAULT 'number',
  metric_numeric DECIMAL(12,2) NULL,
  metric_text VARCHAR(255) NULL,
  metric_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_generation_metric),
  UNIQUE KEY uniq_schedule_generation_metrics_key (id_generation, metric_key),
  KEY idx_schedule_generation_metrics_generation (id_generation),
  CONSTRAINT fk_schedule_generation_metrics_generation
    FOREIGN KEY (id_generation) REFERENCES schedule_generations (id_generation)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_generation_actions (
  id_generation_action BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_generation BIGINT UNSIGNED NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  performed_by INT NULL,
  action_note TEXT NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_generation_action),
  KEY idx_schedule_generation_actions_generation (id_generation, created_at),
  KEY idx_schedule_generation_actions_user (performed_by),
  CONSTRAINT fk_schedule_generation_actions_generation
    FOREIGN KEY (id_generation) REFERENCES schedule_generations (id_generation)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_generation_actions_user
    FOREIGN KEY (performed_by) REFERENCES utilisateurs (id_utilisateur)
      ON DELETE SET NULL
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
