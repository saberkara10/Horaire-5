import request from "supertest";
import { jest } from "@jest/globals";

const horaireModelMock = {
  getAllAffectations: jest.fn(),
  getAffectationById: jest.fn(),
  creerAffectationValidee: jest.fn(),
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
  beforeEach(() => {
    jest.clearAllMocks();
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

  test("POST /api/horaires/generer retourne 201 avec un resume de generation", async () => {
    horaireModelMock.genererHoraireAutomatiquement.mockResolvedValue({
      message: "2 affectation(s) generee(s).",
      periode: {
        debut: "2026-03-23",
        fin: "2026-04-03",
      },
      affectations: [
        {
          id_affectation_cours: 1,
          cours: "INF101 - Programmation",
        },
      ],
      non_planifies: [],
    });

    const response = await request(app).post("/api/horaires/generer");

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("message");
    expect(horaireModelMock.genererHoraireAutomatiquement).toHaveBeenCalledTimes(1);
  });

  test("POST /api/horaires/generer retourne 400 si les donnees sont insuffisantes", async () => {
    const erreur = new Error("Il faut au moins 1 cours, 1 professeur et 1 salle.");
    erreur.statusCode = 400;
    horaireModelMock.genererHoraireAutomatiquement.mockRejectedValue(erreur);

    const response = await request(app).post("/api/horaires/generer");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Il faut au moins 1 cours, 1 professeur et 1 salle.",
    });
  });

  test("DELETE /api/horaires retourne 200 apres reinitialisation", async () => {
    horaireModelMock.deleteAllAffectations.mockResolvedValue(undefined);

    const response = await request(app).delete("/api/horaires");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Horaires reinitialises." });
  });
});
