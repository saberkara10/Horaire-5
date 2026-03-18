import request from "supertest";
import app from "../src/app.js";
import pool from "../db.js";

describe("Tests routes Cours", () => {

  // ===============================
  // GET TOUS LES COURS
  // ===============================
  test("GET /api/cours doit retourner 200", async () => {
    const response = await request(app).get("/api/cours");
    expect(response.statusCode).toBe(200);
  });

  // ===============================
  // GET COURS PAR ID
  // ===============================
  test("GET /api/cours/1 doit retourner 200 ou 404", async () => {
    const response = await request(app).get("/api/cours/1");
    expect([200, 404]).toContain(response.statusCode);
  });

  // ===============================
  // POST CREER COURS
  // ===============================
  test("POST /api/cours doit retourner 201 ou 400", async () => {

    const nouveauCours = {
      code: "TEST101",
      nom: "Cours Test",
      duree: 30,
      programme: "Informatique",
      etape_etude: 1,
      type_salle: "Laboratoire"
    };

    const response = await request(app)
      .post("/api/cours")
      .send(nouveauCours);

    expect([201, 400]).toContain(response.statusCode);
  });

  // ===============================
  // PUT MODIFIER COURS
  // ===============================
  test("PUT /api/cours/1 doit retourner 200, 400 ou 404", async () => {

    const modification = {
      nom: "Cours Modifié"
    };

    const response = await request(app)
      .put("/api/cours/1")
      .send(modification);

    expect([200, 400, 404]).toContain(response.statusCode);
  });

  // ===============================
  // DELETE SUPPRIMER COURS
  // ===============================
  test("DELETE /api/cours/1 doit retourner 200, 400 ou 404", async () => {

    const response = await request(app)
      .delete("/api/cours/1");

    expect([200, 400, 404]).toContain(response.statusCode);
  });

});

afterAll(async () => {
  await pool.end().catch(() => {});
});
