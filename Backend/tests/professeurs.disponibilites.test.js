/**
 * TESTS - Routes Disponibilites Professeurs
 *
 * Ce fichier couvre les principaux cas
 * des routes de disponibilites des professeurs.
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

describe("Tests routes Professeurs disponibilites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    professeursModelMock.recupererProfesseurParNomPrenom.mockResolvedValue(null);
    professeursModelMock.validerContrainteCoursProfesseur.mockResolvedValue("");
  });

  test("GET /api/professeurs/:id/disponibilites retourne 400 si l'identifiant est invalide", async () => {
    const response = await request(app).get("/api/professeurs/abc/disponibilites");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Identifiant invalide." });
  });

  test("GET /api/professeurs/:id/disponibilites retourne 404 si le professeur est introuvable", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue(null);

    const response = await request(app).get("/api/professeurs/999/disponibilites");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "Professeur introuvable." });
  });

  test("GET /api/professeurs/:id/disponibilites retourne 500 si le modele echoue", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "INF01",
    });
    professeursModelMock.recupererDisponibilitesProfesseur.mockRejectedValue(
      new Error("DB error")
    );

    const response = await request(app).get("/api/professeurs/1/disponibilites");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("GET /api/professeurs/:id/disponibilites/journal retourne le journal de replanification", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "INF01",
    });
    professeursModelMock.recupererJournalDisponibilitesProfesseur.mockResolvedValue([
      {
        id_journal_disponibilite_professeur: 7,
        statut: "SUCCES",
      },
    ]);

    const response = await request(app).get(
      "/api/professeurs/1/disponibilites/journal?limit=5"
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([
      {
        id_journal_disponibilite_professeur: 7,
        statut: "SUCCES",
      },
    ]);
    expect(
      professeursModelMock.recupererJournalDisponibilitesProfesseur
    ).toHaveBeenCalledWith(1, {
      limit: "5",
    });
  });

  test("PUT /api/professeurs/:id/disponibilites retourne 400 si disponibilites n'est pas un tableau", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "INF01",
    });

    const response = await request(app)
      .put("/api/professeurs/1/disponibilites")
      .send({ disponibilites: "08:00-10:00" });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Le champ disponibilites doit etre un tableau.",
    });
  });

  test("PUT /api/professeurs/:id/disponibilites retourne 400 si une heure est manquante", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "INF01",
    });

    const response = await request(app)
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [{ jour_semaine: 2, heure_debut: "09:00", heure_fin: "" }],
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Chaque disponibilite doit inclure heure_debut et heure_fin.",
    });
  });

  test("PUT /api/professeurs/:id/disponibilites accepte une disponibilite le dimanche", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "INF01",
    });
    professeursModelMock.remplacerDisponibilitesProfesseur.mockResolvedValue({
      disponibilites: [
        { jour_semaine: 7, heure_debut: "09:00:00", heure_fin: "12:00:00" },
      ],
      session_active: {
        id_session: 1,
        nom: "Automne 2026",
      },
      semaine_reference: {
        numero_semaine: 1,
      },
      variations: [],
    });

    const response = await request(app)
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [{ jour_semaine: 7, heure_debut: "09:00", heure_fin: "12:00" }],
      });

    expect(response.statusCode).toBe(200);
    expect(professeursModelMock.remplacerDisponibilitesProfesseur).toHaveBeenCalledWith(1, [
      { jour_semaine: 7, heure_debut: "09:00", heure_fin: "12:00" },
    ], {
      semaine_cible: undefined,
      mode_application: undefined,
    });
  });

  test("PUT /api/professeurs/:id/disponibilites retourne 400 si l'heure de fin precede l'heure de debut", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "INF01",
    });

    const response = await request(app)
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [{ jour_semaine: 2, heure_debut: "12:00", heure_fin: "10:00" }],
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Chaque disponibilite doit avoir une heure de fin apres l'heure de debut.",
    });
  });

  test("PUT /api/professeurs/:id/disponibilites retourne 400 si le payload contient des doublons", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "INF01",
    });

    const response = await request(app)
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [
          { jour_semaine: 2, heure_debut: "10:00", heure_fin: "12:00" },
          { jour_semaine: 2, heure_debut: "10:00:00", heure_fin: "12:00:00" },
        ],
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Les disponibilites dupliquees ne sont pas autorisees.",
    });
  });

  test("PUT /api/professeurs/:id/disponibilites retourne 500 si le remplacement echoue", async () => {
    professeursModelMock.recupererProfesseurParId.mockResolvedValue({
      id_professeur: 1,
      matricule: "INF01",
    });
    professeursModelMock.remplacerDisponibilitesProfesseur.mockRejectedValue(
      new Error("DB error")
    );

    const response = await request(app)
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [{ jour_semaine: 2, heure_debut: "10:00", heure_fin: "12:00" }],
      });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ message: "DB error", details: [] });
  });
});
/**
 * TESTS - Routes Disponibilites Professeurs
 *
 * Ce fichier couvre les principaux cas
 * des routes de disponibilites des professeurs.
 */
