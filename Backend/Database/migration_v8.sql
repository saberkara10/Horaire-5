-- ============================================================================
-- ROLE DU FICHIER
-- Definition SQL pour la version de schema v8.
--
-- IMPACT SUR LE PROJET
-- - cree `affectation_etudiants`
-- - memorise le groupe de reprise choisi dans `cours_echoues`
-- - impose l'unicite du nom de groupe par session
-- ============================================================================
-- migration_v8.sql
-- Evolution enterprise pour :
-- 1. l'unicite des groupes par session
-- 2. les affectations individuelles etudiantes sur sections stables
-- 3. la persistance du groupe de reprise retenu pour un cours echoue

CREATE TABLE IF NOT EXISTS affectation_etudiants (
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
);

ALTER TABLE cours_echoues
  ADD COLUMN IF NOT EXISTS id_groupe_reprise INT NULL;

CREATE INDEX idx_cours_echoues_groupe_reprise
  ON cours_echoues (id_groupe_reprise);

ALTER TABLE cours_echoues
  ADD CONSTRAINT fk_cours_echoues_groupe_reprise
    FOREIGN KEY (id_groupe_reprise) REFERENCES groupes_etudiants (id_groupes_etudiants)
    ON DELETE SET NULL;

ALTER TABLE groupes_etudiants
  DROP INDEX nom_groupe;

CREATE INDEX idx_groupes_nom_groupe
  ON groupes_etudiants (nom_groupe);

CREATE UNIQUE INDEX uniq_groupes_session_nom
  ON groupes_etudiants (id_session, nom_groupe);
