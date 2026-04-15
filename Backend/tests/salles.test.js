/**
 * TESTS - Routes Salles
 *
 * Ce fichier couvre les principaux cas
 * des routes de gestion des salles.
 */
import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

const sallesModelMock = {
  getAllSalles: jest.fn(),
  getSalleById: jest.fn(),
  getSalleByCode: jest.fn(),
  addSalle: jest.fn(),
  modifySalle: jest.fn(),
  deleteSalle: jest.fn(),
  salleEstDejaAffectee: jest.fn(),
  recupererOccupationSalle: jest.fn(),
};

await jest.unstable_mockModule("../src/model/salle.js", () => sallesModelMock);

await jest.unstable_mockModule("../routes/export.routes.js", () => ({
  default() {},
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

const { default: app } = await import("../src/app.js");

describe("Tests routes Salles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/salles retourne 200 avec la liste", async () => {
    sallesModelMock.getAllSalles.mockResolvedValue([
      {
        id_salle: 1,
        code: "B201",
        type: "Classe",
        capacite: 30,
      },
    ]);

    const response = await request(app).get("/api/salles");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(sallesModelMock.getAllSalles).toHaveBeenCalledTimes(1);
  });

  test("GET /api/salles/abc retourne 400 si l'identifiant est invalide", async () => {
    const response = await request(app).get("/api/salles/abc");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Identifiant invalide." });
  });

  test("GET /api/salles/1 retourne 200 si la salle existe", async () => {
    const salle = {
      id_salle: 1,
      code: "B201",
      type: "Classe",
      capacite: 30,
    };

    sallesModelMock.getSalleById.mockResolvedValue(salle);

    const response = await request(app).get("/api/salles/1");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(salle);
  });

  test("GET /api/salles/1/occupation retourne la consultation d'occupation", async () => {
    sallesModelMock.getSalleById.mockResolvedValue({
      id_salle: 1,
      code: "B201",
      type: "Classe",
      capacite: 30,
    });
    sallesModelMock.recupererOccupationSalle.mockResolvedValue({
      salle: {
        id_salle: 1,
        code: "B201",
        type: "Classe",
        capacite: 30,
      },
      session: {
        id_session: 3,
        nom: "Automne 2026",
      },
      occupations: [
        {
          id_affectation_cours: 12,
          groupes: "INF-A1",
          code_cours: "INF301",
          nom_cours: "Reseaux",
          nom_professeur: "Dupont",
          prenom_professeur: "Ali",
          statut: "occupee",
        },
      ],
      vue_hebdomadaire: {
        debut_semaine: "2026-03-23",
        fin_semaine: "2026-03-29",
        jours: [],
      },
      resume: {
        taux_occupation_pourcentage: 25,
      },
      temps_reel: {
        statut: "libre",
      },
    });

    const response = await request(app).get(
      "/api/salles/1/occupation?id_session=3&date_reference=2026-03-23"
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.session.id_session).toBe(3);
    expect(response.body.occupations[0]).toMatchObject({
      groupes: "INF-A1",
      code_cours: "INF301",
      nom_professeur: "Dupont",
    });
    expect(sallesModelMock.recupererOccupationSalle).toHaveBeenCalledWith(1, {
      id_session: 3,
      date_reference: "2026-03-23",
      salle: {
        id_salle: 1,
        code: "B201",
        type: "Classe",
        capacite: 30,
      },
    });
  });

  test("GET /api/salles/1/occupation retourne 400 si la session est invalide", async () => {
    sallesModelMock.getSalleById.mockResolvedValue({
      id_salle: 1,
      code: "B201",
      type: "Classe",
      capacite: 30,
    });

    const response = await request(app).get("/api/salles/1/occupation?id_session=abc");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Session invalide." });
    expect(sallesModelMock.recupererOccupationSalle).not.toHaveBeenCalled();
  });

  test("GET /api/salles/1/occupation retourne 400 si la date_reference est invalide", async () => {
    sallesModelMock.getSalleById.mockResolvedValue({
      id_salle: 1,
      code: "B201",
      type: "Classe",
      capacite: 30,
    });

    const response = await request(app).get(
      "/api/salles/1/occupation?date_reference=23-03-2026"
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "La date_reference doit etre au format YYYY-MM-DD.",
    });
    expect(sallesModelMock.recupererOccupationSalle).not.toHaveBeenCalled();
  });

  test("GET /api/salles/999 retourne 404 si la salle est introuvable", async () => {
    sallesModelMock.getSalleById.mockResolvedValue(null);

    const response = await request(app).get("/api/salles/999");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "Salle introuvable." });
  });

  test("POST /api/salles retourne 201 quand les donnees sont valides", async () => {
    const salleAjoutee = {
      id_salle: 3,
      code: "LAB-01",
      type: "Laboratoire",
      capacite: 24,
    };

    sallesModelMock.getSalleByCode
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(salleAjoutee);
    sallesModelMock.addSalle.mockResolvedValue({ insertId: 3 });

    const response = await request(app).post("/api/salles").send({
      code: "LAB-01",
      type: "Laboratoire",
      capacite: 24,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual(salleAjoutee);
    expect(sallesModelMock.addSalle).toHaveBeenCalledWith(
      "LAB-01",
      "Laboratoire",
      24
    );
  });

  test("POST /api/salles retourne 409 si le code existe deja", async () => {
    sallesModelMock.getSalleByCode.mockResolvedValue({
      id_salle: 1,
      code: "B201",
      type: "Classe",
      capacite: 30,
    });

    const response = await request(app).post("/api/salles").send({
      code: "B201",
      type: "Classe",
      capacite: 40,
    });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ message: "Code deja utilise." });
  });

  test("PUT /api/salles/1 retourne 200 quand la modification est valide", async () => {
    sallesModelMock.getSalleById
      .mockResolvedValueOnce({
        id_salle: 1,
        code: "B201",
        type: "Classe",
        capacite: 30,
      })
      .mockResolvedValueOnce({
        id_salle: 1,
        code: "B201",
        type: "Laboratoire",
        capacite: 32,
      });
    sallesModelMock.modifySalle.mockResolvedValue(true);

    const response = await request(app).put("/api/salles/1").send({
      type: "Laboratoire",
      capacite: 32,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      id_salle: 1,
      code: "B201",
      type: "Laboratoire",
      capacite: 32,
    });
  });

  test("PUT /api/salles/1 retourne 400 si aucun champ n'est fourni", async () => {
    sallesModelMock.getSalleById.mockResolvedValue({
      id_salle: 1,
      code: "B201",
      type: "Classe",
      capacite: 30,
    });

    const response = await request(app).put("/api/salles/1").send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Aucun champ a modifier." });
  });

  test("DELETE /api/salles/1 retourne 400 si la salle est deja affectee", async () => {
    sallesModelMock.getSalleById.mockResolvedValue({
      id_salle: 1,
      code: "B201",
      type: "Classe",
      capacite: 30,
    });
    sallesModelMock.salleEstDejaAffectee.mockResolvedValue(true);

    const response = await request(app).delete("/api/salles/1");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Suppression impossible : salle deja affectee.",
    });
  });

  test("DELETE /api/salles/1 retourne 200 quand la suppression est autorisee", async () => {
    sallesModelMock.getSalleById.mockResolvedValue({
      id_salle: 1,
      code: "B201",
      type: "Classe",
      capacite: 30,
    });
    sallesModelMock.salleEstDejaAffectee.mockResolvedValue(false);
    sallesModelMock.deleteSalle.mockResolvedValue(true);

    const response = await request(app).delete("/api/salles/1");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Salle supprimee." });
    expect(sallesModelMock.deleteSalle).toHaveBeenCalledWith(1);
  });
});
/**
 * TESTS - Routes Salles
 *
 * Ce fichier couvre les principaux cas
 * des routes de gestion des salles.
 */
