/**
 * TESTS - Routes Admins
 *
 * Ce fichier couvre les principaux cas
 * des routes de gestion des sous-admins.
 */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const recupererSousAdminsMock = jest.fn();
const creerSousAdminMock = jest.fn();
const mettreAJourSousAdminMock = jest.fn();
const supprimerSousAdminMock = jest.fn();

jest.unstable_mockModule("../src/model/utilisateur.js", () => ({
  recupererSousAdmins: recupererSousAdminsMock,
  creerSousAdmin: creerSousAdminMock,
  mettreAJourSousAdmin: mettreAJourSousAdminMock,
  supprimerSousAdmin: supprimerSousAdminMock,
}));

const { default: adminsRoutes } = await import("../routes/admins.routes.js");

function createApp(user = null) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = user;
    next();
  });

  adminsRoutes(app);
  return app;
}

describe("routes admins", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/admins retourne 401 si non connecte", async () => {
    const app = createApp();

    const response = await request(app).get("/api/admins");

    expect(response.statusCode).toBe(401);
  });

  it("GET /api/admins retourne 401 si utilisateur non responsable", async () => {
    const app = createApp({ id: 10, roles: ["ADMIN"] });

    const response = await request(app).get("/api/admins");

    expect(response.statusCode).toBe(401);
  });

  it("GET /api/admins retourne la liste des sous-admins pour un responsable", async () => {
    recupererSousAdminsMock.mockResolvedValue([
      { id: 2, email: "admin1@ecole.ca", nom: "Alpha", prenom: "One", role: "ADMIN" },
    ]);
    const app = createApp({ id: 1, roles: ["RESPONSABLE"] });

    const response = await request(app).get("/api/admins");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(recupererSousAdminsMock).toHaveBeenCalled();
  });

  it("POST /api/admins valide les champs obligatoires", async () => {
    const app = createApp({ id: 1, roles: ["RESPONSABLE"] });

    const response = await request(app).post("/api/admins").send({
      nom: "",
      prenom: "Sous",
      email: "sous@ecole.ca",
      password: "Admin123!",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Nom invalide.");
  });

  it("POST /api/admins cree un sous-admin", async () => {
    creerSousAdminMock.mockResolvedValue({
      id: 2,
      email: "sous@ecole.ca",
      nom: "Sous",
      prenom: "Admin",
      role: "ADMIN",
    });
    const app = createApp({ id: 1, roles: ["RESPONSABLE"] });

    const response = await request(app).post("/api/admins").send({
      nom: "Sous",
      prenom: "Admin",
      email: "sous@ecole.ca",
      password: "Admin123!",
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.email).toBe("sous@ecole.ca");
    expect(creerSousAdminMock).toHaveBeenCalledWith({
      nom: "Sous",
      prenom: "Admin",
      email: "sous@ecole.ca",
      password: "Admin123!",
    });
  });

  it("POST /api/admins retourne 409 si le courriel existe deja", async () => {
    creerSousAdminMock.mockRejectedValue({ code: "ER_DUP_ENTRY" });
    const app = createApp({ id: 1, roles: ["RESPONSABLE"] });

    const response = await request(app).post("/api/admins").send({
      nom: "Sous",
      prenom: "Admin",
      email: "sous@ecole.ca",
      password: "Admin123!",
    });

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toBe("Ce courriel est deja utilise.");
  });

  it("PUT /api/admins/:id met a jour un sous-admin", async () => {
    mettreAJourSousAdminMock.mockResolvedValue({
      id: 2,
      email: "maj@ecole.ca",
      nom: "Mise",
      prenom: "AJour",
      role: "ADMIN",
    });
    const app = createApp({ id: 1, roles: ["RESPONSABLE"] });

    const response = await request(app).put("/api/admins/2").send({
      nom: "Mise",
      prenom: "AJour",
      email: "maj@ecole.ca",
      password: "",
    });

    expect(response.statusCode).toBe(200);
    expect(mettreAJourSousAdminMock).toHaveBeenCalledWith(2, {
      nom: "Mise",
      prenom: "AJour",
      email: "maj@ecole.ca",
    });
  });

  it("PUT /api/admins/:id retourne 404 si le sous-admin est introuvable", async () => {
    mettreAJourSousAdminMock.mockResolvedValue(null);
    const app = createApp({ id: 1, roles: ["RESPONSABLE"] });

    const response = await request(app).put("/api/admins/999").send({
      nom: "Mise",
      prenom: "AJour",
      email: "maj@ecole.ca",
    });

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Admin introuvable.");
  });

  it("DELETE /api/admins/:id supprime un sous-admin", async () => {
    supprimerSousAdminMock.mockResolvedValue(true);
    const app = createApp({ id: 1, roles: ["RESPONSABLE"] });

    const response = await request(app).delete("/api/admins/2");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Admin supprime.");
    expect(supprimerSousAdminMock).toHaveBeenCalledWith(2);
  });

  it("DELETE /api/admins/:id retourne 404 si le sous-admin est introuvable", async () => {
    supprimerSousAdminMock.mockResolvedValue(false);
    const app = createApp({ id: 1, roles: ["RESPONSABLE"] });

    const response = await request(app).delete("/api/admins/999");

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Admin introuvable.");
  });
});
/**
 * TESTS - Routes Admins
 *
 * Ce fichier couvre les principaux cas
 * des routes de gestion des sous-admins.
 */
