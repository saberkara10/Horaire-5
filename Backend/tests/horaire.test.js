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
  planifierAffectationManuelle: jest.fn(),
  replanifierAffectationManuelle: jest.fn(),
  recupererEtudiantsPourPlanificationReprise: jest.fn(),
  recupererCoursEchouesEtudiantPlanifiables: jest.fn(),
  recupererGroupesCompatiblesPourCoursEchoueEtudiant: jest.fn(),
  planifierRepriseEtudiant: jest.fn(),
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

function payloadHoraire(overrides = {}) {
  return {
    id_cours: 1,
    id_professeur: 2,
    id_salle: 3,
    id_groupes_etudiants: 4,
    date: "2026-03-23",
    heure_debut: "08:00",
    heure_fin: "10:00",
    ...overrides,
  };
}

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
    expect(horaireModelMock.getAllAffectations).toHaveBeenCalledWith({
      sessionActive: false,
    });
  });

  test("GET /api/horaires accepte session_active=1", async () => {
    horaireModelMock.getAllAffectations.mockResolvedValue([]);

    const response = await request(app).get("/api/horaires?session_active=1");

    expect(response.statusCode).toBe(200);
    expect(horaireModelMock.getAllAffectations).toHaveBeenCalledWith({
      sessionActive: true,
    });
  });

  test("GET /api/horaires/reprises/etudiants retourne la liste enrichie pour la reprise manuelle", async () => {
    horaireModelMock.recupererEtudiantsPourPlanificationReprise.mockResolvedValue([
      {
        id_etudiant: 25,
        matricule: "2024001",
        nom: "Kara",
        prenom: "Saber",
        groupe: "GPI-E4-2",
        reprise_manuelle: {
          statut: "a_traiter",
          a_traiter: true,
          nb_total: 2,
          nb_planifies: 0,
          nb_non_planifies: 2,
        },
      },
    ]);

    const response = await request(app).get("/api/horaires/reprises/etudiants");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(
      horaireModelMock.recupererEtudiantsPourPlanificationReprise
    ).toHaveBeenCalledWith();
  });

  test("GET /api/horaires/reprises/etudiants retourne le status metier en cas d'erreur", async () => {
    horaireModelMock.recupererEtudiantsPourPlanificationReprise.mockRejectedValue({
      statusCode: 409,
      message: "Aucune session active n'est disponible.",
    });

    const response = await request(app).get("/api/horaires/reprises/etudiants");

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      message: "Aucune session active n'est disponible.",
    });
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
    expect(response.body).toEqual({
      message:
        "Champs obligatoires manquants: id_salle, id_groupes_etudiants, date, heure_debut, heure_fin.",
    });
    expect(horaireModelMock.planifierAffectationManuelle).not.toHaveBeenCalled();
  });

  test("POST /api/horaires refuse un format d'heure invalide", async () => {
    const response = await request(app)
      .post("/api/horaires")
      .send(payloadHoraire({ heure_debut: "8h00" }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Format d'heure invalide. Utilisez HH:MM ou HH:MM:SS.",
    });
    expect(horaireModelMock.planifierAffectationManuelle).not.toHaveBeenCalled();
  });

  test("POST /api/horaires refuse une heure de fin avant l'heure de debut", async () => {
    const response = await request(app)
      .post("/api/horaires")
      .send(payloadHoraire({ heure_debut: "14:00", heure_fin: "10:00" }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "L'heure de fin doit etre apres l'heure de debut.",
    });
    expect(horaireModelMock.planifierAffectationManuelle).not.toHaveBeenCalled();
  });

  test("POST /api/horaires refuse une duree zero", async () => {
    const response = await request(app)
      .post("/api/horaires")
      .send(payloadHoraire({ heure_debut: "10:00", heure_fin: "10:00" }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "La duree du creneau doit etre superieure a 0.",
    });
    expect(horaireModelMock.planifierAffectationManuelle).not.toHaveBeenCalled();
  });

  test("POST /api/horaires retourne 201 quand le creneau est valide", async () => {
    horaireModelMock.planifierAffectationManuelle.mockResolvedValue({
      id_affectation_cours: 7,
      id_plage_horaires: 3,
    });

    const response = await request(app)
      .post("/api/horaires")
      .send({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        id_groupes_etudiants: 4,
        date: "2026-03-23",
        heure_debut: "08:00",
        heure_fin: "10:00",
      });

    expect(response.statusCode).toBe(201);
    expect(horaireModelMock.planifierAffectationManuelle).toHaveBeenCalledWith({
      idCours: 1,
      idProfesseur: 2,
      idSalle: 3,
      idGroupeEtudiants: 4,
      date: "2026-03-23",
      heureDebut: "08:00",
      heureFin: "10:00",
      portee: {
        mode: "single",
        date_debut: null,
        date_fin: null,
      },
    });
  });

  test("POST /api/horaires transmet la portee personnalisee au service", async () => {
    horaireModelMock.planifierAffectationManuelle.mockResolvedValue({
      message: "2 occurrence(s) planifiee(s).",
    });

    const response = await request(app)
      .post("/api/horaires")
      .send({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        id_groupes_etudiants: 4,
        date: "2026-03-23",
        heure_debut: "08:00",
        heure_fin: "10:00",
        portee_mode: "custom_range",
        date_debut_portee: "2026-03-23",
        date_fin_portee: "2026-04-20",
      });

    expect(response.statusCode).toBe(201);
    expect(horaireModelMock.planifierAffectationManuelle).toHaveBeenCalledWith({
      idCours: 1,
      idProfesseur: 2,
      idSalle: 3,
      idGroupeEtudiants: 4,
      date: "2026-03-23",
      heureDebut: "08:00",
      heureFin: "10:00",
      portee: {
        mode: "custom_range",
        date_debut: "2026-03-23",
        date_fin: "2026-04-20",
      },
    });
  });

  test("POST /api/horaires retourne le statusCode du modele en cas d'erreur metier", async () => {
    horaireModelMock.planifierAffectationManuelle.mockRejectedValue({
      statusCode: 409,
      message: "Conflit detecte.",
    });

    const response = await request(app)
      .post("/api/horaires")
      .send({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        id_groupes_etudiants: 4,
        date: "2026-03-23",
        heure_debut: "08:00",
        heure_fin: "10:00",
      });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ message: "Conflit detecte." });
  });

  test("POST /api/horaires retourne 409 si le groupe a deja un cours sur ce creneau", async () => {
    horaireModelMock.planifierAffectationManuelle.mockRejectedValue({
      statusCode: 409,
      message: "Groupe deja occupe sur ce creneau.",
    });

    const response = await request(app)
      .post("/api/horaires")
      .send({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        id_groupes_etudiants: 4,
        date: "2026-03-23",
        heure_debut: "08:00",
        heure_fin: "10:00",
      });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      message: "Groupe deja occupe sur ce creneau.",
    });
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
    expect(response.body).toEqual({
      message:
        "Champs obligatoires manquants: id_professeur, id_salle, id_groupes_etudiants, date, heure_debut, heure_fin.",
    });
    expect(horaireModelMock.replanifierAffectationManuelle).not.toHaveBeenCalled();
  });

  test("PUT /api/horaires/:id refuse un format d'heure invalide", async () => {
    const response = await request(app)
      .put("/api/horaires/4")
      .send(payloadHoraire({ heure_fin: "25:00" }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Format d'heure invalide. Utilisez HH:MM ou HH:MM:SS.",
    });
    expect(horaireModelMock.replanifierAffectationManuelle).not.toHaveBeenCalled();
  });

  test("PUT /api/horaires/:id refuse une heure de fin avant l'heure de debut", async () => {
    const response = await request(app)
      .put("/api/horaires/4")
      .send(payloadHoraire({ heure_debut: "13:00", heure_fin: "11:00" }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "L'heure de fin doit etre apres l'heure de debut.",
    });
    expect(horaireModelMock.replanifierAffectationManuelle).not.toHaveBeenCalled();
  });

  test("PUT /api/horaires/:id refuse une duree zero", async () => {
    const response = await request(app)
      .put("/api/horaires/4")
      .send(payloadHoraire({ heure_debut: "11:00", heure_fin: "11:00" }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "La duree du creneau doit etre superieure a 0.",
    });
    expect(horaireModelMock.replanifierAffectationManuelle).not.toHaveBeenCalled();
  });

  test("PUT /api/horaires/:id retourne 200 si mise a jour valide", async () => {
    horaireModelMock.replanifierAffectationManuelle.mockResolvedValue({
      id_affectation_cours: 4,
      id_salle: 8,
    });

    const response = await request(app).put("/api/horaires/4").send({
      id_cours: 1,
      id_professeur: 2,
      id_salle: 8,
      id_groupes_etudiants: 6,
      date: "2026-03-24",
      heure_debut: "09:00",
      heure_fin: "11:00",
    });

    expect(response.statusCode).toBe(200);
    expect(horaireModelMock.replanifierAffectationManuelle).toHaveBeenCalledWith(4, {
      idCours: 1,
      idProfesseur: 2,
      idSalle: 8,
      idGroupeEtudiants: 6,
      date: "2026-03-24",
      heureDebut: "09:00",
      heureFin: "11:00",
      portee: {
        mode: "single",
        date_debut: null,
        date_fin: null,
      },
    });
  });

  test("PUT /api/horaires/:id retourne le statusCode du modele si erreur metier", async () => {
    horaireModelMock.replanifierAffectationManuelle.mockRejectedValue({
      statusCode: 404,
      message: "Affectation introuvable.",
    });

    const response = await request(app).put("/api/horaires/4").send({
      id_cours: 1,
      id_professeur: 2,
      id_salle: 8,
      id_groupes_etudiants: 6,
      date: "2026-03-24",
      heure_debut: "09:00",
      heure_fin: "11:00",
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "Affectation introuvable." });
  });

  test("GET /api/horaires/etudiants/:id/cours-echoues retourne les reprises planifiables", async () => {
    horaireModelMock.recupererCoursEchouesEtudiantPlanifiables.mockResolvedValue([
      { id: 10, code_cours: "INF201" },
    ]);

    const response = await request(app).get("/api/horaires/etudiants/25/cours-echoues");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ id: 10, code_cours: "INF201" }]);
    expect(
      horaireModelMock.recupererCoursEchouesEtudiantPlanifiables
    ).toHaveBeenCalledWith(25);
  });

  test("GET /api/horaires/etudiants/:id/cours-echoues/:idCoursEchoue/groupes-compatibles retourne les groupes filtres", async () => {
    horaireModelMock.recupererGroupesCompatiblesPourCoursEchoueEtudiant.mockResolvedValue([
      { id_groupes_etudiants: 4, nom_groupe: "INF-A1" },
    ]);

    const response = await request(app).get(
      "/api/horaires/etudiants/25/cours-echoues/10/groupes-compatibles"
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ id_groupes_etudiants: 4, nom_groupe: "INF-A1" }]);
    expect(
      horaireModelMock.recupererGroupesCompatiblesPourCoursEchoueEtudiant
    ).toHaveBeenCalledWith(25, 10);
  });

  test("POST /api/horaires/reprises rattache l'etudiant a un groupe d'accueil", async () => {
    horaireModelMock.planifierRepriseEtudiant.mockResolvedValue({
      message: "Cours echoue planifie pour l'etudiant.",
    });

    const response = await request(app)
      .post("/api/horaires/reprises")
      .send({
        id_etudiant: 25,
        id_cours_echoue: 10,
        id_groupes_etudiants: 4,
      });

    expect(response.statusCode).toBe(201);
    expect(horaireModelMock.planifierRepriseEtudiant).toHaveBeenCalledWith({
      idEtudiant: 25,
      idCoursEchoue: 10,
      idGroupeEtudiants: 4,
    });
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
      date_debut: "2026-03-23",
    });

    expect(response.statusCode).toBe(201);
    expect(horaireModelMock.genererHoraireAutomatiquement).toHaveBeenCalledWith({
      programme: "Informatique",
      etape: "1",
      session: "Automne",
      dateDebut: "2026-03-23",
    });
  });

  test("POST /api/horaires/generer retourne 400 si la cohorte est incomplete", async () => {
    const response = await request(app).post("/api/horaires/generer").send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message:
        "Le programme, l'etape et la session sont obligatoires pour generer l'horaire.",
    });
  });

  test("POST /api/horaires/generer retourne 400 si la date de debut est invalide", async () => {
    const response = await request(app).post("/api/horaires/generer").send({
      programme: "Informatique",
      etape: "1",
      session: "Automne",
      date_debut: "23-03-2026",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "La date de debut est invalide." });
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
    expect(horaireModelMock.deleteAllAffectations).toHaveBeenCalledWith({
      deleteStudents: false,
      sessionActive: false,
    });
  });

  test("DELETE /api/horaires accepte session_active=1", async () => {
    horaireModelMock.deleteAllAffectations.mockResolvedValue(undefined);

    const response = await request(app).delete("/api/horaires?session_active=1");

    expect(response.statusCode).toBe(200);
    expect(horaireModelMock.deleteAllAffectations).toHaveBeenCalledWith({
      deleteStudents: false,
      sessionActive: true,
    });
  });

  test("DELETE /api/horaires accepte delete_students=1 sur la session active", async () => {
    horaireModelMock.deleteAllAffectations.mockResolvedValue(undefined);

    const response = await request(app).delete(
      "/api/horaires?session_active=1&delete_students=1"
    );

    expect(response.statusCode).toBe(200);
    expect(horaireModelMock.deleteAllAffectations).toHaveBeenCalledWith({
      deleteStudents: true,
      sessionActive: true,
    });
  });

  test("DELETE /api/horaires retourne 500 si le reset echoue", async () => {
    horaireModelMock.deleteAllAffectations.mockRejectedValue(new Error("db"));

    const response = await request(app).delete("/api/horaires");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });
});
