import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const poolQueryMock = jest.fn();
const getConnectionMock = jest.fn();
const recupererGroupesMock = jest.fn();
const recupererGroupeParIdMock = jest.fn();
const recupererPlanningCompletGroupeMock = jest.fn();
const genererGroupeMock = jest.fn();
const analyserCompatibiliteChangementGroupePrincipalEtudiantMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: poolQueryMock,
    getConnection: getConnectionMock,
  },
}));

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (request, _response, next) => {
    request.user = { id: 42, roles: ["ADMIN_RESPONSABLE"] };
    next();
  },
  userAdminOrResponsable: (_request, _response, next) => next(),
}));

await jest.unstable_mockModule("../src/model/groupes.model.js", () => ({
  recupererGroupes: recupererGroupesMock,
  recupererGroupeParId: recupererGroupeParIdMock,
  recupererPlanningCompletGroupe: recupererPlanningCompletGroupeMock,
}));

await jest.unstable_mockModule(
  "../src/services/academic-scheduler-schema.js",
  () => ({
    assurerSchemaSchedulerAcademique: jest.fn(),
  })
);

await jest.unstable_mockModule("../src/services/etudiants/student-course-exchange.service.js", () => ({
  analyserCompatibiliteChangementGroupePrincipalEtudiant:
    analyserCompatibiliteChangementGroupePrincipalEtudiantMock,
}));

await jest.unstable_mockModule("../src/services/scheduler/SchedulerEngine.js", () => ({
  SchedulerEngine: {
    genererGroupe: genererGroupeMock,
  },
}));

const { default: groupesRoutes } = await import("../routes/groupes.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  groupesRoutes(app);
  return app;
}

function createConnectionMock() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
    rollback: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

