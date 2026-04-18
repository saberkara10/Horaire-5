import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const importServiceMock = {
  importerSallesDepuisFichier: jest.fn(),
};

await jest.unstable_mockModule("../src/services/import-salles.service.js", () => ({
  importerSallesDepuisFichier: importServiceMock.importerSallesDepuisFichier,
}));

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth(request, response, next) {
    request.user = {
      id: 1,
      email: "admin@ecole.ca",
      roles: ["ADMIN"],
    };
    next();
  },
  userNotAuth(request, response, next) {
    next();
  },
  userAdmin(request, response, next) {
    next();
  },
  userResponsable(request, response, next) {
    next();
  },
  userAdminOrResponsable(request, response, next) {
    next();
  },
}));

const { ImportExcelError } = await import("../src/services/import-excel.shared.js");
const { default: app } = await import("../src/app.js");

describe("routes import salles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/salles/import retourne 200 avec le resume d'import", async () => {
    importServiceMock.importerSallesDepuisFichier.mockResolvedValue({
      message: "Import termine partiellement.",
      total_lignes_lues: 3,
      lignes_importees: 2,
      lignes_creees: 1,
      lignes_mises_a_jour: 1,
      lignes_ignorees: 0,
      lignes_en_erreur: 1,
      erreurs: ["Ligne 4 : capacite invalide (0)."],
    });

    const response = await request(app)
      .post("/api/salles/import")
      .attach("fichier", Buffer.from("contenu"), "salles.xlsx");

    expect(response.statusCode).toBe(200);
    expect(response.body.lignes_en_erreur).toBe(1);
  });

  test("POST /api/salles/import retourne 400 si le format de fichier est invalide", async () => {
    const response = await request(app)
      .post("/api/salles/import")
      .attach("fichier", Buffer.from("contenu"), "salles.txt");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Format de fichier non supporte.",
      erreurs: ["Le fichier doit etre au format .xlsx, .xls ou .csv."],
    });
  });

  test("POST /api/salles/import relaie les erreurs de service", async () => {
    importServiceMock.importerSallesDepuisFichier.mockRejectedValue(
      new ImportExcelError("Impossible de lire le fichier.", {
        erreurs: ["Le fichier envoye ne peut pas etre lu comme un document Excel ou CSV valide."],
      })
    );

    const response = await request(app)
      .post("/api/salles/import")
      .attach("fichier", Buffer.from("contenu"), "salles.xlsx");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Impossible de lire le fichier.");
  });
});
