-- migration_v10.sql
-- Evolution du module de planification manuelle :
-- 1. persistance des series de planification
-- 2. rattachement optionnel des affectations de cours a une recurrence

CREATE TABLE IF NOT EXISTS planification_series (
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
);

ALTER TABLE affectation_cours
  ADD COLUMN IF NOT EXISTS id_planification_serie INT NULL AFTER id_plage_horaires;

CREATE INDEX idx_affectation_cours_planification_serie
  ON affectation_cours (id_planification_serie);

ALTER TABLE affectation_cours
  ADD CONSTRAINT fk_affectation_cours_planification_serie
    FOREIGN KEY (id_planification_serie)
    REFERENCES planification_series (id_planification_serie)
    ON DELETE SET NULL;
