const DEFAULT_SESSION_NAME = "Automne 2026";
const DEFAULT_SESSION_START = "2026-08-25";
const DEFAULT_SESSION_END = "2026-12-20";
const DEFAULT_ADMIN_HASH =
  "$2b$10$wqZfdgYvDSrwYcUmVWdLHuocAiQqmA90YPzNw8GyqygY5IbZv924m";
const DEFAULT_RESPONSABLE_HASH =
  "$2b$10$d7rRkzZZ9VZw0BLx/Yq.L./w8UCy/NkBMgCGBGixKLJOmXF1z5WRe";

function infererNomSessionCourt(nomSession, dateDebut) {
  const normalise = String(nomSession || "").trim().toLowerCase();

  if (normalise.includes("automne")) {
    return "Automne";
  }

  if (normalise.includes("hiver")) {
    return "Hiver";
  }

  if (normalise.includes("printemps")) {
    return "Printemps";
  }

  if (normalise.includes("ete")) {
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

async function isColumnNullable(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  return String(rows[0]?.is_nullable || "NO").toUpperCase() === "YES";
}

async function assurerColonnesUtilisateurs(connection, tools) {
  await tools.addColumnIfMissing(connection, "utilisateurs", "created_by", "INT NULL");
  await tools.addColumnIfMissing(
    connection,
    "utilisateurs",
    "actif",
    "TINYINT(1) NOT NULL DEFAULT 1"
  );
  await tools.addColumnIfMissing(
    connection,
    "utilisateurs",
    "created_at",
    "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP"
  );
}

async function assurerTableSessions(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS sessions (
      id_session INT AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(100) NOT NULL,
      date_debut DATE NOT NULL,
      date_fin DATE NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function assurerColonnesEtudiants(connection, tools) {
  await connection.query(
    `ALTER TABLE etudiants
     MODIFY COLUMN id_groupes_etudiants INT NULL`
  );
  await tools.addColumnIfMissing(connection, "etudiants", "session", "VARCHAR(30) NULL");
  await tools.addColumnIfMissing(connection, "etudiants", "annee", "INT NULL");
}

async function assurerColonnesCours(connection, tools) {
  await tools.addColumnIfMissing(
    connection,
    "cours",
    "est_cours_cle",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await tools.addColumnIfMissing(
    connection,
    "cours",
    "est_en_ligne",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await tools.addColumnIfMissing(
    connection,
    "cours",
    "max_etudiants_par_groupe",
    "INT NOT NULL DEFAULT 30"
  );
  await tools.addColumnIfMissing(
    connection,
    "cours",
    "min_etudiants_par_groupe",
    "INT NOT NULL DEFAULT 5"
  );
  await tools.addColumnIfMissing(
    connection,
    "cours",
    "sessions_par_semaine",
    "INT NOT NULL DEFAULT 2"
  );
}

async function assurerTablePrerequisCours(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS prerequis_cours (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_cours_prerequis INT NOT NULL,
      id_cours_suivant INT NOT NULL,
      est_bloquant TINYINT(1) NOT NULL DEFAULT 1,
      UNIQUE KEY uniq_prerequis (id_cours_prerequis, id_cours_suivant),
      CONSTRAINT fk_pre_cours
        FOREIGN KEY (id_cours_prerequis) REFERENCES cours(id_cours) ON DELETE CASCADE,
      CONSTRAINT fk_siv_cours
        FOREIGN KEY (id_cours_suivant) REFERENCES cours(id_cours) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function assurerTableCoursEchoues(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS cours_echoues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_etudiant INT NOT NULL,
      id_cours INT NOT NULL,
      id_session INT NULL,
      statut ENUM('a_reprendre','planifie','reussi','en_ligne','groupe_special','resolution_manuelle')
        NOT NULL DEFAULT 'a_reprendre',
      note_echec DECIMAL(5,2) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_cours_echoue (id_etudiant, id_cours, id_session),
      CONSTRAINT fk_ce_etudiant
        FOREIGN KEY (id_etudiant) REFERENCES etudiants(id_etudiant) ON DELETE CASCADE,
      CONSTRAINT fk_ce_cours
        FOREIGN KEY (id_cours) REFERENCES cours(id_cours) ON DELETE CASCADE,
      CONSTRAINT fk_ce_session
        FOREIGN KEY (id_session) REFERENCES sessions(id_session) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function assurerTableAbsencesProfesseurs(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS absences_professeurs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_professeur INT NOT NULL,
      date_debut DATE NOT NULL,
      date_fin DATE NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'autre',
      commentaire TEXT NULL,
      approuve_par INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_abs_prof
        FOREIGN KEY (id_professeur) REFERENCES professeurs(id_professeur) ON DELETE CASCADE,
      CONSTRAINT fk_abs_user
        FOREIGN KEY (approuve_par) REFERENCES utilisateurs(id_utilisateur) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function assurerTableSallesIndisponibles(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS salles_indisponibles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_salle INT NOT NULL,
      date_debut DATE NOT NULL,
      date_fin DATE NOT NULL,
      raison VARCHAR(30) NOT NULL DEFAULT 'autre',
      commentaire TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_si_salle
        FOREIGN KEY (id_salle) REFERENCES salles(id_salle) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function assurerColonnesGroupes(connection, tools) {
  await tools.addColumnIfMissing(
    connection,
    "groupes_etudiants",
    "taille_max",
    "INT NOT NULL DEFAULT 30"
  );
  await tools.addColumnIfMissing(
    connection,
    "groupes_etudiants",
    "est_groupe_special",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await tools.addColumnIfMissing(connection, "groupes_etudiants", "id_session", "INT NULL");
  await tools.addColumnIfMissing(
    connection,
    "groupes_etudiants",
    "programme",
    "VARCHAR(150) NULL"
  );
  await tools.addColumnIfMissing(connection, "groupes_etudiants", "etape", "INT NULL");
}

async function assurerTableRapportsGeneration(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS rapports_generation (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_session INT NULL,
      genere_par INT NULL,
      date_generation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      score_qualite DECIMAL(5,2) DEFAULT 0,
      nb_cours_planifies INT NOT NULL DEFAULT 0,
      nb_cours_non_planifies INT NOT NULL DEFAULT 0,
      nb_cours_echoues_traites INT NOT NULL DEFAULT 0,
      nb_cours_en_ligne_generes INT NOT NULL DEFAULT 0,
      nb_groupes_speciaux INT NOT NULL DEFAULT 0,
      nb_resolutions_manuelles INT NOT NULL DEFAULT 0,
      details JSON NULL,
      CONSTRAINT fk_rg_session
        FOREIGN KEY (id_session) REFERENCES sessions(id_session) ON DELETE SET NULL,
      CONSTRAINT fk_rg_user
        FOREIGN KEY (genere_par) REFERENCES utilisateurs(id_utilisateur) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function listerContraintesParColonne(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT DISTINCT constraint_name
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
       AND referenced_table_name IS NOT NULL`,
    [tableName, columnName]
  );

  return rows.map((row) => String(row.constraint_name || ""));
}

async function assurerSessionParDefaut(connection) {
  await connection.query(
    `INSERT INTO sessions (nom, date_debut, date_fin, active)
     SELECT ?, ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1
       FROM sessions
       WHERE nom = ?
         AND date_debut = ?
         AND date_fin = ?
     )`,
    [
      DEFAULT_SESSION_NAME,
      DEFAULT_SESSION_START,
      DEFAULT_SESSION_END,
      DEFAULT_SESSION_NAME,
      DEFAULT_SESSION_START,
      DEFAULT_SESSION_END,
    ]
  );

  const [rows] = await connection.query(
    `SELECT id_session
     FROM sessions
     WHERE nom = ?
       AND date_debut = ?
       AND date_fin = ?
     ORDER BY id_session ASC`,
    [DEFAULT_SESSION_NAME, DEFAULT_SESSION_START, DEFAULT_SESSION_END]
  );

  if (rows.length === 0) {
    return null;
  }

  const canonicalId = Number(rows[0].id_session);

  const [activeRows] = await connection.query(
    `SELECT id_session
     FROM sessions
     WHERE active = 1
     ORDER BY id_session DESC
     LIMIT 1`
  );

  if (activeRows.length === 0) {
    await connection.query(
      `UPDATE sessions
       SET active = CASE WHEN id_session = ? THEN 1 ELSE 0 END`,
      [canonicalId]
    );
  }

  if (rows.length <= 1) {
    return canonicalId;
  }

  const duplicateIds = rows.slice(1).map((row) => Number(row.id_session));
  const placeholders = duplicateIds.map(() => "?").join(", ");
  const [refs] = await connection.query(
    `SELECT s.id_session,
            (
              (SELECT COUNT(*) FROM rapports_generation rg WHERE rg.id_session = s.id_session) +
              (SELECT COUNT(*) FROM groupes_etudiants ge WHERE ge.id_session = s.id_session) +
              (SELECT COUNT(*) FROM cours_echoues ce WHERE ce.id_session = s.id_session)
            ) AS nb_refs
     FROM sessions s
     WHERE s.id_session IN (${placeholders})`,
    duplicateIds
  );

  const deletableIds = refs
    .filter((row) => Number(row.nb_refs || 0) === 0)
    .map((row) => Number(row.id_session));

  if (deletableIds.length > 0) {
    const deletePlaceholders = deletableIds.map(() => "?").join(", ");
    await connection.query(
      `DELETE FROM sessions
       WHERE id_session IN (${deletePlaceholders})`,
      deletableIds
    );
  }

  return canonicalId;
}

async function recupererCohorteParDefaut(connection) {
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
    session: infererNomSessionCourt(
      sessionActive.nom,
      sessionActive.date_debut
    ),
    annee:
      dateDebut && !Number.isNaN(dateDebut.getTime())
        ? dateDebut.getUTCFullYear()
        : 2026,
  };
}

async function assurerUtilisateursParDefaut(connection) {
  await connection.query(
    `INSERT IGNORE INTO utilisateurs (nom, prenom, email, motdepasse, role, actif)
     VALUES (?, ?, ?, ?, ?, 1)`,
    ["Admin", "Systeme", "admin@ecole.ca", DEFAULT_ADMIN_HASH, "ADMIN"]
  );

  await connection.query(
    `INSERT IGNORE INTO utilisateurs (nom, prenom, email, motdepasse, role, actif)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [
      "Responsable",
      "Systeme",
      "responsable@ecole.ca",
      DEFAULT_RESPONSABLE_HASH,
      "ADMIN_RESPONSABLE",
    ]
  );

  await connection.query(
    `UPDATE utilisateurs
     SET motdepasse = ?, role = 'ADMIN', actif = 1
     WHERE email = ?`,
    [DEFAULT_ADMIN_HASH, "admin@ecole.ca"]
  );

  await connection.query(
    `UPDATE utilisateurs
     SET motdepasse = ?, role = 'ADMIN_RESPONSABLE', actif = 1
     WHERE email = ?`,
    [DEFAULT_RESPONSABLE_HASH, "responsable@ecole.ca"]
  );
}

async function normaliserEtudiants(connection) {
  const cohorte = await recupererCohorteParDefaut(connection);

  await connection.query(
    `UPDATE etudiants
     SET session = ?
     WHERE session IS NULL
        OR TRIM(session) = ''`,
    [cohorte.session]
  );

  await connection.query(
    `UPDATE etudiants
     SET annee = ?
     WHERE annee IS NULL
        OR annee < 2000
        OR annee > 2100`,
    [cohorte.annee]
  );

  await connection.query(
    `ALTER TABLE etudiants
     MODIFY COLUMN session VARCHAR(30) NOT NULL,
     MODIFY COLUMN annee INT NOT NULL`
  );
}

async function assurerContrainteGroupeSession(connection, tools) {
  await tools.addConstraintIfMissing(
    connection,
    "groupes_etudiants",
    "fk_groupe_session",
    `ALTER TABLE groupes_etudiants
     ADD CONSTRAINT fk_groupe_session
     FOREIGN KEY (id_session) REFERENCES sessions(id_session)
     ON DELETE SET NULL`
  );
}

async function normaliserAffectationCoursSalle(connection, tools) {
  if (!(await tools.tableExists(connection, "affectation_cours"))) {
    return;
  }

  const constraints = await listerContraintesParColonne(
    connection,
    "affectation_cours",
    "id_salle"
  );

  for (const constraintName of constraints) {
    await connection.query(
      `ALTER TABLE affectation_cours
       DROP FOREIGN KEY ${tools.escapeIdentifier(constraintName)}`
    );
  }

  if (!(await isColumnNullable(connection, "affectation_cours", "id_salle"))) {
    await connection.query(
      `ALTER TABLE affectation_cours
       MODIFY COLUMN id_salle INT NULL`
    );
  }

  await tools.addConstraintIfMissing(
    connection,
    "affectation_cours",
    "fk_affectation_cours_salles",
    `ALTER TABLE affectation_cours
     ADD CONSTRAINT fk_affectation_cours_salles
     FOREIGN KEY (id_salle) REFERENCES salles(id_salle)
     ON DELETE SET NULL`
  );
}

async function marquerCoursCles(connection) {
  await connection.query(
    `UPDATE cours
     SET est_cours_cle = 1
     WHERE code IN ('INF101', 'CYB101', 'ADM101')`
  );
}

export async function isApplied({ connection, tools }) {
  const requiredTables = [
    "sessions",
    "prerequis_cours",
    "cours_echoues",
    "absences_professeurs",
    "salles_indisponibles",
    "rapports_generation",
  ];

  for (const tableName of requiredTables) {
    if (!(await tools.tableExists(connection, tableName))) {
      return false;
    }
  }

  const requiredColumns = [
    ["utilisateurs", "actif"],
    ["utilisateurs", "created_at"],
    ["etudiants", "session"],
    ["etudiants", "annee"],
    ["cours", "est_cours_cle"],
    ["groupes_etudiants", "id_session"],
  ];

  for (const [tableName, columnName] of requiredColumns) {
    if (!(await tools.columnExists(connection, tableName, columnName))) {
      return false;
    }
  }

  return isColumnNullable(connection, "affectation_cours", "id_salle");
}

export async function up(context) {
  const { connection, tools } = context;

  await assurerColonnesUtilisateurs(connection, tools);
  await assurerTableSessions(connection);
  await assurerColonnesEtudiants(connection, tools);
  await assurerColonnesCours(connection, tools);
  await assurerTablePrerequisCours(connection);
  await assurerTableCoursEchoues(connection);
  await assurerTableAbsencesProfesseurs(connection);
  await assurerTableSallesIndisponibles(connection);
  await assurerColonnesGroupes(connection, tools);
  await assurerTableRapportsGeneration(connection);
  await assurerSessionParDefaut(connection);
  await assurerUtilisateursParDefaut(connection);
  await normaliserEtudiants(connection);
  await assurerContrainteGroupeSession(connection, tools);
  await normaliserAffectationCoursSalle(connection, tools);
  await marquerCoursCles(connection);
}
