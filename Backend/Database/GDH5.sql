-- =============================================================================
-- ROLE DU FICHIER
-- Snapshot SQL historique du schema de base GDH5.
-- Ce fichier sert a comprendre le schema d'origine et les donnees semees, mais
-- l'installation normale du projet passe maintenant par le moteur de migration.
--
-- IMPACT SUR LE PROJET
-- - cree le schema legacy initial
-- - insere un premier jeu d'utilisateurs, salles, professeurs et cours
-- - sert surtout de reference historique et d'initialisation
-- =============================================================================
-- =============================================================================
-- SCHÉMA DE BASE DE DONNÉES INITIAL — GDH5 (Gestion Des Horaires v5)
-- =============================================================================
-- Ce fichier crée la structure complète de la base de données avec les données
-- initiales de démarrage (utilisateurs, salles, professeurs, cours de test).
--
-- Pour appliquer ce schéma :
--   mysql -u root -p < GDH5.sql
--
-- Note : Ce fichier représente le SCHÉMA DE BASE (v0). Les migrations ultérieures
-- (migration_v1.sql à migration_v12.sql) ajoutent les tables et colonnes manquantes.
-- En production, utiliser le moteur de migration automatique plutôt que ce fichier
-- seul, qui ne contient pas les améliorations des versions suivantes.
--
-- IMPORTANT sur la sécurité :
-- Le compte "responsable@ecole.ca" a son mot de passe en clair ("Resp123!").
-- Ce compte DOIT être mis à jour via l'interface admin avant la mise en production.
-- L'admin système utilise bcrypt (hash valide commençant par $2b$).
-- =============================================================================

-- Créer la base de données si elle n'existe pas encore et la sélectionner
CREATE DATABASE IF NOT EXISTS gdh5;
USE gdh5;

-- =============================================================================
-- TABLES PRINCIPALES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE : utilisateurs
-- Stocke les comptes des administrateurs et responsables du système.
-- ATTENTION : Ce schéma initial est LEGACY. Les migrations introduisent les tables
-- "roles" et "utilisateur_roles" pour remplacer la colonne `role` directe.
-- Le code backend gère les deux formats via le pattern executerAvecFallback().
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateurs (
  id_utilisateur INT AUTO_INCREMENT PRIMARY KEY,
  nom            VARCHAR(100) NOT NULL,
  prenom         VARCHAR(100) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,  -- Utilisé comme identifiant de connexion
  motdepasse     VARCHAR(255) NOT NULL,          -- Hash bcrypt ou texte clair (legacy)
  role           VARCHAR(50)  NOT NULL           -- Ex: 'ADMIN', 'RESPONSABLE', 'ADMIN_RESPONSABLE'
);

-- -----------------------------------------------------------------------------
-- TABLE : salles
-- Référentiel de toutes les salles physiques de l'établissement.
-- Le `type` est la contrainte clé : chaque cours exige un certain type de salle.
-- La `capacite` sert à calculer combien de groupes peuvent être formés.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salles (
  id_salle  INT AUTO_INCREMENT PRIMARY KEY,
  code      VARCHAR(50) NOT NULL UNIQUE,  -- Code identifiant unique (ex: "A-101", "LAB-B201")
  type      VARCHAR(50) NOT NULL,          -- Type de salle (ex: "Laboratoire", "Salle de cours")
  capacite  INT         NOT NULL           -- Nombre de places assises disponibles
);

-- -----------------------------------------------------------------------------
-- TABLE : groupes_etudiants
-- Un groupe est un ensemble d'étudiants qui partagent le même horaire cours.
-- Les migrations ultérieures ajoutent : programme, etape, est_groupe_special,
-- id_session (liaison avec la session académique active).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groupes_etudiants (
  id_groupes_etudiants INT AUTO_INCREMENT PRIMARY KEY,
  nom_groupe           VARCHAR(100) NOT NULL  -- Ex: "INF-1-A", "WEB-2-B"
);

