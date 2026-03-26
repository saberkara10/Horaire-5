import request from "supertest";
import { jest } from "@jest/globals";

const professeursModelMock = {
  recupererTousLesProfesseurs: jest.fn(),
  recupererProfesseurParId: jest.fn(),
  recupererProfesseurParMatricule: jest.fn(),
  recupererDisponibilitesProfesseur: jest.fn(),
  recupererDisponibilitesProfesseurs: jest.fn(),
  recupererHoraireProfesseur: jest.fn(),
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
        specialite: "Informatique",
      },
    ]);

    const response = await request(app).get("/api/professeurs");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(
      professeursModelMock.recupererTousLesProfesseurs
    ).toHaveBeenCalledTimes(1);
  });

  test("GET /api/professeurs/1 retourne 200 si le professeur existe", async () => {
    const professeur = {
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    };

    professeursModelMock.recupererProfesseurParId.mockResolvedValue(professeur);

    const response = await request(app).get("/api/professeurs/1");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(professeur);
  });

  test("GET /api/professeurs/999 retourne 404 si le professeur est introuvable", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue(null);

    const response = await request(app).get("/api/professeurs/999");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "Professeur introuvable." });
  });

  test("GET /api/professeurs/abc retourne 400 si l'identifiant est invalide", async () => {
    const response = await request(app).get("/api/professeurs/abc");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Identifiant invalide." });
  });

  test("GET /api/professeurs/1/horaire retourne 200 avec les seances triees", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.recupererHoraireProfesseur.mockResolvedValue([
      {
        id_affectation_cours: 10,
        id_cours: 3,
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
    expect(
      professeursModelMock.recupererHoraireProfesseur
    ).toHaveBeenCalledWith(1);
  });

  test("GET /api/professeurs/1/disponibilites retourne 200 avec les disponibilites", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.recupererDisponibilitesProfesseur.mockResolvedValue([
      {
        id_disponibilite_professeur: 5,
        id_professeur: 1,
        jour_semaine: 1,
        heure_debut: "08:00:00",
        heure_fin: "10:00:00",
      },
    ]);

    const response = await request(app).get("/api/professeurs/1/disponibilites");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(
      professeursModelMock.recupererDisponibilitesProfesseur
    ).toHaveBeenCalledWith(1);
  });

  test("PUT /api/professeurs/1/disponibilites retourne 200 quand le payload est valide", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.remplacerDisponibilitesProfesseur.mockResolvedValue([
      {
        id_professeur: 1,
        jour_semaine: 2,
        heure_debut: "10:00:00",
        heure_fin: "12:00:00",
      },
    ]);

    const response = await request(app)
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [
          {
            jour_semaine: 2,
            heure_debut: "10:00",
            heure_fin: "12:00",
          },
        ],
      });

    expect(response.statusCode).toBe(200);
    expect(
      professeursModelMock.remplacerDisponibilitesProfesseur
    ).toHaveBeenCalledWith(1, [
      {
        jour_semaine: 2,
        heure_debut: "10:00",
        heure_fin: "12:00",
      },
    ]);
  });

  test("PUT /api/professeurs/1/disponibilites retourne 400 quand le payload est invalide", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
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
    expect(response.body).toEqual({
      message: "Chaque disponibilite doit avoir un jour_semaine entre 1 et 5.",
    });
  });

  test("GET /api/professeurs/abc/horaire retourne 400 si l'identifiant est invalide", async () => {
    const response = await request(app).get("/api/professeurs/abc/horaire");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Identifiant invalide." });
  });

  test("GET /api/professeurs/999/horaire retourne 404 si le professeur est introuvable", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue(null);

    const response = await request(app).get("/api/professeurs/999/horaire");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "Professeur introuvable." });
  });

  test("POST /api/professeurs retourne 201 quand les donnees sont valides", async () => {
    professeursModelMock.recupererProfesseurParMatricule.mockResolvedValue(null);
    professeursModelMock.ajouterProfesseur.mockResolvedValue({
      id_professeur: 2,
      matricule: "MAT999",
      nom: "Prof",
      prenom: "Test",
      specialite: "Informatique",
    });

    const response = await request(app)
      .post("/api/professeurs")
      .send({
        matricule: "MAT999",
        nom: "Prof",
        prenom: "Test",
        specialite: "Informatique",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.matricule).toBe("MAT999");
  });

  test("PUT /api/professeurs/1 retourne 200 quand la modification est valide", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.modifierProfesseur.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Reseau",
    });

    const response = await request(app)
      .put("/api/professeurs/1")
      .send({ specialite: "Reseau" });

    expect(response.statusCode).toBe(200);
    expect(response.body.specialite).toBe("Reseau");
  });

  test("DELETE /api/professeurs/1 retourne 200 quand la suppression est autorisee", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Informatique",
    });
    professeursModelMock.professeurEstDejaAffecte.mockResolvedValue(false);
    professeursModelMock.supprimerProfesseur.mockResolvedValue(true);

    const response = await request(app).delete("/api/professeurs/1");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Professeur supprime." });
  });
});
