import request from "supertest";
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

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

  test("GET /api/professeurs retourne 200 avec la liste", async () => {
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
    expect(response.body).toHaveLength(1);
  });

  test("GET /api/professeurs retourne 500 si erreur serveur", async () => {
    professeursModelMock.recupererTousLesProfesseurs.mockRejectedValue(new Error("DB error"));

    const response = await request(app).get("/api/professeurs");

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur serveur.");
  });

  test("GET /api/professeurs/:id retourne 400 si id invalide", async () => {
    const response = await request(app).get("/api/professeurs/abc");

    expect(response.statusCode).toBe(400);
  });

  test("GET /api/professeurs/:id retourne 404 si professeur inexistant", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue(null);

    const response = await request(app).get("/api/professeurs/999");

    expect(response.statusCode).toBe(404);
  });

  test("GET /api/professeurs/:id retourne 200 si professeur trouvé", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });

    const response = await request(app).get("/api/professeurs/1");

    expect(response.statusCode).toBe(200);
    expect(response.body.id_professeur).toBe(1);
  });

  test("POST /api/professeurs retourne 400 si données invalides", async () => {
    const response = await request(app)
      .post("/api/professeurs")
      .send({
        matricule: "",
        nom: "123",
        prenom: "123",
        specialite: "Informatique",
      });

    expect(response.statusCode).toBe(400);
  });

  test("POST /api/professeurs retourne 409 si matricule déjà utilisé", async () => {
    professeursModelMock.recupererProfesseurParMatricule.mockResolvedValue({
      id_professeur: 2,
      matricule: "MAT999",
    });

    const response = await request(app)
      .post("/api/professeurs")
      .send({
        matricule: "MAT999",
        nom: "Prof Test",
        prenom: "Test",
        specialite: "Informatique",
      });

    expect(response.statusCode).toBe(409);
  });

  test("POST /api/professeurs retourne 201 si succès", async () => {
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

    expect(response.statusCode).toBe(201);
    expect(response.body.matricule).toBe("MAT999");
  });

  test("POST /api/professeurs retourne 500 si erreur serveur", async () => {
    professeursModelMock.recupererProfesseurParMatricule.mockResolvedValue(null);
    professeursModelMock.ajouterProfesseur.mockRejectedValue(new Error("DB error"));

    const response = await request(app)
      .post("/api/professeurs")
      .send({
        matricule: "MAT999",
        nom: "Prof Test",
        prenom: "Test",
        specialite: "Informatique",
      });

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur serveur.");
  });

  test("PUT /api/professeurs/:id retourne 400 si id invalide", async () => {
    const response = await request(app)
      .put("/api/professeurs/abc")
      .send({ specialite: "Réseau" });

    expect(response.statusCode).toBe(400);
  });

  test("PUT /api/professeurs/:id retourne 404 si professeur inexistant", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue(null);

    const response = await request(app)
      .put("/api/professeurs/999")
      .send({ specialite: "Réseau" });

    expect(response.statusCode).toBe(404);
  });

  test("PUT /api/professeurs/:id retourne 400 si aucune donnée", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });

    const response = await request(app)
      .put("/api/professeurs/1")
      .send({});

    expect(response.statusCode).toBe(400);
  });

  test("PUT /api/professeurs/:id retourne 200 si succès", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.recupererProfesseurParMatricule.mockResolvedValue(null);
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

    expect(response.statusCode).toBe(200);
    expect(response.body.specialite).toBe("Réseau");
  });

  test("PUT /api/professeurs/:id retourne 500 si erreur serveur", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.recupererProfesseurParMatricule.mockResolvedValue(null);
    professeursModelMock.modifierProfesseur.mockRejectedValue(new Error("DB error"));

    const response = await request(app)
      .put("/api/professeurs/1")
      .send({ specialite: "Réseau" });

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur serveur.");
  });

  test("DELETE /api/professeurs/:id retourne 400 si id invalide", async () => {
    const response = await request(app).delete("/api/professeurs/abc");

    expect(response.statusCode).toBe(400);
  });

  test("DELETE /api/professeurs/:id retourne 404 si professeur inexistant", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue(null);

    const response = await request(app).delete("/api/professeurs/999");

    expect(response.statusCode).toBe(404);
  });

  test("DELETE /api/professeurs/:id retourne 400 si professeur déjà affecté", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.professeurEstDejaAffecte.mockResolvedValue(true);

    const response = await request(app).delete("/api/professeurs/1");

    expect(response.statusCode).toBe(400);
  });

  test("DELETE /api/professeurs/:id retourne 200 si succès", async () => {
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

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Professeur supprime.");
  });

  test("DELETE /api/professeurs/:id retourne 500 si erreur serveur", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.professeurEstDejaAffecte.mockResolvedValue(false);
    professeursModelMock.supprimerProfesseur.mockRejectedValue(new Error("DB error"));

    const response = await request(app).delete("/api/professeurs/1");

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur serveur.");
  });
});