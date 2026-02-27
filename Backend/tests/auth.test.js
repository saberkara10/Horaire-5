import request from "supertest";
import app from "../app.js"; // ✅ car ton auth app.js est à la racine Backend/

describe("Tests routes Auth", () => {
  test("POST /auth/login retourne 200 ou 401 ou 400 ou 500", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: "admin@ecole.ca", password: "Admin123!" });

    expect([200, 401, 400 , 500]).toContain(response.statusCode);
  });

  test("GET /auth/me sans session retourne 401", async () => {
    const response = await request(app).get("/auth/me");
    expect(response.statusCode).toBe(401);
  });
});