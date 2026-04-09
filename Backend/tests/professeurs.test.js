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
  recupererProfesseurParNomPrenom: jest.fn(),
  recupererProfesseurParMatricule: jest.fn(),
  assurerUniciteNomPrenomProfesseurs: jest.fn(),
  fusionnerDoublonsProfesseurs: jest.fn(),
  recupererCoursProfesseur: jest.fn(),
  recupererIndexCoursProfesseurs: jest.fn(),
  recupererDisponibilitesProfesseur: jest.fn(),
  recupererJournalDisponibilitesProfesseur: jest.fn(),
  recupererDisponibilitesProfesseurs: jest.fn(),
  recupererHoraireProfesseur: jest.fn(),
  remplacerCoursProfesseur: jest.fn(),
  remplacerDisponibilitesProfesseur: jest.fn(),
  ajouterProfesseur: jest.fn(),
  modifierProfesseur: jest.fn(),
  supprimerProfesseur: jest.fn(),
  professeurEstDejaAffecte: jest.fn(),
  validerContrainteCoursProfesseur: jest.fn(),
  nettoyerAffectationsCoursArchivesProfesseurs: jest.fn(),
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
    professeursModelMock.recupererProfesseurParNomPrenom.mockResolvedValue(null);
    professeursModelMock.validerContrainteCoursProfesseur.mockResolvedValue("");
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

  test("PUT /api/professeurs/1/cours retourne 400 si la contrainte de charge est depassee", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
    });
    professeursModelMock.validerContrainteCoursProfesseur.mockResolvedValue(
      "Un professeur ne peut pas avoir plus de 2 cours dans le meme programme."
    );

    const response = await request(app)
      .put("/api/professeurs/1/cours")
      .send({ cours_ids: [4, 5, 6] });

    expect(response.statusCode).toBe(400);
    expect(professeursModelMock.remplacerCoursProfesseur).not.toHaveBeenCalled();
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

  test("GET /api/professeurs/1/disponibilites/journal retourne 200 avec le journal", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Programmation informatique",
    });
    professeursModelMock.recupererJournalDisponibilitesProfesseur.mockResolvedValue([
      {
        id_journal_replanification: 8,
        statut: "PARTIEL",
      },
    ]);

    const response = await request(app).get(
      "/api/professeurs/1/disponibilites/journal?limit=5"
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([
      {
        id_journal_replanification: 8,
        statut: "PARTIEL",
      },
    ]);
    expect(
      professeursModelMock.recupererJournalDisponibilitesProfesseur
    ).toHaveBeenCalledWith(1, { limit: "5" });
  });

  test("PUT /api/professeurs/1/disponibilites retourne 200 avec un recalcul partiel explicite", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "MAT001",
      nom: "Dupont",
      prenom: "Ali",
      specialite: "Programmation informatique",
    });
    professeursModelMock.remplacerDisponibilitesProfesseur.mockResolvedValue({
      disponibilites: [
        {
          jour_semaine: 2,
          heure_debut: "11:00:00",
          heure_fin: "19:00:00",
        },
      ],
      replanification: {
        statut: "partiel",
        message:
          "1 seance a ete deplacee et 1 seance reste en conflit explicite.",
        seances_concernees: 2,
        seances_deplacees: [{ id_affectation_cours: 12 }],
        seances_non_replanifiees: [{ id_affectation_cours: 13 }],
        resume: {
          seances_concernees: 2,
          seances_replanifiees: 1,
          seances_replanifiees_meme_semaine: 1,
          seances_reportees_semaines_suivantes: 0,
          seances_non_replanifiees: 1,
        },
      },
      synchronisation: {
        id_professeur: 1,
        professeurs_impactes: [1],
        groupes_impactes: [4],
        etudiants_impactes: [10],
        etudiants_reprises_impactes: [11],
      },
    });

    const response = await request(app)
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [
          {
            jour_semaine: 2,
            heure_debut: "11:00",
            heure_fin: "19:00",
          },
        ],
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.replanification).toMatchObject({
      statut: "partiel",
      seances_concernees: 2,
    });
    expect(response.body.synchronisation).toMatchObject({
      groupes_impactes: [4],
      etudiants_impactes: [10],
      etudiants_reprises_impactes: [11],
    });
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
