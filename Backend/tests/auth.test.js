/**
 * TESTS - Routes Auth
 *
 * Ce fichier couvre les principaux cas
 * des routes d'authentification.
 */
import express from "express";
import request from "supertest";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const authenticateMock = jest.fn();

jest.unstable_mockModule("passport", () => ({
  default: {
    authenticate: authenticateMock,
  },
}));

const { default: authRoutes } = await import("../routes/auth.routes.js");

function createApp(options = {}) {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    req.user = options.user ?? null;
    req.logIn = options.logIn ?? ((user, cb) => cb());
    req.logOut = options.logOut ?? ((cb) => cb());
    next();
  });

  authRoutes(app);

  app.use((error, req, res, next) => {
    res.status(500).json({ message: error.message });
  });

  return app;
}

describe("routes auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /auth/login retourne 400 si courriel invalide", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "", password: "123456" });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Courriel invalide");
  });

  it("POST /auth/login retourne 400 si mot de passe invalide", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "admin@ecole.ca", password: "123" });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Mot de passe invalide");
  });

  it("POST /auth/login retourne 401 si déjà connecté", async () => {
    const app = createApp({ user: { id: 1, roles: ["ADMIN"] } });

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "admin@ecole.ca", password: "123456" });

    expect(response.statusCode).toBe(401);
  });

  it("POST /auth/login retourne 401 si passport ne trouve pas l'utilisateur", async () => {
    authenticateMock.mockImplementation((strategy, callback) => {
      return (req, res, next) =>
        callback(null, false, { message: "Identifiants invalides" });
    });

    const app = createApp();

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "admin@ecole.ca", password: "123456" });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Identifiants invalides");
  });

  it("POST /auth/login retourne 200 si connexion réussie", async () => {
    authenticateMock.mockImplementation((strategy, callback) => {
      return (req, res, next) =>
        callback(null, { id: 1, roles: ["ADMIN"] }, { message: "OK" });
    });

    const app = createApp();

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "admin@ecole.ca", password: "123456" });

    expect(response.statusCode).toBe(200);
  });

  it("POST /auth/login retourne 500 si passport renvoie une erreur", async () => {
    authenticateMock.mockImplementation((strategy, callback) => {
      return (req, res, next) => callback(new Error("Erreur passport"));
    });

    const app = createApp();

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "admin@ecole.ca", password: "123456" });

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur passport");
  });

  it("POST /auth/login retourne 500 si logIn échoue", async () => {
    authenticateMock.mockImplementation((strategy, callback) => {
      return (req, res, next) =>
        callback(null, { id: 1, roles: ["ADMIN"] }, { message: "OK" });
    });

    const app = createApp({
      logIn: (user, cb) => cb(new Error("Erreur login")),
    });

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "admin@ecole.ca", password: "123456" });

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur login");
  });

  it("POST /auth/logout retourne 401 si utilisateur non connecté", async () => {
    const app = createApp();

    const response = await request(app).post("/auth/logout");

    expect(response.statusCode).toBe(401);
  });

  it("POST /auth/logout retourne 200 si succès", async () => {
    const app = createApp({ user: { id: 1, roles: ["ADMIN"] } });

    const response = await request(app).post("/auth/logout");

    expect(response.statusCode).toBe(200);
  });

  it("POST /auth/logout retourne 500 si logOut échoue", async () => {
    const app = createApp({
      user: { id: 1, roles: ["ADMIN"] },
      logOut: (cb) => cb(new Error("Erreur logout")),
    });

    const response = await request(app).post("/auth/logout");

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur logout");
  });

  it("GET /auth/me retourne 401 si non connecté", async () => {
    const app = createApp();

    const response = await request(app).get("/auth/me");

    expect(response.statusCode).toBe(401);
  });

  it("GET /auth/me retourne 200 avec utilisateur connecté", async () => {
    const user = { id: 1, email: "admin@ecole.ca", roles: ["ADMIN"] };
    const app = createApp({ user });

    const response = await request(app).get("/auth/me");

    expect(response.statusCode).toBe(200);
    expect(response.body.email).toBe("admin@ecole.ca");
  });
});
/**
 * TESTS - Routes Auth
 *
 * Ce fichier couvre les principaux cas
 * des routes d'authentification.
 */
