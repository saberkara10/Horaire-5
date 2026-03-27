import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

const coursModel = await import("../src/model/cours.model.js");

describe("Model cours", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("recupererTousLesCours retourne la liste", async () => {
    queryMock.mockResolvedValue([
      [{ id_cours: 1, code: "INF101" }],
    ]);

    const result = await coursModel.recupererTousLesCours();

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("INF101");
  });

  test("recupererCoursParId retourne un cours", async () => {
    queryMock.mockResolvedValue([
      [{ id_cours: 1, code: "INF101" }],
    ]);

    const result = await coursModel.recupererCoursParId(1);

    expect(result.id_cours).toBe(1);
  });

  test("recupererCoursParId retourne null si absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await coursModel.recupererCoursParId(999);

    expect(result).toBeNull();
  });

  test("recupererCoursParCode retourne un cours", async () => {
    queryMock.mockResolvedValue([
      [{ id_cours: 1, code: "INF101" }],
    ]);

    const result = await coursModel.recupererCoursParCode("INF101");

    expect(result.code).toBe("INF101");
  });

  test("recupererCoursParCode retourne null si absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await coursModel.recupererCoursParCode("XXX");

    expect(result).toBeNull();
  });

  test("ajouterCours insere puis retourne le cours ajouté", async () => {
    queryMock
      .mockResolvedValueOnce([{ insertId: 5 }])
      .mockResolvedValueOnce([[{ id_cours: 5, code: "INF200" }]]);

    const result = await coursModel.ajouterCours({
      code: "INF200",
      nom: "Algo",
      duree: 45,
      programme: "INF",
      etape_etude: 2,
      type_salle: "LAB",
    });

    expect(result.id_cours).toBe(5);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  test("modifierCours retourne le cours inchangé si aucun champ", async () => {
    queryMock.mockResolvedValueOnce([[{ id_cours: 1, code: "INF101" }]]);

    const result = await coursModel.modifierCours(1, {});

    expect(result.id_cours).toBe(1);
  });

  test("modifierCours retourne null si aucun enregistrement modifié", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const result = await coursModel.modifierCours(999, { nom: "Nouveau" });

    expect(result).toBeNull();
  });

  test("modifierCours retourne le cours modifié", async () => {
    queryMock
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id_cours: 1, nom: "Nouveau" }]]);

    const result = await coursModel.modifierCours(1, { nom: "Nouveau" });

    expect(result.nom).toBe("Nouveau");
  });

  test("coursEstDejaAffecte retourne true si affecté", async () => {
    queryMock.mockResolvedValue([[{ 1: 1 }]]);

    const result = await coursModel.coursEstDejaAffecte(1);

    expect(result).toBe(true);
  });

  test("coursEstDejaAffecte retourne false si non affecté", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await coursModel.coursEstDejaAffecte(1);

    expect(result).toBe(false);
  });

  test("supprimerCours retourne true si suppression réussie", async () => {
    queryMock.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await coursModel.supprimerCours(1);

    expect(result).toBe(true);
  });

  test("supprimerCours retourne false si rien supprimé", async () => {
    queryMock.mockResolvedValue([{ affectedRows: 0 }]);

    const result = await coursModel.supprimerCours(999);

    expect(result).toBe(false);
  });

  test("typeSalleExiste retourne true si type trouvé", async () => {
    queryMock.mockResolvedValue([[{ 1: 1 }]]);

    const result = await coursModel.typeSalleExiste("LAB");

    expect(result).toBe(true);
  });

  test("typeSalleExiste retourne false si type absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await coursModel.typeSalleExiste("XYZ");

    expect(result).toBe(false);
  });
});