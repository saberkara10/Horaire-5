import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const importServiceMock = {
  importerCoursDepuisFichier: jest.fn(),
};

await jest.unstable_mockModule("../src/services/import-cours.service.js", () => ({
  importerCoursDepuisFichier: importServiceMock.importerCoursDepuisFichier,
}));

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth(request, _response, next) {
    request.user = {
      id: 1,
      email: "admin@ecole.ca",
      roles: ["ADMIN_RESPONSABLE"],
    };
    next();
  },
  userNotAuth(_request, _response, next) {
    next();
  },
  userAdmin(_request, _response, next) {
    next();
  },
  userResponsable(_request, _response, next) {
    next();
  },
  userAdminOrResponsable(_request, _response, next) {
    next();
  },
}));

const { ImportExcelError } = await import("../src/services/import-excel.shared.js");
const { default: app } = await import("../src/app.js");

describe("routes import cours", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/cours/import retourne 200 avec le resume d'import", async () => {
    importServiceMock.importerCoursDepuisFichier.mockResolvedValue({
      message: "Import termine avec succes.",
      total_lignes_lues: 2,
      lignes_importees: 2,
      lignes_creees: 2,
      lignes_mises_a_jour: 0,
      lignes_ignorees: 0,
      lignes_en_erreur: 0,
      erreurs: [],
    });

    const response = await request(app)
      .post("/api/cours/import")
      .attach("fichier", Buffer.from("contenu"), "cours.xlsx");

    expect(response.statusCode).toBe(200);
    expect(response.body.lignes_creees).toBe(2);
  });

  test("POST /api/cours/import retourne 400 sans fichier", async () => {
    const response = await request(app).post("/api/cours/import");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Aucun fichier fourni.");
  });

  test("POST /api/cours/import relaie une erreur ImportExcelError", async () => {
    importServiceMock.importerCoursDepuisFichier.mockRejectedValue(
      new ImportExcelError("Fichier vide.", {
        erreurs: ["Le fichier contient uniquement l'en-tete ou des lignes vides."],
      })
    );

    const response = await request(app)
      .post("/api/cours/import")
      .attach("fichier", Buffer.from("contenu"), "cours.xlsx");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Fichier vide.",
      erreurs: ["Le fichier contient uniquement l'en-tete ou des lignes vides."],
    });
  });
});
