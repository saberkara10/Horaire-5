-- ============================================================================
-- ROLE DU FICHIER
-- Definition SQL pour la version de schema v11.
--
-- IMPACT SUR LE PROJET
-- - cree `echanges_cours_etudiants`
-- - relie les affectations etudiantes a un enregistrement d'echange optionnel
-- ============================================================================
-- migration_v11.sql
-- Evolution du module etudiant :
-- 1. tracabilite des echanges cibles de cours entre etudiants
-- 2. rattachement optionnel des affectations individuelles a un echange

CREATE TABLE IF NOT EXISTS echanges_cours_etudiants (
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
);

ALTER TABLE affectation_etudiants
  ADD COLUMN IF NOT EXISTS id_echange_cours INT NULL AFTER id_cours_echoue;

CREATE INDEX idx_affectation_etudiants_echange_cours
  ON affectation_etudiants (id_echange_cours);

ALTER TABLE affectation_etudiants
  ADD CONSTRAINT fk_affectation_etudiants_echange_cours
    FOREIGN KEY (id_echange_cours)
    REFERENCES echanges_cours_etudiants (id_echange_cours)
    ON DELETE SET NULL;
