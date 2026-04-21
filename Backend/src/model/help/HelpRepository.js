/**
 * Couche d'acces aux donnees du module help.
 *
 * Cette couche ne contient aucune logique HTTP ni filesystem.
 * Elle ne fait que traduire les besoins du service en requetes SQL.
 */

import pool from "../../../db.js";

const VIDEO_LIST_SELECT = `
  SELECT
    v.id_video,
    v.id_category,
    v.title,
    v.slug,
    v.short_description,
    v.full_description,
    v.video_path,
    v.thumbnail_path,
    v.keywords_json,
    v.module_key,
    v.duration_seconds,
    v.display_order,
    v.is_active,
    v.is_published,
    v.created_at,
    v.updated_at,
    c.name AS category_name,
    c.slug AS category_slug
  FROM help_videos v
  INNER JOIN help_categories c ON c.id_category = v.id_category
`;

const VISIBLE_VIDEO_WHERE = `
  WHERE v.is_active = 1
    AND v.is_published = 1
    AND c.is_active = 1
`;

export async function findAllActiveCategories() {
  const [rows] = await pool.query(
    `SELECT
       id_category,
       name,
       slug,
       description,
       display_order
     FROM help_categories
     WHERE is_active = 1
     ORDER BY display_order ASC, name ASC`
  );

  return rows;
}

export async function findAllActiveVideos() {
  const [rows] = await pool.query(
    `${VIDEO_LIST_SELECT}
     ${VISIBLE_VIDEO_WHERE}
     ORDER BY c.display_order ASC, v.display_order ASC, v.title ASC`
  );

  return rows;
}

export async function searchVideos(query) {
  const likeQuery = `%${query}%`;

  const [rows] = await pool.query(
    `${VIDEO_LIST_SELECT}
     ${VISIBLE_VIDEO_WHERE}
       AND (
         v.title LIKE ?
         OR COALESCE(v.short_description, '') LIKE ?
         OR COALESCE(v.full_description, '') LIKE ?
         OR JSON_SEARCH(v.keywords_json, 'one', ?, NULL, '$[*]') IS NOT NULL
       )
     ORDER BY c.display_order ASC, v.display_order ASC, v.title ASC`,
    [likeQuery, likeQuery, likeQuery, likeQuery]
  );

  return rows;
}

export async function findVideosByCategory(categoryId) {
  const [rows] = await pool.query(
    `${VIDEO_LIST_SELECT}
     ${VISIBLE_VIDEO_WHERE}
       AND v.id_category = ?
     ORDER BY v.display_order ASC, v.title ASC`,
    [categoryId]
  );

  return rows;
}

export async function findVideoById(videoId) {
  const [rows] = await pool.query(
    `${VIDEO_LIST_SELECT}
     ${VISIBLE_VIDEO_WHERE}
       AND v.id_video = ?
     LIMIT 1`,
    [videoId]
  );

  return rows[0] || null;
}

export async function findVideoMediaById(videoId) {
  const [rows] = await pool.query(
    `SELECT
       id_video,
       slug,
       video_path,
       thumbnail_path
     FROM help_videos
     WHERE id_video = ?
       AND is_active = 1
       AND is_published = 1
     LIMIT 1`,
    [videoId]
  );

  return rows[0] || null;
}
