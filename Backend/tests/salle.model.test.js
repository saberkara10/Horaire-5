/**
 * TESTS - Modele Salles
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des salles.
 */
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

const salleModel = await import("../src/model/salle.js");

describe("model salle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getAllSalles retourne la liste des salles", async () => {
    queryMock.mockResolvedValue([
      [{ id_salle: 1, code: "A101", type: "LAB", capacite: 30 }],
    ]);

    const result = await salleModel.getAllSalles();

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("A101");
  });

  test("getSalleById retourne une salle", async () => {
    queryMock.mockResolvedValue([
      [{ id_salle: 1, code: "A101", type: "LAB", capacite: 30 }],
    ]);

    const result = await salleModel.getSalleById(1);

    expect(result.id_salle).toBe(1);
    expect(result.code).toBe("A101");
  });

  test("getSalleById retourne undefined si absente", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await salleModel.getSalleById(999);

    expect(result).toBeUndefined();
  });

  test("getSalleByCode retourne une salle", async () => {
    queryMock.mockResolvedValue([
      [{ id_salle: 1, code: "A101", type: "LAB", capacite: 30 }],
    ]);

    const result = await salleModel.getSalleByCode("A101");

    expect(result.code).toBe("A101");
  });

  test("getSalleByCode retourne undefined si absente", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await salleModel.getSalleByCode("Z999");

    expect(result).toBeUndefined();
  });

  test("addSalle retourne le résultat SQL", async () => {
    queryMock.mockResolvedValue([{ insertId: 5, affectedRows: 1 }]);

    const result = await salleModel.addSalle("B201", "LAB", 25);

    expect(result.insertId).toBe(5);
    expect(result.affectedRows).toBe(1);
  });

  test("modifySalle retourne le résultat SQL", async () => {
    queryMock.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await salleModel.modifySalle(1, "LAB", 40);

    expect(result.affectedRows).toBe(1);
  });

  test("deleteSalle retourne le résultat SQL", async () => {
    queryMock.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await salleModel.deleteSalle(1);

    expect(result.affectedRows).toBe(1);
  });
});
/**
 * TESTS - Modele Salles
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des salles.
 */