describe("groupes routes extra", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    analyserCompatibiliteChangementGroupePrincipalEtudiantMock.mockResolvedValue({
      validation_requise: false,
      changement_autorise: true,
      conflits: [],
    });
  });

  test("GET /api/groupes enrichit a_horaire quand details=1", async () => {
    recupererGroupesMock.mockResolvedValueOnce([
      { id_groupes_etudiants: 1, nb_seances: 0 },
      { id_groupes_etudiants: 2, nb_seances: 3 },
    ]);

    const response = await request(createApp()).get(
      "/api/groupes?details=1&session_active=1&effectif_min=1&planning_only=1&special_groups=1"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id_groupes_etudiants: 1, nb_seances: 0, a_horaire: false },
      { id_groupes_etudiants: 2, nb_seances: 3, a_horaire: true },
    ]);
    expect(recupererGroupesMock).toHaveBeenCalledWith(true, {
      sessionActive: true,
      seulementAvecEffectif: true,
      seulementAvecPlanning: true,
      inclureGroupesSpeciaux: true,
    });
  });

  test("GET /api/groupes/:id retourne 404 si groupe absent", async () => {
    recupererGroupeParIdMock.mockResolvedValueOnce(null);

    const response = await request(createApp()).get("/api/groupes/99");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Groupe introuvable." });
  });

  test("GET /api/groupes/:id retourne 500 si la lecture des metriques echoue", async () => {
    recupererGroupeParIdMock.mockResolvedValueOnce({
      id_groupes_etudiants: 5,
      nom_groupe: "G-INF-01",
    });
    poolQueryMock.mockRejectedValueOnce(new Error("db error"));

    const response = await request(createApp()).get("/api/groupes/5");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("POST /api/groupes/generer-cible retourne 400 sans critere", async () => {
    const response = await request(createApp())
      .post("/api/groupes/generer-cible")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Au moins un critère est requis");
  });

  test("POST /api/groupes/generer-cible retourne 404 si aucun groupe ne correspond", async () => {
    poolQueryMock.mockResolvedValueOnce([[]]);

    const response = await request(createApp())
      .post("/api/groupes/generer-cible")
      .send({ programme: "INF" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Aucun groupe trouvé pour les critères spécifiés.",
    });
  });

  test("POST /api/groupes/generer-cible ignore les groupes vides et remonte les erreurs moteur", async () => {
    poolQueryMock.mockResolvedValueOnce([
      [
        {
          id_groupes_etudiants: 1,
          nom_groupe: "VIDE",
          effectif: 0,
        },
        {
          id_groupes_etudiants: 2,
          nom_groupe: "OK",
          effectif: 10,
        },
        {
          id_groupes_etudiants: 3,
          nom_groupe: "KO",
          effectif: 12,
        },
      ],
    ]);
    genererGroupeMock
      .mockResolvedValueOnce({
        nb_cours_planifies: 4,
        nb_cours_non_planifies: 1,
        score_qualite: 75,
        details: {},
      })
      .mockRejectedValueOnce(new Error("moteur indisponible"));

    const response = await request(createApp())
      .post("/api/groupes/generer-cible")
      .send({ programme: "INF", optimization_mode: "scoring_v1" });

    expect(response.status).toBe(201);
    expect(response.body.nb_groupes_traites).toBe(1);
    expect(response.body.nb_groupes_erreur).toBe(2);
    expect(response.body.total_planifies).toBe(4);
    expect(response.body.erreurs).toEqual(
      expect.arrayContaining([
        { nom_groupe: "VIDE", raison: "Groupe vide, ignoré." },
        { nom_groupe: "KO", raison: "moteur indisponible" },
      ])
    );
  });

  test("POST /api/groupes/:id/etudiants assigne les etudiants si la capacite le permet", async () => {
    poolQueryMock
      .mockResolvedValueOnce([[{ effectif: 10 }]])
      .mockResolvedValueOnce([{ affectedRows: 2 }]);

    const response = await request(createApp())
      .post("/api/groupes/7/etudiants")
      .send({ etudiantsIds: [1, 2] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Étudiants assignés avec succès.",
      nb_ajoutes: 2,
    });
    expect(poolQueryMock).toHaveBeenNthCalledWith(
      2,
      "UPDATE etudiants SET id_groupes_etudiants = ? WHERE id_etudiant IN (?)",
      [7, [1, 2]]
    );
  });

  test("POST /api/groupes/:id/etudiants retourne 500 si l'assignation echoue", async () => {
    poolQueryMock
      .mockResolvedValueOnce([[{ effectif: 10 }]])
      .mockRejectedValueOnce(new Error("maj impossible"));

    const response = await request(createApp())
      .post("/api/groupes/7/etudiants")
      .send({ etudiantsIds: [1] });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: "Erreur serveur lors de l'assignation.",
    });
  });

  test("POST /api/groupes/:id/etudiants/creer-ajouter retourne 404 si le groupe n'existe pas", async () => {
    const conn = createConnectionMock();
    conn.query.mockResolvedValueOnce([[]]);
    getConnectionMock.mockResolvedValueOnce(conn);

    const response = await request(createApp())
      .post("/api/groupes/15/etudiants/creer-ajouter")
      .send({ nom: "Diallo", prenom: "Aya", matricule: "E001" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Groupe introuvable." });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  test("POST /api/groupes/:id/etudiants/creer-ajouter refuse un programme incompatible", async () => {
    const conn = createConnectionMock();
    conn.query
      .mockResolvedValueOnce([[
        {
          id_groupes_etudiants: 5,
          nom_groupe: "G-INF-01",
          programme: "INF",
          etape: 1,
          id_session: 9,
          taille_max: 30,
          effectif: 12,
        },
      ]]);
    getConnectionMock.mockResolvedValueOnce(conn);

    const response = await request(createApp())
      .post("/api/groupes/5/etudiants/creer-ajouter")
      .send({
        nom: "Diallo",
        prenom: "Aya",
        matricule: "E001",
        programme: "COM",
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toContain("incompatible avec le groupe");
    expect(conn.rollback).toHaveBeenCalled();
  });

  test("POST /api/groupes/:id/etudiants/creer-ajouter signale un matricule deja present dans un autre groupe", async () => {
    const conn = createConnectionMock();
    conn.query
      .mockResolvedValueOnce([[
        {
          id_groupes_etudiants: 5,
          nom_groupe: "G-INF-01",
          programme: "INF",
          etape: 1,
          id_session: 9,
          taille_max: 30,
          effectif: 12,
        },
      ]])
      .mockResolvedValueOnce([[{ id_session: 9, nom: "Automne 2026", date_debut: "2026-08-25" }]])
      .mockResolvedValueOnce([[{ id_etudiant: 33, id_groupes_etudiants: 7 }]]);
    getConnectionMock.mockResolvedValueOnce(conn);

    const response = await request(createApp())
      .post("/api/groupes/5/etudiants/creer-ajouter")
      .send({
        nom: "Diallo",
        prenom: "Aya",
        matricule: "E001",
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      existant: true,
      id_etudiant: 33,
      id_groupe_actuel: 7,
    });
  });

  test("POST /api/groupes/:id/etudiants/creer-ajouter cree l'etudiant et journalise les cours echoues invalides", async () => {
    const conn = createConnectionMock();
    conn.query
      .mockResolvedValueOnce([[
        {
          id_groupes_etudiants: 5,
          nom_groupe: "G-INF-01",
          programme: "INF",
          etape: 1,
          id_session: 9,
          taille_max: 30,
          effectif: 12,
        },
      ]])
      .mockResolvedValueOnce([[{ id_session: 9, nom: "Automne 2026", date_debut: "2026-08-25" }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 71 }])
      .mockResolvedValueOnce([[{ id_cours: 12 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]]);
    getConnectionMock.mockResolvedValueOnce(conn);

    const response = await request(createApp())
      .post("/api/groupes/5/etudiants/creer-ajouter")
      .send({
        nom: "Diallo",
        prenom: "Aya",
        matricule: "E001",
        email: "aya@ecole.ca",
        cours_echoues: [{ code: "INF101", note_echec: 45 }, { code: "XYZ999" }],
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id_etudiant: 71,
      groupe: "G-INF-01",
      matricule: "E001",
      existant: false,
      cours_echoues_inseres: ["INF101"],
    });
    expect(response.body.erreurs_cours_echoues).toEqual([
      { code: "XYZ999", raison: "Cours introuvable dans le catalogue." },
    ]);
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  test("PUT /api/groupes/:id/etudiants/:idEtudiant/deplacer refuse les programmes differents", async () => {
    poolQueryMock
      .mockResolvedValueOnce([[{ id_groupes_etudiants: 3, programme: "INF", etape: "1" }]])
      .mockResolvedValueOnce([[
        {
          id_groupes_etudiants: 5,
          nom_groupe: "G-COM-01",
          id_session: 8,
          programme: "COM",
          etape: "1",
          effectif: 18,
        },
      ]]);

    const response = await request(createApp())
      .put("/api/groupes/3/etudiants/44/deplacer")
      .send({ id_groupe_cible: 5 });

    expect(response.status).toBe(422);
    expect(response.body.message).toContain("programmes différents");
  });

  test("PUT /api/groupes/:id/etudiants/:idEtudiant/deplacer relaie les erreurs metier structurees", async () => {
    poolQueryMock.mockRejectedValueOnce(
      Object.assign(new Error("operation refuser"), {
        statusCode: 409,
        code: "MOVE_BLOCKED",
        details: [{ raison: "contrainte" }],
      })
    );

    const response = await request(createApp())
      .put("/api/groupes/3/etudiants/44/deplacer")
      .send({ id_groupe_cible: 5 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "operation refuser",
      code: "MOVE_BLOCKED",
      details: [{ raison: "contrainte" }],
    });
  });

  test("DELETE /api/groupes/:id retourne 500 si la suppression echoue", async () => {
    poolQueryMock.mockRejectedValueOnce(new Error("suppression impossible"));

    const response = await request(createApp()).delete("/api/groupes/12");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: "Erreur serveur lors de la suppression.",
    });
  });

  test("POST /api/groupes/:id/generer-horaire retourne 404 si le groupe n'existe pas", async () => {
    poolQueryMock.mockResolvedValueOnce([[]]);

    const response = await request(createApp())
      .post("/api/groupes/12/generer-horaire")
      .send({ optimization_mode: "professeur" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Groupe introuvable." });
  });
});
