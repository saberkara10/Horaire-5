import request from "supertest";
import { jest } from "@jest/globals";

const etudiantsModelMock = {
  recupererEtudiantParId: jest.fn(),
  recupererHoraireCompletEtudiant: jest.fn(),
};

await jest.unstable_mockModule("../src/model/etudiants.model.js", () => etudiantsModelMock);

const { default: app } = await import("../src/app.js");

describe("Tests routes Étudiants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/etudiants/1/horaire retourne 200", async () => {
    etudiantsModelMock.recupererEtudiantParId.mockResolvedValue({
      id_etudiant: 1,
      matricule: "2024001",
      nom: "Benali",
      prenom: "Sara",
      groupe: "G01",
      programme: "Informatique",
      etape: 2,
    });

    etudiantsModelMock.recupererHoraireCompletEtudiant.mockResolvedValue({
      etudiant: {
        id_etudiant: 1,
        matricule: "2024001",
        nom: "Benali",
        prenom: "Sara",
        groupe: "G01",
        programme: "Informatique",
        etape: 2,
      },
      horaire: [
        {
          id_affectation_cours: 10,
          code_cours: "INF101",
          nom_cours: "Programmation",
          nom_professeur: "Dupont",
          prenom_professeur: "Ali",
          code_salle: "B204",
          type_salle: "Laboratoire",
          date: "2026-03-18",
          heure_debut: "08:00:00",
          heure_fin: "10:00:00",
        },
      ],
    });

    const response = await request(app).get("/api/etudiants/1/horaire");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("etudiant");
    expect(response.body).toHaveProperty("horaire");
  });

  test("GET /api/etudiants/abc/horaire retourne 400", async () => {
    const response = await request(app).get("/api/etudiants/abc/horaire");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Identifiant étudiant invalide.",
    });
  });

  test("GET /api/etudiants/999/horaire retourne 404", async () => {
    etudiantsModelMock.recupererEtudiantParId.mockResolvedValue(null);

    const response = await request(app).get("/api/etudiants/999/horaire");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      message: "Étudiant introuvable.",
    });
  });

  test("GET /api/etudiants/1/horaire retourne 500", async () => {
    etudiantsModelMock.recupererEtudiantParId.mockRejectedValue(new Error("Erreur test"));

    const response = await request(app).get("/api/etudiants/1/horaire");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: "Erreur serveur.",
    });
  });
});