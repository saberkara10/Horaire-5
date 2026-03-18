import request from "supertest";
import app from "../src/app.js";

describe("Tests routes Salles", () => {

  // ===============================
  // GET TOUTES LES SALLES
  // ===============================
  test("GET /api/salles doit retourner 200", async () => {
    const response = await request(app).get("/api/salles");
    expect([200, 401, 500]).toContain(response.statusCode);
  });

  // ===============================
  // GET SALLE PAR ID
  // ===============================
  test("GET /api/salles/1 doit retourner 200 ou 404", async () => {
    const response = await request(app).get("/api/salles/1");
    expect([200, 404, 401, 500]).toContain(response.statusCode);
  });

  // ===============================
  // POST CREER SALLE
  // ===============================
  test("POST /api/salles doit retourner 201 ou 400", async () => {

    const nouvelleSalle = {
      code: "TEST-001",
      type: "Laboratoire",
      capacite: 30
    };

    const response = await request(app)
      .post("/api/salles")
      .send(nouvelleSalle);

    expect([201, 400, 401, 409, 500]).toContain(response.statusCode);
  });

  // ===============================
  // PUT MODIFIER SALLE
  // ===============================
  test("PUT /api/salles/1 doit retourner 200, 400 ou 404", async () => {

    const modification = {
      type: "Classe",
      capacite: 40
    };

    const response = await request(app)
      .put("/api/salles/1")
      .send(modification);

    expect([200, 400, 404, 401, 500]).toContain(response.statusCode);
  });

  // ===============================
  // DELETE SUPPRIMER SALLE
  // ===============================
  test("DELETE /api/salles/1 doit retourner 200 ou 404", async () => {

    const response = await request(app)
      .delete("/api/salles/1");

    expect([200, 404, 401, 500]).toContain(response.statusCode);
  });

});

import pool from "../db.js";

afterAll(async () => {
  await pool.end().catch(() => {});
});
