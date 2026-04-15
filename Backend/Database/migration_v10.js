async function assurerTablePlanificationSeries(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS planification_series (
      id_planification_serie INT NOT NULL AUTO_INCREMENT,
      id_session INT NOT NULL,
      type_planification ENUM('groupe','reprise') NOT NULL DEFAULT 'groupe',
      recurrence ENUM('hebdomadaire','ponctuelle') NOT NULL DEFAULT 'hebdomadaire',
      date_debut DATE NOT NULL,
      date_fin DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id_planification_serie),
      KEY idx_planification_series_session (id_session),
      CONSTRAINT fk_planification_series_session
        FOREIGN KEY (id_session) REFERENCES sessions (id_session)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

export async function isApplied({ connection, tools }) {
  return (
    (await tools.tableExists(connection, "planification_series")) &&
    (await tools.columnExists(
      connection,
      "affectation_cours",
      "id_planification_serie"
    )) &&
    (await tools.indexExists(
      connection,
      "affectation_cours",
      "idx_affectation_cours_planification_serie"
    )) &&
    (await tools.constraintExists(
      connection,
      "affectation_cours",
      "fk_affectation_cours_planification_serie"
    ))
  );
}

export async function up({ connection, tools }) {
  await assurerTablePlanificationSeries(connection);

  await tools.addColumnIfMissing(
    connection,
    "affectation_cours",
    "id_planification_serie",
    "INT NULL AFTER id_plage_horaires"
  );
  await tools.addIndexIfMissing(
    connection,
    "affectation_cours",
    "idx_affectation_cours_planification_serie",
    `CREATE INDEX idx_affectation_cours_planification_serie
     ON affectation_cours (id_planification_serie)`
  );
  await tools.addConstraintIfMissing(
    connection,
    "affectation_cours",
    "fk_affectation_cours_planification_serie",
    `ALTER TABLE affectation_cours
     ADD CONSTRAINT fk_affectation_cours_planification_serie
     FOREIGN KEY (id_planification_serie)
     REFERENCES planification_series (id_planification_serie)
     ON DELETE SET NULL`
  );
}
