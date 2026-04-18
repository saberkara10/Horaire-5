/**
 * Couche HTTP du module help.
 *
 * Tous les appels passent par apiRequest afin de reutiliser:
 * - les cookies de session
 * - la gestion d'erreur centralisee
 */

import { apiRequest } from "./api.js";

export async function getHelpCenter() {
  return apiRequest("/api/help/center");
}

export async function getHelpCategories() {
  return apiRequest("/api/help/categories");
}

export async function getHelpVideos() {
  return apiRequest("/api/help/videos");
}

export async function searchHelpVideos(query) {
  const encodedQuery = encodeURIComponent(String(query || "").trim());
  return apiRequest(`/api/help/videos/search?q=${encodedQuery}`);
}

export async function getHelpVideosByCategory(categoryId) {
  return apiRequest(`/api/help/videos/category/${categoryId}`);
}

export async function getHelpVideoDetail(videoId) {
  return apiRequest(`/api/help/videos/${videoId}`);
}

export async function getHelpDocumentDetail(slug) {
  const encodedSlug = encodeURIComponent(String(slug || "").trim());
  return apiRequest(`/api/help/documents/${encodedSlug}`);
}
