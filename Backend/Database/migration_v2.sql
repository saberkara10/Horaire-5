-- ============================================================================
-- ROLE DU FICHIER
-- Definition SQL pour la version de schema v2.
-- Elle etend le schema d'origine vers le premier flux metier complet.
--
-- IMPACT SUR LE PROJET
-- - ajoute les sessions et le support des rapports
-- - ajoute les cours echoues, absences et indisponibilites de salles
-- - enrichit les utilisateurs, etudiants, cours et groupes
-- ============================================================================
-- migration_v2.sql
-- Extension fonctionnelle initiale du schema.

ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS created_by INT NULL,
  ADD COLUMN IF NOT EXISTS actif TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS sessions (
  id_session INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE etudiants
  MODIFY COLUMN id_groupes_etudiants INT NULL,
  ADD COLUMN IF NOT EXISTS session VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS annee INT NULL;

ALTER TABLE cours
  ADD COLUMN IF NOT EXISTS est_cours_cle TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS est_en_ligne TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_etudiants_par_groupe INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS min_etudiants_par_groupe INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sessions_par_semaine INT NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS prerequis_cours (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_cours_prerequis INT NOT NULL,
  id_cours_suivant INT NOT NULL,
  est_bloquant TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uniq_prerequis (id_cours_prerequis, id_cours_suivant),
  CONSTRAINT fk_pre_cours
    FOREIGN KEY (id_cours_prerequis) REFERENCES cours(id_cours) ON DELETE CASCADE,
  CONSTRAINT fk_siv_cours
    FOREIGN KEY (id_cours_suivant) REFERENCES cours(id_cours) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cours_echoues (
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
);

CREATE TABLE IF NOT EXISTS absences_professeurs (
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
);

CREATE TABLE IF NOT EXISTS salles_indisponibles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_salle INT NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  raison VARCHAR(30) NOT NULL DEFAULT 'autre',
  commentaire TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_si_salle
    FOREIGN KEY (id_salle) REFERENCES salles(id_salle) ON DELETE CASCADE
);

ALTER TABLE groupes_etudiants
  ADD COLUMN IF NOT EXISTS taille_max INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS est_groupe_special TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS id_session INT NULL,
  ADD COLUMN IF NOT EXISTS programme VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS etape INT NULL;

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
  CONSTRAINT fk_rg_session
    FOREIGN KEY (id_session) REFERENCES sessions(id_session) ON DELETE SET NULL,
  CONSTRAINT fk_rg_user
    FOREIGN KEY (genere_par) REFERENCES utilisateurs(id_utilisateur) ON DELETE SET NULL
);
