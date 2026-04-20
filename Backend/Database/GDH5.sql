

-- Installation complete de la base GDH5 pour un nouveau execteur de projet.

-- Ce fichier cree directement la base finale utile au projet.
-- Aucune migration supplementaire n'est necessaire pour demarrer.


DROP DATABASE IF EXISTS gdh5;

CREATE DATABASE IF NOT EXISTS gdh5
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gdh5;

CREATE TABLE IF NOT EXISTS utilisateurs (
  id_utilisateur INT NOT NULL AUTO_INCREMENT,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  motdepasse VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_by INT NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_utilisateur),
  UNIQUE KEY uniq_utilisateurs_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id_session INT NOT NULL AUTO_INCREMENT,
  nom VARCHAR(100) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_session)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salles (
  id_salle INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  capacite INT NOT NULL,
  PRIMARY KEY (id_salle),
  UNIQUE KEY uniq_salles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS indisponibilites_salles (
  id_indisponibilite_salle INT NOT NULL AUTO_INCREMENT,
  id_salle INT NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  type_indisponibilite VARCHAR(80) NOT NULL,
  motif VARCHAR(255) NULL,
  PRIMARY KEY (id_indisponibilite_salle),
  UNIQUE KEY uniq_indisponibilite_salle_periode (id_salle, date_debut, date_fin),
  CONSTRAINT fk_indisponibilite_salle
    FOREIGN KEY (id_salle) REFERENCES salles (id_salle)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS programmes_reference (
  id_programme_reference INT NOT NULL AUTO_INCREMENT,
  nom_programme VARCHAR(150) NOT NULL,
  PRIMARY KEY (id_programme_reference),
  UNIQUE KEY uniq_programmes_reference_nom (nom_programme)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS professeurs (
  id_professeur INT NOT NULL AUTO_INCREMENT,
  matricule VARCHAR(50) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  specialite VARCHAR(150) NULL,
  PRIMARY KEY (id_professeur),
  UNIQUE KEY uniq_professeur_matricule (matricule),
  UNIQUE KEY uniq_professeur_nom_prenom (nom, prenom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS groupes_etudiants (
  id_groupes_etudiants INT NOT NULL AUTO_INCREMENT,
  nom_groupe VARCHAR(100) NOT NULL,
  taille_max INT NOT NULL DEFAULT 30,
  est_groupe_special TINYINT(1) NOT NULL DEFAULT 0,
  id_session INT NULL,
  programme VARCHAR(150) NULL,
  etape INT NULL,
  PRIMARY KEY (id_groupes_etudiants),
  KEY idx_groupes_nom_groupe (nom_groupe),
  UNIQUE KEY uniq_groupes_session_nom (id_session, nom_groupe),
  CONSTRAINT fk_groupe_session
    FOREIGN KEY (id_session) REFERENCES sessions (id_session)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plages_horaires (
  id_plage_horaires INT NOT NULL AUTO_INCREMENT,
  date DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  PRIMARY KEY (id_plage_horaires),
  KEY idx_plages_horaires_date_heure (date, heure_debut, heure_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cours (
  id_cours INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  nom VARCHAR(150) NOT NULL,
  duree INT NOT NULL,
  programme VARCHAR(150) NOT NULL,
  etape_etude VARCHAR(50) NOT NULL,
  type_salle VARCHAR(50) NOT NULL,
  id_salle_reference INT NULL,
  archive TINYINT(1) NOT NULL DEFAULT 0,
  est_cours_cle TINYINT(1) NOT NULL DEFAULT 0,
  est_en_ligne TINYINT(1) NOT NULL DEFAULT 0,
  max_etudiants_par_groupe INT NOT NULL DEFAULT 30,
  min_etudiants_par_groupe INT NOT NULL DEFAULT 5,
  sessions_par_semaine INT NOT NULL DEFAULT 2,
  PRIMARY KEY (id_cours),
  UNIQUE KEY uniq_cours_code (code),
  CONSTRAINT fk_cours_salle_reference
    FOREIGN KEY (id_salle_reference) REFERENCES salles (id_salle)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS etudiants (
  id_etudiant INT NOT NULL AUTO_INCREMENT,
  matricule VARCHAR(50) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  id_groupes_etudiants INT NULL,
  programme VARCHAR(150) NOT NULL,
  etape INT NOT NULL,
  session VARCHAR(30) NOT NULL,
  annee INT NOT NULL,
  email VARCHAR(150) NULL,
  PRIMARY KEY (id_etudiant),
  UNIQUE KEY uniq_etudiants_matricule (matricule),
  UNIQUE KEY uniq_etudiants_email (email),
  CONSTRAINT fk_etudiants_groupes
    FOREIGN KEY (id_groupes_etudiants) REFERENCES groupes_etudiants (id_groupes_etudiants)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS disponibilites_professeurs (
  id_disponibilite_professeur INT NOT NULL AUTO_INCREMENT,
  id_professeur INT NOT NULL,
  jour_semaine TINYINT NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  date_debut_effet DATE NOT NULL DEFAULT '2000-01-01',
  date_fin_effet DATE NOT NULL DEFAULT '2099-12-31',
  PRIMARY KEY (id_disponibilite_professeur),
  KEY idx_disponibilite_professeur_effet (
    id_professeur,
    date_debut_effet,
    date_fin_effet,
    jour_semaine
  ),
  UNIQUE KEY uniq_disponibilite_professeur (
    id_professeur,
    jour_semaine,
    heure_debut,
    heure_fin,
    date_debut_effet,
    date_fin_effet
  ),
  CONSTRAINT fk_disponibilite_professeur
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE CASCADE,
  CONSTRAINT chk_disponibilite_jour
    CHECK (jour_semaine BETWEEN 1 AND 7),
  CONSTRAINT chk_disponibilite_heure
    CHECK (heure_debut < heure_fin),
  CONSTRAINT chk_disponibilite_effet
    CHECK (date_debut_effet <= date_fin_effet)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prerequis_cours (
  id INT NOT NULL AUTO_INCREMENT,
  id_cours_prerequis INT NOT NULL,
  id_cours_suivant INT NOT NULL,
  est_bloquant TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_prerequis (id_cours_prerequis, id_cours_suivant),
  CONSTRAINT fk_pre_cours
    FOREIGN KEY (id_cours_prerequis) REFERENCES cours (id_cours)
    ON DELETE CASCADE,
  CONSTRAINT fk_siv_cours
    FOREIGN KEY (id_cours_suivant) REFERENCES cours (id_cours)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cours_echoues (
  id INT NOT NULL AUTO_INCREMENT,
  id_etudiant INT NOT NULL,
  id_cours INT NOT NULL,
  id_session INT NULL,
  id_groupe_reprise INT NULL,
  statut ENUM(
    'a_reprendre',
    'planifie',
    'reussi',
    'en_ligne',
    'groupe_special',
    'resolution_manuelle'
  ) NOT NULL DEFAULT 'a_reprendre',
  note_echec DECIMAL(5,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_cours_echoue (id_etudiant, id_cours, id_session),
  KEY idx_cours_echoues_groupe_reprise (id_groupe_reprise),
  CONSTRAINT fk_ce_etudiant
    FOREIGN KEY (id_etudiant) REFERENCES etudiants (id_etudiant)
    ON DELETE CASCADE,
  CONSTRAINT fk_ce_cours
    FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
    ON DELETE CASCADE,
  CONSTRAINT fk_ce_session
    FOREIGN KEY (id_session) REFERENCES sessions (id_session)
    ON DELETE SET NULL,
  CONSTRAINT fk_cours_echoues_groupe_reprise
    FOREIGN KEY (id_groupe_reprise) REFERENCES groupes_etudiants (id_groupes_etudiants)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS absences_professeurs (
  id INT NOT NULL AUTO_INCREMENT,
  id_professeur INT NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'autre',
  commentaire TEXT NULL,
  approuve_par INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_abs_prof
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE CASCADE,
  CONSTRAINT fk_abs_user
    FOREIGN KEY (approuve_par) REFERENCES utilisateurs (id_utilisateur)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salles_indisponibles (
  id INT NOT NULL AUTO_INCREMENT,
  id_salle INT NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  raison VARCHAR(30) NOT NULL DEFAULT 'autre',
  commentaire TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_si_salle
    FOREIGN KEY (id_salle) REFERENCES salles (id_salle)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS professeur_cours (
  id_professeur_cours INT NOT NULL AUTO_INCREMENT,
  id_professeur INT NOT NULL,
  id_cours INT NOT NULL,
  PRIMARY KEY (id_professeur_cours),
  UNIQUE KEY uniq_professeur_cours (id_professeur, id_cours),
  CONSTRAINT fk_professeur_cours_professeur
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE CASCADE,
  CONSTRAINT fk_professeur_cours_cours
    FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS affectation_cours (
  id_affectation_cours INT NOT NULL AUTO_INCREMENT,
  id_cours INT NOT NULL,
  id_professeur INT NOT NULL,
  id_salle INT NULL,
  id_plage_horaires INT NOT NULL,
  id_planification_serie INT NULL,
  PRIMARY KEY (id_affectation_cours),
  KEY idx_affectation_cours_planification_serie (id_planification_serie),
  CONSTRAINT fk_affectation_cours_cours
    FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
    ON DELETE RESTRICT,
  CONSTRAINT fk_affectation_cours_professeurs
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE RESTRICT,
  CONSTRAINT fk_affectation_cours_salles
    FOREIGN KEY (id_salle) REFERENCES salles (id_salle)
    ON DELETE SET NULL,
  CONSTRAINT fk_affectation_cours_plages
    FOREIGN KEY (id_plage_horaires) REFERENCES plages_horaires (id_plage_horaires)
    ON DELETE CASCADE,
  CONSTRAINT fk_affectation_cours_planification_serie
    FOREIGN KEY (id_planification_serie) REFERENCES planification_series (id_planification_serie)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS affectation_groupes (
  id_affectation_groupes INT NOT NULL AUTO_INCREMENT,
  id_groupes_etudiants INT NOT NULL,
  id_affectation_cours INT NOT NULL,
  PRIMARY KEY (id_affectation_groupes),
  UNIQUE KEY uniq_affectation_groupe (id_groupes_etudiants, id_affectation_cours),
  CONSTRAINT fk_affectation_groupes_groupes
    FOREIGN KEY (id_groupes_etudiants) REFERENCES groupes_etudiants (id_groupes_etudiants)
    ON DELETE CASCADE,
  CONSTRAINT fk_affectation_groupes_affectation
    FOREIGN KEY (id_affectation_cours) REFERENCES affectation_cours (id_affectation_cours)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS affectation_etudiants (
  id_affectation_etudiant INT NOT NULL AUTO_INCREMENT,
  id_etudiant INT NOT NULL,
  id_groupes_etudiants INT NOT NULL,
  id_cours INT NOT NULL,
  id_session INT NOT NULL,
  source_type ENUM('reprise','individuelle') NOT NULL DEFAULT 'individuelle',
  id_cours_echoue INT NULL,
  id_echange_cours INT NULL,
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
  KEY idx_affectation_etudiants_echange_cours (id_echange_cours),
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
    ON DELETE SET NULL,
  CONSTRAINT fk_affectation_etudiants_echange_cours
    FOREIGN KEY (id_echange_cours) REFERENCES echanges_cours_etudiants (id_echange_cours)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rapports_generation (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS journal_modifications_affectations_scheduler (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO sessions (nom, date_debut, date_fin, active)
VALUES (
  'Session initiale',
  '2026-08-25',
  '2026-12-20',
  1
);

INSERT INTO utilisateurs (nom, prenom, email, motdepasse, role, actif, created_by)
VALUES (
  'Responsable',
  'Systeme',
  'responsable@ecole.ca',
  '$2b$10$PJBP4DGLXJKEIMr2IT1Y1.L0AXULTVrGHTZPgNqIOCXJpPRakAJn6',
  'ADMIN_RESPONSABLE',
  1,
  NULL
);
