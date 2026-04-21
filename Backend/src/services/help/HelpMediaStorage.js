/**
 * Strategie de stockage des medias du module help.
 *
 * Regles:
 * - les chemins stockes en base sont toujours relatifs a Backend/
 * - les videos sont stockees dans uploads/help/videos
 * - les miniatures sont stockees dans uploads/help/thumbnails
 * - les fichiers ne sont jamais exposes via express.static
 * - l'acces passe uniquement par les routes authentifiees du module
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, "../../..");

export const HELP_VIDEO_STORAGE_PREFIX = "uploads/help/videos/";
export const HELP_THUMBNAIL_STORAGE_PREFIX = "uploads/help/thumbnails/";

export const HELP_VIDEO_DIR = path.join(BACKEND_ROOT, "uploads", "help", "videos");
export const HELP_THUMBNAIL_DIR = path.join(
  BACKEND_ROOT,
  "uploads",
  "help",
  "thumbnails"
);

const ALLOWED_EXTENSIONS = {
  video: new Set([".mp4"]),
  thumbnail: new Set([".jpg", ".jpeg", ".png", ".webp"]),
};

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".webp": "image/webp",
};

function normalizeStoredPath(storedPath) {
  return String(storedPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

export function buildHelpVideoStoragePath(slug) {
  return `${HELP_VIDEO_STORAGE_PREFIX}${slug}.mp4`;
}

export function buildHelpThumbnailStoragePath(slug, extension = ".jpg") {
  const normalizedExtension = String(extension || ".jpg").startsWith(".")
    ? String(extension || ".jpg").toLowerCase()
    : `.${String(extension || "jpg").toLowerCase()}`;

  return `${HELP_THUMBNAIL_STORAGE_PREFIX}${slug}${normalizedExtension}`;
}

export function buildHelpStreamUrl(videoId) {
  return `/api/help/videos/${videoId}/stream`;
}

export function buildHelpThumbnailUrl(videoId) {
  return `/api/help/videos/${videoId}/thumbnail`;
}

export function resolveHelpMediaPath(storedPath, kind) {
  const normalizedPath = normalizeStoredPath(storedPath);
  const baseDirectory = kind === "thumbnail" ? HELP_THUMBNAIL_DIR : HELP_VIDEO_DIR;
  const expectedPrefix =
    kind === "thumbnail"
      ? HELP_THUMBNAIL_STORAGE_PREFIX
      : HELP_VIDEO_STORAGE_PREFIX;

  if (!normalizedPath) {
    return { ok: false, reason: "Aucun chemin media n'est configure." };
  }

  if (!normalizedPath.startsWith(expectedPrefix)) {
    return {
      ok: false,
      reason: "Le fichier media n'est pas dans le dossier de stockage autorise.",
    };
  }

  const extension = path.extname(normalizedPath).toLowerCase();

  if (!ALLOWED_EXTENSIONS[kind]?.has(extension)) {
    return {
      ok: false,
      reason: "Le format de fichier media n'est pas autorise.",
    };
  }

  const absolutePath = path.resolve(BACKEND_ROOT, normalizedPath);
  const relativeToBaseDirectory = path.relative(baseDirectory, absolutePath);

  if (
    relativeToBaseDirectory.startsWith("..") ||
    path.isAbsolute(relativeToBaseDirectory)
  ) {
    return {
      ok: false,
      reason: "Le chemin media pointe hors du dossier de stockage autorise.",
    };
  }

  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      reason: "Le fichier media est introuvable sur le serveur.",
    };
  }

  return {
    ok: true,
    absolutePath,
    contentType: MIME_TYPES[extension] || "application/octet-stream",
    normalizedPath,
  };
}