-- -----------------------------------------------------------------------------
-- TABLE : professeurs
-- Référentiel de tous les enseignants disponibles pour planification.
-- La `specialite` détermine quels programmes ce professeur peut enseigner.
-- La clé unique composite (nom, prenom) évite les doublons sur le nom complet.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professeurs (
  id_professeur INT AUTO_INCREMENT PRIMARY KEY,
  matricule     VARCHAR(50)  NOT NULL UNIQUE,            -- Identifiant RH unique (ex: "INF01")
  nom           VARCHAR(100) NOT NULL,
  prenom        VARCHAR(100) NOT NULL,
  specialite    VARCHAR(150) NULL,                        -- Programme ou domaine principal
  UNIQUE KEY uniq_professeur_nom_prenom (nom, prenom)    -- Éviter les homonymes exacts
);

-- -----------------------------------------------------------------------------
-- TABLE : programmes_reference
-- Index centralisé de tous les programmes académiques reconnus par le système.
-- Alimenté automatiquement lors des imports et des créations de cours/étudiants.
-- Permet d'avoir une source de vérité unique pour les noms de programmes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programmes_reference (
  id_programme_reference INT AUTO_INCREMENT PRIMARY KEY,
  nom_programme          VARCHAR(150) NOT NULL UNIQUE  -- Nom officiel normalisé
);

-- -----------------------------------------------------------------------------
-- TABLE : plages_horaires
-- Représente un créneau temporel précis : une date + heure de début + heure de fin.
-- Utilisée comme référence partagée pour planifier les séances sans dupliquer
-- les informations de date/heure dans plusieurs tables.
-- Exemple : date=2025-01-20, heure_debut=08:00, heure_fin=10:00
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plages_horaires (
  id_plage_horaires INT AUTO_INCREMENT PRIMARY KEY,
  date              DATE NOT NULL,  -- Date du cours (format YYYY-MM-DD)
  heure_debut       TIME NOT NULL,  -- Heure de début du cours (format HH:MM:SS)
  heure_fin         TIME NOT NULL   -- Heure de fin du cours (format HH:MM:SS)
);

-- -----------------------------------------------------------------------------
-- TABLE : cours
-- Définit les matières enseignées dans chaque programme.
-- Chaque cours est associé à un programme, une étape, et un type de salle requis.
-- La salle_reference sert de modèle pour déterminer automatiquement le type de salle.
-- Le champ `archive` permet de masquer un cours sans le supprimer.
-- Clé étrangère : si la salle_reference est supprimée, on met NULL (ON DELETE SET NULL)
--   → le cours reste mais perd sa référence de salle.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cours (
  id_cours          INT AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(50)  NOT NULL UNIQUE,  -- Code unique (ex: "INF-1001")
  nom               VARCHAR(150) NOT NULL,          -- Intitulé complet du cours
  duree             INT          NOT NULL,          -- Durée en heures par séance
  programme         VARCHAR(150) NOT NULL,          -- Programme auquel appartient ce cours
  etape_etude       VARCHAR(50)  NOT NULL,          -- Étape académique (ex: "1", "2", "3")
  type_salle        VARCHAR(50)  NOT NULL,          -- Type de salle requis pour ce cours
  id_salle_reference INT         NULL,              -- Salle modèle (détermine le type_salle)
  archive           BOOLEAN      DEFAULT FALSE,     -- TRUE = cours masqué de l'interface
  CONSTRAINT fk_cours_salle_reference
    FOREIGN KEY (id_salle_reference) REFERENCES salles (id_salle)
    ON DELETE SET NULL  -- Si la salle est supprimée, le cours reste sans référence
);

