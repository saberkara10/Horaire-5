/**
 * Service d'evolution de schema au runtime pour les modules avances.
 *
 * Le projet repose encore sur un melange de dump SQL historiques et
 * d'evolutions incrustees dans le backend. Ce fichier sert donc de garde-fou :
 * il assure, avant l'execution des flux critiques, que les tables, colonnes,
 * index et contraintes indispensables au scheduler academique sont bien presentes.
 */
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
    `SELECT INDEX_NAME AS index_name,
            NON_UNIQUE AS non_unique,
            SEQ_IN_INDEX AS seq_in_index,
            COLUMN_NAME AS column_name
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
     ORDER BY INDEX_NAME ASC, SEQ_IN_INDEX ASC`,
    [tableName]
  );

  return rows;
}

async function indexExiste(executor, tableName, indexName) {
  const indexes = await recupererIndexes(executor, tableName);
  const nomRecherche = String(indexName || "").toLowerCase();
  return indexes.some(
    (row) => String(row.index_name || "").toLowerCase() === nomRecherche
  );
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

async function assurerSessionScopeGroupesEtudiants(executor) {
  await ajouterColonneSiAbsente(
    executor,
    "groupes_etudiants",
    "id_session",
    "INT NULL AFTER etape"
  );

  await creerIndexSiAbsent(
    executor,
    "groupes_etudiants",
    "idx_groupes_id_session",
    `CREATE INDEX idx_groupes_id_session
     ON groupes_etudiants (id_session)`
  );

  await creerContrainteSiAbsente(
    executor,
    "groupes_etudiants",
    "fk_groupes_session",
    `ALTER TABLE groupes_etudiants
     ADD CONSTRAINT fk_groupes_session
     FOREIGN KEY (id_session) REFERENCES sessions (id_session)
     ON DELETE SET NULL`
  );
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

/**
 * Cree la table des affectations individuelles si elle n'existe pas encore.
 *
 * Cette table supporte a la fois les reprises et les exceptions individuelles
 * appliquees a un etudiant sur un cours donne.
 *
 * @param {Object} executor Connexion SQL active.
 * @returns {Promise<void>}
 */
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

/**
 * Cree le journal metier des echanges de cours et rattache les overrides
 * individuels a ce journal.
 *
 * @param {Object} executor Connexion SQL active.
 * @returns {Promise<void>}
 */
async function assurerEchangesCoursEtudiants(executor) {
  await executor.query(
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

  await ajouterColonneSiAbsente(
    executor,
    "affectation_etudiants",
    "id_echange_cours",
    "INT NULL AFTER id_cours_echoue"
  );

  await creerIndexSiAbsent(
    executor,
    "affectation_etudiants",
    "idx_affectation_etudiants_echange_cours",
    `CREATE INDEX idx_affectation_etudiants_echange_cours
     ON affectation_etudiants (id_echange_cours)`
  );

  await creerContrainteSiAbsente(
    executor,
    "affectation_etudiants",
    "fk_affectation_etudiants_echange_cours",
    `ALTER TABLE affectation_etudiants
     ADD CONSTRAINT fk_affectation_etudiants_echange_cours
     FOREIGN KEY (id_echange_cours)
     REFERENCES echanges_cours_etudiants (id_echange_cours)
     ON DELETE SET NULL`
  );
}

/**
 * Fait evoluer `cours_echoues` pour tracer le groupe reel retenu en reprise.
 *
 * @param {Object} executor Connexion SQL active.
 * @returns {Promise<void>}
 */
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

/**
 * Cree les series de planification utilisees par la recurrence manuelle.
 *
 * @param {Object} executor Connexion SQL active.
 * @returns {Promise<void>}
 */
async function assurerPlanificationSeries(executor) {
  await executor.query(
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

  await ajouterColonneSiAbsente(
    executor,
    "affectation_cours",
    "id_planification_serie",
    "INT NULL AFTER id_plage_horaires"
  );

  await creerIndexSiAbsent(
    executor,
    "affectation_cours",
    "idx_affectation_cours_planification_serie",
    `CREATE INDEX idx_affectation_cours_planification_serie
     ON affectation_cours (id_planification_serie)`
  );

  await creerContrainteSiAbsente(
    executor,
    "affectation_cours",
    "fk_affectation_cours_planification_serie",
    `ALTER TABLE affectation_cours
     ADD CONSTRAINT fk_affectation_cours_planification_serie
     FOREIGN KEY (id_planification_serie)
     REFERENCES planification_series (id_planification_serie)
     ON DELETE SET NULL`
  );
}

/**
 * Assure la presence de la table des rapports de generation.
 *
 * Pourquoi:
 * - `SchedulerEngine.generer()` insere dans `rapports_generation` en toute fin
 *   de transaction ;
 * - si la base n'a pas recu toutes les migrations mais que le scheduler peut
 *   quand meme tourner, l'echec n'apparait qu'au moment de persister le
 *   rapport final.
 *
 * Impact:
 * - evite une erreur tardive apres une generation reussie ;
 * - garde les routes d'historique compatibles avec les bases legacy.
 *
 * @param {Object} executor Connexion SQL active.
 * @returns {Promise<void>}
 */
async function assurerRapportsGeneration(executor) {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS rapports_generation (
      id INT NOT NULL AUTO_INCREMENT,
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
      PRIMARY KEY (id),
      CONSTRAINT fk_rg_session
        FOREIGN KEY (id_session) REFERENCES sessions (id_session)
        ON DELETE SET NULL,
      CONSTRAINT fk_rg_user
        FOREIGN KEY (genere_par) REFERENCES utilisateurs (id_utilisateur)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await ajouterColonneSiAbsente(executor, "rapports_generation", "id_session", "INT NULL");
  await ajouterColonneSiAbsente(
    executor,
    "rapports_generation",
    "genere_par",
    "INT NULL"
  );
  await ajouterColonneSiAbsente(
    executor,
    "rapports_generation",
    "date_generation",
    "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP"
  );
  await ajouterColonneSiAbsente(
    executor,
    "rapports_generation",
    "score_qualite",
    "DECIMAL(5,2) NOT NULL DEFAULT 0"
  );
  await ajouterColonneSiAbsente(
    executor,
    "rapports_generation",
    "nb_cours_planifies",
    "INT NOT NULL DEFAULT 0"
  );
  await ajouterColonneSiAbsente(
    executor,
    "rapports_generation",
    "nb_cours_non_planifies",
    "INT NOT NULL DEFAULT 0"
  );
  await ajouterColonneSiAbsente(
    executor,
    "rapports_generation",
    "nb_cours_echoues_traites",
    "INT NOT NULL DEFAULT 0"
  );
  await ajouterColonneSiAbsente(
    executor,
    "rapports_generation",
    "nb_cours_en_ligne_generes",
    "INT NOT NULL DEFAULT 0"
  );
  await ajouterColonneSiAbsente(
    executor,
    "rapports_generation",
    "nb_groupes_speciaux",
    "INT NOT NULL DEFAULT 0"
  );
  await ajouterColonneSiAbsente(
    executor,
    "rapports_generation",
    "nb_resolutions_manuelles",
    "INT NOT NULL DEFAULT 0"
  );
  await ajouterColonneSiAbsente(
    executor,
    "rapports_generation",
    "details",
    "LONGTEXT NULL"
  );

  await creerContrainteSiAbsente(
    executor,
    "rapports_generation",
    "fk_rg_session",
    `ALTER TABLE rapports_generation
     ADD CONSTRAINT fk_rg_session
     FOREIGN KEY (id_session) REFERENCES sessions (id_session)
     ON DELETE SET NULL`
  );

  await creerContrainteSiAbsente(
    executor,
    "rapports_generation",
    "fk_rg_user",
    `ALTER TABLE rapports_generation
     ADD CONSTRAINT fk_rg_user
     FOREIGN KEY (genere_par) REFERENCES utilisateurs (id_utilisateur)
     ON DELETE SET NULL`
  );
}

/**
 * Cree le journal metier des replanifications intelligentes d'affectations.
 *
 * @param {Object} executor Connexion SQL active.
 * @returns {Promise<void>}
 */
async function assurerJournalModificationsAffectationsScheduler(executor) {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS journal_modifications_affectations_scheduler (
      id_journal_modification_affectation INT NOT NULL AUTO_INCREMENT,
      id_session INT NOT NULL,
      id_utilisateur INT NULL,
      id_affectation_reference INT NOT NULL,
      id_planification_serie_reference INT NULL,
      portee VARCHAR(32) NOT NULL,
      mode_optimisation VARCHAR(32) NOT NULL,
      nb_occurrences_ciblees INT NOT NULL DEFAULT 1,
      statut VARCHAR(32) NOT NULL DEFAULT 'APPLIQUEE',
      anciennes_valeurs_json LONGTEXT NULL,
      nouvelles_valeurs_json LONGTEXT NULL,
      simulation_json LONGTEXT NULL,
      details_json LONGTEXT NULL,
      cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_journal_modification_affectation),
      KEY idx_modifications_affectations_session (id_session, cree_le),
      KEY idx_modifications_affectations_reference (id_affectation_reference, cree_le),
      CONSTRAINT fk_modifications_affectations_session
        FOREIGN KEY (id_session) REFERENCES sessions (id_session)
        ON DELETE CASCADE,
      CONSTRAINT fk_modifications_affectations_utilisateur
        FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs (id_utilisateur)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function assurerSchema(executor) {
  await assurerSessionScopeGroupesEtudiants(executor);
  await assurerTableAffectationEtudiants(executor);
  await assurerEchangesCoursEtudiants(executor);
  await assurerCoursEchouesEvolution(executor);
  await assurerPlanificationSeries(executor);
  await assurerRapportsGeneration(executor);
  await assurerJournalModificationsAffectationsScheduler(executor);
  await assurerIndexGroupesParSession(executor);
}

/**
 * Assure le schema minimal requis par les modules de scheduler academique.
 *
 * En environnement applicatif, le resultat est memorise pour eviter de
 * rejouer les memes verifications a chaque requete. En test, l'appel est
 * neutralise afin de laisser les fixtures maitriser entierement le schema.
 *
 * @param {Object} [executor=pool] Pool MySQL ou connexion transactionnelle.
 * @returns {Promise<void>}
 */
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
