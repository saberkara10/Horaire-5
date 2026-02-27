import request from "supertest";
import app from "../src/app.js";

describe("Tests routes Professeurs", () => {

  // ===============================
  // GET TOUS LES PROFESSEURS
  // ===============================
  test("GET /api/professeurs doit retourner 200", async () => {
    const response = await request(app).get("/api/professeurs");
    expect(response.statusCode).toBe(200);
  });

  // ===============================
  // GET PROFESSEUR PAR ID
  // ===============================
  test("GET /api/professeurs/1 doit retourner 200 ou 404", async () => {
    const response = await request(app).get("/api/professeurs/1");
    expect([200, 404]).toContain(response.statusCode);
  });

  // ===============================
  // POST CREER PROFESSEUR
  // ===============================
  test("POST /api/professeurs doit retourner 201 ou 400", async () => {

    const nouveauProf = {
      matricule: "MAT999",
      nom: "Prof Test",
      prenom: "Test",
      specialite: "Informatique"
    };

    const response = await request(app)
      .post("/api/professeurs")
      .send(nouveauProf);

    expect([201, 400 , 409]).toContain(response.statusCode);
  });

  // ===============================
  // PUT MODIFIER PROFESSEUR
  // ===============================
  test("PUT /api/professeurs/1 doit retourner 200, 400 ou 404", async () => {

    const modification = {
      specialite: "Réseau"
    };

    const response = await request(app)
      .put("/api/professeurs/1")
      .send(modification);

    expect([200, 400, 404]).toContain(response.statusCode);
  });

  // ===============================
  // DELETE SUPPRIMER PROFESSEUR
  // ===============================
  test("DELETE /api/professeurs/1 doit retourner 200, 400 ou 404", async () => {

    const response = await request(app)
      .delete("/api/professeurs/1");

    expect([200, 400, 404]).toContain(response.statusCode);
  });

});

import pool from "../db.js";

afterAll(async () => {
  await pool.end();
});