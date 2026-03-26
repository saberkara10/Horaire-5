import request from "supertest";
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const coursModelMock = {
  recupererTousLesCours: jest.fn(),
  recupererCoursParId: jest.fn(),
  recupererCoursParCode: jest.fn(),
  ajouterCours: jest.fn(),
  modifierCours: jest.fn(),
  supprimerCours: jest.fn(),
  coursEstDejaAffecte: jest.fn(),
  typeSalleExiste: jest.fn(),
};

await jest.unstable_mockModule("../src/model/cours.model.js", () => coursModelMock);

const { default: app } = await import("../src/app.js");

describe("Tests routes Cours", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/cours retourne 200 avec la liste des cours", async () => {
    coursModelMock.recupererTousLesCours.mockResolvedValue([
      {
        id_cours: 1,
        code: "INF101",
        nom: "Programmation",
        duree: 30,
        programme: "Informatique",
        etape_etude: 1,
        type_salle: "Laboratoire",
      },
    ]);

    const response = await request(app).get("/api/cours");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].code).toBe("INF101");
  });

  test("GET /api/cours retourne 500 si erreur serveur", async () => {
    coursModelMock.recupererTousLesCours.mockRejectedValue(new Error("DB error"));

    const response = await request(app).get("/api/cours");

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur serveur.");
  });

  test("GET /api/cours/:id retourne 400 si id invalide", async () => {
    const response = await request(app).get("/api/cours/abc");

    expect(response.statusCode).toBe(400);
  });

  test("GET /api/cours/:id retourne 404 si cours inexistant", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue(null);

    const response = await request(app).get("/api/cours/999");

    expect(response.statusCode).toBe(404);
  });

  test("GET /api/cours/:id retourne 200 si cours trouvé", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
      duree: 30,
      programme: "Informatique",
      etape_etude: 1,
      type_salle: "Laboratoire",
    });

    const response = await request(app).get("/api/cours/1");

    expect(response.statusCode).toBe(200);
    expect(response.body.id_cours).toBe(1);
  });

  test("POST /api/cours retourne 400 si données invalides", async () => {
    const response = await request(app)
      .post("/api/cours")
      .send({
        code: "",
        nom: "12345",
        duree: 0,
        programme: "",
        etape_etude: 10,
        type_salle: "",
      });

    expect(response.statusCode).toBe(400);
  });

  test("POST /api/cours retourne 409 si code déjà utilisé", async () => {
    coursModelMock.recupererCoursParCode.mockResolvedValue({
      id_cours: 2,
      code: "INF101",
    });

    const response = await request(app)
      .post("/api/cours")
      .send({
        code: "INF101",
        nom: "Cours Test",
        duree: 30,
        programme: "Informatique",
        etape_etude: 1,
        type_salle: "Laboratoire",
      });

    expect(response.statusCode).toBe(409);
  });

  test("POST /api/cours retourne 201 si succès", async () => {
    coursModelMock.recupererCoursParCode.mockResolvedValue(null);
    coursModelMock.typeSalleExiste.mockResolvedValue(true);
    coursModelMock.ajouterCours.mockResolvedValue({
      id_cours: 2,
      code: "TEST101",
      nom: "Cours Test",
      duree: 30,
      programme: "Informatique",
      etape_etude: 1,
      type_salle: "Laboratoire",
    });

    const response = await request(app)
      .post("/api/cours")
      .send({
        code: "TEST101",
        nom: "Cours Test",
        duree: 30,
        programme: "Informatique",
        etape_etude: 1,
        type_salle: "Laboratoire",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.code).toBe("TEST101");
  });

  test("POST /api/cours retourne 500 si erreur serveur", async () => {
    coursModelMock.recupererCoursParCode.mockResolvedValue(null);
    coursModelMock.typeSalleExiste.mockResolvedValue(true);
    coursModelMock.ajouterCours.mockRejectedValue(new Error("DB error"));

    const response = await request(app)
      .post("/api/cours")
      .send({
        code: "TEST101",
        nom: "Cours Test",
        duree: 30,
        programme: "Informatique",
        etape_etude: 1,
        type_salle: "Laboratoire",
      });

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur serveur.");
  });

  test("PUT /api/cours/:id retourne 400 si id invalide", async () => {
    const response = await request(app)
      .put("/api/cours/abc")
      .send({ nom: "Cours Modifié" });

    expect(response.statusCode).toBe(400);
  });

  test("PUT /api/cours/:id retourne 404 si cours inexistant", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue(null);

    const response = await request(app)
      .put("/api/cours/999")
      .send({ nom: "Cours Modifié" });

    expect(response.statusCode).toBe(404);
  });

  test("PUT /api/cours/:id retourne 400 si données invalides", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
      duree: 30,
      programme: "Informatique",
      etape_etude: 1,
      type_salle: "Laboratoire",
    });

    const response = await request(app)
      .put("/api/cours/1")
      .send({ archive: true });

    expect(response.statusCode).toBe(400);
  });

  test("PUT /api/cours/:id retourne 200 si succès", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
      duree: 30,
      programme: "Informatique",
      etape_etude: 1,
      type_salle: "Laboratoire",
    });
    coursModelMock.recupererCoursParCode.mockResolvedValue(null);
    coursModelMock.modifierCours.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Cours Modifié",
    });

    const response = await request(app)
      .put("/api/cours/1")
      .send({ nom: "Cours Modifié" });

    expect(response.statusCode).toBe(200);
    expect(response.body.nom).toBe("Cours Modifié");
  });

  test("PUT /api/cours/:id retourne 500 si erreur serveur", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
      duree: 30,
      programme: "Informatique",
      etape_etude: 1,
      type_salle: "Laboratoire",
    });
    coursModelMock.recupererCoursParCode.mockResolvedValue(null);
    coursModelMock.modifierCours.mockRejectedValue(new Error("DB error"));

    const response = await request(app)
      .put("/api/cours/1")
      .send({ nom: "Cours Modifié" });

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur serveur.");
  });

  test("DELETE /api/cours/:id retourne 400 si id invalide", async () => {
    const response = await request(app).delete("/api/cours/abc");

    expect(response.statusCode).toBe(400);
  });

  test("DELETE /api/cours/:id retourne 404 si cours inexistant", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue(null);

    const response = await request(app).delete("/api/cours/999");

    expect(response.statusCode).toBe(404);
  });

  test("DELETE /api/cours/:id retourne 400 si cours déjà affecté", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
    });
    coursModelMock.coursEstDejaAffecte.mockResolvedValue(true);

    const response = await request(app).delete("/api/cours/1");

    expect(response.statusCode).toBe(400);
  });

  test("DELETE /api/cours/:id retourne 200 si succès", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
    });
    coursModelMock.coursEstDejaAffecte.mockResolvedValue(false);
    coursModelMock.supprimerCours.mockResolvedValue(true);

    const response = await request(app).delete("/api/cours/1");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Cours supprimé.");
  });

  test("DELETE /api/cours/:id retourne 500 si erreur serveur", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
    });
    coursModelMock.coursEstDejaAffecte.mockResolvedValue(false);
    coursModelMock.supprimerCours.mockRejectedValue(new Error("DB error"));

    const response = await request(app).delete("/api/cours/1");

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur serveur.");
  });
});