-- -----------------------------------------------------------------------------
-- TABLE : etudiants
-- Référentiel de tous les étudiants inscrits.
-- Les étudiants sont liés à un groupe (id_groupes_etudiants) pour recevoir un horaire.
-- La contrainte `ON DELETE RESTRICT` empêche de supprimer un groupe qui a des étudiants.
-- Les champs programme/etape/session/annee définissent leur cohorte académique.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etudiants (
  id_etudiant          INT AUTO_INCREMENT PRIMARY KEY,
  matricule            VARCHAR(50)  NOT NULL UNIQUE,  -- Identifiant académique unique
  nom                  VARCHAR(100) NOT NULL,
  prenom               VARCHAR(100) NOT NULL,
  id_groupes_etudiants INT          NULL,             -- NULL si l'étudiant n'est pas encore groupé
  programme            VARCHAR(150) NOT NULL,         -- Programme d'études
  etape                INT          NOT NULL,         -- Étape académique (1, 2, 3...)
  session              VARCHAR(20)  NOT NULL,         -- Session (Automne, Hiver, Printemps, Été)
  annee                SMALLINT     NOT NULL,         -- Année scolaire (ex: 2025)
  CONSTRAINT fk_etudiants_groupes
    FOREIGN KEY (id_groupes_etudiants) REFERENCES groupes_etudiants (id_groupes_etudiants)
    ON DELETE RESTRICT  -- Empêche la suppression d'un groupe qui contient des étudiants
);

-- -----------------------------------------------------------------------------
-- TABLE : disponibilites_professeurs
-- Plages horaires hebdomadaires pendant lesquelles un professeur est disponible.
-- Chaque ligne = un jour de la semaine + heure de début/fin.
-- La contrainte unique empêche les doublons pour le même professeur/jour/heure.
-- La contrainte CHECK vérifie que heure_debut < heure_fin (cohérence logique).
-- La clé étrangère avec ON DELETE CASCADE supprime les disponibilités si le professeur
-- est supprimé (nettoyage automatique des données liées).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disponibilites_professeurs (
  id_disponibilite_professeur INT AUTO_INCREMENT PRIMARY KEY,
  id_professeur               INT     NOT NULL,
  jour_semaine                TINYINT NOT NULL,  -- 1=Lundi, 2=Mardi, ..., 7=Dimanche
  heure_debut                 TIME    NOT NULL,
  heure_fin                   TIME    NOT NULL,
  UNIQUE KEY uniq_disponibilite_professeur (
    id_professeur,
    jour_semaine,
    heure_debut,
    heure_fin
  ),
  CONSTRAINT fk_disponibilite_professeur
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE CASCADE,  -- Supprime les disponibilités si le professeur est supprimé
  CONSTRAINT chk_disponibilite_jour
    CHECK (jour_semaine BETWEEN 1 AND 7),  -- Valeurs valides : 1 (Lundi) à 7 (Dimanche)
  CONSTRAINT chk_disponibilite_heure
    CHECK (heure_debut < heure_fin)        -- Logique temporelle : début avant fin
);

-- -----------------------------------------------------------------------------
-- TABLE : professeur_cours
-- Table de liaison many-to-many entre professeurs et cours.
-- Définit quels cours un professeur est habilité à enseigner.
-- Les deux clés étrangères avec ON DELETE CASCADE permettent un nettoyage propre :
-- si un professeur ou un cours est supprimé, l'habilitation correspondante disparaît.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professeur_cours (
  id_professeur_cours INT AUTO_INCREMENT PRIMARY KEY,
  id_professeur       INT NOT NULL,
  id_cours            INT NOT NULL,
  UNIQUE KEY uniq_professeur_cours (id_professeur, id_cours),  -- Pas de doublon d'habilitation
  CONSTRAINT fk_professeur_cours_professeur
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE CASCADE,
  CONSTRAINT fk_professeur_cours_cours
    FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
    ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- TABLE : affectation_cours
