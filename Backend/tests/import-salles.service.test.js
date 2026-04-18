import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import XLSX from "xlsx";

const addSalleMock = jest.fn();
const getSalleByCodeMock = jest.fn();
const modifySalleMock = jest.fn();
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
    getConnection: jest.fn().mockResolvedValue(connectionMock),
  },
}));

await jest.unstable_mockModule("../src/model/salle.js", () => ({
  addSalle: addSalleMock,
  getAllSalles: jest.fn(),
  getSalleByCode: getSalleByCodeMock,
  getSalleById: jest.fn(),
  modifySalle: modifySalleMock,
  salleEstDejaAffectee: jest.fn(),
}));

const { importerSallesDepuisFichier } = await import(
  "../src/services/import-salles.service.js"
);

function creerFichierExcel(lignes, nom = "salles.xlsx") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(lignes), "Salles");

  return {
    originalname: nom,
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
}

describe("service import-salles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionMock.beginTransaction.mockResolvedValue(undefined);
    connectionMock.commit.mockResolvedValue(undefined);
    connectionMock.rollback.mockResolvedValue(undefined);
    connectionMock.release.mockResolvedValue(undefined);
    connectionQueryMock.mockResolvedValue([[]]);
  });

  test("cree, met a jour et ignore les salles deja synchronisees", async () => {
    getSalleByCodeMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id_salle: 8,
        code: "A101",
        type: "Classe",
        capacite: 35,
      })
      .mockResolvedValueOnce({
        id_salle: 9,
        code: "B204",
        type: "Classe",
        capacite: 20,
      });

    const fichier = creerFichierExcel([
      ["code", "type", "capacite"],
      ["C301", "Laboratoire", "24"],
      ["A101", "Classe", "35"],
      ["B204", "Laboratoire", "28"],
    ]);

    const resultat = await importerSallesDepuisFichier(fichier);

    expect(resultat).toMatchObject({
      total_lignes_lues: 3,
      lignes_creees: 1,
      lignes_mises_a_jour: 1,
      lignes_ignorees: 1,
      lignes_en_erreur: 0,
      lignes_importees: 2,
      statut: "warning",
    });
    expect(addSalleMock).toHaveBeenCalledWith("C301", "Laboratoire", 24, connectionMock);
    expect(modifySalleMock).toHaveBeenCalledWith(9, "Laboratoire", 28, connectionMock);
    expect(connectionMock.commit).toHaveBeenCalledTimes(1);
  });

  test("retourne un resume quand certaines lignes sont invalides avant persistence", async () => {
    const fichier = creerFichierExcel([
      ["code", "type", "capacite"],
      ["", "Laboratoire", "24"],
      ["B204", "Classe", "0"],
    ]);

    const resultat = await importerSallesDepuisFichier(fichier);

    expect(resultat).toMatchObject({
      total_lignes_lues: 2,
      lignes_importees: 0,
      lignes_en_erreur: 2,
      statut: "warning",
    });
    expect(resultat.erreurs).toEqual([
      "Ligne 2 : code obligatoire.",
      "Ligne 3 : capacite invalide (0).",
    ]);
    expect(addSalleMock).not.toHaveBeenCalled();
    expect(modifySalleMock).not.toHaveBeenCalled();
  });

  test("refuse un fichier dont les colonnes obligatoires sont absentes", async () => {
    const fichier = creerFichierExcel([
      ["code", "type_salle"],
      ["B204", "Laboratoire"],
    ]);

    await expect(importerSallesDepuisFichier(fichier)).rejects.toMatchObject({
      message: "Colonnes obligatoires manquantes.",
      erreurs: ["La colonne obligatoire capacite est absente du fichier."],
    });
  });
});
