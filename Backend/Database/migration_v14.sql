
-- Migration v14 - Integration des capsules video reelles du centre d'aide

--
-- Objectif:
--   - raccorder les fichiers video reels aux bons slugs help
--   - enrichir les metadonnees des capsules principales
--   - ajouter les entrees manquantes pour Generation, Pilotage session
--     et Horaires etudiants


INSERT IGNORE INTO help_categories (
  name,
  slug,
  description,
  display_order,
  is_active
) VALUES
  (
    'Generation et planification',
    'generation-planification',
    'Generation ciblee, planification manuelle, reprises et simulation.',
    6,
    1
  ),
  (
    'Pilotage de session',
    'pilotage-session',
    'Creation de session, optimisation, historique et rapports detailles.',
    7,
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
    'groupes-etudiants' AS category_slug,
    'Horaire etudiant, fiche detaillee et echange controle' AS title,
    'horaires-etudiants-what-if' AS slug,
    'Recherche etudiante, fiche detaillee, export et modification d un cours entre etudiants compatibles.' AS short_description,
    'Cette capsule montre la recherche d un etudiant, la lecture de son horaire, l export, la consultation de sa fiche detaillee et l option de modifier un cours entre etudiants du meme programme et de la meme etape.' AS full_description,
    'uploads/help/videos/horaires-etudiants-what-if.mp4' AS video_path,
    '["horaire etudiant","liste etudiants","fiche detaillee","echange","meme programme","meme etape"]' AS keywords_json,
    'horaires-etudiants' AS module_key,
    489 AS duration_seconds,
    3 AS display_order

  UNION ALL

  SELECT
    'generation-planification',
    'Module Generer : generation, reprises et simulation what-if',
    'generer-un-planning',
    'Generation ciblee, reprises, legacy, planification manuelle et modification des affectations.' AS short_description,
    'Cette capsule presente de bout en bout le module Generer: generation pour un programme et une etape, reprises d etudiants non planifies, simulation what-if, legacy, planification manuelle, modification d une planification existante et lecture de toutes les planifications de la session.' AS full_description,
    'uploads/help/videos/generer-un-planning.mp4',
    '["generation","what-if","legacy","planification manuelle","reprise etudiant","modifier planification"]',
    'generation',
    1079,
    1

  UNION ALL

  SELECT
    'pilotage-session',
    'Pilotage session : creation, optimisation et rapport detaille',
    'pilotage-session-generation',
    'Creation de session, choix du mode d optimisation, historique et lecture du rapport detaille.' AS short_description,
    'Cette capsule montre comment creer une session, verifier les prerequis, choisir un mode d optimisation, lancer une generation, basculer entre les sessions et lire l historique avec scores, cours non planifies, causes et suggestions de correction manuelle.' AS full_description,
    'uploads/help/videos/pilotage-session-generation.mp4',
    '["creer session","mode optimisation","historique","rapport detaille","cours non planifies"]',
    'pilotage-session',
    815,
    1
) AS seed
INNER JOIN help_categories AS categories
  ON categories.slug = seed.category_slug
LEFT JOIN help_videos AS existing_videos
  ON existing_videos.slug = seed.slug
