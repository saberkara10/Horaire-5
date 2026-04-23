import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "@jest/globals";

import {
  HELP_THUMBNAIL_DIR,
  HELP_VIDEO_DIR,
  buildHelpStreamUrl,
  buildHelpThumbnailStoragePath,
  buildHelpThumbnailUrl,
  buildHelpVideoStoragePath,
  resolveHelpMediaPath,
} from "../src/services/help/HelpMediaStorage.js";

const createdFiles = [];

afterEach(() => {
  for (const filePath of createdFiles.splice(0)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Nettoyage best effort.
    }
  }
});

function createFile(directory, fileName) {
  fs.mkdirSync(directory, { recursive: true });
  const absolutePath = path.join(directory, fileName);
  fs.writeFileSync(absolutePath, "");
  createdFiles.push(absolutePath);
  return absolutePath;
}

describe("HelpMediaStorage", () => {
  test("construit les chemins et URLs attendus", () => {
    expect(buildHelpVideoStoragePath("guide-demo")).toBe(
      "uploads/help/videos/guide-demo.mp4"
    );
    expect(buildHelpThumbnailStoragePath("guide-demo")).toBe(
      "uploads/help/thumbnails/guide-demo.jpg"
    );
    expect(buildHelpThumbnailStoragePath("guide-demo", "PNG")).toBe(
      "uploads/help/thumbnails/guide-demo.png"
    );
    expect(buildHelpStreamUrl(8)).toBe("/api/help/videos/8/stream");
    expect(buildHelpThumbnailUrl(8)).toBe("/api/help/videos/8/thumbnail");
  });

  test("resolveHelpMediaPath accepte une video valide et normalise le chemin", () => {
    createFile(HELP_VIDEO_DIR, "unit-video.mp4");

    const resultat = resolveHelpMediaPath(
      "\\uploads\\help\\videos\\unit-video.mp4",
      "video"
    );

    expect(resultat.ok).toBe(true);
    expect(resultat.contentType).toBe("video/mp4");
    expect(resultat.normalizedPath).toBe("uploads/help/videos/unit-video.mp4");
    expect(resultat.absolutePath).toContain(path.join("uploads", "help", "videos"));
  });

  test("resolveHelpMediaPath accepte une miniature valide", () => {
    createFile(HELP_THUMBNAIL_DIR, "unit-thumb.webp");

    const resultat = resolveHelpMediaPath(
      "/uploads/help/thumbnails/unit-thumb.webp",
      "thumbnail"
    );

    expect(resultat.ok).toBe(true);
    expect(resultat.contentType).toBe("image/webp");
  });

  test("refuse un chemin vide", () => {
    expect(resolveHelpMediaPath("", "video")).toEqual({
      ok: false,
      reason: "Aucun chemin media n'est configure.",
    });
  });

  test("refuse un chemin hors du prefixe autorise", () => {
    expect(resolveHelpMediaPath("uploads/autre/video.mp4", "video")).toEqual({
      ok: false,
      reason: "Le fichier media n'est pas dans le dossier de stockage autorise.",
    });
  });

  test("refuse une extension non autorisee", () => {
    expect(
      resolveHelpMediaPath("uploads/help/videos/unit-video.avi", "video")
    ).toEqual({
      ok: false,
      reason: "Le format de fichier media n'est pas autorise.",
    });
  });

  test("refuse un chemin qui sort du dossier autorise", () => {
    expect(
      resolveHelpMediaPath(
        "uploads/help/videos/../../secret/escaped.mp4",
        "video"
      )
    ).toEqual({
      ok: false,
      reason: "Le chemin media pointe hors du dossier de stockage autorise.",
    });
  });

  test("refuse un fichier manquant sur le serveur", () => {
    expect(
      resolveHelpMediaPath("uploads/help/thumbnails/introuvable.jpg", "thumbnail")
    ).toEqual({
      ok: false,
      reason: "Le fichier media est introuvable sur le serveur.",
    });
  });
});
