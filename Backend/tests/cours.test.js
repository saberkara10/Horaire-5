/**
 * TESTS - Routes Cours
 *
 * Ce fichier couvre les principaux cas
 * des routes de gestion des cours.
 */
import request from "supertest";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const coursModelMock = {
  DUREE_COURS_FIXE: 3,
  MODES_COURS: ["Presentiel", "En ligne"],
  recupererTousLesCours: jest.fn(),
  recupererTypesSalleDisponibles: jest.fn(),
  recupererCoursParId: jest.fn(),
  recupererCoursParCode: jest.fn(),
  ajouterCours: jest.fn(),
  modifierCours: jest.fn(),
  supprimerCours: jest.fn(),
  coursEstDejaAffecte: jest.fn(),
  salleExisteParId: jest.fn(),
};

await jest.unstable_mockModule("../src/model/cours.model.js", () => coursModelMock);

const { default: app } = await import("../src/app.js");

describe("Tests routes Cours", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("GET /api/cours retourne 200 avec la liste des cours", async () => {
    coursModelMock.recupererTousLesCours.mockResolvedValue([
      {
        id_cours: 1,
        code: "INF101",
        nom: "Programmation",
        duree: 2,
        programme: "Programmation informatique",
        etape_etude: 1,
        id_salle_reference: 3,
        salle_code: "A101",
        salle_type: "Laboratoire",
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

  test("GET /api/cours/:id retourne 200 si cours trouve", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
      duree: 2,
      programme: "Programmation informatique",
      etape_etude: 1,
      id_salle_reference: 3,
      salle_code: "A101",
      salle_type: "Laboratoire",
    });

    const response = await request(app).get("/api/cours/1");

    expect(response.statusCode).toBe(200);
    expect(response.body.id_cours).toBe(1);
  });

  test("POST /api/cours retourne 400 si donnees invalides", async () => {
    const response = await request(app).post("/api/cours").send({
      code: "",
      nom: "12345",
      duree: 0,
      programme: "",
      etape_etude: 10,
      id_salle_reference: 0,
    });

    expect(response.statusCode).toBe(400);
  });

  test("POST /api/cours retourne 409 si code deja utilise", async () => {
    coursModelMock.recupererCoursParCode.mockResolvedValue({
      id_cours: 2,
      code: "INF101",
    });

    const response = await request(app).post("/api/cours").send({
      code: "INF101",
      nom: "Cours Test",
      duree: 2,
      mode_cours: "Presentiel",
      programme: "Programmation informatique",
      etape_etude: 1,
      id_salle_reference: 5,
    });

    expect(response.statusCode).toBe(409);
  });

  test("POST /api/cours retourne 201 si succes", async () => {
    coursModelMock.recupererCoursParCode.mockResolvedValue(null);
    coursModelMock.salleExisteParId.mockResolvedValue(true);
    coursModelMock.ajouterCours.mockResolvedValue({
      id_cours: 2,
      code: "TEST101",
      nom: "Cours Test",
      duree: 2,
      programme: "Programmation informatique",
      etape_etude: 1,
      id_salle_reference: 5,
      salle_code: "B204",
      salle_type: "Laboratoire",
    });

    const response = await request(app).post("/api/cours").send({
      code: "TEST101",
      nom: "Cours Test",
      duree: 2,
      mode_cours: "Presentiel",
      programme: "Programmation informatique",
      etape_etude: 1,
      id_salle_reference: 5,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.code).toBe("TEST101");
  });

  test("POST /api/cours retourne 400 si salle de reference absente", async () => {
    const response = await request(app).post("/api/cours").send({
      code: "TEST101",
      nom: "Cours Test",
      duree: 2,
      mode_cours: "Presentiel",
      programme: "Programmation informatique",
      etape_etude: 1,
    });

    expect(response.statusCode).toBe(400);
  });

  test("POST /api/cours retourne 500 si erreur serveur", async () => {
    coursModelMock.recupererCoursParCode.mockResolvedValue(null);
    coursModelMock.salleExisteParId.mockResolvedValue(true);
    coursModelMock.ajouterCours.mockRejectedValue(new Error("DB error"));

    const response = await request(app).post("/api/cours").send({
      code: "TEST101",
      nom: "Cours Test",
      duree: 2,
      mode_cours: "Presentiel",
      programme: "Programmation informatique",
      etape_etude: 1,
      id_salle_reference: 5,
    });

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur serveur.");
  });

  test("PUT /api/cours/:id retourne 400 si id invalide", async () => {
    const response = await request(app).put("/api/cours/abc").send({
      nom: "Cours Modifie",
    });

    expect(response.statusCode).toBe(400);
  });

  test("PUT /api/cours/:id retourne 404 si cours inexistant", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue(null);

    const response = await request(app).put("/api/cours/999").send({
      nom: "Cours Modifie",
    });

    expect(response.statusCode).toBe(404);
  });

  test("PUT /api/cours/:id retourne 400 si donnees invalides", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
      duree: 2,
      mode_cours: "Presentiel",
      programme: "Programmation informatique",
      etape_etude: 1,
      type_salle: "Laboratoire",
      id_salle_reference: 3,
    });

    const response = await request(app).put("/api/cours/1").send({ archive: true });

    expect(response.statusCode).toBe(400);
  });

  test("PUT /api/cours/:id retourne 200 si succes", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
      duree: 2,
      mode_cours: "Presentiel",
      programme: "Programmation informatique",
      etape_etude: 1,
      type_salle: "Laboratoire",
      id_salle_reference: 3,
    });
    coursModelMock.recupererCoursParCode.mockResolvedValue(null);
    coursModelMock.modifierCours.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Cours Modifie",
    });

    const response = await request(app).put("/api/cours/1").send({
      nom: "Cours Modifie",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.nom).toBe("Cours Modifie");
  });

  test("PUT /api/cours/:id retourne 500 si erreur serveur", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
      duree: 2,
      mode_cours: "Presentiel",
      programme: "Programmation informatique",
      etape_etude: 1,
      type_salle: "Laboratoire",
      id_salle_reference: 3,
    });
    coursModelMock.recupererCoursParCode.mockResolvedValue(null);
    coursModelMock.modifierCours.mockRejectedValue(new Error("DB error"));

    const response = await request(app).put("/api/cours/1").send({
      nom: "Cours Modifie",
    });

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

  test("DELETE /api/cours/:id retourne 400 si cours deja affecte", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
    });
    coursModelMock.coursEstDejaAffecte.mockResolvedValue(true);

    const response = await request(app).delete("/api/cours/1");

    expect(response.statusCode).toBe(400);
  });

  test("DELETE /api/cours/:id retourne 200 si succes", async () => {
    coursModelMock.recupererCoursParId.mockResolvedValue({
      id_cours: 1,
      code: "INF101",
      nom: "Programmation",
    });
    coursModelMock.coursEstDejaAffecte.mockResolvedValue(false);
    coursModelMock.supprimerCours.mockResolvedValue(true);

    const response = await request(app).delete("/api/cours/1");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Cours supprime.");
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