-- Une affectation = une séance planifiée : un cours donné par un professeur,
-- dans une salle précise, à une plage horaire déterminée.
-- C'est la table centrale du planning généré par le scheduler.
-- Les clés étrangères RESTRICT protègent les données :
--  - On ne peut pas supprimer un cours/professeur/salle utilisé dans le planning.
--  - ON DELETE CASCADE pour plagehhoraires: si la plage est supprimée, la séance disparaît.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affectation_cours (
  id_affectation_cours INT AUTO_INCREMENT PRIMARY KEY,
  id_cours             INT NOT NULL,  -- Le cours planifié
  id_professeur        INT NOT NULL,  -- Le professeur qui donne le cours
  id_salle             INT NOT NULL,  -- La salle où le cours a lieu
  id_plage_horaires    INT NOT NULL,  -- La date et l'heure du cours
  CONSTRAINT fk_affectation_cours_cours
    FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
    ON DELETE RESTRICT,  -- Ne pas supprimer un cours planifié sans nettoyer le planning
  CONSTRAINT fk_affectation_cours_professeurs
    FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
    ON DELETE RESTRICT,
  CONSTRAINT fk_affectation_cours_salles
    FOREIGN KEY (id_salle) REFERENCES salles (id_salle)
    ON DELETE RESTRICT,
  CONSTRAINT fk_affectation_cours_plages
    FOREIGN KEY (id_plage_horaires) REFERENCES plages_horaires (id_plage_horaires)
    ON DELETE CASCADE  -- Si la plage est supprimée, la séance n'a plus de sens → cascade
);

-- -----------------------------------------------------------------------------
-- TABLE : affectation_groupes
-- Lie un groupe d'étudiants à une affectation de cours.
-- C'est par cette table qu'on sait quels groupes assistent à quelle séance.
-- La clé unique (id_groupes_etudiants, id_affectation_cours) empêche qu'un groupe
-- soit inscrit deux fois à la même séance.
-- Les deux ON DELETE CASCADE permettent un nettoyage propre : si le groupe ou
-- la séance disparaît, le lien est supprimé automatiquement.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affectation_groupes (
  id_affectation_groupes INT AUTO_INCREMENT PRIMARY KEY,
  id_groupes_etudiants   INT NOT NULL,
  id_affectation_cours   INT NOT NULL,
  UNIQUE KEY uniq_affectation_groupe (id_groupes_etudiants, id_affectation_cours),
  CONSTRAINT fk_affectation_groupes_groupes
    FOREIGN KEY (id_groupes_etudiants) REFERENCES groupes_etudiants (id_groupes_etudiants)
    ON DELETE CASCADE,
  CONSTRAINT fk_affectation_groupes_affectation
    FOREIGN KEY (id_affectation_cours) REFERENCES affectation_cours (id_affectation_cours)
    ON DELETE CASCADE
);

-- =============================================================================
-- DONNÉES INITIALES DE DÉMARRAGE
-- =============================================================================
-- Toutes les insertions utilisent INSERT IGNORE pour être idempotentes :
-- si les données existent déjà, rien n'est modifié. On peut relancer ce script
-- sans risque de dupliquer des entrées.
-- =============================================================================

-- Comptes utilisateurs de démarrage
-- SÉCURITÉ : Le mot de passe de responsable@ecole.ca est en clair dans ce fichier.
-- Ce compte DOIT être mis à jour via l'interface d'administration avant toute
-- mise en production ou partage de ce fichier.
INSERT IGNORE INTO utilisateurs (nom, prenom, email, motdepasse, role)
VALUES
(
  'Admin',
  'Systeme',
  'admin@ecole.ca',
  -- Hash bcrypt valide (cost=10) du mot de passe Admin123! (changer en production)
  '$2b$10$wqZfdgYvDSrwYcUmVWdLHuocAiQqmA90YPzNw8GyqygY5IbZv924m',
  'ADMIN'
),
(
  'Responsable',
  'General',
  'responsable@ecole.ca',
  -- ATTENTION : mot de passe en clair — migration bcrypt requise avant la production
  'Resp123!',
  'ADMIN_RESPONSABLE'
);

-- Programmes académiques officiels reconnus par le système
-- Ces noms DOIVENT correspondre exactement aux valeurs dans PROGRAMMES_OFFICIELS (utils/programmes.js)
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

