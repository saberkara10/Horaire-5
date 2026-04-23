-- ============================================================
-- GDH5 — Migration v2 : Schéma étendu
-- ============================================================

-- 1. Mise à jour de la table utilisateurs (rôles + traçabilité)
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS created_by INT NULL,
  ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Mettre les rôles existants à jour vers la nomenclature v2
-- ADMIN existant → déjà ok
-- Ajouter le premier ADMIN_RESPONSABLE s'il n'existe pas
INSERT IGNORE INTO utilisateurs (nom, prenom, email, motdepasse, role)
VALUES (
  'Responsable',
  'Systeme',
  'responsable@ecole.ca',
  '$2b$10$d7rRkzZZ9VZw0BLx/Yq.L./w8UCy/NkBMgCGBGixKLJOmXF1z5WRe',
  'ADMIN_RESPONSABLE'
);

-- 2. Table sessions
CREATE TABLE IF NOT EXISTS sessions (
  id_session      INT AUTO_INCREMENT PRIMARY KEY,
  nom             VARCHAR(100) NOT NULL,
  date_debut      DATE         NOT NULL,
  date_fin        DATE         NOT NULL,
  active          BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Créer une session par défaut (active)
INSERT INTO sessions (nom, date_debut, date_fin, active)
SELECT 'Automne 2026', '2026-08-25', '2026-12-20', TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM sessions
  WHERE nom = 'Automne 2026'
    AND date_debut = '2026-08-25'
    AND date_fin = '2026-12-20'
);

-- 3. Extension de la table etudiants
ALTER TABLE etudiants
  MODIFY COLUMN id_groupes_etudiants INT NULL,
  ADD COLUMN IF NOT EXISTS session VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS annee INT NULL;

UPDATE etudiants
SET session = 'Automne'
WHERE session IS NULL OR TRIM(session) = '';

UPDATE etudiants
SET annee = 2026
WHERE annee IS NULL OR annee < 2000 OR annee > 2100;

ALTER TABLE etudiants
  MODIFY COLUMN session VARCHAR(30) NOT NULL,
  MODIFY COLUMN annee INT NOT NULL;

-- 4. Extension de la table cours
ALTER TABLE cours
  ADD COLUMN IF NOT EXISTS est_cours_cle          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS est_en_ligne            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_etudiants_par_groupe INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS min_etudiants_par_groupe INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sessions_par_semaine     INT NOT NULL DEFAULT 2;

-- La durée d'une séance est TOUJOURS 3h (contrainte système)
-- Le champ `duree` existant reste pour compatibilité

-- 4. Prérequis bloquants (cours clés)
CREATE TABLE IF NOT EXISTS prerequis_cours (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  id_cours_prerequis  INT NOT NULL,
  id_cours_suivant    INT NOT NULL,
  est_bloquant        BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uniq_prerequis (id_cours_prerequis, id_cours_suivant),
  CONSTRAINT fk_prerequis_cours
    FOREIGN KEY (id_cours_prerequis) REFERENCES cours(id_cours) ON DELETE CASCADE,
  CONSTRAINT fk_cours_suivant
    FOREIGN KEY (id_cours_suivant) REFERENCES cours(id_cours) ON DELETE CASCADE
);

-- 5. Cours échoués par étudiant
CREATE TABLE IF NOT EXISTS cours_echoues (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  id_etudiant INT NOT NULL,
  id_cours    INT NOT NULL,
  id_session  INT NULL,
  statut      ENUM('a_reprendre','planifie','reussi','en_ligne','groupe_special','resolution_manuelle')
              NOT NULL DEFAULT 'a_reprendre',
  note_echec  DECIMAL(5,2) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cours_echoue (id_etudiant, id_cours, id_session),
  CONSTRAINT fk_ce_etudiant
    FOREIGN KEY (id_etudiant) REFERENCES etudiants(id_etudiant) ON DELETE CASCADE,
  CONSTRAINT fk_ce_cours
    FOREIGN KEY (id_cours) REFERENCES cours(id_cours) ON DELETE CASCADE,
  CONSTRAINT fk_ce_session
    FOREIGN KEY (id_session) REFERENCES sessions(id_session) ON DELETE SET NULL
);

-- 6. Absences professeurs
CREATE TABLE IF NOT EXISTS absences_professeurs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_professeur   INT NOT NULL,
  date_debut      DATE NOT NULL,
  date_fin        DATE NOT NULL,
  type            ENUM('conge','maladie','formation','autre') NOT NULL DEFAULT 'autre',
  commentaire     TEXT NULL,
  approuve_par    INT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_absence_prof
    FOREIGN KEY (id_professeur) REFERENCES professeurs(id_professeur) ON DELETE CASCADE,
  CONSTRAINT fk_absence_approuve
    FOREIGN KEY (approuve_par) REFERENCES utilisateurs(id_utilisateur) ON DELETE SET NULL
);

-- 7. Salles indisponibles
CREATE TABLE IF NOT EXISTS salles_indisponibles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  id_salle    INT NOT NULL,
  date_debut  DATE NOT NULL,
  date_fin    DATE NOT NULL,
  raison      ENUM('maintenance','probleme_technique','reservation_externe','autre')
              NOT NULL DEFAULT 'autre',
  commentaire TEXT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_salle_indispo
    FOREIGN KEY (id_salle) REFERENCES salles(id_salle) ON DELETE CASCADE
);

-- 8. Extension groupes_etudiants
ALTER TABLE groupes_etudiants
  ADD COLUMN IF NOT EXISTS taille_max         INT     NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS est_groupe_special  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS id_session          INT     NULL,
  ADD COLUMN IF NOT EXISTS programme           VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS etape               INT     NULL;

-- Ajouter FK session sur groupes si elle n'existe pas
-- (on vérifie manuellement en cas d'erreur d'exécution)
ALTER TABLE groupes_etudiants
  ADD CONSTRAINT IF NOT EXISTS fk_groupe_session
    FOREIGN KEY (id_session) REFERENCES sessions(id_session) ON DELETE SET NULL;

-- 9. Rapport de génération
CREATE TABLE IF NOT EXISTS rapports_generation (
  id                          INT AUTO_INCREMENT PRIMARY KEY,
  id_session                  INT NULL,
  genere_par                  INT NULL,
  date_generation             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  score_qualite               DECIMAL(5,2) DEFAULT 0,
  nb_cours_planifies          INT NOT NULL DEFAULT 0,
  nb_cours_non_planifies      INT NOT NULL DEFAULT 0,
  nb_cours_echoues_traites    INT NOT NULL DEFAULT 0,
  nb_cours_en_ligne_generes   INT NOT NULL DEFAULT 0,
  nb_groupes_speciaux         INT NOT NULL DEFAULT 0,
  nb_resolutions_manuelles    INT NOT NULL DEFAULT 0,
  parametres                  JSON NULL,
  details                     JSON NULL,
  CONSTRAINT fk_rapport_session
    FOREIGN KEY (id_session) REFERENCES sessions(id_session) ON DELETE SET NULL,
  CONSTRAINT fk_rapport_user
    FOREIGN KEY (genere_par) REFERENCES utilisateurs(id_utilisateur) ON DELETE SET NULL
);

-- 10. Marquer INF101 comme cours clé (exemple)
UPDATE cours SET est_cours_cle = TRUE
WHERE code IN ('INF101', 'CYB101', 'ADM101');

-- ============================================================
-- Fin de la migration v2
-- ============================================================
