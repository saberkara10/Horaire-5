-- ============================================================================
-- ROLE DU FICHIER
-- Definition SQL pour la version de schema v6.
--
-- IMPACT SUR LE PROJET
-- - cree `journal_replanifications_disponibilites`
-- - donne au projet une piste d'audit pour les replanifications liees aux disponibilites
-- ============================================================================
-- migration_v6.sql
-- Journal des replanifications liees aux disponibilites professeurs.

CREATE TABLE IF NOT EXISTS journal_replanifications_disponibilites (
  id_journal_replanification INT NOT NULL AUTO_INCREMENT,
  id_professeur INT NOT NULL,
  source_operation VARCHAR(64) NOT NULL DEFAULT 'disponibilites_professeur',
  statut VARCHAR(32) NOT NULL,
  seances_concernees INT NOT NULL DEFAULT 0,
  seances_replanifiees INT NOT NULL DEFAULT 0,
  seances_replanifiees_meme_semaine INT NOT NULL DEFAULT 0,
  seances_reportees_semaines_suivantes INT NOT NULL DEFAULT 0,
  seances_non_replanifiees INT NOT NULL DEFAULT 0,
  disponibilites_avant_json LONGTEXT NULL,
  disponibilites_apres_json LONGTEXT NULL,
  resume_json LONGTEXT NULL,
  details_json LONGTEXT NULL,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_journal_replanification),
  KEY idx_journal_replanifications_professeur (id_professeur, cree_le),
  CONSTRAINT fk_journal_replanifications_professeur
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE CASCADE
);
