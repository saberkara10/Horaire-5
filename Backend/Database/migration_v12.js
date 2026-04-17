/**
 * Logique d'audit scheduler de la migration v12.
 *
 * Role:
 * - cree la trace d'audit des changements manuels ou simules du scheduler
 *
 * Impact sur le projet:
 * - ajoute `journal_modifications_affectations_scheduler`
 * - rend tracables les optimisations et reaffectations
 */
export async function isApplied({ connection, tools }) {
  return (
    (await tools.tableExists(
      connection,
      "journal_modifications_affectations_scheduler"
    )) &&
    (await tools.indexExists(
      connection,
      "journal_modifications_affectations_scheduler",
      "idx_modifications_affectations_session"
    )) &&
    (await tools.indexExists(
      connection,
      "journal_modifications_affectations_scheduler",
      "idx_modifications_affectations_reference"
    )) &&
    (await tools.constraintExists(
      connection,
      "journal_modifications_affectations_scheduler",
      "fk_modifications_affectations_session"
    )) &&
    (await tools.constraintExists(
      connection,
      "journal_modifications_affectations_scheduler",
      "fk_modifications_affectations_utilisateur"
    ))
  );
}

export async function up({ connection }) {
  await connection.query(
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
