import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import XLSX from "xlsx";

const ajouterCoursMock = jest.fn();
const modifierCoursMock = jest.fn();
const recupererCoursParCodeMock = jest.fn();
const getSalleByCodeMock = jest.fn();
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

await jest.unstable_mockModule("../src/model/cours.model.js", () => ({
  ajouterCours: ajouterCoursMock,
  modifierCours: modifierCoursMock,
  recupererCoursParCode: recupererCoursParCodeMock,
}));

await jest.unstable_mockModule("../src/model/salle.js", () => ({
  getSalleByCode: getSalleByCodeMock,
  getSalleById: jest.fn(),
  getAllSalles: jest.fn(),
  salleEstDejaAffectee: jest.fn(),
}));

const { importerCoursDepuisFichier } = await import(
  "../src/services/import-cours.service.js"
);

function creerFichierExcel(lignes, nom = "cours.xlsx") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(lignes), "Cours");

  return {
    originalname: nom,
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
}

describe("service import-cours", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionMock.beginTransaction.mockResolvedValue(undefined);
    connectionMock.commit.mockResolvedValue(undefined);
    connectionMock.rollback.mockResolvedValue(undefined);
    connectionMock.release.mockResolvedValue(undefined);
    connectionQueryMock.mockResolvedValue([[]]);
  });

  test("importe les cours valides et signale les salles de reference introuvables", async () => {
    getSalleByCodeMock
      .mockResolvedValueOnce({
        id_salle: 3,
        code: "B204",
        type: "Laboratoire",
      })
      .mockResolvedValueOnce({
        id_salle: 4,
        code: "A101",
        type: "Classe",
      })
      .mockResolvedValueOnce(null);
    recupererCoursParCodeMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id_cours: 8,
        code: "WEB201",
        nom: "Ancien nom",
        duree: 2,
        programme: "Developpement Web",
        etape_etude: "2",
        id_salle_reference: 2,
      });

    const fichier = creerFichierExcel([
      [
        "code",
        "nom",
        "duree",
        "programme",
        "etape_etude",
        "salle_reference_code",
        "type_salle",
      ],
      ["INF301", "Reseaux", "2", "Programmation informatique", "3", "B204", "Laboratoire"],
      ["WEB201", "API Web", "3", "Developpement Web", "2", "A101", "Classe"],
      ["MKT101", "Marketing 1", "2", "Marketing numerique", "1", "Z999", ""],
    ]);

    const resultat = await importerCoursDepuisFichier(fichier);

    expect(resultat).toMatchObject({
      total_lignes_lues: 3,
      lignes_creees: 1,
      lignes_mises_a_jour: 1,
      lignes_en_erreur: 1,
      lignes_importees: 2,
      statut: "partial",
    });
    expect(ajouterCoursMock).toHaveBeenCalledWith(
      {
        code: "INF301",
        nom: "Reseaux",
        duree: 2,
        programme: "Programmation informatique",
        etape_etude: "3",
        id_salle_reference: 3,
      },
      connectionMock
    );
    expect(modifierCoursMock).toHaveBeenCalledWith(
      8,
      {
        code: "WEB201",
        nom: "API Web",
        duree: 3,
        programme: "Developpement Web",
        etape_etude: "2",
        id_salle_reference: 4,
      },
      connectionMock
    );
    expect(resultat.erreurs).toContain(
      "Ligne 4 : la salle de reference Z999 est introuvable."
    );
  });

  test("rejette les lignes dont la duree sort du cadre editable du produit", async () => {
    const fichier = creerFichierExcel([
      ["code", "nom", "duree", "programme", "etape_etude", "salle_reference_code"],
      ["INF301", "Reseaux", "6", "Programmation informatique", "3", "B204"],
    ]);

    const resultat = await importerCoursDepuisFichier(fichier);

    expect(resultat).toMatchObject({
      lignes_importees: 0,
      lignes_en_erreur: 1,
      statut: "warning",
    });
    expect(resultat.erreurs[0]).toContain("duree invalide");
    expect(ajouterCoursMock).not.toHaveBeenCalled();
  });
});
