/**
 * TESTS - Application Express
 *
 * Ce fichier couvre les principaux cas
 * d'initialisation de l'application.
 */
import request from "supertest";
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

process.env.SESSION_SECRET = "test-secret";

const queryMock = jest.fn();
const recupererGroupesMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

await jest.unstable_mockModule("../src/model/groupes.model.js", () => ({
  recupererGroupes: recupererGroupesMock,
  recupererGroupeParId: jest.fn(),
  recupererPlanningCompletGroupe: jest.fn(),
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
  userAdminTechnique(_request, _response, next) {
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

describe("Tests app.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/health retourne 200", async () => {
    const response = await request(app).get("/api/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("OK");
  });

  test("GET /api/test retourne 200", async () => {
    const response = await request(app).get("/api/test");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("La route de test fonctionne correctement");
  });

  test("GET /api/health accepte une origine localhost de developpement", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:4100");

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:4100"
    );
  });

  test("GET /api/health refuse une origine non autorisee", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "http://origine-non-autorisee.example");

    expect(response.statusCode).toBe(500);
  });

  test("GET /api/groupes retourne 200", async () => {
    recupererGroupesMock.mockResolvedValue([
      { id_groupes_etudiants: 1, nom_groupe: "INF2025-A" },
    ]);

    const response = await request(app).get("/api/groupes");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].nom_groupe).toBe("INF2025-A");
  });

  test("GET /api/groupes retourne 500 si erreur BD", async () => {
    recupererGroupesMock.mockRejectedValue(new Error("DB error"));

    const response = await request(app).get("/api/groupes");

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur lors de la recuperation des groupes.");
  });

  test("GET /admin-only retourne la route de verification admin", async () => {
    const response = await request(app).get("/admin-only");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("OK ADMIN");
    expect(response.body.user.email).toBe("admin@ecole.ca");
  });

  test("GET /responsable-only retourne la route de verification responsable", async () => {
    const response = await request(app).get("/responsable-only");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("OK RESPONSABLE");
    expect(response.body.user.roles).toContain("ADMIN_RESPONSABLE");
  });
});
/**
 * TESTS - Application Express
 *
 * Ce fichier couvre les principaux cas
 * d'initialisation de l'application.
 */
