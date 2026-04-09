/**
 * Migration v2 idempotente pour le projet GDH5.
 * Lance : node Backend/Database/run_migration.js
 */

import { createConnection } from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import { hashPassword } from "../src/utils/passwords.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const connection = await createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "gdh5",
  port: Number(process.env.DB_PORT) || 3306,
  multipleStatements: false,
});

console.log("[OK] Connexion a la BD reussie.\n");

let ok = 0;
let skipped = 0;
let errors = 0;

function logOk(description) {
  console.log(`  [OK] ${description}`);
  ok++;
}

function logSkipped(description) {
  console.log(`  [SKIP] ${description}`);
  skipped++;
}

function logError(description, error) {
  console.error(`  [ERR] ${description}`);
  console.error(`        Code: ${error.code || "UNKNOWN"}`);
  console.error(`        Msg : ${String(error.message || error).slice(0, 140)}`);
  errors++;
}

function isIgnorableError(error) {
  const ignorableCodes = [
    "ER_DUP_FIELDNAME",
    "ER_TABLE_EXISTS_ERROR",
    "ER_DUP_KEY",
    "ER_DUP_KEYNAME",
    "ER_FK_DUP_NAME",
    "ER_CANT_DROP_FIELD_OR_KEY",
    "ER_DUP_ENTRY",
  ];

  const ignorableMessages = [
    "already exists",
    "Duplicate column",
    "Duplicate key",
    "Duplicate foreign key",
    "Multiple primary key",
    "Duplicate check constraint name",
  ];

  return (
    ignorableCodes.includes(error.code) ||
    ignorableMessages.some((message) => String(error.message).includes(message))
  );
}

async function exec(description, sql, params = []) {
  try {
    await connection.query(sql, params);
    logOk(description);
  } catch (error) {
    if (isIgnorableError(error)) {
      logSkipped(description);
      return;
    }
    logError(description, error);
  }
}

async function execWithFallback(description, statements) {
  let lastError = null;

  for (const { sql, params = [] } of statements) {
    try {
      await connection.query(sql, params);
      logOk(description);
      return;
    } catch (error) {
      if (isIgnorableError(error)) {
        logSkipped(description);
        return;
      }
      lastError = error;
    }
  }

  if (lastError) {
    logError(description, lastError);
  }
}

