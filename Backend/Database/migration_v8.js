async function assurerTableAffectationEtudiants(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS affectation_etudiants (
      id_affectation_etudiant INT NOT NULL AUTO_INCREMENT,
      id_etudiant INT NOT NULL,
      id_groupes_etudiants INT NOT NULL,
      id_cours INT NOT NULL,
      id_session INT NOT NULL,
      source_type ENUM('reprise','individuelle') NOT NULL DEFAULT 'individuelle',
      id_cours_echoue INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_affectation_etudiant),
      UNIQUE KEY uniq_affectation_etudiant_section (
        id_etudiant,
        id_groupes_etudiants,
        id_cours,
        id_session,
        source_type
      ),
      UNIQUE KEY uniq_affectation_etudiant_cours_echoue (id_cours_echoue),
      KEY idx_affectation_etudiants_groupe (id_groupes_etudiants),
      KEY idx_affectation_etudiants_session (id_session),
      KEY idx_affectation_etudiants_cours (id_cours),
      CONSTRAINT fk_affectation_etudiants_etudiant
        FOREIGN KEY (id_etudiant) REFERENCES etudiants (id_etudiant)
        ON DELETE CASCADE,
      CONSTRAINT fk_affectation_etudiants_groupe
        FOREIGN KEY (id_groupes_etudiants) REFERENCES groupes_etudiants (id_groupes_etudiants)
        ON DELETE CASCADE,
      CONSTRAINT fk_affectation_etudiants_cours
        FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
        ON DELETE CASCADE,
      CONSTRAINT fk_affectation_etudiants_session
        FOREIGN KEY (id_session) REFERENCES sessions (id_session)
        ON DELETE CASCADE,
      CONSTRAINT fk_affectation_etudiants_cours_echoue
        FOREIGN KEY (id_cours_echoue) REFERENCES cours_echoues (id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function assurerContraintesAffectationEtudiants(connection, tools) {
  await tools.addIndexIfMissing(
    connection,
    "affectation_etudiants",
    "idx_affectation_etudiants_groupe",
    `CREATE INDEX idx_affectation_etudiants_groupe
     ON affectation_etudiants (id_groupes_etudiants)`
  );
  await tools.addIndexIfMissing(
    connection,
    "affectation_etudiants",
    "idx_affectation_etudiants_session",
    `CREATE INDEX idx_affectation_etudiants_session
     ON affectation_etudiants (id_session)`
  );
  await tools.addIndexIfMissing(
    connection,
    "affectation_etudiants",
    "idx_affectation_etudiants_cours",
    `CREATE INDEX idx_affectation_etudiants_cours
     ON affectation_etudiants (id_cours)`
  );
  await tools.addIndexIfMissing(
    connection,
    "affectation_etudiants",
    "uniq_affectation_etudiant_section",
    `ALTER TABLE affectation_etudiants
     ADD UNIQUE KEY uniq_affectation_etudiant_section (
       id_etudiant,
       id_groupes_etudiants,
       id_cours,
       id_session,
       source_type
     )`
  );
  await tools.addIndexIfMissing(
    connection,
    "affectation_etudiants",
    "uniq_affectation_etudiant_cours_echoue",
    `ALTER TABLE affectation_etudiants
     ADD UNIQUE KEY uniq_affectation_etudiant_cours_echoue (id_cours_echoue)`
  );

  await tools.addConstraintIfMissing(
    connection,
    "affectation_etudiants",
    "fk_affectation_etudiants_etudiant",
    `ALTER TABLE affectation_etudiants
     ADD CONSTRAINT fk_affectation_etudiants_etudiant
     FOREIGN KEY (id_etudiant) REFERENCES etudiants (id_etudiant)
     ON DELETE CASCADE`
  );
  await tools.addConstraintIfMissing(
    connection,
    "affectation_etudiants",
    "fk_affectation_etudiants_groupe",
    `ALTER TABLE affectation_etudiants
     ADD CONSTRAINT fk_affectation_etudiants_groupe
     FOREIGN KEY (id_groupes_etudiants) REFERENCES groupes_etudiants (id_groupes_etudiants)
     ON DELETE CASCADE`
  );
  await tools.addConstraintIfMissing(
    connection,
    "affectation_etudiants",
    "fk_affectation_etudiants_cours",
    `ALTER TABLE affectation_etudiants
     ADD CONSTRAINT fk_affectation_etudiants_cours
     FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
     ON DELETE CASCADE`
  );
  await tools.addConstraintIfMissing(
    connection,
    "affectation_etudiants",
    "fk_affectation_etudiants_session",
    `ALTER TABLE affectation_etudiants
     ADD CONSTRAINT fk_affectation_etudiants_session
     FOREIGN KEY (id_session) REFERENCES sessions (id_session)
     ON DELETE CASCADE`
  );
  await tools.addConstraintIfMissing(
    connection,
    "affectation_etudiants",
    "fk_affectation_etudiants_cours_echoue",
    `ALTER TABLE affectation_etudiants
     ADD CONSTRAINT fk_affectation_etudiants_cours_echoue
     FOREIGN KEY (id_cours_echoue) REFERENCES cours_echoues (id)
     ON DELETE SET NULL`
  );
}

async function assurerCoursEchouesEvolution(connection, tools) {
  await tools.addColumnIfMissing(
    connection,
    "cours_echoues",
    "id_groupe_reprise",
    "INT NULL"
  );
  await tools.addIndexIfMissing(
    connection,
    "cours_echoues",
    "idx_cours_echoues_groupe_reprise",
    `CREATE INDEX idx_cours_echoues_groupe_reprise
     ON cours_echoues (id_groupe_reprise)`
  );
  await tools.addConstraintIfMissing(
    connection,
    "cours_echoues",
    "fk_cours_echoues_groupe_reprise",
    `ALTER TABLE cours_echoues
     ADD CONSTRAINT fk_cours_echoues_groupe_reprise
     FOREIGN KEY (id_groupe_reprise) REFERENCES groupes_etudiants (id_groupes_etudiants)
     ON DELETE SET NULL`
  );
}

async function assurerIndexGroupesParSession(connection, tools) {
  const indexes = await tools.getIndexes(connection, "groupes_etudiants");
  const indexNames = [...new Set(indexes.map((index) => index.index_name))];

  for (const indexName of indexNames) {
    const index = tools.findIndex(indexes, indexName);
    if (
      index &&
      index.unique &&
      index.columns.length === 1 &&
      index.columns[0] === "nom_groupe"
    ) {
      await tools.dropIndexIfExists(connection, "groupes_etudiants", indexName);
    }
  }

  await tools.addIndexIfMissing(
    connection,
    "groupes_etudiants",
    "idx_groupes_nom_groupe",
    `CREATE INDEX idx_groupes_nom_groupe
     ON groupes_etudiants (nom_groupe)`
  );
  await tools.addIndexIfMissing(
    connection,
    "groupes_etudiants",
    "uniq_groupes_session_nom",
    `CREATE UNIQUE INDEX uniq_groupes_session_nom
     ON groupes_etudiants (id_session, nom_groupe)`
  );
}

export async function isApplied({ connection, tools }) {
  return (
    (await tools.tableExists(connection, "affectation_etudiants")) &&
    (await tools.columnExists(connection, "cours_echoues", "id_groupe_reprise")) &&
    (await tools.indexExists(
      connection,
      "affectation_etudiants",
      "uniq_affectation_etudiant_section"
    )) &&
    (await tools.constraintExists(
      connection,
      "cours_echoues",
      "fk_cours_echoues_groupe_reprise"
    )) &&
    (await tools.indexExists(connection, "groupes_etudiants", "uniq_groupes_session_nom"))
  );
}

export async function up({ connection, tools }) {
  await assurerTableAffectationEtudiants(connection);
  await assurerContraintesAffectationEtudiants(connection, tools);
  await assurerCoursEchouesEvolution(connection, tools);
  await assurerIndexGroupesParSession(connection, tools);
}
