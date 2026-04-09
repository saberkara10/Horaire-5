import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const etudiantsModelMock = {
  recupererTousLesEtudiants: jest.fn(),
  recupererEtudiantParId: jest.fn(),
  recupererHoraireCompletEtudiant: jest.fn(),
  supprimerTousLesEtudiants: jest.fn(),
};

class ImportEtudiantsErrorMock extends Error {
  constructor(message, { status = 400, erreurs = [] } = {}) {
    super(message);
    this.status = status;
    this.erreurs = erreurs;
  }
}

const importServiceMock = {
  importerEtudiantsDepuisFichier: jest.fn(),
  ImportEtudiantsError: ImportEtudiantsErrorMock,
};

await jest.unstable_mockModule("../src/model/etudiants.model.js", () => etudiantsModelMock);
await jest.unstable_mockModule("../src/services/import-etudiants.service.js", () => importServiceMock);

const { default: app } = await import("../src/app.js");

describe("Tests import etudiants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/etudiants/import retourne 200 avec un fichier valide", async () => {
    importServiceMock.importerEtudiantsDepuisFichier.mockResolvedValue({
      message: "Import termine avec succes.",
      nombre_importes: 2,
      cohorte_utilisee: {
        session: "Automne",
      },
    });

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from("contenu"), "etudiants.xlsx");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: "Import termine avec succes.",
      nombre_importes: 2,
      cohorte_utilisee: {
        session: "Automne",
      },
    });
    expect(importServiceMock.importerEtudiantsDepuisFichier).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: "etudiants.xlsx" })
    );
  });

  test("POST /api/etudiants/import retourne 400 sans fichier", async () => {
    const response = await request(app).post("/api/etudiants/import");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Aucun fichier fourni.",
      erreurs: [
        "Veuillez selectionner un fichier .xlsx, .xls ou .csv avant de lancer l'import.",
      ],
    });
  });

  test("POST /api/etudiants/import retourne 400 si le format est invalide", async () => {
    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from("contenu"), "etudiants.txt");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Format de fichier non supporte.",
      erreurs: ["Le fichier doit etre au format .xlsx, .xls ou .csv."],
    });
  });

  test("POST /api/etudiants/import retourne 400 si le service refuse le fichier", async () => {
    importServiceMock.importerEtudiantsDepuisFichier.mockRejectedValue(
      new ImportEtudiantsErrorMock("Fichier vide.", {
        status: 400,
        erreurs: ["Le fichier contient uniquement l'en-tete ou des lignes vides."],
      })
    );

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from("contenu"), "etudiants.xlsx");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Fichier vide.",
      erreurs: ["Le fichier contient uniquement l'en-tete ou des lignes vides."],
    });
  });

  test("POST /api/etudiants/import retourne 409 si des doublons sont detectes", async () => {
    importServiceMock.importerEtudiantsDepuisFichier.mockRejectedValue(
      new ImportEtudiantsErrorMock("Import impossible.", {
        status: 409,
        erreurs: ["Ligne 2 : l'etudiant au matricule E001 est deja present dans la base de donnees."],
      })
    );

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from("contenu"), "etudiants.xlsx");

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toBe("Import impossible.");
    expect(response.body.erreurs).toHaveLength(1);
  });
});
