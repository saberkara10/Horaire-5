import express from "express";
import request from "supertest";
import app from "../src/app.js";

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
});
