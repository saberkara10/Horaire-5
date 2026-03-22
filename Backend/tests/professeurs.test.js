import request from "supertest";
import { jest } from "@jest/globals";

const professeursModelMock = {
  recupererTousLesProfesseurs: jest.fn(),
  recupererProfesseurParId: jest.fn(),
  recupererProfesseurParMatricule: jest.fn(),
  ajouterProfesseur: jest.fn(),
  modifierProfesseur: jest.fn(),
  supprimerProfesseur: jest.fn(),
  professeurEstDejaAffecte: jest.fn(),
};

await jest.unstable_mockModule("../src/model/professeurs.model.js", () => professeursModelMock);

const { default: app } = await import("../src/app.js");

describe("Tests routes Professeurs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/professeurs doit retourner 200", async () => {
    professeursModelMock.recupererTousLesProfesseurs.mockResolvedValue([
      {
        id_professeur: 1,
        matricule: "MAT001",
        nom: "Dupont",
        prenom: "Ali",
        specialite: "Informatique",
      },
    ]);

    const response = await request(app).get("/api/professeurs");
    expect(response.statusCode).toBe(200);
  });

  test("GET /api/professeurs/1 doit retourner 200 ou 404", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });

    const response = await request(app).get("/api/professeurs/1");
    expect([200, 404]).toContain(response.statusCode);
  });

  test("POST /api/professeurs doit retourner 201 ou 400 ou 409", async () => {
    professeursModelMock.recupererProfesseurParMatricule.mockResolvedValue(null);
    professeursModelMock.ajouterProfesseur.mockResolvedValue({
      id_professeur: 2,
      matricule: "MAT999",
      nom: "Prof Test",
      prenom: "Test",
      specialite: "Informatique",
    });

    const response = await request(app)
      .post("/api/professeurs")
      .send({
        matricule: "MAT999",
        nom: "Prof Test",
        prenom: "Test",
        specialite: "Informatique",
      });

    expect([201, 400, 409]).toContain(response.statusCode);
  });

  test("PUT /api/professeurs/1 doit retourner 200, 400 ou 404", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.modifierProfesseur.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Réseau",
    });

    const response = await request(app)
      .put("/api/professeurs/1")
      .send({ specialite: "Réseau" });

    expect([200, 400, 404]).toContain(response.statusCode);
  });

  test("DELETE /api/professeurs/1 doit retourner 200, 400 ou 404", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.professeurEstDejaAffecte.mockResolvedValue(false);
    professeursModelMock.supprimerProfesseur.mockResolvedValue(true);

    const response = await request(app).delete("/api/professeurs/1");
    expect([200, 400, 404]).toContain(response.statusCode);
  });
});