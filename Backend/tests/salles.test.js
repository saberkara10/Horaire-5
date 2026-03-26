import express from "express";
import request from "supertest";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const getAllSalles = jest.fn();
const getSalleById = jest.fn();
const addSalle = jest.fn();
const modifySalle = jest.fn();
const deleteSalle = jest.fn();

jest.unstable_mockModule("../src/model/salle.js", () => ({
  getAllSalles,
  getSalleById,
  addSalle,
  modifySalle,
  deleteSalle,
}));

const { default: sallesRoutes } = await import("../routes/salles.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  sallesRoutes(app);
  return app;
}

describe("routes salles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/salles retourne 200", async () => {
    getAllSalles.mockResolvedValue([{ id_salle: 1 }]);
    const app = createApp();

    const response = await request(app).get("/api/salles");

    expect(response.statusCode).toBe(200);
    expect(response.body[0].id_salle).toBe(1);
  });

  it("GET /api/salles/:id retourne 404 si salle absente", async () => {
    getSalleById.mockResolvedValue(undefined);
    const app = createApp();

    const response = await request(app).get("/api/salles/1");

    expect(response.statusCode).toBe(404);
  });

  it("GET /api/salles/:id retourne 200 si salle trouvée", async () => {
    getSalleById.mockResolvedValue({ id_salle: 1, code: "A101" });
    const app = createApp();

    const response = await request(app).get("/api/salles/1");

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe("A101");
  });

  it("POST /api/salles retourne 400 si code invalide", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/salles")
      .send({ code: "", type: "LAB", capacite: 20 });

    expect(response.statusCode).toBe(400);
  });

  it("POST /api/salles retourne 201 si succès", async () => {
    addSalle.mockResolvedValue({});
    const app = createApp();

    const response = await request(app)
      .post("/api/salles")
      .send({ code: "A101", type: "LAB", capacite: 20 });

    expect(response.statusCode).toBe(201);
  });

  it("POST /api/salles retourne 409 si doublon", async () => {
    addSalle.mockRejectedValue({ code: "ER_DUP_ENTRY" });
    const app = createApp();

    const response = await request(app)
      .post("/api/salles")
      .send({ code: "A101", type: "LAB", capacite: 20 });

    expect(response.statusCode).toBe(409);
  });

  it("PUT /api/salles/:id retourne 404 si salle absente", async () => {
    getSalleById.mockResolvedValue(undefined);
    const app = createApp();

    const response = await request(app)
      .put("/api/salles/1")
      .send({ type: "LAB", capacite: 30 });

    expect(response.statusCode).toBe(404);
  });

  it("PUT /api/salles/:id retourne 200 si succès", async () => {
    getSalleById.mockResolvedValue({ id_salle: 1 });
    modifySalle.mockResolvedValue({});
    const app = createApp();

    const response = await request(app)
      .put("/api/salles/1")
      .send({ type: "LAB", capacite: 30 });

    expect(response.statusCode).toBe(200);
  });

  it("DELETE /api/salles/:id retourne 404 si salle absente", async () => {
    getSalleById.mockResolvedValue(undefined);
    const app = createApp();

    const response = await request(app).delete("/api/salles/1");

    expect(response.statusCode).toBe(404);
  });

  it("DELETE /api/salles/:id retourne 200 si succès", async () => {
    getSalleById.mockResolvedValue({ id_salle: 1 });
    deleteSalle.mockResolvedValue({});
    const app = createApp();

    const response = await request(app).delete("/api/salles/1");

    expect(response.statusCode).toBe(200);
  });
});