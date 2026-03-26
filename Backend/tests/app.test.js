import request from "supertest";
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
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

  test("GET /api/groupes retourne 200", async () => {
    queryMock.mockResolvedValue([
      [
        { id_groupes_etudiants: 1, nom_groupe: "INF2025-A" },
      ],
    ]);

    const response = await request(app).get("/api/groupes");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].nom_groupe).toBe("INF2025-A");
  });

  test("GET /api/groupes retourne 500 si erreur BD", async () => {
    queryMock.mockRejectedValue(new Error("DB error"));

    const response = await request(app).get("/api/groupes");

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur lors de la recuperation des groupes.");
  });
});