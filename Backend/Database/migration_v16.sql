-- =============================================================================
-- Migration v16 - Capsules dashboard, occupation salles et sous-admin
-- =============================================================================
--
-- Objectif:
--   - raccorder les nouvelles capsules video reelles
--   - enrichir les metadonnees de dashboard et occupation salles
--   - ajouter la capsule de gestion des sous-admins
-- =============================================================================

INSERT IGNORE INTO help_categories (
  name,
  slug,
  description,
  display_order,
  is_active
) VALUES
  (
    'Administration applicative',
    'administration-applicative',
    'Gestion des roles administratifs, delegations et comptes de supervision.',
    8,
    1
  );

INSERT INTO help_videos (
  id_category,
  title,
  slug,
  short_description,
  full_description,
  video_path,
  thumbnail_path,
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
  seed.video_path,
  NULL AS thumbnail_path,
  seed.keywords_json,
  seed.module_key,
  seed.duration_seconds,
  seed.display_order,
  1 AS is_active,
  1 AS is_published
FROM (
  SELECT
    'administration-applicative' AS category_slug,
    'Sous-admin : roles, ajout, modification et suppression' AS title,
    'gestion-admins' AS slug,
    'Responsabilites du responsable administratif et de l admin, puis gestion complete d un sous-admin avec un exemple reel.' AS short_description,
    'Cette capsule explique les responsabilites du responsable administratif et de l admin, puis montre comment ajouter, modifier et supprimer un sous-admin avec un exemple reel.' AS full_description,
    'uploads/help/videos/gestion-admins.mp4' AS video_path,
    '["responsable administratif","admin","ajouter sous admin","modifier admin","supprimer admin"]' AS keywords_json,
    'administration' AS module_key,
    184 AS duration_seconds,
    1 AS display_order
) AS seed
INNER JOIN help_categories AS categories
  ON categories.slug = seed.category_slug
LEFT JOIN help_videos AS existing_videos
  ON existing_videos.slug = seed.slug
WHERE existing_videos.id_video IS NULL;

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'demarrage-rapide'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Comprendre le tableau de bord',
  videos.short_description = 'Lecture des informations, indicateurs et blocs de pilotage visibles sur le dashboard.',
  videos.full_description = 'Cette capsule explique comment lire le tableau de bord, comprendre le role de chaque bloc d information et utiliser les indicateurs pour orienter les prochaines actions.',
  videos.video_path = 'uploads/help/videos/tableau-de-bord.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["tableau de bord","indicateurs","informations dashboard","session active","resume global"]',
  videos.module_key = 'dashboard',
  videos.duration_seconds = 199,
  videos.display_order = 2,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'tableau-de-bord';

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'gestion-horaires'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Occupation salles : role, temps reel et statistiques',
  videos.short_description = 'Role du module, lecture des disponibilites en temps reel et interpretation des statistiques des salles.',
  videos.full_description = 'Cette capsule explique le role du module Occupation salles, comment voir en temps reel l occupation et la disponibilite des salles, et comment lire les statistiques associees.',
  videos.video_path = 'uploads/help/videos/occupation-salles.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["occupation salles","temps reel","disponibilites salles","statistiques salles","role module salles"]',
  videos.module_key = 'occupation-salles',
  videos.duration_seconds = 189,
  videos.display_order = 3,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'occupation-salles';

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'administration-applicative'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Sous-admin : roles, ajout, modification et suppression',
  videos.short_description = 'Responsabilites du responsable administratif et de l admin, puis gestion complete d un sous-admin avec un exemple reel.',
  videos.full_description = 'Cette capsule explique les responsabilites du responsable administratif et de l admin, puis montre comment ajouter, modifier et supprimer un sous-admin avec un exemple reel.',
  videos.video_path = 'uploads/help/videos/gestion-admins.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["responsable administratif","admin","ajouter sous admin","modifier admin","supprimer admin"]',
  videos.module_key = 'administration',
  videos.duration_seconds = 184,
  videos.display_order = 1,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'gestion-admins';
