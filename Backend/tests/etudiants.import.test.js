import request from "supertest";
import XLSX from "xlsx";
import { jest } from "@jest/globals";

const etudiantsModelMock = {
  recupererTousLesEtudiants: jest.fn(),
  recupererEtudiantParId: jest.fn(),
  recupererHoraireCompletEtudiant: jest.fn(),
};

const importEtudiantsModelMock = {
  enregistrerEtudiantsImportes: jest.fn(),
};

await jest.unstable_mockModule("../src/model/etudiants.model.js", () => etudiantsModelMock);
await jest.unstable_mockModule(
  "../src/model/import-etudiants.model.js",
  () => importEtudiantsModelMock
);

const { default: app } = await import("../src/app.js");

function creerFichierExcel(lignes) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(lignes);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Etudiants");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
}

describe("Tests import etudiants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/etudiants/import retourne 201 avec un fichier valide", async () => {
    importEtudiantsModelMock.enregistrerEtudiantsImportes.mockResolvedValue({
      nombreImportes: 2,
    });

    const fichier = creerFichierExcel([
      ["matricule", "nom", "prenom", "groupe", "programme", "etape"],
      ["2026001", "Doe", "Jane", "A1", "Informatique", "1"],
      ["2026002", "Dupont", "Marc", "A1", "Informatique", "1"],
    ]);

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("file", fichier, "etudiants.xlsx");

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      message: "Import termine avec succes.",
      nombre_importes: 2,
    });
  });

  test("POST /api/etudiants/import retourne 400 sans fichier", async () => {
    const response = await request(app).post("/api/etudiants/import");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Aucun fichier fourni.",
      erreurs: [
        "Veuillez selectionner un fichier .xlsx ou .csv avant de lancer l'import.",
      ],
    });
  });

  test("POST /api/etudiants/import retourne 400 si le format est invalide", async () => {
    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("file", Buffer.from("contenu"), "etudiants.txt");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Format de fichier non supporte.",
      erreurs: ["Le fichier doit etre au format .xlsx ou .csv."],
    });
  });

  test("POST /api/etudiants/import retourne 400 si le fichier est vide", async () => {
    const fichier = creerFichierExcel([]);

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("file", fichier, "etudiants.xlsx");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Fichier vide.",
      erreurs: ["Le fichier ne contient aucune ligne etudiant a importer."],
    });
  });

  test("POST /api/etudiants/import retourne 400 si une colonne obligatoire manque", async () => {
    const fichier = creerFichierExcel([
      ["matricule", "nom", "prenom", "groupe", "programme"],
      ["2026001", "Doe", "Jane", "A1", "Informatique"],
    ]);

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("file", fichier, "etudiants.xlsx");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Colonnes obligatoires manquantes.");
    expect(response.body.erreurs).toContain(
      "La colonne obligatoire etape est absente du fichier."
    );
  });

  test("POST /api/etudiants/import retourne 400 si un groupe est manquant", async () => {
    const fichier = creerFichierExcel([
      ["matricule", "nom", "prenom", "groupe", "programme", "etape"],
      ["2026001", "Doe", "Jane", "", "Informatique", "1"],
    ]);

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("file", fichier, "etudiants.xlsx");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Import impossible.",
      erreurs: ["Ligne 2 : groupe obligatoire."],
    });
  });

  test("POST /api/etudiants/import retourne 400 si l'etape est invalide", async () => {
    const fichier = creerFichierExcel([
      ["matricule", "nom", "prenom", "groupe", "programme", "etape"],
      ["2026001", "Doe", "Jane", "A1", "Informatique", "12"],
    ]);

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("file", fichier, "etudiants.xlsx");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Import impossible.",
      erreurs: [
        "Ligne 2 : etape invalide (12). La valeur attendue doit etre un entier entre 1 et 8.",
      ],
    });
  });

  test("POST /api/etudiants/import retourne 400 en cas de doublon dans le fichier", async () => {
    const fichier = creerFichierExcel([
      ["matricule", "nom", "prenom", "groupe", "programme", "etape"],
      ["2026001", "Doe", "Jane", "A1", "Informatique", "1"],
      ["2026001", "Dupont", "Marc", "A1", "Informatique", "1"],
    ]);

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("file", fichier, "etudiants.xlsx");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Import impossible.",
      erreurs: ["Ligne 3 : le matricule 2026001 est duplique dans le fichier."],
    });
  });

  test("POST /api/etudiants/import retourne 409 si un matricule existe deja en base", async () => {
    importEtudiantsModelMock.enregistrerEtudiantsImportes.mockResolvedValue({
      erreurs: [
        "Ligne 2 : l'etudiant au matricule 2026001 est deja present dans la base de donnees.",
      ],
    });

    const fichier = creerFichierExcel([
      ["matricule", "nom", "prenom", "groupe", "programme", "etape"],
      ["2026001", "Doe", "Jane", "A1", "Informatique", "1"],
    ]);

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("file", fichier, "etudiants.xlsx");

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      message: "Import impossible.",
      erreurs: [
        "Ligne 2 : l'etudiant au matricule 2026001 est deja present dans la base de donnees.",
      ],
    });
  });
});
