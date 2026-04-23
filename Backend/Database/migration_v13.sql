
-- Migration v13 - Module Help

--
-- Objectif:
--   Ajouter le centre d'aide applicatif avec categories, guides video,
--   recherche par mots-cles et stockage media securise.
--
-- Regles de stockage:
--   - video_path stocke un chemin relatif de type uploads/help/videos/{slug}.mp4
--   - thumbnail_path stocke un chemin relatif de type
--     uploads/help/thumbnails/{slug}.jpg
--   - les fichiers sont servis uniquement via l'API authentifiee


CREATE TABLE IF NOT EXISTS help_categories (
  id_category INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT NULL,
  display_order SMALLINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_category),
  UNIQUE KEY uq_help_categories_slug (slug),
  KEY idx_help_categories_active_order (is_active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Categories du centre d aide';

CREATE TABLE IF NOT EXISTS help_videos (
  id_video INT NOT NULL AUTO_INCREMENT,
  id_category INT NOT NULL,
  title VARCHAR(220) NOT NULL,
  slug VARCHAR(220) NOT NULL,
  short_description VARCHAR(400) NULL,
  full_description TEXT NULL,
  video_path VARCHAR(500) NULL,
  thumbnail_path VARCHAR(500) NULL,
  keywords_json JSON NULL,
  module_key VARCHAR(80) NULL,
  duration_seconds INT UNSIGNED NULL,
  display_order SMALLINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_video),
  UNIQUE KEY uq_help_videos_slug (slug),
  KEY idx_help_videos_category (id_category),
  KEY idx_help_videos_active (is_active, is_published, display_order),
  KEY idx_help_videos_module_key (module_key),
  KEY idx_help_videos_created (created_at),
  CONSTRAINT fk_help_videos_category
    FOREIGN KEY (id_category) REFERENCES help_categories (id_category)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Guides video du centre d aide';

INSERT IGNORE INTO help_categories (
  name,
  slug,
  description,
  display_order,
  is_active
) VALUES
  (
    'Demarrage rapide',
    'demarrage-rapide',
    'Premiers pas dans l application, connexion et navigation.',
    1,
    1
  ),
  (
    'Gestion des horaires',
    'gestion-horaires',
    'Consultation, lecture et pilotage des horaires.',
    2,
    1
  ),
  (
    'Professeurs et disponibilites',
    'professeurs-disponibilites',
    'Gestion des enseignants et de leurs contraintes.',
    3,
    1
  ),
  (
    'Groupes et etudiants',
    'groupes-etudiants',
    'Imports, groupes pedagogiques et suivi etudiant.',
    4,
    1
  ),
  (
    'Exportation et rapports',
    'exportation-rapports',
    'Exports PDF, Excel et partage des plannings.',
    5,
    1
  );

INSERT INTO help_videos (
  id_category,
  title,
  slug,
  short_description,
  full_description,
  keywords_json,
  module_key,
  duration_seconds,
  display_order,
  is_active,
  is_published
)
SELECT
  categories.id_category,
  seed.title,
  seed.slug,
  seed.short_description,
  seed.full_description,
  seed.keywords_json,
  seed.module_key,
  seed.duration_seconds,
  seed.display_order,
  seed.is_active,
  seed.is_published
FROM (
  SELECT
    'demarrage-rapide' AS category_slug,
    'Connexion et prise en main' AS title,
    'connexion-prise-en-main' AS slug,
    'Accedez au portail et decouvrez les ecrans essentiels de l application.' AS short_description,
    'Ce guide presente la connexion, la reprise de session et les principaux reperes de navigation du portail.' AS full_description,
    '["connexion","login","mot de passe","navigation","tableau de bord"]' AS keywords_json,
    'dashboard' AS module_key,
    NULL AS duration_seconds,
    1 AS display_order,
    1 AS is_active,
    1 AS is_published

  UNION ALL

  SELECT
    'demarrage-rapide',
    'Comprendre le tableau de bord',
    'tableau-de-bord',
    'Lecture des indicateurs, alertes et resume de session.',
    'Ce guide aide a interpreter les statistiques, les alertes et les raccourcis proposes sur la page d accueil.',
    '["dashboard","accueil","statistiques","indicateurs"]',
    'dashboard',
    NULL,
    2,
    1,
    1

  UNION ALL

  SELECT
    'gestion-horaires',
    'Consulter les horaires d un groupe',
    'consulter-horaires-groupe',
    'Accedez rapidement au planning hebdomadaire d un groupe.',
    'Apprenez a selectionner une session, naviguer entre les semaines et verifier les plages libres d un groupe.',
    '["horaire","groupe","planning","session","semaine"]',
    'horaires',
    NULL,
    1,
    1,
    1

  UNION ALL

  SELECT
    'gestion-horaires',
    'Consulter les horaires d un professeur',
    'consulter-horaires-professeur',
    'Visualisez le planning complet d un enseignant.',
    'Ce guide montre comment filtrer par professeur et identifier les conflits ou les plages disponibles.',
    '["horaire","professeur","enseignant","planning","creneaux"]',
    'horaires',
    NULL,
    2,
    1,
    1

  UNION ALL

  SELECT
    'gestion-horaires',
    'Consulter l occupation des salles',
    'occupation-salles',
    'Suivez l utilisation des salles et reperez les disponibilites.',
    'Ce guide presente la lecture de la vue salles, les filtres de capacite et l analyse des conflits de reservation.',
    '["salle","occupation","reservation","disponibilite","capacite"]',
    'horaires',
    NULL,
    3,
    1,
    1

  UNION ALL

  SELECT
    'professeurs-disponibilites',
    'Saisir les disponibilites d un professeur',
    'saisir-disponibilites',
    'Enregistrez les contraintes hebdomadaires d un enseignant.',
    'Ce guide explique comment saisir les disponibilites et comment elles alimentent le moteur de generation.',
    '["disponibilite","professeur","contraintes","planning"]',
    'professeurs',
    NULL,
    1,
    1,
    1

  UNION ALL

  SELECT
    'professeurs-disponibilites',
    'Gerer les profils enseignants',
    'gestion-profils-enseignants',
    'Creation, modification et suivi des fiches professeurs.',
    'Apprenez a gerer les informations de specialite, de contact et de parametres academiques d un enseignant.',
    '["professeur","profil","specialite","ajout","modification"]',
    'professeurs',
    NULL,
    2,
    1,
    1

  UNION ALL

  SELECT
    'groupes-etudiants',
    'Importer une liste d etudiants',
    'importer-etudiants',
    'Import Excel pour ajouter rapidement une cohorte complete.',
    'Ce guide montre le format attendu, la validation des donnees et la lecture du resume d import.',
    '["import","etudiant","excel","cohorte","fichier"]',
    'etudiants',
    NULL,
    1,
    1,
    1

  UNION ALL

  SELECT
    'groupes-etudiants',
    'Gerer la structure des groupes',
    'gestion-groupes',
    'Organisez les groupes pedagogiques par programme et session.',
    'Ce guide couvre la creation des groupes, leur composition et leur lien avec les programmes academiques.',
    '["groupe","programme","session","organisation","pedagogie"]',
    'groupes',
    NULL,
    2,
    1,
    1

  UNION ALL

  SELECT
    'exportation-rapports',
    'Exporter un horaire en PDF',
    'exporter-horaire-pdf',
    'Generez un PDF propre pour un groupe, un professeur ou une salle.',
    'Ce guide presente les options d export, la lecture du rendu PDF et les usages impression ou partage.',
    '["export","pdf","impression","rapport","telechargement"]',
    'export',
    NULL,
    1,
    1,
    1

  UNION ALL

  SELECT
    'exportation-rapports',
    'Exporter les donnees en Excel',
    'exporter-donnees-excel',
    'Extrayez les plannings au format Excel pour analyses et suivis.',
    'Ce guide montre comment exporter en xlsx et reutiliser les donnees hors de l application.',
    '["export","excel","xlsx","analyse","rapport"]',
    'export',
    NULL,
    2,
    1,
    1
) AS seed
INNER JOIN help_categories AS categories
  ON categories.slug = seed.category_slug
LEFT JOIN help_videos AS existing_videos
  ON existing_videos.slug = seed.slug
WHERE existing_videos.id_video IS NULL;
