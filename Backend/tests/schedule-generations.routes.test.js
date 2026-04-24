import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const listGenerationsMock = jest.fn();
const getGenerationByIdMock = jest.fn();
const updateGenerationMock = jest.fn();
const compareGenerationsMock = jest.fn();
const restoreGenerationMock = jest.fn();
const duplicateGenerationMock = jest.fn();
const archiveGenerationMock = jest.fn();
const softDeleteGenerationMock = jest.fn();

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (request, _response, next) => {
    request.user = { id: 12, roles: ["ADMIN"] };
    next();
  },
  userAdmin: (_request, _response, next) => next(),
}));

await jest.unstable_mockModule(
  "../src/services/scheduler/ScheduleGenerationService.js",
  () => ({
    ScheduleGenerationService: {
      listGenerations: listGenerationsMock,
      getGenerationById: getGenerationByIdMock,
      updateGeneration: updateGenerationMock,
      compareGenerations: compareGenerationsMock,
      restoreGeneration: restoreGenerationMock,
      duplicateGeneration: duplicateGenerationMock,
      archiveGeneration: archiveGenerationMock,
      softDeleteGeneration: softDeleteGenerationMock,
    },
  })
);

const { default: scheduleGenerationsRoutes } = await import(
  "../routes/schedule-generations.routes.js"
);

function createApp() {
  const app = express();
  app.use(express.json());
  scheduleGenerationsRoutes(app);
  return app;
}

describe("schedule generations routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/schedule-generations retourne les generations filtrees", async () => {
    listGenerationsMock.mockResolvedValueOnce([
      { id_generation: 3, generation_name: "Version 3" },
    ]);

    const response = await request(createApp()).get(
      "/api/schedule-generations?id_session=9&status=active"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id_generation: 3, generation_name: "Version 3" },
    ]);
    expect(listGenerationsMock).toHaveBeenCalledWith({
      idSession: "9",
      status: "active",
    });
  });

  test("GET /api/schedule-generations retourne 500 si le service echoue", async () => {
    listGenerationsMock.mockRejectedValueOnce(new Error("db"));

    const response = await request(createApp()).get("/api/schedule-generations");

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("db");
  });

  test("GET /api/schedule-generations/:id valide l'identifiant", async () => {
    const response = await request(createApp()).get("/api/schedule-generations/abc");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Identifiant de generation invalide.",
    });
  });

  test("GET /api/schedule-generations/:id retourne 404 si la generation est absente", async () => {
    getGenerationByIdMock.mockResolvedValueOnce(null);

    const response = await request(createApp()).get("/api/schedule-generations/7");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Generation introuvable." });
  });

  test("PATCH /api/schedule-generations/:id met a jour une generation", async () => {
    updateGenerationMock.mockResolvedValueOnce({
      id_generation: 11,
      generation_name: "Version 11",
    });

    const response = await request(createApp())
      .patch("/api/schedule-generations/11")
      .send({ generation_name: "Version 11" });

    expect(response.status).toBe(200);
    expect(response.body.generation_name).toBe("Version 11");
    expect(updateGenerationMock).toHaveBeenCalledWith(
      11,
      { generation_name: "Version 11" },
      expect.objectContaining({
        user: { id: 12, roles: ["ADMIN"] },
      })
    );
  });

  test("POST /api/schedule-generations/compare valide la presence des identifiants", async () => {
    const response = await request(createApp())
      .post("/api/schedule-generations/compare")
      .send({ left_id: 4 });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("left_id et right_id");
  });

  test("POST /api/schedule-generations/compare accepte les alias generation_a_id / generation_b_id", async () => {
    compareGenerationsMock.mockResolvedValueOnce({
      comparison: { changes: { added: [] } },
    });

    const response = await request(createApp())
      .post("/api/schedule-generations/compare")
      .send({ generation_a_id: 4, generation_b_id: 8 });

    expect(response.status).toBe(200);
    expect(compareGenerationsMock).toHaveBeenCalledWith(
      { leftId: 4, rightId: 8 },
      expect.objectContaining({
        user: { id: 12, roles: ["ADMIN"] },
      })
    );
  });

  test("POST /api/schedule-generations/:id/restore retourne 200 quand une confirmation est requise", async () => {
    restoreGenerationMock.mockResolvedValueOnce({
      requires_confirmation: true,
      comparison: {},
    });

    const response = await request(createApp())
      .post("/api/schedule-generations/14/restore")
      .send({ confirm: false, note: "preview" });

    expect(response.status).toBe(200);
    expect(restoreGenerationMock).toHaveBeenCalledWith(
      14,
      { confirm: false, note: "preview" },
      expect.objectContaining({
        user: { id: 12, roles: ["ADMIN"] },
      })
    );
  });

  test("POST /api/schedule-generations/:id/restore relaie les details d'erreur", async () => {
    restoreGenerationMock.mockRejectedValueOnce({
      statusCode: 409,
      message: "Restauration bloquee.",
      details: { blockingIssues: [{ code: "GROUP_NOT_FOUND" }] },
    });

    const response = await request(createApp())
      .post("/api/schedule-generations/14/restore")
      .send({ confirm: true });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Restauration bloquee.",
      details: { blockingIssues: [{ code: "GROUP_NOT_FOUND" }] },
    });
  });

  test("POST /api/schedule-generations/:id/duplicate duplique une generation", async () => {
    duplicateGenerationMock.mockResolvedValueOnce({ id_generation: 22 });

    const response = await request(createApp()).post(
      "/api/schedule-generations/22/duplicate"
    );

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id_generation: 22 });
  });

  test("PATCH /api/schedule-generations/:id/archive archive une generation", async () => {
    archiveGenerationMock.mockResolvedValueOnce({
      id_generation: 9,
      status: "archived",
    });

    const response = await request(createApp()).patch(
      "/api/schedule-generations/9/archive"
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("archived");
  });

  test("DELETE /api/schedule-generations/:id supprime logiquement une generation", async () => {
    softDeleteGenerationMock.mockResolvedValueOnce({
      success: true,
      id_generation: 19,
    });

    const response = await request(createApp()).delete(
      "/api/schedule-generations/19"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      id_generation: 19,
    });
  });
});