-- Salles initiales de démonstration
-- À remplacer par les vraies salles de l'établissement avant la production
INSERT IGNORE INTO salles (code, type, capacite)
VALUES
  ('A101', 'Salle de cours',    40),  -- Salle théorique capacité 40
  ('A102', 'Salle de cours',    40),
  ('B201', 'Laboratoire',       28),  -- Lab informatique capacité 28
  ('B202', 'Laboratoire',       28),
  ('C301', 'Atelier multimedia', 24), -- Atelier multimédia
  ('D401', 'Salle reseautique', 24);  -- Salle équipée pour la réseautique

-- Professeurs initiaux de démonstration
-- matricule = identifiant RH unique dans l'établissement
INSERT IGNORE INTO professeurs (matricule, nom, prenom, specialite)
VALUES
  ('INF01',    'Bedreddine', 'Rafik',          'Programmation informatique'),
  ('INF02',    'Kara',       'Saber',           'Technologie des systemes informatiques - cybersecurite et reseautique'),
  ('CMRC06',   'Hamza',      'Abdelgheffar',    'Techniques en administration des affaires'),
  ('PROF1001', 'Tremblay',   'Sophie',          'Programmation informatique'),
  ('PROF1002', 'Bouchard',   'Marc',            'Programmation informatique'),
  ('PROF1003', 'Gagnon',     'Nadia',           'Programmation informatique'),
  ('PROF1004', 'Roy',        'Karim',           'Programmation informatique'),
  ('PROF1005', 'Lefebvre',   'Amine',           'Technologie des systemes informatiques - cybersecurite et reseautique'),
  ('PROF1006', 'Morin',      'Sarah',           'Technologie des systemes informatiques - cybersecurite et reseautique'),
  ('PROF1007', 'Cote',       'Yacine',          'Technologie des systemes informatiques - cybersecurite et reseautique');

-- Cours initiaux de démonstration
-- id_salle_reference : l'ID de la salle (3=B201 Laboratoire, 4=B202 Laboratoire, etc.)
-- Le type_salle dans la table est déduit du type de la salle de référence.
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
  -- Cours Programmation informatique — Étape 1
  ('INF101', 'Introduction a la programmation',      2, 'Programmation informatique', '1', 'Laboratoire',       3),
  ('INF102', 'Logique de programmation',             2, 'Programmation informatique', '1', 'Laboratoire',       4),
  ('INF103', 'Mathematiques pour l''informatique',  2, 'Programmation informatique', '1', 'Salle de cours',    1),
  -- Cours Réseautique/Cybersécurité — Étape 1
  ('CYB101', 'Fondements reseautiques',              2, 'Technologie des systemes informatiques - cybersecurite et reseautique', '1', 'Salle reseautique', 6),
  ('CYB102', 'Securite des postes',                  2, 'Technologie des systemes informatiques - cybersecurite et reseautique', '1', 'Laboratoire',       3),
  -- Cours Administration — Étape 1
  ('ADM101', 'Introduction a la gestion',            2, 'Techniques en administration des affaires', '1', 'Salle de cours', 2);

-- Habilitations : quel professeur peut enseigner quel cours
-- Les IDs référencent les professeurs et cours dans leur ordre d'insertion ci-dessus.
-- Chaque ligne = ce professeur EST qualifié pour enseigner ce cours.
INSERT IGNORE INTO professeur_cours (id_professeur, id_cours)
VALUES
  (1, 1),  -- Bedreddine → INF101 (Introduction à la programmation)
  (1, 2),  -- Bedreddine → INF102 (Logique de programmation)
  (4, 1),  -- Tremblay   → INF101
  (5, 2),  -- Bouchard   → INF102
  (6, 3),  -- Gagnon     → INF103 (Mathématiques)
  (2, 4),  -- Kara       → CYB101 (Fondements réseautiques)
  (8, 4),  -- Lefebvre   → CYB101
  (9, 5),  -- Morin      → CYB102 (Sécurité des postes)
  (3, 6);  -- Hamza      → ADM101 (Introduction à la gestion)
