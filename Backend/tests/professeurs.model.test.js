/**
 * TESTS - Modele Professeurs
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des professeurs.
 */
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();
const connectionQueryMock = jest.fn();
const connectionMock = {
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
  query: connectionQueryMock,
};

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
    getConnection: jest.fn().mockResolvedValue(connectionMock),
  },
}));

const professeursModel = await import("../src/model/professeurs.model.js");

describe("Model professeurs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionMock.beginTransaction.mockResolvedValue(undefined);
    connectionMock.commit.mockResolvedValue(undefined);
    connectionMock.rollback.mockResolvedValue(undefined);
    connectionMock.release.mockResolvedValue(undefined);
  });

  test("recupererTousLesProfesseurs retourne la liste", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 1, matricule: "P001" }]]);

    const result = await professeursModel.recupererTousLesProfesseurs();

    expect(result).toHaveLength(1);
  });

  test("recupererCoursProfesseur retourne les cours assignes", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_cours: 1, code: "INF101" }]]);

    const result = await professeursModel.recupererCoursProfesseur(1);

    expect(result[0].code).toBe("INF101");
  });

  test("recupererIndexCoursProfesseurs retourne une map par professeur", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 1, id_cours: 3 }]]);

    const result = await professeursModel.recupererIndexCoursProfesseurs();

    expect(result.get(1).has(3)).toBe(true);
  });

  test("remplacerCoursProfesseur remplace les liaisons", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_cours: 1, code: "INF101" }]]);

    const result = await professeursModel.remplacerCoursProfesseur(1, [1, 2]);

    expect(result).toHaveLength(1);
    expect(connectionMock.commit).toHaveBeenCalled();
  });

  test("ajouterProfesseur insere puis retourne le professeur ajoute", async () => {
    queryMock
      .mockResolvedValueOnce([{ insertId: 5 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 5, matricule: "P005" }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 5, matricule: "P005" }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 5, matricule: "P005" }]]);
    connectionQueryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const result = await professeursModel.ajouterProfesseur({
      matricule: "P005",
      nom: "Ali",
      prenom: "Test",
      specialite: "Programmation informatique",
      cours_ids: [1],
    });

    expect(result.id_professeur).toBe(5);
  });

  test("modifierProfesseur retourne le professeur modifie", async () => {
    queryMock
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 1, specialite: "Java" }]]);

    const result = await professeursModel.modifierProfesseur(1, { specialite: "Java" });

    expect(result.specialite).toBe("Java");
  });

  test("supprimerProfesseur retourne true si suppression reussie", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await professeursModel.supprimerProfesseur(1);

    expect(result).toBe(true);
  });
});
/**
 * TESTS - Modele Professeurs
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des professeurs.
 */
