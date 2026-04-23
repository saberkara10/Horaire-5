import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const helpServiceMock = {
  getCategories: jest.fn(),
  getHelpCenter: jest.fn(),
  getAllVideos: jest.fn(),
  searchVideos: jest.fn(),
  getVideosByCategory: jest.fn(),
  getVideoDetail: jest.fn(),
  streamVideo: jest.fn(),
  serveThumbnail: jest.fn(),
  getDocumentDetail: jest.fn(),
};

await jest.unstable_mockModule("../src/services/help/HelpService.js", () => ({
  ...helpServiceMock,
}));

const HelpController = await import("../src/controllers/help/HelpController.js");

function createResponse(overrides = {}) {
  return {
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

describe("HelpController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getCategories retourne les categories", async () => {
    const response = createResponse();
    helpServiceMock.getCategories.mockResolvedValue([{ id: 1 }]);

    await HelpController.getCategories({}, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  test("getHelpCenter retourne le payload du centre d'aide", async () => {
    const response = createResponse();
    helpServiceMock.getHelpCenter.mockResolvedValue({ summary: { guides: 3 } });

    await HelpController.getHelpCenter({}, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ summary: { guides: 3 } });
  });

  test("getAllVideos utilise le message de secours si le service echoue sans message", async () => {
    const response = createResponse();
    helpServiceMock.getAllVideos.mockRejectedValue({ status: 503 });

    await HelpController.getAllVideos({}, response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      message: "Erreur lors de la recuperation des guides.",
    });
  });

  test("searchVideos retourne 400 si q est absent", async () => {
    const response = createResponse();

    await HelpController.searchVideos({ query: {} }, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Le parametre q est requis.",
    });
    expect(helpServiceMock.searchVideos).not.toHaveBeenCalled();
  });

  test("searchVideos nettoie la requete et retourne le resultat", async () => {
    const response = createResponse();
    helpServiceMock.searchVideos.mockResolvedValue([{ id: 9 }]);

    await HelpController.searchVideos({ query: { q: "  planning  " } }, response);

    expect(helpServiceMock.searchVideos).toHaveBeenCalledWith("planning");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith([{ id: 9 }]);
  });

  test("getVideosByCategory transmet le categoryId", async () => {
    const response = createResponse();
    helpServiceMock.getVideosByCategory.mockResolvedValue([{ id: 2 }]);

    await HelpController.getVideosByCategory(
      { params: { categoryId: "12" } },
      response
    );

    expect(helpServiceMock.getVideosByCategory).toHaveBeenCalledWith("12");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith([{ id: 2 }]);
  });

  test("getVideoDetail retourne le guide demande", async () => {
    const response = createResponse();
    helpServiceMock.getVideoDetail.mockResolvedValue({ id: 8 });

    await HelpController.getVideoDetail({ params: { id: "8" } }, response);

    expect(helpServiceMock.getVideoDetail).toHaveBeenCalledWith("8");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ id: 8 });
  });

  test("streamVideo laisse le service ecrire la reponse", async () => {
    const response = createResponse();
    const request = { params: { id: "5" } };

    await HelpController.streamVideo(request, response);

    expect(helpServiceMock.streamVideo).toHaveBeenCalledWith("5", request, response);
  });

  test("streamVideo ne double pas la reponse si les en-tetes sont deja envoyes", async () => {
    const response = createResponse({ headersSent: true });
    helpServiceMock.streamVideo.mockRejectedValue(new Error("stream casse"));

    await HelpController.streamVideo({ params: { id: "5" } }, response);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  test("serveThumbnail transmet la miniature au service", async () => {
    const response = createResponse();

    await HelpController.serveThumbnail({ params: { id: "17" } }, response);

    expect(helpServiceMock.serveThumbnail).toHaveBeenCalledWith("17", response);
  });

  test("getDocumentDetail retourne le document demande", async () => {
    const response = createResponse();
    helpServiceMock.getDocumentDetail.mockResolvedValue({ slug: "dashboard" });

    await HelpController.getDocumentDetail(
      { params: { slug: "dashboard" } },
      response
    );

    expect(helpServiceMock.getDocumentDetail).toHaveBeenCalledWith("dashboard");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ slug: "dashboard" });
  });
});
