const UNIQUE_INDEX_COLUMNS = [
  "id_professeur",
  "jour_semaine",
  "heure_debut",
  "heure_fin",
  "date_debut_effet",
  "date_fin_effet",
];

const EFFECT_INDEX_COLUMNS = [
  "id_professeur",
  "date_debut_effet",
  "date_fin_effet",
  "jour_semaine",
];

async function assurerIndexExact(connection, tools, tableName, indexName, createSql, expectedColumns, expectedUnique) {
  const indexes = await tools.getIndexes(connection, tableName);
  const index = tools.findIndex(indexes, indexName);

  if (index) {
    const memeUnicite = index.unique === expectedUnique;
    const memesColonnes =
      index.columns.length === expectedColumns.length &&
      index.columns.every((columnName, indexPosition) => columnName === expectedColumns[indexPosition]);

    if (memeUnicite && memesColonnes) {
      return;
    }

    await tools.dropIndexIfExists(connection, tableName, indexName);
  }

  await tools.addIndexIfMissing(connection, tableName, indexName, createSql);
}

export async function isApplied({ connection, tools }) {
  if (
    !(await tools.columnExists(
      connection,
      "disponibilites_professeurs",
      "date_debut_effet"
    )) ||
    !(await tools.columnExists(
      connection,
      "disponibilites_professeurs",
      "date_fin_effet"
    ))
  ) {
    return false;
  }

  const indexes = await tools.getIndexes(connection, "disponibilites_professeurs");
  const uniqueIndex = tools.findIndex(indexes, "uniq_disponibilite_professeur");
  const effectIndex = tools.findIndex(
    indexes,
    "idx_disponibilite_professeur_effet"
  );

  const uniqueReady =
    uniqueIndex?.unique === true &&
    JSON.stringify(uniqueIndex.columns) === JSON.stringify(UNIQUE_INDEX_COLUMNS);
  const effectReady =
    effectIndex?.unique === false &&
    JSON.stringify(effectIndex.columns) === JSON.stringify(EFFECT_INDEX_COLUMNS);

  return uniqueReady && effectReady;
}

export async function up({ connection, tools }) {
  await tools.addColumnIfMissing(
    connection,
    "disponibilites_professeurs",
    "date_debut_effet",
    "DATE NULL AFTER heure_fin"
  );
  await tools.addColumnIfMissing(
    connection,
    "disponibilites_professeurs",
    "date_fin_effet",
    "DATE NULL AFTER date_debut_effet"
  );

  await connection.query(
    `UPDATE disponibilites_professeurs
     SET date_debut_effet = COALESCE(date_debut_effet, '2000-01-01'),
         date_fin_effet = COALESCE(date_fin_effet, '2099-12-31')
     WHERE date_debut_effet IS NULL
        OR date_fin_effet IS NULL`
  );

  await connection.query(
    `ALTER TABLE disponibilites_professeurs
     MODIFY COLUMN date_debut_effet DATE NOT NULL DEFAULT '2000-01-01',
     MODIFY COLUMN date_fin_effet DATE NOT NULL DEFAULT '2099-12-31'`
  );

  await assurerIndexExact(
    connection,
    tools,
    "disponibilites_professeurs",
    "idx_disponibilite_professeur_effet",
    `CREATE INDEX idx_disponibilite_professeur_effet
     ON disponibilites_professeurs (
       id_professeur,
       date_debut_effet,
       date_fin_effet,
       jour_semaine
     )`,
    EFFECT_INDEX_COLUMNS,
    false
  );

  await assurerIndexExact(
    connection,
    tools,
    "disponibilites_professeurs",
    "uniq_disponibilite_professeur",
    `ALTER TABLE disponibilites_professeurs
     ADD UNIQUE KEY uniq_disponibilite_professeur (
       id_professeur,
       jour_semaine,
       heure_debut,
       heure_fin,
       date_debut_effet,
       date_fin_effet
     )`,
    UNIQUE_INDEX_COLUMNS,
    true
  );

  await tools.addConstraintIfMissing(
    connection,
    "disponibilites_professeurs",
    "chk_disponibilite_effet",
    `ALTER TABLE disponibilites_professeurs
     ADD CONSTRAINT chk_disponibilite_effet
     CHECK (date_debut_effet <= date_fin_effet)`
  );
}
