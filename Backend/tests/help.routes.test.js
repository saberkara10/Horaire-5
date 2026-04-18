import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const helpServiceMock = {
  getCategories: jest.fn(),
  getHelpCenter: jest.fn(),
  getAllVideos: jest.fn(),
  getDocumentDetail: jest.fn(),
  getVideoDetail: jest.fn(),
  getVideosByCategory: jest.fn(),
  searchVideos: jest.fn(),
  serveThumbnail: jest.fn(),
  streamVideo: jest.fn(),
};

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (request, _response, next) => {
    request.user = { id_utilisateur: 1 };
    next();
  },
}));

await jest.unstable_mockModule("../src/services/help/HelpService.js", () => ({
  ...helpServiceMock,
}));

const { default: helpRoutes } = await import("../routes/help.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  helpRoutes(app);
  return app;
}

describe("routes help", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/help/categories retourne les categories actives", async () => {
    helpServiceMock.getCategories.mockResolvedValue([
      { id: 1, name: "Demarrage rapide" },
    ]);

    const response = await request(createApp()).get("/api/help/categories");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 1, name: "Demarrage rapide" }]);
  });

  it("GET /api/help/center retourne le payload unifie du centre d'aide", async () => {
    helpServiceMock.getHelpCenter.mockResolvedValue({
      summary: { guides: 2 },
      categories: [],
    });

    const response = await request(createApp()).get("/api/help/center");

    expect(response.status).toBe(200);
    expect(response.body.summary.guides).toBe(2);
  });

  it("GET /api/help/videos/search retourne 400 sans parametre q", async () => {
    const response = await request(createApp()).get("/api/help/videos/search");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Le parametre q est requis.");
  });

  it("GET /api/help/videos/:id remonte les erreurs de service", async () => {
    helpServiceMock.getVideoDetail.mockRejectedValue(
      Object.assign(new Error("Guide introuvable."), { status: 404 })
    );

    const response = await request(createApp()).get("/api/help/videos/44");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Guide introuvable.");
  });

  it("GET /api/help/videos/:id/stream laisse le service ecrire la reponse", async () => {
    helpServiceMock.streamVideo.mockImplementation(async (_id, _request, response) => {
      response.status(206).type("video/mp4").send("chunk");
    });

    const response = await request(createApp()).get("/api/help/videos/8/stream");

    expect(response.status).toBe(206);
    expect(response.headers["content-type"]).toContain("video/mp4");
  });

  it("GET /api/help/documents/:slug retourne la documentation demandee", async () => {
    helpServiceMock.getDocumentDetail.mockResolvedValue({
      slug: "documentation-dashboard",
      title: "Documentation dashboard",
    });

    const response = await request(createApp()).get(
      "/api/help/documents/documentation-dashboard"
    );

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("Documentation dashboard");
  });
});
