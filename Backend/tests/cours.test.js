import request from "supertest";
import { jest } from "@jest/globals";

const coursModelMock = {
  recupererTousLesCours: jest.fn(),
  recupererTypesSalleDisponibles: jest.fn(),
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

  test("GET /api/cours doit retourner 200", async () => {
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
  });

  test("GET /api/cours/1 doit retourner 200 ou 404", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
    });

    const response = await request(app).get("/api/cours/1");
    expect([200, 404]).toContain(response.statusCode);
  });

  test("POST /api/cours doit retourner 201 ou 400", async () => {
    coursModelMock.recupererCoursParCode.mockResolvedValue(null);
    coursModelMock.typeSalleExiste.mockResolvedValue(true);
    coursModelMock.ajouterCours.mockResolvedValue({
      id_cours: 2,
      code: "TEST101",
      nom: "Cours Test",
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

    expect([201, 400]).toContain(response.statusCode);
  });

  test("PUT /api/cours/1 doit retourner 200, 400 ou 404", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
      duree: 30,
      programme: "Informatique",
      etape_etude: 1,
      type_salle: "Laboratoire",
    });
    coursModelMock.modifierCours.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Cours Modifié",
    });

    const response = await request(app)
      .put("/api/cours/1")
      .send({ nom: "Cours Modifié" });

    expect([200, 400, 404]).toContain(response.statusCode);
  });

  test("DELETE /api/cours/1 doit retourner 200, 400 ou 404", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
    });
    coursModelMock.coursEstDejaAffecte.mockResolvedValue(false);
    coursModelMock.supprimerCours.mockResolvedValue(true);

    const response = await request(app).delete("/api/cours/1");
    expect([200, 400, 404]).toContain(response.statusCode);
  });
});
