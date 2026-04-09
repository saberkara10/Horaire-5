import pool from "../../db.js";

let schemaReadyPromise = null;

async function recupererColonnes(executor, tableName) {
  const [rows] = await executor.query(
    `SELECT COLUMN_NAME
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );

  return new Set(rows.map((row) => String(row.COLUMN_NAME || "")));
}

async function colonneExiste(executor, tableName, columnName) {
  const colonnes = await recupererColonnes(executor, tableName);
  return colonnes.has(columnName);
}

async function ajouterColonneSiAbsente(executor, tableName, columnName, definitionSql) {
  if (await colonneExiste(executor, tableName, columnName)) {
    return;
  }

  await executor.query(
    `ALTER TABLE ${tableName}
     ADD COLUMN ${columnName} ${definitionSql}`
  );
}

async function recupererIndexes(executor, tableName) {
  const [rows] = await executor.query(
    `SELECT index_name,
            non_unique,
            seq_in_index,
            column_name
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
     ORDER BY index_name ASC, seq_in_index ASC`,
    [tableName]
  );

  return rows;
}

async function indexExiste(executor, tableName, indexName) {
  const indexes = await recupererIndexes(executor, tableName);
  return indexes.some((row) => String(row.index_name || "") === indexName);
}

async function creerIndexSiAbsent(executor, tableName, indexName, sqlCreation) {
  if (await indexExiste(executor, tableName, indexName)) {
    return;
  }

  await executor.query(sqlCreation);
}

async function supprimerIndexSiExistant(executor, tableName, indexName) {
  if (!(await indexExiste(executor, tableName, indexName))) {
    return;
  }

  await executor.query(`ALTER TABLE ${tableName} DROP INDEX ${indexName}`);
}

async function recupererContrainte(executor, tableName, constraintName) {
  const [rows] = await executor.query(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.table_constraints
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND constraint_name = ?
     LIMIT 1`,
    [tableName, constraintName]
  );

  return rows[0] || null;
}

async function creerContrainteSiAbsente(executor, tableName, constraintName, sqlCreation) {
  const contrainte = await recupererContrainte(executor, tableName, constraintName);
  if (contrainte) {
    return;
  }

  await executor.query(sqlCreation);
}

async function trouverIndexUniqueNomGroupeGlobal(executor) {
  const indexes = await recupererIndexes(executor, "groupes_etudiants");
  const indexesParNom = new Map();

  for (const row of indexes) {
    const nom = String(row.index_name || "");
    if (!indexesParNom.has(nom)) {
      indexesParNom.set(nom, []);
    }
    indexesParNom.get(nom).push(row);
  }

  for (const [nomIndex, lignes] of indexesParNom) {
    const colonnes = lignes.map((ligne) => String(ligne.column_name || ""));
    const estUnique = Number(lignes[0]?.non_unique) === 0;
    if (estUnique && colonnes.length === 1 && colonnes[0] === "nom_groupe") {
      return nomIndex;
    }
  }

  return null;
}

async function assurerIndexGroupesParSession(executor) {
  const indexGlobal = await trouverIndexUniqueNomGroupeGlobal(executor);
  if (indexGlobal) {
    await supprimerIndexSiExistant(executor, "groupes_etudiants", indexGlobal);
  }

  await creerIndexSiAbsent(
    executor,
    "groupes_etudiants",
    "idx_groupes_nom_groupe",
    `CREATE INDEX idx_groupes_nom_groupe
     ON groupes_etudiants (nom_groupe)`
  );

  await creerIndexSiAbsent(
    executor,
    "groupes_etudiants",
    "uniq_groupes_session_nom",
    `CREATE UNIQUE INDEX uniq_groupes_session_nom
     ON groupes_etudiants (id_session, nom_groupe)`
  );
}

async function assurerTableAffectationEtudiants(executor) {
  await executor.query(
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

async function assurerCoursEchouesEvolution(executor) {
  await ajouterColonneSiAbsente(
    executor,
    "cours_echoues",
    "id_groupe_reprise",
    "INT NULL"
  );

  await creerIndexSiAbsent(
    executor,
    "cours_echoues",
    "idx_cours_echoues_groupe_reprise",
    `CREATE INDEX idx_cours_echoues_groupe_reprise
     ON cours_echoues (id_groupe_reprise)`
  );

  await creerContrainteSiAbsente(
    executor,
    "cours_echoues",
    "fk_cours_echoues_groupe_reprise",
    `ALTER TABLE cours_echoues
     ADD CONSTRAINT fk_cours_echoues_groupe_reprise
     FOREIGN KEY (id_groupe_reprise)
     REFERENCES groupes_etudiants (id_groupes_etudiants)
     ON DELETE SET NULL`
  );
}

async function assurerSchema(executor) {
  await assurerTableAffectationEtudiants(executor);
  await assurerCoursEchouesEvolution(executor);
  await assurerIndexGroupesParSession(executor);
}

export async function assurerSchemaSchedulerAcademique(executor = pool) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (executor !== pool) {
    await assurerSchema(executor);
    return;
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = assurerSchema(executor).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}
