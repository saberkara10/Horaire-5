function sessionParDefaut(nomSession, dateDebut) {
  const valeur = String(nomSession || "").trim().toLowerCase();

  if (valeur.includes("automne")) {
    return "Automne";
  }

  if (valeur.includes("hiver")) {
    return "Hiver";
  }

  if (valeur.includes("printemps")) {
    return "Printemps";
  }

  if (valeur.includes("ete")) {
    return "Ete";
  }

  const date = dateDebut ? new Date(dateDebut) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "Automne";
  }

  const mois = date.getUTCMonth() + 1;
  if (mois >= 8 && mois <= 12) {
    return "Automne";
  }
  if (mois >= 1 && mois <= 4) {
    return "Hiver";
  }
  if (mois >= 5 && mois <= 6) {
    return "Printemps";
  }
  return "Ete";
}

async function recupererValeursParDefaut(connection) {
  const [rows] = await connection.query(
    `SELECT nom, date_debut
     FROM sessions
     WHERE active = 1
     ORDER BY id_session DESC
     LIMIT 1`
  );

  const sessionActive = rows[0];
  if (!sessionActive) {
    return {
      session: "Automne",
      annee: 2026,
    };
  }

  const dateDebut = sessionActive.date_debut
    ? new Date(sessionActive.date_debut)
    : null;

  return {
    session: sessionParDefaut(sessionActive.nom, sessionActive.date_debut),
    annee:
      dateDebut && !Number.isNaN(dateDebut.getTime())
        ? dateDebut.getUTCFullYear()
        : 2026,
  };
}

async function emailUniqueIndexed(connection, tools) {
  const indexes = await tools.getIndexes(connection, "etudiants");
  const parNom = [...new Set(indexes.map((index) => index.index_name))];

  return parNom.some((indexName) => {
    const index = tools.findIndex(indexes, indexName);
    return (
      index &&
      index.unique &&
      index.columns.length === 1 &&
      index.columns[0] === "email"
    );
  });
}

async function verifierDoublonsEmail(connection) {
  const [rows] = await connection.query(
    `SELECT email
     FROM etudiants
     WHERE email IS NOT NULL
       AND TRIM(email) <> ''
     GROUP BY email
     HAVING COUNT(*) > 1
     LIMIT 1`
  );

  if (rows.length > 0) {
    throw new Error(
      `Duplicate student email detected before v9: ${rows[0].email}`
    );
  }
}

export async function isApplied({ connection, tools }) {
  return (
    (await tools.columnExists(connection, "etudiants", "email")) &&
    (await emailUniqueIndexed(connection, tools))
  );
}

export async function up({ connection, tools }) {
  await tools.addColumnIfMissing(
    connection,
    "etudiants",
    "email",
    "VARCHAR(150) NULL"
  );

  const defaults = await recupererValeursParDefaut(connection);

  await connection.query(
    `UPDATE etudiants
     SET session = ?
     WHERE session IS NULL
        OR TRIM(session) = ''`,
    [defaults.session]
  );

  await connection.query(
    `UPDATE etudiants
     SET annee = ?
     WHERE annee IS NULL
        OR annee < 2000
        OR annee > 2100`,
    [defaults.annee]
  );

  await verifierDoublonsEmail(connection);

  if (!(await emailUniqueIndexed(connection, tools))) {
    await tools.addIndexIfMissing(
      connection,
      "etudiants",
      "uniq_etudiants_email",
      `CREATE UNIQUE INDEX uniq_etudiants_email
       ON etudiants (email)`
    );
  }
}
