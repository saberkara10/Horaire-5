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
    expect(response.body).toContain("Techniques en administration des affaires");
    expect(response.body).toContain("Programmation informatique");
    expect(response.body).toContain(
      "Technologie des systemes informatiques - cybersecurite et reseautique"
    );
    expect(response.body).toContain("Design graphique");
    expect(response.body.length).toBeGreaterThanOrEqual(20);
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
