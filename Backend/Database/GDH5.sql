CREATE DATABASE IF NOT EXISTS gestion_horaires;
USE gestion_horaires;

DROP TABLE IF EXISTS affectation_cours;
CREATE TABLE affectation_cours (
  id_affectation_cours INT AUTO_INCREMENT PRIMARY KEY,
  id_cours INT NOT NULL,
  id_professeur INT NOT NULL,
  id_salle INT NOT NULL,
  id_plage_horaires INT NOT NULL
);

DROP TABLE IF EXISTS affectation_groupes;
CREATE TABLE affectation_groupes (
  id_affectation_groupes INT AUTO_INCREMENT PRIMARY KEY,
  id_groupes_etudiants INT NOT NULL,
  id_affectation_cours INT NOT NULL
);

DROP TABLE IF EXISTS cours;
CREATE TABLE cours (
  id_cours INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  nom VARCHAR(150) NOT NULL,
  duree INT NOT NULL,
  programme VARCHAR(150) NOT NULL,
  etape_etude VARCHAR(50) NOT NULL,
  type_salle VARCHAR(50) NOT NULL,
  archive BOOLEAN DEFAULT FALSE
);

DROP TABLE IF EXISTS groupes_etudiants;
CREATE TABLE groupes_etudiants (
  id_groupes_etudiants INT AUTO_INCREMENT PRIMARY KEY,
  nom_groupe VARCHAR(100) NOT NULL UNIQUE
);

DROP TABLE IF EXISTS etudiants;
CREATE TABLE etudiants (
  id_etudiant INT AUTO_INCREMENT PRIMARY KEY,
  matricule VARCHAR(50) NOT NULL UNIQUE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  id_groupes_etudiants INT NOT NULL,
  programme VARCHAR(150) NOT NULL,
  etape INT NOT NULL
);

DROP TABLE IF EXISTS plages_horaires;
CREATE TABLE plages_horaires (
  id_plage_horaires INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL
);

DROP TABLE IF EXISTS professeurs;
CREATE TABLE professeurs (
  id_professeur INT AUTO_INCREMENT PRIMARY KEY,
  matricule VARCHAR(50) NOT NULL UNIQUE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  specialite VARCHAR(100)
);

DROP TABLE IF EXISTS salles;
CREATE TABLE salles (
  id_salle INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL,
  capacite INT NOT NULL
);

DROP TABLE IF EXISTS utilisateurs;
CREATE TABLE utilisateurs (
  id_utilisateur INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  motdepasse VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL
);

INSERT INTO utilisateurs (nom, prenom, email, motdepasse, role)
VALUES (
  'Admin',
  'Systeme',
  'admin@ecole.ca',
  'Admin123!',
  'ADMIN'
);