async function hasCheckConstraint(tableName, constraintName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'CHECK'
     LIMIT 1`,
    [tableName, constraintName]
  );

  return rows.length > 0;
}

async function ensureDefaultSession() {
  const nom = "Automne 2026";
  const dateDebut = "2026-08-25";
  const dateFin = "2026-12-20";

  const [existing] = await connection.query(
    `SELECT id_session
     FROM sessions
     WHERE nom = ? AND date_debut = ? AND date_fin = ?
     ORDER BY id_session ASC`,
    [nom, dateDebut, dateFin]
  );

  if (existing.length === 0) {
    const [result] = await connection.query(
      `INSERT INTO sessions (nom, date_debut, date_fin, active)
       VALUES (?, ?, ?, 1)`,
      [nom, dateDebut, dateFin]
    );
    logOk("INSERT session par defaut");
    return result.insertId;
  }

  const canonicalId = existing[0].id_session;
  logSkipped("INSERT session par defaut");

  await connection.query(
    `UPDATE sessions
     SET active = CASE WHEN id_session = ? THEN 1 ELSE 0 END
     WHERE nom = ? AND date_debut = ? AND date_fin = ?`,
    [canonicalId, nom, dateDebut, dateFin]
  );

  const duplicateIds = existing.slice(1).map((row) => row.id_session);
  if (duplicateIds.length === 0) {
    return canonicalId;
  }

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
    .filter((row) => Number(row.nb_refs) === 0)
    .map((row) => row.id_session);

  if (deletableIds.length === 0) {
    logSkipped("Cleanup sessions par defaut dupliquees");
    return canonicalId;
  }

  const deletePlaceholders = deletableIds.map(() => "?").join(", ");
  await connection.query(
    `DELETE FROM sessions WHERE id_session IN (${deletePlaceholders})`,
    deletableIds
  );
  logOk("Cleanup sessions par defaut dupliquees");

  return canonicalId;
}

function extraireNomSessionCourte(nomSession, dateDebut) {
  const valeur = String(nomSession || "").toLowerCase();

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

async function recupererCohorteParDefaut() {
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
    session: extraireNomSessionCourte(
      sessionActive.nom,
      sessionActive.date_debut
    ),
    annee:
      dateDebut && !Number.isNaN(dateDebut.getTime())
        ? dateDebut.getUTCFullYear()
        : 2026,
  };
}

const defaultAdminPasswordHash = await hashPassword("Admin123!");
const defaultResponsablePasswordHash = await hashPassword("Responsable123!");

// 1. Sessions
await exec("CREATE TABLE sessions", `
  CREATE TABLE IF NOT EXISTS sessions (
    id_session INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

await ensureDefaultSession();
const cohorteParDefaut = await recupererCohorteParDefaut();

// 2. etudiants
await exec(
  "etudiants: id_groupes_etudiants nullable",
  "ALTER TABLE etudiants MODIFY COLUMN id_groupes_etudiants INT NULL"
);
await exec(
  "etudiants: ADD session",
  "ALTER TABLE etudiants ADD COLUMN session VARCHAR(30) NULL"
);
await exec(
  "etudiants: ADD annee",
  "ALTER TABLE etudiants ADD COLUMN annee INT NULL"
);
await exec(
  "etudiants: remplir session vide",
  "UPDATE etudiants SET session = ? WHERE session IS NULL OR TRIM(session) = ''",
  [cohorteParDefaut.session]
);
await exec(
  "etudiants: remplir annee vide",
  "UPDATE etudiants SET annee = ? WHERE annee IS NULL OR annee < 2000 OR annee > 2100",
  [cohorteParDefaut.annee]
);
await exec(
  "etudiants: session NOT NULL",
  "ALTER TABLE etudiants MODIFY COLUMN session VARCHAR(30) NOT NULL"
);
await exec(
  "etudiants: annee NOT NULL",
  "ALTER TABLE etudiants MODIFY COLUMN annee INT NOT NULL"
);

// 3. prerequis_cours
await exec("CREATE TABLE prerequis_cours", `
  CREATE TABLE IF NOT EXISTS prerequis_cours (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_cours_prerequis INT NOT NULL,
    id_cours_suivant INT NOT NULL,
    est_bloquant TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uniq_prerequis (id_cours_prerequis, id_cours_suivant),
    CONSTRAINT fk_pre_cours FOREIGN KEY (id_cours_prerequis) REFERENCES cours(id_cours) ON DELETE CASCADE,
    CONSTRAINT fk_siv_cours FOREIGN KEY (id_cours_suivant) REFERENCES cours(id_cours) ON DELETE CASCADE
  )
`);

// 4. cours_echoues
await exec("CREATE TABLE cours_echoues", `
  CREATE TABLE IF NOT EXISTS cours_echoues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_etudiant INT NOT NULL,
    id_cours INT NOT NULL,
    id_session INT NULL,
    statut VARCHAR(30) NOT NULL DEFAULT 'a_reprendre',
    note_echec DECIMAL(5,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_cours_echoue (id_etudiant, id_cours),
    CONSTRAINT fk_ce_etudiant FOREIGN KEY (id_etudiant) REFERENCES etudiants(id_etudiant) ON DELETE CASCADE,
    CONSTRAINT fk_ce_cours FOREIGN KEY (id_cours) REFERENCES cours(id_cours) ON DELETE CASCADE,
    CONSTRAINT fk_ce_session FOREIGN KEY (id_session) REFERENCES sessions(id_session) ON DELETE SET NULL
  )
`);

// 5. absences_professeurs
await exec("CREATE TABLE absences_professeurs", `
  CREATE TABLE IF NOT EXISTS absences_professeurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_professeur INT NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'autre',
    commentaire TEXT NULL,
    approuve_par INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_abs_prof FOREIGN KEY (id_professeur) REFERENCES professeurs(id_professeur) ON DELETE CASCADE,
    CONSTRAINT fk_abs_user FOREIGN KEY (approuve_par) REFERENCES utilisateurs(id_utilisateur) ON DELETE SET NULL
  )
`);

// 6. salles_indisponibles
await exec("CREATE TABLE salles_indisponibles", `
  CREATE TABLE IF NOT EXISTS salles_indisponibles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_salle INT NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    raison VARCHAR(30) NOT NULL DEFAULT 'autre',
    commentaire TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_si_salle FOREIGN KEY (id_salle) REFERENCES salles(id_salle) ON DELETE CASCADE
  )
`);

// 7. rapports_generation
await exec("CREATE TABLE rapports_generation", `
  CREATE TABLE IF NOT EXISTS rapports_generation (
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
    CONSTRAINT fk_rg_session FOREIGN KEY (id_session) REFERENCES sessions(id_session) ON DELETE SET NULL,
    CONSTRAINT fk_rg_user FOREIGN KEY (genere_par) REFERENCES utilisateurs(id_utilisateur) ON DELETE SET NULL
  )
`);

// 8. utilisateurs
await exec("utilisateurs: ADD created_by", "ALTER TABLE utilisateurs ADD COLUMN created_by INT NULL");
await exec("utilisateurs: ADD actif", "ALTER TABLE utilisateurs ADD COLUMN actif TINYINT(1) NOT NULL DEFAULT 1");
await exec("utilisateurs: ADD created_at", "ALTER TABLE utilisateurs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
await exec("utilisateurs: actif=1 par defaut", "UPDATE utilisateurs SET actif = 1 WHERE actif IS NULL");

await exec(
  "INSERT admin par defaut",
  `INSERT IGNORE INTO utilisateurs (nom, prenom, email, motdepasse, role, actif)
   VALUES (?, ?, ?, ?, ?, 1)`,
  ["Admin", "Systeme", "admin@ecole.ca", defaultAdminPasswordHash, "ADMIN"]
);
await exec(
  "INSERT admin responsable",
  `INSERT IGNORE INTO utilisateurs (nom, prenom, email, motdepasse, role, actif)
   VALUES (?, ?, ?, ?, ?, 1)`,
  ["Responsable", "Systeme", "responsable@ecole.ca", defaultResponsablePasswordHash, "ADMIN_RESPONSABLE"]
);
await exec(
  "Migrate admin password legacy",
  "UPDATE utilisateurs SET motdepasse = ? WHERE email = ? AND motdepasse = ?",
  [defaultAdminPasswordHash, "admin@ecole.ca", "Admin123!"]
);
await exec(
  "Migrate responsable password legacy",
  "UPDATE utilisateurs SET motdepasse = ? WHERE email = ? AND motdepasse = ?",
  [defaultResponsablePasswordHash, "responsable@ecole.ca", "Responsable123!"]
);
await exec(
  "Normalize admin role",
  "UPDATE utilisateurs SET role = 'ADMIN', actif = 1 WHERE email = ?",
  ["admin@ecole.ca"]
);
await exec(
  "Normalize responsable role",
  "UPDATE utilisateurs SET role = 'ADMIN_RESPONSABLE', actif = 1 WHERE email = ?",
  ["responsable@ecole.ca"]
);

// 9. cours
await exec("cours: ADD est_cours_cle", "ALTER TABLE cours ADD COLUMN est_cours_cle TINYINT(1) NOT NULL DEFAULT 0");
await exec("cours: ADD est_en_ligne", "ALTER TABLE cours ADD COLUMN est_en_ligne TINYINT(1) NOT NULL DEFAULT 0");
await exec("cours: ADD max_etudiants_par_groupe", "ALTER TABLE cours ADD COLUMN max_etudiants_par_groupe INT NOT NULL DEFAULT 30");
await exec("cours: ADD min_etudiants_par_groupe", "ALTER TABLE cours ADD COLUMN min_etudiants_par_groupe INT NOT NULL DEFAULT 5");
await exec("cours: ADD sessions_par_semaine", "ALTER TABLE cours ADD COLUMN sessions_par_semaine INT NOT NULL DEFAULT 2");

// 10. groupes_etudiants
await exec("groupes: ADD taille_max", "ALTER TABLE groupes_etudiants ADD COLUMN taille_max INT NOT NULL DEFAULT 30");
await exec("groupes: ADD est_groupe_special", "ALTER TABLE groupes_etudiants ADD COLUMN est_groupe_special TINYINT(1) NOT NULL DEFAULT 0");
await exec("groupes: ADD id_session", "ALTER TABLE groupes_etudiants ADD COLUMN id_session INT NULL");
await exec("groupes: ADD programme", "ALTER TABLE groupes_etudiants ADD COLUMN programme VARCHAR(150) NULL");
await exec("groupes: ADD etape", "ALTER TABLE groupes_etudiants ADD COLUMN etape INT NULL");

// 11. affectation_cours.id_salle nullable
await exec("affectation_cours: DROP FK salle", "ALTER TABLE affectation_cours DROP FOREIGN KEY fk_affectation_cours_salles");
await exec("affectation_cours: id_salle nullable", "ALTER TABLE affectation_cours MODIFY COLUMN id_salle INT NULL");
await exec(
  "affectation_cours: RESTORE FK salle",
  `ALTER TABLE affectation_cours
   ADD CONSTRAINT fk_affectation_cours_salles
   FOREIGN KEY (id_salle) REFERENCES salles(id_salle) ON DELETE SET NULL`
);

// 12. plages_horaires index de recherche non unique
await exec(
  "plages_horaires: DROP UNIQUE uniq_plage",
  "ALTER TABLE plages_horaires DROP INDEX uniq_plage"
);
await exec(
  "plages_horaires: ADD INDEX idx_plages_horaires_date_heure",
  "ALTER TABLE plages_horaires ADD INDEX idx_plages_horaires_date_heure (date, heure_debut, heure_fin)"
);

// 13. disponibilites_professeurs weekend
if (await hasCheckConstraint("disponibilites_professeurs", "chk_disponibilite_jour")) {
  await execWithFallback("disponibilites: DROP CHECK jour", [
    {
      sql: "ALTER TABLE disponibilites_professeurs DROP CHECK chk_disponibilite_jour",
    },
    {
      sql: "ALTER TABLE disponibilites_professeurs DROP CONSTRAINT chk_disponibilite_jour",
    },
  ]);
} else {
  logSkipped("disponibilites: DROP CHECK jour");
}

await exec(
  "disponibilites: ADD CHECK jour 1-7",
  `ALTER TABLE disponibilites_professeurs
   ADD CONSTRAINT chk_disponibilite_jour CHECK (jour_semaine BETWEEN 1 AND 7)`
);

// 14. cours cles
await exec(
  "cours: marquer cours cles (INF101, CYB101, ADM101)",
  "UPDATE cours SET est_cours_cle = 1 WHERE code IN ('INF101', 'CYB101', 'ADM101')"
);

await connection.end();

console.log(`\n${"-".repeat(50)}`);
console.log("MIGRATION TERMINEE");
console.log(`  [OK]   Succes  : ${ok}`);
console.log(`  [SKIP] Ignores : ${skipped}`);
console.log(`  [ERR]  Erreurs : ${errors}`);

if (errors === 0) {
  console.log("\nBase de donnees v2 prete.");
} else {
  console.log("\nDes erreurs se sont produites. Verifiez ci-dessus.");
  process.exit(1);
}
