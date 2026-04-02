/**
 * TESTS - Routes Professeurs
 *
 * Ce fichier couvre les principaux cas
 * des routes de gestion des professeurs.
 */
import request from "supertest";
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const professeursModelMock = {
  recupererTousLesProfesseurs: jest.fn(),
  recupererProfesseurParId: jest.fn(),
  recupererProfesseurParMatricule: jest.fn(),
  recupererCoursProfesseur: jest.fn(),
  recupererIndexCoursProfesseurs: jest.fn(),
  recupererDisponibilitesProfesseur: jest.fn(),
  recupererDisponibilitesProfesseurs: jest.fn(),
  recupererHoraireProfesseur: jest.fn(),
  remplacerCoursProfesseur: jest.fn(),
  remplacerDisponibilitesProfesseur: jest.fn(),
  ajouterProfesseur: jest.fn(),
  modifierProfesseur: jest.fn(),
  supprimerProfesseur: jest.fn(),
  professeurEstDejaAffecte: jest.fn(),
};

await jest.unstable_mockModule("../src/model/professeurs.model.js", () => professeursModelMock);

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

describe("Tests routes Professeurs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/professeurs retourne 200 avec la liste", async () => {
    professeursModelMock.recupererTousLesProfesseurs.mockResolvedValue([
      {
        id_professeur: 1,
        matricule: "MAT001",
        nom: "Dupont",
        prenom: "Ali",
        specialite: "Programmation informatique",
        cours_assignes: "INF101, INF102",
      },
    ]);

    const response = await request(app).get("/api/professeurs");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  test("GET /api/professeurs/1/cours retourne 200", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
    });
    professeursModelMock.recupererCoursProfesseur.mockResolvedValue([
      { id_cours: 1, code: "INF101" },
    ]);

    const response = await request(app).get("/api/professeurs/1/cours");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  test("PUT /api/professeurs/1/cours retourne 200 avec des cours valides", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
    });
    professeursModelMock.remplacerCoursProfesseur.mockResolvedValue([
      { id_cours: 1, code: "INF101" },
    ]);

    const response = await request(app)
      .put("/api/professeurs/1/cours")
      .send({ cours_ids: [1, 2] });

    expect(response.statusCode).toBe(200);
    expect(professeursModelMock.remplacerCoursProfesseur).toHaveBeenCalledWith(1, [1, 2]);
  });

  test("GET /api/professeurs/1/horaire retourne 200 avec les seances triees", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Programmation informatique",
    });
    professeursModelMock.recupererHoraireProfesseur.mockResolvedValue([
      {
        id_affectation_cours: 10,
        code_cours: "INF301",
        nom_cours: "Reseaux",
        code_salle: "B203",
        date: "2026-03-24",
        heure_debut: "10:00:00",
        heure_fin: "12:00:00",
      },
    ]);

    const response = await request(app).get("/api/professeurs/1/horaire");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  test("PUT /api/professeurs/1/disponibilites retourne 400 quand le payload est invalide", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Programmation informatique",
    });

    const response = await request(app)
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [
          {
            jour_semaine: 8,
            heure_debut: "10:00",
            heure_fin: "12:00",
          },
        ],
      });

    expect(response.statusCode).toBe(400);
  });

  test("POST /api/professeurs retourne 201 quand les donnees sont valides", async () => {
    professeursModelMock.recupererProfesseurParMatricule.mockResolvedValue(null);
    professeursModelMock.ajouterProfesseur.mockResolvedValue({
      id_professeur: 2,
      matricule: "MAT999",
      nom: "Prof",
      prenom: "Test",
      specialite: "Programmation informatique",
      cours_ids: "1,2",
    });

    const response = await request(app)
      .post("/api/professeurs")
      .send({
        matricule: "MAT999",
        nom: "Prof",
        prenom: "Test",
        specialite: "Programmation informatique",
        cours_ids: [1, 2],
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.matricule).toBe("MAT999");
  });
});
/**
 * TESTS - Routes Professeurs
 *
 * Ce fichier couvre les principaux cas
 * des routes de gestion des professeurs.
 */
