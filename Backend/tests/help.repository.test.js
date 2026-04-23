import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

const HelpRepository = await import("../src/model/help/HelpRepository.js");

describe("HelpRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("findAllActiveCategories retourne les categories actives", async () => {
    queryMock.mockResolvedValueOnce([[{ id_category: 1, name: "Guides" }]]);

    await expect(HelpRepository.findAllActiveCategories()).resolves.toEqual([
      { id_category: 1, name: "Guides" },
    ]);
  });

  test("findAllActiveCategories retourne [] si la table est absente", async () => {
    queryMock.mockRejectedValueOnce({ code: "ER_NO_SUCH_TABLE" });

    await expect(HelpRepository.findAllActiveCategories()).resolves.toEqual([]);
  });

  test("findAllActiveCategories propage les autres erreurs", async () => {
    const error = new Error("connexion coupee");
    queryMock.mockRejectedValueOnce(error);

    await expect(HelpRepository.findAllActiveCategories()).rejects.toBe(error);
  });

  test("findAllActiveVideos retourne les videos visibles", async () => {
    queryMock.mockResolvedValueOnce([[{ id_video: 4, title: "Export" }]]);

    await expect(HelpRepository.findAllActiveVideos()).resolves.toEqual([
      { id_video: 4, title: "Export" },
    ]);
  });

  test("findAllActiveVideos retourne [] sur table absente via le message SQL", async () => {
    queryMock.mockRejectedValueOnce(new Error("Unknown table 'help_videos'"));

    await expect(HelpRepository.findAllActiveVideos()).resolves.toEqual([]);
  });

  test("findAllActiveVideos propage les erreurs non liees au schema", async () => {
    const error = new Error("erreur mysql");
    queryMock.mockRejectedValueOnce(error);

    await expect(HelpRepository.findAllActiveVideos()).rejects.toBe(error);
  });

  test("searchVideos construit le motif LIKE pour les quatre champs", async () => {
    queryMock.mockResolvedValueOnce([[{ id_video: 8 }]]);

    const resultat = await HelpRepository.searchVideos("plan");

    expect(resultat).toEqual([{ id_video: 8 }]);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("JSON_SEARCH"),
      ["%plan%", "%plan%", "%plan%", "%plan%"]
    );
  });

  test("searchVideos retourne [] si la table est absente", async () => {
    queryMock.mockRejectedValueOnce({
      message: "Table help_videos doesn't exist",
    });

    await expect(HelpRepository.searchVideos("plan")).resolves.toEqual([]);
  });

  test("searchVideos propage les erreurs non liees a la table", async () => {
    const error = new Error("json invalid");
    queryMock.mockRejectedValueOnce(error);

    await expect(HelpRepository.searchVideos("plan")).rejects.toBe(error);
  });

  test("findVideosByCategory filtre par categorie", async () => {
    queryMock.mockResolvedValueOnce([[{ id_video: 11 }]]);

    const resultat = await HelpRepository.findVideosByCategory(7);

    expect(resultat).toEqual([{ id_video: 11 }]);
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), [7]);
  });

  test("findVideosByCategory retourne [] si la table est absente", async () => {
    queryMock.mockRejectedValueOnce({ code: "ER_NO_SUCH_TABLE" });

    await expect(HelpRepository.findVideosByCategory(7)).resolves.toEqual([]);
  });

  test("findVideosByCategory propage les erreurs non liees au schema", async () => {
    const error = new Error("timeout");
    queryMock.mockRejectedValueOnce(error);

    await expect(HelpRepository.findVideosByCategory(7)).rejects.toBe(error);
  });

  test("findVideoById retourne la premiere video trouvee", async () => {
    queryMock.mockResolvedValueOnce([[{ id_video: 3 }, { id_video: 4 }]]);

    await expect(HelpRepository.findVideoById(3)).resolves.toEqual({
      id_video: 3,
    });
  });

  test("findVideoById retourne null si la table est absente", async () => {
    queryMock.mockRejectedValueOnce({ code: "ER_NO_SUCH_TABLE" });

    await expect(HelpRepository.findVideoById(3)).resolves.toBeNull();
  });

  test("findVideoById propage les erreurs non liees au schema", async () => {
    const error = new Error("lecture impossible");
    queryMock.mockRejectedValueOnce(error);

    await expect(HelpRepository.findVideoById(3)).rejects.toBe(error);
  });

  test("findVideoMediaById retourne le media associe", async () => {
    queryMock.mockResolvedValueOnce([[{ id_video: 22, slug: "demo" }]]);

    await expect(HelpRepository.findVideoMediaById(22)).resolves.toEqual({
      id_video: 22,
      slug: "demo",
    });
  });

  test("findVideoMediaById retourne null si le schema media est absent", async () => {
    queryMock.mockRejectedValueOnce({
      message: "No such table: help_videos",
    });

    await expect(HelpRepository.findVideoMediaById(22)).resolves.toBeNull();
  });

  test("findVideoMediaById propage les erreurs non liees au schema", async () => {
    const error = new Error("permission refusee");
    queryMock.mockRejectedValueOnce(error);

    await expect(HelpRepository.findVideoMediaById(22)).rejects.toBe(error);
  });
});
