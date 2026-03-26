import express from "express";
import request from "supertest";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const creerAffectation = jest.fn();
const recupererToutesLesAffectations = jest.fn();
const supprimerAffectation = jest.fn();
const validerAffectation = jest.fn();

jest.unstable_mockModule("../src/model/affectations.model.js", () => ({
  creerAffectation,
  recupererToutesLesAffectations,
  supprimerAffectation,
}));

jest.unstable_mockModule("../src/validations/affectations.validation.js", () => ({
  validerAffectation,
}));

const { default: affectationsRoutes } = await import("../routes/affectations.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  affectationsRoutes(app);
  return app;
}

describe("routes affectations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/affectations retourne 200", async () => {
    recupererToutesLesAffectations.mockResolvedValue([{ id_affectation_cours: 1 }]);
    const app = createApp();

    const response = await request(app).get("/api/affectations");

    expect(response.statusCode).toBe(200);
    expect(response.body[0].id_affectation_cours).toBe(1);
  });

  it("GET /api/affectations retourne 500 si erreur", async () => {
    recupererToutesLesAffectations.mockRejectedValue(new Error("Erreur"));
    const app = createApp();

    const response = await request(app).get("/api/affectations");

    expect(response.statusCode).toBe(500);
  });

  it("POST /api/affectations retourne 201 si succès", async () => {
    validerAffectation.mockImplementation(() => {});
    creerAffectation.mockResolvedValue({ id_affectation_cours: 5 });
    const app = createApp();

    const response = await request(app)
      .post("/api/affectations")
      .send({
        id_cours: 1,
        id_professeur: 1,
        id_salle: 1,
        date: "2026-03-26",
        heure_debut: "08:00",
        heure_fin: "11:00",
        id_groupes: [1],
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.id_affectation_cours).toBe(5);
  });

  it("POST /api/affectations retourne 400 si validation échoue", async () => {
    validerAffectation.mockImplementation(() => {
      throw new Error("Cours, professeur et salle obligatoires");
    });
    const app = createApp();

    const response = await request(app).post("/api/affectations").send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Cours, professeur et salle obligatoires");
  });

  it("DELETE /api/affectations/:id retourne 400 si id invalide", async () => {
    const app = createApp();

    const response = await request(app).delete("/api/affectations/abc");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("ID invalide.");
  });

  it("DELETE /api/affectations/:id retourne 200 si succès", async () => {
    supprimerAffectation.mockResolvedValue();
    const app = createApp();

    const response = await request(app).delete("/api/affectations/1");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Affectation supprimee.");
  });

  it("DELETE /api/affectations/:id retourne 500 si erreur", async () => {
    supprimerAffectation.mockRejectedValue(new Error("Affectation introuvable."));
    const app = createApp();

    const response = await request(app).delete("/api/affectations/1");

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Affectation introuvable.");
  });
});