WHERE existing_videos.id_video IS NULL;

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'gestion-horaires'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Horaire de groupe : filtres et export',
  videos.short_description = 'Choix du groupe, application des filtres et export du planning.',
  videos.full_description = 'Cette capsule montre comment choisir un groupe, appliquer les filtres utiles, consulter son horaire puis l exporter proprement.',
  videos.video_path = 'uploads/help/videos/consulter-horaires-groupe.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["horaire groupe","choisir groupe","filtrer horaire groupe","exporter horaire groupe"]',
  videos.module_key = 'horaires-groupes',
  videos.duration_seconds = 72,
  videos.display_order = 1,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'consulter-horaires-groupe';

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'gestion-horaires'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Horaire professeur : consultation et export',
  videos.short_description = 'Choix du professeur, lecture de son planning et export du resultat.',
  videos.full_description = 'Cette capsule montre comment choisir un professeur, visualiser son horaire puis exporter le resultat pour partage ou verification.',
  videos.video_path = 'uploads/help/videos/consulter-horaires-professeur.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["horaire professeur","choisir professeur","voir horaire professeur","exporter horaire professeur"]',
  videos.module_key = 'horaires-professeurs',
  videos.duration_seconds = 99,
  videos.display_order = 2,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'consulter-horaires-professeur';

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'professeurs-disponibilites'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Disponibilites professeur et replanification automatique',
  videos.short_description = 'Choix du professeur, modification des plages et controle des cours automatiquement replanifies.',
  videos.full_description = 'Cette capsule montre comment consulter les disponibilites d un professeur, les modifier sur une seance, une periode ou jusqu a la fin de session, puis verifier la replanification automatique des horaires professeur et groupe concernes.',
  videos.video_path = 'uploads/help/videos/saisir-disponibilites.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["disponibilites professeur","modifier disponibilites","fin de session","replanification automatique"]',
  videos.module_key = 'disponibilites',
  videos.duration_seconds = 441,
  videos.display_order = 1,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'saisir-disponibilites';

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'groupes-etudiants'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Gestion des groupes, mouvements d etudiants et regeneration ciblee',
  videos.short_description = 'Groupes, membres, creation manuelle, mouvements et regeneration de l horaire cible.',
  videos.full_description = 'Cette capsule montre la consultation des groupes et de leurs membres, la creation manuelle d un groupe, l ajout d un etudiant a un groupe existant, le changement vers un groupe frere et la regeneration ciblee de l horaire du groupe choisi.',
  videos.video_path = 'uploads/help/videos/gestion-groupes.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["gestion groupes","membres groupe","ajouter groupe","ajouter etudiant groupe","groupe frere","regeneration"]',
  videos.module_key = 'gestion-groupes',
  videos.duration_seconds = 449,
  videos.display_order = 2,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'gestion-groupes';

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'groupes-etudiants'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Horaire etudiant, fiche detaillee et echange controle',
  videos.short_description = 'Recherche etudiante, fiche detaillee, export et modification d un cours entre etudiants compatibles.',
  videos.full_description = 'Cette capsule montre la recherche d un etudiant, la lecture de son horaire, l export, la consultation de sa fiche detaillee et l option de modifier un cours entre etudiants du meme programme et de la meme etape.',
  videos.video_path = 'uploads/help/videos/horaires-etudiants-what-if.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["horaire etudiant","liste etudiants","fiche detaillee","echange","meme programme","meme etape"]',
  videos.module_key = 'horaires-etudiants',
  videos.duration_seconds = 489,
  videos.display_order = 3,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'horaires-etudiants-what-if';

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'generation-planification'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Module Generer : generation, reprises et simulation what-if',
  videos.short_description = 'Generation ciblee, reprises, legacy, planification manuelle et modification des affectations.',
  videos.full_description = 'Cette capsule presente de bout en bout le module Generer: generation pour un programme et une etape, reprises d etudiants non planifies, simulation what-if, legacy, planification manuelle, modification d une planification existante et lecture de toutes les planifications de la session.',
  videos.video_path = 'uploads/help/videos/generer-un-planning.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["generation","what-if","legacy","planification manuelle","reprise etudiant","modifier planification"]',
  videos.module_key = 'generation',
  videos.duration_seconds = 1079,
  videos.display_order = 1,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'generer-un-planning';

UPDATE help_videos AS videos
INNER JOIN help_categories AS categories
  ON categories.slug = 'pilotage-session'
SET
  videos.id_category = categories.id_category,
  videos.title = 'Pilotage session : creation, optimisation et rapport detaille',
  videos.short_description = 'Creation de session, choix du mode d optimisation, historique et lecture du rapport detaille.',
  videos.full_description = 'Cette capsule montre comment creer une session, verifier les prerequis, choisir un mode d optimisation, lancer une generation, basculer entre les sessions et lire l historique avec scores, cours non planifies, causes et suggestions de correction manuelle.',
  videos.video_path = 'uploads/help/videos/pilotage-session-generation.mp4',
  videos.thumbnail_path = NULL,
  videos.keywords_json = '["creer session","mode optimisation","historique","rapport detaille","cours non planifies"]',
  videos.module_key = 'pilotage-session',
  videos.duration_seconds = 815,
  videos.display_order = 1,
  videos.is_active = 1,
  videos.is_published = 1
WHERE videos.slug = 'pilotage-session-generation';
