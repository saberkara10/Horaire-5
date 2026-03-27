import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

const professeursModel = await import("../src/model/professeurs.model.js");

describe("Model professeurs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("recupererTousLesProfesseurs retourne la liste", async () => {
    queryMock.mockResolvedValue([
      [{ id_professeur: 1, matricule: "P001" }],
    ]);

    const result = await professeursModel.recupererTousLesProfesseurs();

    expect(result).toHaveLength(1);
    expect(result[0].matricule).toBe("P001");
  });

  test("recupererProfesseurParId retourne un professeur", async () => {
    queryMock.mockResolvedValue([
      [{ id_professeur: 1, matricule: "P001" }],
    ]);

    const result = await professeursModel.recupererProfesseurParId(1);

    expect(result.id_professeur).toBe(1);
  });

  test("recupererProfesseurParId retourne null si absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await professeursModel.recupererProfesseurParId(999);

    expect(result).toBeNull();
  });

  test("recupererProfesseurParMatricule retourne un professeur", async () => {
    queryMock.mockResolvedValue([
      [{ id_professeur: 1, matricule: "P001" }],
    ]);

    const result = await professeursModel.recupererProfesseurParMatricule("P001");

    expect(result.matricule).toBe("P001");
  });

  test("recupererProfesseurParMatricule retourne null si absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await professeursModel.recupererProfesseurParMatricule("P999");

    expect(result).toBeNull();
  });

  test("ajouterProfesseur insere puis retourne le professeur ajouté", async () => {
    queryMock
      .mockResolvedValueOnce([{ insertId: 5 }])
      .mockResolvedValueOnce([[{ id_professeur: 5, matricule: "P005" }]]);

    const result = await professeursModel.ajouterProfesseur({
      matricule: "P005",
      nom: "Ali",
      prenom: "Test",
      specialite: "Web",
    });

    expect(result.id_professeur).toBe(5);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  test("modifierProfesseur retourne le professeur courant si aucun champ", async () => {
    queryMock.mockResolvedValueOnce([[{ id_professeur: 1, matricule: "P001" }]]);

    const result = await professeursModel.modifierProfesseur(1, {});

    expect(result.id_professeur).toBe(1);
  });

  test("modifierProfesseur retourne null si aucun enregistrement modifié", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const result = await professeursModel.modifierProfesseur(999, { specialite: "Java" });

    expect(result).toBeNull();
  });

  test("modifierProfesseur retourne le professeur modifié", async () => {
    queryMock
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id_professeur: 1, specialite: "Java" }]]);

    const result = await professeursModel.modifierProfesseur(1, { specialite: "Java" });

    expect(result.specialite).toBe("Java");
  });

  test("professeurEstDejaAffecte retourne true si affecté", async () => {
    queryMock.mockResolvedValue([[{ 1: 1 }]]);

    const result = await professeursModel.professeurEstDejaAffecte(1);

    expect(result).toBe(true);
  });

  test("professeurEstDejaAffecte retourne false si non affecté", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await professeursModel.professeurEstDejaAffecte(1);

    expect(result).toBe(false);
  });

  test("supprimerProfesseur retourne true si suppression réussie", async () => {
    queryMock.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await professeursModel.supprimerProfesseur(1);

    expect(result).toBe(true);
  });

  test("supprimerProfesseur retourne false si rien supprimé", async () => {
    queryMock.mockResolvedValue([{ affectedRows: 0 }]);

    const result = await professeursModel.supprimerProfesseur(999);

    expect(result).toBe(false);
  });
});