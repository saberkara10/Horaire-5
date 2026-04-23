-- ============================================================================
-- ROLE DU FICHIER
-- Bootstrap SQL canonique pour la version de schema v1.
-- Ce fichier cree la premiere structure de base exploitable du projet.
--
-- IMPACT SUR LE PROJET
-- - installe les tables coeur de GDH5
-- - insere les donnees de reference initiales utilisees par l'application
-- ============================================================================
-- migration_v1.sql
-- Base canonique du projet avant les evolutions v2+.

CREATE TABLE IF NOT EXISTS utilisateurs (
  id_utilisateur INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  motdepasse VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS salles (
  id_salle INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL,
  capacite INT NOT NULL
);

CREATE TABLE IF NOT EXISTS groupes_etudiants (
  id_groupes_etudiants INT AUTO_INCREMENT PRIMARY KEY,
  nom_groupe VARCHAR(100) NOT NULL,
  UNIQUE KEY nom_groupe (nom_groupe)
);

CREATE TABLE IF NOT EXISTS professeurs (
  id_professeur INT AUTO_INCREMENT PRIMARY KEY,
  matricule VARCHAR(50) NOT NULL UNIQUE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  specialite VARCHAR(150) NULL
);

CREATE TABLE IF NOT EXISTS programmes_reference (
  id_programme_reference INT AUTO_INCREMENT PRIMARY KEY,
  nom_programme VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS plages_horaires (
  id_plage_horaires INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS cours (
  id_cours INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  nom VARCHAR(150) NOT NULL,
  duree INT NOT NULL,
  programme VARCHAR(150) NOT NULL,
  etape_etude VARCHAR(50) NOT NULL,
  type_salle VARCHAR(50) NOT NULL,
  id_salle_reference INT NULL,
  archive TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_cours_salle_reference
    FOREIGN KEY (id_salle_reference) REFERENCES salles (id_salle)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS etudiants (
  id_etudiant INT AUTO_INCREMENT PRIMARY KEY,
  matricule VARCHAR(50) NOT NULL UNIQUE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  id_groupes_etudiants INT NULL,
  programme VARCHAR(150) NOT NULL,
  etape INT NOT NULL,
  CONSTRAINT fk_etudiants_groupes
    FOREIGN KEY (id_groupes_etudiants) REFERENCES groupes_etudiants (id_groupes_etudiants)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS disponibilites_professeurs (
  id_disponibilite_professeur INT AUTO_INCREMENT PRIMARY KEY,
  id_professeur INT NOT NULL,
  jour_semaine TINYINT NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  UNIQUE KEY uniq_disponibilite_professeur (
    id_professeur,
    jour_semaine,
    heure_debut,
    heure_fin
  ),
  CONSTRAINT fk_disponibilite_professeur
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE CASCADE,
  CONSTRAINT chk_disponibilite_jour
    CHECK (jour_semaine BETWEEN 1 AND 7),
  CONSTRAINT chk_disponibilite_heure
    CHECK (heure_debut < heure_fin)
);

CREATE TABLE IF NOT EXISTS professeur_cours (
  id_professeur_cours INT AUTO_INCREMENT PRIMARY KEY,
  id_professeur INT NOT NULL,
  id_cours INT NOT NULL,
  UNIQUE KEY uniq_professeur_cours (id_professeur, id_cours),
  CONSTRAINT fk_professeur_cours_professeur
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE CASCADE,
  CONSTRAINT fk_professeur_cours_cours
    FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS affectation_cours (
  id_affectation_cours INT AUTO_INCREMENT PRIMARY KEY,
  id_cours INT NOT NULL,
  id_professeur INT NOT NULL,
  id_salle INT NOT NULL,
  id_plage_horaires INT NOT NULL,
  CONSTRAINT fk_affectation_cours_cours
    FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
    ON DELETE RESTRICT,
  CONSTRAINT fk_affectation_cours_professeurs
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE RESTRICT,
  CONSTRAINT fk_affectation_cours_salles
    FOREIGN KEY (id_salle) REFERENCES salles (id_salle)
    ON DELETE RESTRICT,
  CONSTRAINT fk_affectation_cours_plages
    FOREIGN KEY (id_plage_horaires) REFERENCES plages_horaires (id_plage_horaires)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS affectation_groupes (
  id_affectation_groupes INT AUTO_INCREMENT PRIMARY KEY,
  id_groupes_etudiants INT NOT NULL,
  id_affectation_cours INT NOT NULL,
  UNIQUE KEY uniq_affectation_groupe (id_groupes_etudiants, id_affectation_cours),
  CONSTRAINT fk_affectation_groupes_groupes
    FOREIGN KEY (id_groupes_etudiants) REFERENCES groupes_etudiants (id_groupes_etudiants)
    ON DELETE CASCADE,
  CONSTRAINT fk_affectation_groupes_affectation
    FOREIGN KEY (id_affectation_cours) REFERENCES affectation_cours (id_affectation_cours)
    ON DELETE CASCADE
);

INSERT IGNORE INTO utilisateurs (nom, prenom, email, motdepasse, role)
VALUES
  (
    'Admin',
    'Systeme',
    'admin@ecole.ca',
    '$2b$10$wqZfdgYvDSrwYcUmVWdLHuocAiQqmA90YPzNw8GyqygY5IbZv924m',
    'ADMIN'
  ),
  (
    'Responsable',
    'General',
    'responsable@ecole.ca',
    'Resp123!',
    'ADMIN_RESPONSABLE'
  );

INSERT IGNORE INTO programmes_reference (nom_programme)
VALUES
  ('Techniques en administration des affaires'),
  ('Comptabilite et gestion'),
  ('Gestion de la chaine d''approvisionnement'),
  ('Marketing numerique'),
  ('Gestion hoteliere'),
  ('Gestion des services de restauration'),
  ('Techniques juridiques'),
  ('Education en services a l''enfance'),
  ('Travail social'),
  ('Soins infirmiers auxiliaires'),
  ('Techniques de laboratoire'),
  ('Programmation informatique'),
  ('Developpement Web'),
  ('Developpement mobile'),
  ('Intelligence artificielle appliquee'),
  ('Analyse de donnees'),
  ('Technologie des systemes informatiques - cybersecurite et reseautique'),
  ('Soutien informatique'),
  ('Design graphique'),
  ('Production multimedia');

INSERT IGNORE INTO salles (code, type, capacite)
VALUES
  ('A101', 'Salle de cours', 40),
  ('A102', 'Salle de cours', 40),
  ('B201', 'Laboratoire', 28),
  ('B202', 'Laboratoire', 28),
  ('C301', 'Atelier multimedia', 24),
  ('D401', 'Salle reseautique', 24);

INSERT IGNORE INTO professeurs (matricule, nom, prenom, specialite)
VALUES
  ('INF01', 'Bedreddine', 'Rafik', 'Programmation informatique'),
  ('INF02', 'Kara', 'Saber', 'Technologie des systemes informatiques - cybersecurite et reseautique'),
  ('CMRC06', 'Hamza', 'Abdelgheffar', 'Techniques en administration des affaires'),
  ('PROF1001', 'Tremblay', 'Sophie', 'Programmation informatique'),
  ('PROF1002', 'Bouchard', 'Marc', 'Programmation informatique'),
  ('PROF1003', 'Gagnon', 'Nadia', 'Programmation informatique'),
  ('PROF1004', 'Roy', 'Karim', 'Programmation informatique'),
  ('PROF1005', 'Lefebvre', 'Amine', 'Technologie des systemes informatiques - cybersecurite et reseautique'),
  ('PROF1006', 'Morin', 'Sarah', 'Technologie des systemes informatiques - cybersecurite et reseautique'),
  ('PROF1007', 'Cote', 'Yacine', 'Technologie des systemes informatiques - cybersecurite et reseautique');

INSERT IGNORE INTO cours (
  code,
  nom,
  duree,
  programme,
  etape_etude,
  type_salle,
  id_salle_reference
)
VALUES
  ('INF101', 'Introduction a la programmation', 2, 'Programmation informatique', '1', 'Laboratoire', 3),
  ('INF102', 'Logique de programmation', 2, 'Programmation informatique', '1', 'Laboratoire', 4),
  ('INF103', 'Mathematiques pour l''informatique', 2, 'Programmation informatique', '1', 'Salle de cours', 1),
  ('CYB101', 'Fondements reseautiques', 2, 'Technologie des systemes informatiques - cybersecurite et reseautique', '1', 'Salle reseautique', 6),
  ('CYB102', 'Securite des postes', 2, 'Technologie des systemes informatiques - cybersecurite et reseautique', '1', 'Laboratoire', 3),
  ('ADM101', 'Introduction a la gestion', 2, 'Techniques en administration des affaires', '1', 'Salle de cours', 2);

INSERT IGNORE INTO professeur_cours (id_professeur, id_cours)
VALUES
  (1, 1),
  (1, 2),
  (4, 1),
  (5, 2),
  (6, 3),
  (2, 4),
  (8, 4),
  (9, 5),
  (3, 6);
