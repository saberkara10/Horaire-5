
-- Migration v15 - Capsule sur la planification des cours echoues
--
-- Objectif:
--   - ajouter la capsule video expliquant le systeme de planification
--     des cours echoues
--   - fournir les metadonnees et la duree exactes


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
    'generation-planification' AS category_slug,
    'Comment fonctionne le systeme de planification des cours echoues, comment faire et lire le rapport detaille' AS title,
    'planification-cours-echoues' AS slug,
    'Explication du moteur, exemple concret de planification d un cours echoue et lecture guidee du rapport detaille.' AS short_description,
    'Cette capsule montre comment le moteur cherche une solution pour affecter un cours echoue, detaille les etapes du raisonnement, presente un exemple concret de planification et explique comment lire et comprendre le rapport detaille.' AS full_description,
    'uploads/help/videos/planification-cours-echoues.mp4' AS video_path,
    '["cours echoues","cours non planifies","rapport detaille","planification","comment faire"]' AS keywords_json,
    'generation' AS module_key,
    1053 AS duration_seconds,
    2 AS display_order
) AS seed
INNER JOIN help_categories AS categories
  ON categories.slug = seed.category_slug
LEFT JOIN help_videos AS existing_videos
  ON existing_videos.slug = seed.slug
WHERE existing_videos.id_video IS NULL;

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'generation-planification'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Comment fonctionne le systeme de planification des cours echoues, comment faire et lire le rapport detaille',
  videos.short_description = 'Explication du moteur, exemple concret de planification d un cours echoue et lecture guidee du rapport detaille.',
  videos.full_description = 'Cette capsule montre comment le moteur cherche une solution pour affecter un cours echoue, detaille les etapes du raisonnement, presente un exemple concret de planification et explique comment lire et comprendre le rapport detaille.',
  videos.video_path = 'uploads/help/videos/planification-cours-echoues.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["cours echoues","cours non planifies","rapport detaille","planification","comment faire"]',
  videos.module_key = 'generation',
  videos.duration_seconds = 1053,
  videos.display_order = 2,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'planification-cours-echoues';
