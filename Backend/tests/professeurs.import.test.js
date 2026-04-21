import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const importServiceMock = {
  importerProfesseursDepuisFichier: jest.fn(),
};

await jest.unstable_mockModule("../src/services/import-professeurs.service.js", () => ({
  importerProfesseursDepuisFichier: importServiceMock.importerProfesseursDepuisFichier,
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

describe("routes import professeurs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/professeurs/import retourne 200 avec le resume d'import", async () => {
    importServiceMock.importerProfesseursDepuisFichier.mockResolvedValue({
      message: "Import termine avec succes.",
      total_lignes_lues: 2,
      lignes_importees: 2,
      lignes_creees: 1,
      lignes_mises_a_jour: 1,
      lignes_ignorees: 0,
      lignes_en_erreur: 0,
      erreurs: [],
    });

    const response = await request(app)
      .post("/api/professeurs/import")
      .attach("fichier", Buffer.from("contenu"), "professeurs.xlsx");

    expect(response.statusCode).toBe(200);
    expect(response.body.lignes_importees).toBe(2);
    expect(importServiceMock.importerProfesseursDepuisFichier).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: "professeurs.xlsx" })
    );
  });

  test("POST /api/professeurs/import retourne 400 sans fichier", async () => {
    const response = await request(app).post("/api/professeurs/import");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Aucun fichier fourni.");
  });

  test("POST /api/professeurs/import relaie les erreurs metier de format", async () => {
    importServiceMock.importerProfesseursDepuisFichier.mockRejectedValue(
      new ImportExcelError("Colonnes obligatoires manquantes.", {
        erreurs: ["La colonne obligatoire matricule est absente du fichier."],
      })
    );

    const response = await request(app)
      .post("/api/professeurs/import")
      .attach("fichier", Buffer.from("contenu"), "professeurs.xlsx");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Colonnes obligatoires manquantes.",
      erreurs: ["La colonne obligatoire matricule est absente du fichier."],
    });
  });
});
