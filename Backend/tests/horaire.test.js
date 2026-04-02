/**
 * TESTS - Routes Horaire
 *
 * Ce fichier couvre les principaux cas
 * des routes de gestion des horaires.
 */
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

process.env.SESSION_SECRET = "test-secret";

const horaireModelMock = {
  getAllAffectations: jest.fn(),
  getAffectationById: jest.fn(),
  creerAffectationValidee: jest.fn(),
  updateAffectationValidee: jest.fn(),
  genererHoraireAutomatiquement: jest.fn(),
  deleteAffectation: jest.fn(),
  deleteAllAffectations: jest.fn(),
};

await jest.unstable_mockModule("../src/model/horaire.js", () => horaireModelMock);

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth(request, response, next) {
    request.user = {
      id: 1,
      email: "admin@ecole.ca",
      roles: ["ADMIN"],
    };
    next();
  },
  userNotAuth(request, response, next) {
    next();
  },
  userAdmin(request, response, next) {
    next();
  },
  userResponsable(request, response, next) {
    next();
  },
  userAdminOrResponsable(request, response, next) {
    next();
  },
}));

const { default: app } = await import("../src/app.js");

describe("Tests routes Horaires", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  test("GET /api/horaires retourne 200 avec les affectations", async () => {
    horaireModelMock.getAllAffectations.mockResolvedValue([
      {
        id_affectation_cours: 1,
        cours_code: "INF101",
        professeur_nom: "Dupont",
        salle_code: "B201",
        date: "2026-03-23",
        heure_debut: "08:00:00",
        heure_fin: "10:00:00",
      },
    ]);

    const response = await request(app).get("/api/horaires");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  test("GET /api/horaires retourne 500 si lecture impossible", async () => {
    horaireModelMock.getAllAffectations.mockRejectedValue(new Error("db"));

    const response = await request(app).get("/api/horaires");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("GET /api/horaires/:id retourne 400 si identifiant invalide", async () => {
    const response = await request(app).get("/api/horaires/abc");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Identifiant invalide." });
  });

  test("GET /api/horaires/:id retourne 404 si affectation introuvable", async () => {
    horaireModelMock.getAffectationById.mockResolvedValue(null);

    const response = await request(app).get("/api/horaires/2");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "Affectation introuvable." });
  });

  test("GET /api/horaires/:id retourne 200 si affectation trouvee", async () => {
    horaireModelMock.getAffectationById.mockResolvedValue({ id_affectation_cours: 2 });

    const response = await request(app).get("/api/horaires/2");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id_affectation_cours: 2 });
  });

  test("GET /api/horaires/:id retourne 500 si erreur interne", async () => {
    horaireModelMock.getAffectationById.mockRejectedValue(new Error("db"));

    const response = await request(app).get("/api/horaires/2");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("POST /api/horaires retourne 400 si champs manquants", async () => {
    const response = await request(app).post("/api/horaires").send({
      id_cours: 1,
      id_professeur: 2,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Champs manquants." });
  });

  test("POST /api/horaires retourne 201 quand le creneau est valide", async () => {
    horaireModelMock.creerAffectationValidee.mockResolvedValue({
      id_affectation_cours: 7,
      id_plage_horaires: 3,
    });

    const response = await request(app)
      .post("/api/horaires")
      .send({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        date: "2026-03-23",
        heure_debut: "08:00",
        heure_fin: "10:00",
      });

    expect(response.statusCode).toBe(201);
    expect(horaireModelMock.creerAffectationValidee).toHaveBeenCalledWith({
      idCours: 1,
      idProfesseur: 2,
      idSalle: 3,
      date: "2026-03-23",
      heureDebut: "08:00",
      heureFin: "10:00",
    });
  });

  test("POST /api/horaires retourne le statusCode du modele en cas d'erreur metier", async () => {
    horaireModelMock.creerAffectationValidee.mockRejectedValue({
      statusCode: 409,
      message: "Conflit detecte.",
    });

    const response = await request(app)
      .post("/api/horaires")
      .send({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        date: "2026-03-23",
        heure_debut: "08:00",
        heure_fin: "10:00",
      });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ message: "Conflit detecte." });
  });

  test("PUT /api/horaires/:id retourne 400 si identifiant invalide", async () => {
    const response = await request(app).put("/api/horaires/x").send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Identifiant invalide." });
  });

  test("PUT /api/horaires/:id retourne 400 si payload incomplet", async () => {
    const response = await request(app).put("/api/horaires/4").send({
      id_cours: 1,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Champs manquants." });
  });

  test("PUT /api/horaires/:id retourne 200 si mise a jour valide", async () => {
    horaireModelMock.updateAffectationValidee.mockResolvedValue({
      id_affectation_cours: 4,
      id_salle: 8,
    });

    const response = await request(app).put("/api/horaires/4").send({
      id_cours: 1,
      id_professeur: 2,
      id_salle: 8,
      date: "2026-03-24",
      heure_debut: "09:00",
      heure_fin: "11:00",
    });

    expect(response.statusCode).toBe(200);
    expect(horaireModelMock.updateAffectationValidee).toHaveBeenCalledWith(4, {
      idCours: 1,
      idProfesseur: 2,
      idSalle: 8,
      date: "2026-03-24",
      heureDebut: "09:00",
      heureFin: "11:00",
    });
  });

  test("PUT /api/horaires/:id retourne le statusCode du modele si erreur metier", async () => {
    horaireModelMock.updateAffectationValidee.mockRejectedValue({
      statusCode: 404,
      message: "Affectation introuvable.",
    });

    const response = await request(app).put("/api/horaires/4").send({
      id_cours: 1,
      id_professeur: 2,
      id_salle: 8,
      date: "2026-03-24",
      heure_debut: "09:00",
      heure_fin: "11:00",
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "Affectation introuvable." });
  });

  test("POST /api/horaires/generer retourne 201 avec un resume de generation", async () => {
    horaireModelMock.genererHoraireAutomatiquement.mockResolvedValue({
      message: "2 affectation(s) generee(s).",
      affectations: [{ id_affectation_cours: 1 }],
      non_planifies: [],
    });

    const response = await request(app).post("/api/horaires/generer").send({
      programme: "Informatique",
      etape: "1",
      session: "Automne",
      annee: 2026,
      date_debut: "2026-03-23",
    });

    expect(response.statusCode).toBe(201);
    expect(horaireModelMock.genererHoraireAutomatiquement).toHaveBeenCalledWith({
      programme: "Informatique",
      etape: "1",
      session: "Automne",
      annee: 2026,
      dateDebut: "2026-03-23",
    });
  });

  test("POST /api/horaires/generer retourne 400 si la cohorte est incomplete", async () => {
    const response = await request(app).post("/api/horaires/generer").send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message:
        "Le programme, l'etape, la session et l'annee sont obligatoires pour generer l'horaire.",
    });
  });

  test("POST /api/horaires/generer retourne 400 si la date de debut est invalide", async () => {
    const response = await request(app).post("/api/horaires/generer").send({
      programme: "Informatique",
      etape: "1",
      session: "Automne",
      annee: 2026,
      date_debut: "23-03-2026",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "La date de debut est invalide." });
  });

  test("POST /api/horaires/generer retourne 400 si l'annee est invalide", async () => {
    const response = await request(app).post("/api/horaires/generer").send({
      programme: "Informatique",
      etape: "1",
      session: "Automne",
      annee: 1800,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "L'annee est invalide." });
  });

  test("POST /api/horaires/generer retourne le statusCode du modele en cas d'echec", async () => {
    horaireModelMock.genererHoraireAutomatiquement.mockRejectedValue({
      statusCode: 422,
      message: "Generation impossible.",
    });

    const response = await request(app).post("/api/horaires/generer").send({
      programme: "Informatique",
      etape: "1",
      session: "Automne",
      annee: 2026,
    });

    expect(response.statusCode).toBe(422);
    expect(response.body).toEqual({ message: "Generation impossible." });
  });

  test("DELETE /api/horaires/:id retourne 400 si identifiant invalide", async () => {
    const response = await request(app).delete("/api/horaires/abc");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Identifiant invalide." });
  });

  test("DELETE /api/horaires/:id retourne 404 si affectation absente", async () => {
    horaireModelMock.getAffectationById.mockResolvedValue(null);

    const response = await request(app).delete("/api/horaires/5");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "Affectation introuvable." });
  });

  test("DELETE /api/horaires/:id retourne 200 apres suppression", async () => {
    horaireModelMock.getAffectationById.mockResolvedValue({ id_affectation_cours: 5 });
    horaireModelMock.deleteAffectation.mockResolvedValue(undefined);

    const response = await request(app).delete("/api/horaires/5");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Affectation supprimee." });
    expect(horaireModelMock.deleteAffectation).toHaveBeenCalledWith(5);
  });

  test("DELETE /api/horaires/:id retourne 500 si la suppression echoue", async () => {
    horaireModelMock.getAffectationById.mockResolvedValue({ id_affectation_cours: 5 });
    horaireModelMock.deleteAffectation.mockRejectedValue(new Error("db"));

    const response = await request(app).delete("/api/horaires/5");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("DELETE /api/horaires retourne 200 apres reinitialisation", async () => {
    horaireModelMock.deleteAllAffectations.mockResolvedValue(undefined);

    const response = await request(app).delete("/api/horaires");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Horaires reinitialises." });
  });

  test("DELETE /api/horaires retourne 500 si le reset echoue", async () => {
    horaireModelMock.deleteAllAffectations.mockRejectedValue(new Error("db"));

    const response = await request(app).delete("/api/horaires");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });
});
