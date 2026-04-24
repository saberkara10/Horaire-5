import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const listerJournalActiviteMock = jest.fn();
const obtenirResumeJournalActiviteMock = jest.fn();
const recupererEvenementJournalMock = jest.fn();

let currentUser = { id: 7, roles: ["ADMIN_RESPONSABLE"] };

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (request, response, next) => {
    if (!currentUser) {
      return response.status(401).json({ message: "Non authentifie." });
    }

    request.user = currentUser;
    return next();
  },
}));

await jest.unstable_mockModule("../src/services/activity-log.service.js", () => ({
  listerJournalActivite: listerJournalActiviteMock,
  obtenirResumeJournalActivite: obtenirResumeJournalActiviteMock,
  recupererEvenementJournal: recupererEvenementJournalMock,
}));

const { default: activityLogsRoutes } = await import("../routes/activity-logs.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  activityLogsRoutes(app);
  return app;
}

describe("activity log routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { id: 7, roles: ["ADMIN_RESPONSABLE"] };
  });

  test("GET /api/admin/activity-logs/stats/summary retourne le resume", async () => {
    currentUser = { id: 7, role: "ADMIN_RESPONSABLE" };
    obtenirResumeJournalActiviteMock.mockResolvedValue({
      total: 21,
      actions_aujourdhui: 4,
    });

    const response = await request(createApp()).get(
      "/api/admin/activity-logs/stats/summary"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      total: 21,
      actions_aujourdhui: 4,
    });
  });

  test("GET /api/admin/activity-logs/stats/summary retourne 500 si le service echoue", async () => {
    obtenirResumeJournalActiviteMock.mockRejectedValueOnce(new Error("indisponible"));

    const response = await request(createApp()).get(
      "/api/admin/activity-logs/stats/summary"
    );

    expect(response.status).toBe(500);
    expect(response.body.message).toContain("statistiques du journal");
  });

  test("GET /api/admin/activity-logs relaie les filtres au service", async () => {
    listerJournalActiviteMock.mockResolvedValueOnce({
      data: [{ id_log: 12, action_type: "LOGIN" }],
      pagination: { page: 2, limit: 10, total: 1, total_pages: 1 },
    });

    const response = await request(createApp()).get(
      "/api/admin/activity-logs?page=2&limit=10&module=Horaires"
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(listerJournalActiviteMock).toHaveBeenCalledWith({
      page: "2",
      limit: "10",
      module: "Horaires",
    });
  });

  test("GET /api/admin/activity-logs retourne 500 si le service echoue", async () => {
    listerJournalActiviteMock.mockRejectedValueOnce(new Error("db"));

    const response = await request(createApp()).get("/api/admin/activity-logs");

    expect(response.status).toBe(500);
    expect(response.body.message).toContain("journal d'activite");
  });

  test("GET /api/admin/activity-logs/:id retourne 400 si l'identifiant est invalide", async () => {
    const response = await request(createApp()).get("/api/admin/activity-logs/abc");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Identifiant de log invalide." });
    expect(recupererEvenementJournalMock).not.toHaveBeenCalled();
  });

  test("GET /api/admin/activity-logs/:id retourne 404 si l'evenement est absent", async () => {
    recupererEvenementJournalMock.mockResolvedValueOnce(null);

    const response = await request(createApp()).get("/api/admin/activity-logs/9");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Evenement introuvable." });
  });

  test("GET /api/admin/activity-logs/:id retourne l'evenement demande", async () => {
    recupererEvenementJournalMock.mockResolvedValueOnce({
      id_log: 18,
      action_type: "GENERATE",
    });

    const response = await request(createApp()).get("/api/admin/activity-logs/18");

    expect(response.status).toBe(200);
    expect(response.body.action_type).toBe("GENERATE");
    expect(recupererEvenementJournalMock).toHaveBeenCalledWith(18);
  });

  test("GET /api/admin/activity-logs/:id retourne 500 si le service echoue", async () => {
    recupererEvenementJournalMock.mockRejectedValueOnce(new Error("db"));

    const response = await request(createApp()).get("/api/admin/activity-logs/18");

    expect(response.status).toBe(500);
    expect(response.body.message).toContain("recuperation de l'evenement");
  });

  test("les routes refusent un utilisateur sans role ADMIN_RESPONSABLE", async () => {
    currentUser = { id: 7, roles: ["ADMIN"] };

    const response = await request(createApp()).get("/api/admin/activity-logs");

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Acces reserve a l'administrateur general.");
  });
});
