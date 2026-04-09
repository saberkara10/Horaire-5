import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import XLSX from "xlsx";

const enregistrerEtudiantsImportesMock = jest.fn();

await jest.unstable_mockModule("../src/model/import-etudiants.model.js", () => ({
  enregistrerEtudiantsImportes: enregistrerEtudiantsImportesMock,
}));

const { importerEtudiantsDepuisFichier } = await import(
  "../src/services/import-etudiants.service.js"
);

function creerFichierExcel(lignes, nom = "etudiants.xlsx") {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(lignes);
  XLSX.utils.book_append_sheet(workbook, sheet, "Etudiants");

  return {
    originalname: nom,
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
}

function creerFichierExcelMultiFeuilles(
  {
    etudiants,
    coursEchoues = null,
    feuillesSupplementaires = [],
  },
  nom = "etudiants.xlsx"
) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(etudiants), "Etudiants");

  if (Array.isArray(coursEchoues)) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(coursEchoues),
      "CoursEchoues"
    );
  }

  for (const feuille of feuillesSupplementaires) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(feuille.lignes),
      feuille.nom
    );
  }

  return {
    originalname: nom,
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
}

describe("service import-etudiants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("accepte un fichier sans colonne groupe et transmet les cohortes au modele", async () => {
    enregistrerEtudiantsImportesMock.mockResolvedValue({
      nombreImportes: 2,
      nombreCoursEchouesImportes: 0,
      cohorteUtilisee: {
        session: "Automne",
      },
    });

    const fichier = creerFichierExcel([
      ["matricule", "nom", "prenom", "programme", "etape", "session"],
      ["E001", "Ali", "Test", "INF", "1", "Automne"],
      ["E002", "Nina", "Demo", "Analyse de donnees", "4", "Hiver"],
    ]);

    const resultat = await importerEtudiantsDepuisFichier(fichier);

    expect(resultat).toEqual({
      message: "Import termine avec succes.",
      nombre_importes: 2,
      cohorte_utilisee: {
        session: "Automne",
      },
    });
    expect(enregistrerEtudiantsImportesMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          matricule: "E001",
          programme: "Programmation informatique",
          etape: 1,
          session: "Automne",
        }),
        expect.objectContaining({
          matricule: "E002",
          programme: "Analyse de donnees",
          etape: 4,
          session: "Hiver",
        }),
      ],
      { coursEchoues: [] }
    );
  });

  test("accepte un onglet optionnel CoursEchoues et le transmet au modele", async () => {
    enregistrerEtudiantsImportesMock.mockResolvedValue({
      nombreImportes: 2,
      nombreCoursEchouesImportes: 1,
      cohorteUtilisee: {
        session: "Automne",
      },
    });

    const fichier = creerFichierExcelMultiFeuilles({
      etudiants: [
        ["matricule", "nom", "prenom", "programme", "etape", "session"],
        ["INF9001", "Roy", "Nadia", "Programmation informatique", "2", "Automne"],
        ["INF9002", "Ali", "Sami", "Programmation informatique", "1", "Automne"],
      ],
      coursEchoues: [
        ["matricule", "code_cours", "session_cible", "note_echec", "statut"],
        ["INF9001", "INF101", "Automne", "52.5", "a_reprendre"],
      ],
      feuillesSupplementaires: [
        {
          nom: "ChargeAcademique",
          lignes: [
            ["matricule", "nb_cours_normaux", "nb_cours_total"],
            ["INF9001", "7", "8"],
          ],
        },
      ],
    });

    const resultat = await importerEtudiantsDepuisFichier(fichier);

    expect(resultat).toEqual({
      message: "Import des etudiants et des cours echoues termine avec succes.",
      nombre_importes: 2,
      nombre_cours_echoues_importes: 1,
      cohorte_utilisee: {
        session: "Automne",
      },
    });
    expect(enregistrerEtudiantsImportesMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          matricule: "INF9001",
          etape: 2,
          session: "Automne",
        }),
        expect.objectContaining({
          matricule: "INF9002",
          etape: 1,
          session: "Automne",
        }),
      ],
      {
        coursEchoues: [
          expect.objectContaining({
            matricule: "INF9001",
            code_cours: "INF101",
            session: "Automne",
            note_echec: 52.5,
            statut: "a_reprendre",
          }),
        ],
      }
    );
  });

  test("ignore les onglets informatifs supplementaires lorsqu'il n'y a pas d'onglet CoursEchoues", async () => {
    enregistrerEtudiantsImportesMock.mockResolvedValue({
      nombreImportes: 1,
      nombreCoursEchouesImportes: 0,
      cohorteUtilisee: {
        session: "Automne",
      },
    });

    const fichier = creerFichierExcelMultiFeuilles({
      etudiants: [
        ["matricule", "nom", "prenom", "programme", "etape", "session"],
        ["ADM7001", "Dupont", "Lea", "Techniques en administration des affaires", "3", "Automne"],
      ],
      feuillesSupplementaires: [
        {
          nom: "Synthese",
          lignes: [
            ["matricule", "cours_total"],
            ["ADM7001", "7"],
          ],
        },
      ],
    });

    const resultat = await importerEtudiantsDepuisFichier(fichier);

    expect(resultat.nombre_importes).toBe(1);
    expect(enregistrerEtudiantsImportesMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          matricule: "ADM7001",
          programme: "Techniques en administration des affaires",
        }),
      ],
      { coursEchoues: [] }
    );
  });

  test("propage le nombre d'etudiants et cohortes ignores quand le modele filtre les donnees non exploitables", async () => {
    enregistrerEtudiantsImportesMock.mockResolvedValue({
      nombreImportes: 1,
      nombreEtudiantsIgnores: 2,
      nombreCohortesIgnorees: 1,
      cohorteUtilisee: {
        session: "Automne",
      },
    });

    const fichier = creerFichierExcel([
      ["matricule", "nom", "prenom", "programme", "etape", "session"],
      ["INF9001", "Roy", "Nadia", "INF", "1", "Automne"],
    ]);

    const resultat = await importerEtudiantsDepuisFichier(fichier);

    expect(resultat).toEqual({
      message: "Import termine avec succes.",
      nombre_importes: 1,
      nombre_etudiants_ignores: 2,
      nombre_cohortes_ignorees: 1,
      cohorte_utilisee: {
        session: "Automne",
      },
    });
  });
});
