import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const repositoryMock = {
  findAllActiveCategories: jest.fn(),
  findAllActiveVideos: jest.fn(),
  findVideosByCategory: jest.fn(),
  findVideoById: jest.fn(),
  findVideoMediaById: jest.fn(),
  searchVideos: jest.fn(),
};

await jest.unstable_mockModule("../src/model/help/HelpRepository.js", () => ({
  ...repositoryMock,
}));

const HelpService = await import("../src/services/help/HelpService.js");

describe("help service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mappe les categories en camelCase pour le frontend", async () => {
    repositoryMock.findAllActiveCategories.mockResolvedValue([
      {
        id_category: 4,
        name: "Groupes",
        slug: "groupes",
        description: "Guides groupes",
        display_order: 7,
      },
    ]);

    await expect(HelpService.getCategories()).resolves.toEqual([
      {
        id: 4,
        name: "Groupes",
        slug: "groupes",
        description: "Guides groupes",
        displayOrder: 7,
      },
    ]);
  });

  it("refuse une recherche trop courte", async () => {
    await expect(HelpService.searchVideos("a")).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("au moins 2"),
    });
  });

  it("mappe le detail video avec keywords et urls derivees", async () => {
    repositoryMock.findVideoById.mockResolvedValue({
      id_video: 9,
      id_category: 2,
      title: "Exporter un horaire",
      slug: "exporter-un-horaire",
      short_description: "Resume",
      full_description: "Description longue",
      category_name: "Exports",
      category_slug: "exports",
      keywords_json: JSON.stringify(["export", "pdf"]),
      module_key: "export",
      duration_seconds: 135,
      display_order: 3,
      video_path: "uploads/help/videos/exporter-un-horaire.mp4",
      thumbnail_path: "uploads/help/thumbnails/exporter-un-horaire.jpg",
      created_at: "2026-04-17 10:00:00",
      updated_at: "2026-04-17 11:00:00",
    });

    await expect(HelpService.getVideoDetail(9)).resolves.toEqual(
      expect.objectContaining({
        id: 9,
        categoryId: 2,
        categoryName: "Exports",
        keywords: ["export", "pdf"],
        moduleKey: "export",
        durationLabel: "2 min 15 s",
        streamUrl: "/api/help/videos/9/stream",
        thumbnailUrl: "/api/help/videos/9/thumbnail",
      })
    );
  });

  it("retourne 404 si le guide demande est introuvable", async () => {
    repositoryMock.findVideoById.mockResolvedValue(null);

    await expect(HelpService.getVideoDetail(999)).rejects.toMatchObject({
      status: 404,
      message: "Guide introuvable.",
    });
  });

  it("valide les identifiants de categorie", async () => {
    await expect(HelpService.getVideosByCategory("abc")).rejects.toMatchObject({
      status: 400,
      message: "Identifiant de categorie invalide.",
    });
  });

  it("construit le payload complet du centre d'aide", async () => {
    repositoryMock.findAllActiveVideos.mockResolvedValue([
      {
        id_video: 12,
        id_category: 1,
        title: "Connexion et prise en main",
        slug: "connexion-prise-en-main",
        short_description: "Resume onboarding",
        full_description: "Description detaillee",
        category_name: "Demarrage rapide",
        category_slug: "demarrage-rapide",
        keywords_json: JSON.stringify(["connexion", "navigation"]),
        module_key: "dashboard",
        duration_seconds: 240,
        display_order: 1,
        video_path: "uploads/help/videos/connexion-prise-en-main.mp4",
        thumbnail_path: "uploads/help/thumbnails/connexion-prise-en-main.jpg",
      },
    ]);

    const payload = await HelpService.getHelpCenter();

    expect(payload.summary.categories).toBeGreaterThanOrEqual(16);
    expect(payload.summary.guides).toBeGreaterThan(0);
    expect(payload.summary.documents).toBeGreaterThan(0);
    expect(payload.featured.quickAccess.length).toBeGreaterThan(0);
    expect(payload.meta.filters.types).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "guide" }),
        expect.objectContaining({ id: "video" }),
      ])
    );
    expect(payload.guides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "guide-onboarding",
          videos: expect.arrayContaining([
            expect.objectContaining({
              id: "video-onboarding",
              status: "available",
              streamUrl: "/api/help/videos/12/stream",
            }),
          ]),
        }),
      ])
    );
  });

  it("lit le contenu markdown d'une documentation reliee", async () => {
    const document = await HelpService.getDocumentDetail("documentation-dashboard");

    expect(document).toEqual(
      expect.objectContaining({
        slug: "documentation-dashboard",
        title: "Documentation dashboard",
        content: expect.stringContaining("# Documentation - Module Dashboard"),
      })
    );
  });
});
