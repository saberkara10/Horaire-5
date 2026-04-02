/**
 * TESTS - Utils Programmes
 *
 * Ce fichier couvre la normalisation
 * et la comparaison des programmes.
 */
import request from "supertest";
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

const { default: app } = await import("../src/app.js");

describe("Tests route Programmes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/programmes retourne les programmes normalises et la reference", async () => {
    queryMock.mockResolvedValue([[
      { programme: "Commerce" },
      { programme: "Informatique" },
      { programme: "Reseaux" },
      { programme: "Design graphique" },
    ]]);

    const response = await request(app).get("/api/programmes");

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Commerce");
    expect(response.body).toContain("Informatique");
    expect(response.body).toContain("Reseaux");
    expect(response.body).toContain("Design graphique");
    expect(response.body).toEqual([
      "Commerce",
      "Design graphique",
      "Informatique",
      "Reseaux",
    ]);
  });

  test("GET /api/programmes conserve aussi les libelles importes", async () => {
    queryMock.mockResolvedValue([[{ programme: "Developpement Web" }]]);

    const response = await request(app).get("/api/programmes");

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Developpement Web");
  });

  test("GET /api/programmes nettoie les valeurs vides et trie les programmes", async () => {
    queryMock.mockResolvedValue([[
      { programme: "  Reseaux  " },
      { programme: "" },
      { programme: "Commerce" },
      { programme: null },
      { programme: "Analyse de donnees" },
    ]]);

    const response = await request(app).get("/api/programmes");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([
      "Analyse de donnees",
      "Commerce",
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
/**
 * TESTS - Utils Programmes
 *
 * Ce fichier couvre la normalisation
 * et la comparaison des programmes.
 */
