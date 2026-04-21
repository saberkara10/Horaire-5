import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import XLSX from "xlsx";

const ajouterProfesseurMock = jest.fn();
const modifierProfesseurMock = jest.fn();
const recupererProfesseurParMatriculeMock = jest.fn();
const recupererProfesseurParNomPrenomMock = jest.fn();
const validerContrainteCoursProfesseurMock = jest.fn();
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

await jest.unstable_mockModule("../src/model/professeurs.model.js", () => ({
  ajouterProfesseur: ajouterProfesseurMock,
  modifierProfesseur: modifierProfesseurMock,
  recupererProfesseurParMatricule: recupererProfesseurParMatriculeMock,
  recupererProfesseurParNomPrenom: recupererProfesseurParNomPrenomMock,
  validerContrainteCoursProfesseur: validerContrainteCoursProfesseurMock,
}));

const { importerProfesseursDepuisFichier } = await import(
  "../src/services/import-professeurs.service.js"
);

function creerFichierExcel(lignes, nom = "professeurs.xlsx") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(lignes),
    "Professeurs"
  );

  return {
    originalname: nom,
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
}

describe("service import-professeurs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionMock.beginTransaction.mockResolvedValue(undefined);
    connectionMock.commit.mockResolvedValue(undefined);
    connectionMock.rollback.mockResolvedValue(undefined);
    connectionMock.release.mockResolvedValue(undefined);
    validerContrainteCoursProfesseurMock.mockResolvedValue("");
    connectionQueryMock.mockImplementation(async (sql, params = []) => {
      if (
        String(sql).includes("SELECT id_cours, code, archive") &&
        params.includes("INF101") &&
        params.includes("WEB201")
      ) {
        return [[
          { id_cours: 1, code: "INF101", archive: 0 },
          { id_cours: 2, code: "WEB201", archive: 0 },
        ]];
      }

      if (String(sql).includes("SELECT id_cours, code, archive") && params.includes("INF101")) {
        return [[{ id_cours: 1, code: "INF101", archive: 0 }]];
      }

      if (String(sql).includes("SELECT id_cours, code, archive") && params.includes("ZZZ999")) {
        return [[]];
      }

      return [[]];
    });
  });

  test("cree, met a jour et remonte les erreurs de cours introuvables", async () => {
    recupererProfesseurParMatriculeMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id_professeur: 9,
        matricule: "P-2026-002",
        nom: "Roy",
        prenom: "Lea",
        specialite: "Ancienne specialite",
        cours_ids: "1",
      });
    recupererProfesseurParNomPrenomMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id_professeur: 9,
        matricule: "P-2026-002",
        nom: "Roy",
        prenom: "Lea",
        specialite: "Ancienne specialite",
        cours_ids: "1",
      });

    const fichier = creerFichierExcel([
      ["matricule", "nom", "prenom", "specialite", "cours_codes"],
      ["P-2026-001", "Diallo", "Aminata", "Programmation informatique", "INF101;WEB201"],
      ["P-2026-002", "Roy", "Lea", "Developpement Web", "INF101"],
      ["P-2026-003", "Ali", "Sami", "", "ZZZ999"],
    ]);

    const resultat = await importerProfesseursDepuisFichier(fichier);

    expect(resultat).toMatchObject({
      total_lignes_lues: 3,
      lignes_creees: 1,
      lignes_mises_a_jour: 1,
      lignes_en_erreur: 1,
      lignes_importees: 2,
      statut: "partial",
    });
    expect(ajouterProfesseurMock).toHaveBeenCalledWith(
      {
        matricule: "P-2026-001",
        nom: "Diallo",
        prenom: "Aminata",
        specialite: "Programmation informatique",
        cours_ids: [1, 2],
      },
      connectionMock
    );
    expect(modifierProfesseurMock).toHaveBeenCalledWith(
      9,
      {
        matricule: "P-2026-002",
        nom: "Roy",
        prenom: "Lea",
        specialite: "Developpement Web",
        cours_ids: [1],
      },
      connectionMock
    );
    expect(resultat.erreurs).toContain(
      "Ligne 4 : les cours ZZZ999 sont introuvables."
    );
  });

  test("retourne directement les erreurs de validation de fichier", async () => {
    const fichier = creerFichierExcel([
      ["matricule", "nom", "prenom"],
      ["P-2026-001", "Diallo", "Aminata"],
      ["", "Roy", "Lea"],
    ]);

    const resultat = await importerProfesseursDepuisFichier(fichier);

    expect(resultat).toMatchObject({
      total_lignes_lues: 2,
      lignes_importees: 1,
      lignes_en_erreur: 1,
      statut: "partial",
    });
    expect(resultat.erreurs).toEqual(["Ligne 3 : matricule obligatoire."]);
  });
});
