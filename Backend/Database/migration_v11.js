async function assurerTableEchangesCoursEtudiants(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS echanges_cours_etudiants (
      id_echange_cours INT NOT NULL AUTO_INCREMENT,
      id_session INT NOT NULL,
      id_cours INT NOT NULL,
      id_etudiant_a INT NOT NULL,
      id_groupe_a_avant INT NOT NULL,
      id_groupe_a_apres INT NOT NULL,
      id_etudiant_b INT NOT NULL,
      id_groupe_b_avant INT NOT NULL,
      id_groupe_b_apres INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id_echange_cours),
      KEY idx_echanges_cours_session (id_session),
      KEY idx_echanges_cours_cours (id_cours),
      KEY idx_echanges_cours_etudiant_a (id_etudiant_a),
      KEY idx_echanges_cours_etudiant_b (id_etudiant_b),
      CONSTRAINT fk_echanges_cours_session
        FOREIGN KEY (id_session) REFERENCES sessions (id_session)
        ON DELETE CASCADE,
      CONSTRAINT fk_echanges_cours_cours
        FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
        ON DELETE CASCADE,
      CONSTRAINT fk_echanges_cours_etudiant_a
        FOREIGN KEY (id_etudiant_a) REFERENCES etudiants (id_etudiant)
        ON DELETE CASCADE,
      CONSTRAINT fk_echanges_cours_etudiant_b
        FOREIGN KEY (id_etudiant_b) REFERENCES etudiants (id_etudiant)
        ON DELETE CASCADE,
      CONSTRAINT fk_echanges_cours_groupe_a_avant
        FOREIGN KEY (id_groupe_a_avant) REFERENCES groupes_etudiants (id_groupes_etudiants)
        ON DELETE CASCADE,
      CONSTRAINT fk_echanges_cours_groupe_a_apres
        FOREIGN KEY (id_groupe_a_apres) REFERENCES groupes_etudiants (id_groupes_etudiants)
        ON DELETE CASCADE,
      CONSTRAINT fk_echanges_cours_groupe_b_avant
        FOREIGN KEY (id_groupe_b_avant) REFERENCES groupes_etudiants (id_groupes_etudiants)
        ON DELETE CASCADE,
      CONSTRAINT fk_echanges_cours_groupe_b_apres
        FOREIGN KEY (id_groupe_b_apres) REFERENCES groupes_etudiants (id_groupes_etudiants)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

export async function isApplied({ connection, tools }) {
  return (
    (await tools.tableExists(connection, "echanges_cours_etudiants")) &&
    (await tools.columnExists(
      connection,
      "affectation_etudiants",
      "id_echange_cours"
    )) &&
    (await tools.indexExists(
      connection,
      "affectation_etudiants",
      "idx_affectation_etudiants_echange_cours"
    )) &&
    (await tools.constraintExists(
      connection,
      "affectation_etudiants",
      "fk_affectation_etudiants_echange_cours"
    ))
  );
}

export async function up({ connection, tools }) {
  await assurerTableEchangesCoursEtudiants(connection);

  await tools.addColumnIfMissing(
    connection,
    "affectation_etudiants",
    "id_echange_cours",
    "INT NULL AFTER id_cours_echoue"
  );
  await tools.addIndexIfMissing(
    connection,
    "affectation_etudiants",
    "idx_affectation_etudiants_echange_cours",
    `CREATE INDEX idx_affectation_etudiants_echange_cours
     ON affectation_etudiants (id_echange_cours)`
  );
  await tools.addConstraintIfMissing(
    connection,
    "affectation_etudiants",
    "fk_affectation_etudiants_echange_cours",
    `ALTER TABLE affectation_etudiants
     ADD CONSTRAINT fk_affectation_etudiants_echange_cours
     FOREIGN KEY (id_echange_cours)
     REFERENCES echanges_cours_etudiants (id_echange_cours)
     ON DELETE SET NULL`
  );
}
