/**
 * TESTS - Route Programmes
 *
 * Ce fichier couvre la normalisation
 * et la deduplication retournees par l'API.
 */
import request from "supertest";
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
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

const { default: app } = await import("../src/app.js");

describe("Tests route Programmes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/programmes retourne les programmes canonises et tries", async () => {
    queryMock.mockResolvedValue([[
      { programme: "Commerce" },
      { programme: "Informatique" },
      { programme: "Reseaux" },
      { programme: "Design graphique" },
    ]]);

    const response = await request(app).get("/api/programmes");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([
      "Commerce",
      "Design graphique",
      "Informatique",
      "Reseaux",
    ]);
  });

  test("GET /api/programmes conserve les libelles non reconnus", async () => {
    queryMock.mockResolvedValue([[{ programme: "Developpement Web" }]]);

    const response = await request(app).get("/api/programmes");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(["Developpement Web"]);
  });

  test("GET /api/programmes nettoie les valeurs vides et deduplique les alias", async () => {
    queryMock.mockResolvedValue([[
      { programme: "  Reseaux  " },
      { programme: "" },
      { programme: "Commerce" },
      { programme: null },
      { programme: "Analyse de donnees" },
      { programme: "Programmation informatique" },
      { programme: "informatique" },
    ]]);

    const response = await request(app).get("/api/programmes");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([
      "Analyse de donnees",
      "Commerce",
      "informatique",
      "Programmation informatique",
      "Reseaux",
    ]);
  });

  test("GET /api/programmes retourne 500 si la base echoue", async () => {
    queryMock.mockRejectedValue(new Error("DB error"));

    const response = await request(app).get("/api/programmes");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: "Erreur lors de la recuperation des programmes.",
    });
  });
});
