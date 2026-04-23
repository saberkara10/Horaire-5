import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const recupererGroupesMock = jest.fn();
const recupererGroupeParIdMock = jest.fn();
const recupererPlanningCompletGroupeMock = jest.fn();
const poolQueryMock = jest.fn();
const assurerSchemaSchedulerAcademiqueMock = jest.fn();

await jest.unstable_mockModule("../src/model/groupes.model.js", () => ({
  recupererGroupes: recupererGroupesMock,
  recupererGroupeParId: recupererGroupeParIdMock,
  recupererPlanningCompletGroupe: recupererPlanningCompletGroupeMock,
}));

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: poolQueryMock,
  },
}));

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (request, _response, next) => {
    request.user = { id: 18 };
    next();
  },
  userAdminOrResponsable: (_request, _response, next) => next(),
}));

await jest.unstable_mockModule(
  "../src/services/academic-scheduler-schema.js",
  () => ({
    assurerSchemaSchedulerAcademique: assurerSchemaSchedulerAcademiqueMock,
  })
);

const { default: groupesRoutes } = await import("../routes/groupes.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  groupesRoutes(app);
  return app;
}

describe("groupes admin routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/groupes/manuel valide les champs requis", async () => {
    const response = await request(createApp()).post("/api/groupes/manuel").send({
      programme: "INF",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Le nom du groupe est requis." });
  });

  test("POST /api/groupes/manuel utilise la session active si aucune session n'est fournie", async () => {
    poolQueryMock
      .mockResolvedValueOnce([[{ id_session: 9, nom: "Automne 2026", date_debut: "2026-08-25" }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 44 }]);

    const response = await request(createApp()).post("/api/groupes/manuel").send({
      nom_groupe: "G-INF-01",
      programme: "INF",
      etape: 1,
      taille_max: 35,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      message: "Groupe créé avec succès.",
      id_groupes_etudiants: 44,
    });
    expect(assurerSchemaSchedulerAcademiqueMock).toHaveBeenCalled();
    expect(poolQueryMock).toHaveBeenNthCalledWith(
      3,
      `INSERT INTO groupes_etudiants (nom_groupe, taille_max, est_groupe_special, programme, etape, id_session)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ["G-INF-01", 30, 0, "INF", 1, 9]
    );
  });

  test("POST /api/groupes/manuel retourne 409 si un doublon existe deja", async () => {
    poolQueryMock
      .mockResolvedValueOnce([[{ id_session: 2, nom: "Hiver 2027", date_debut: "2027-01-10" }]])
      .mockResolvedValueOnce([[{ id_groupes_etudiants: 7 }]]);

    const response = await request(createApp()).post("/api/groupes/manuel").send({
      nom_groupe: "G-INF-01",
      programme: "INF",
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("existe déjà");
  });

  test("POST /api/groupes/nettoyer refuse un nettoyage sans criteres", async () => {
    const response = await request(createApp()).post("/api/groupes/nettoyer").send({
      inclure_vides: false,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Aucun critère de nettoyage sélectionné." });
  });

  test("POST /api/groupes/nettoyer retourne un apercu en mode preview", async () => {
    poolQueryMock.mockResolvedValueOnce([
      [
        { id_groupes_etudiants: 1, nom_groupe: "G1", effectif: 0, nb_affectations: 0 },
        { id_groupes_etudiants: 2, nom_groupe: "G2", effectif: 0, nb_affectations: 1 },
      ],
    ]);

    const response = await request(createApp()).post("/api/groupes/nettoyer").send({
      mode: "preview",
    });

    expect(response.status).toBe(200);
    expect(response.body.mode).toBe("preview");
    expect(response.body.candidats).toHaveLength(2);
  });

  test("POST /api/groupes/nettoyer supprime les groupes eligibles et conserve les proteges", async () => {
    poolQueryMock
      .mockResolvedValueOnce([
        [
          { id_groupes_etudiants: 1, nom_groupe: "G1", nb_affectations: 0 },
          { id_groupes_etudiants: 2, nom_groupe: "G2", nb_affectations: 3 },
          { id_groupes_etudiants: 3, nom_groupe: "G3", nb_affectations: 0 },
        ],
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockRejectedValueOnce(new Error("suppression impossible"));

    const response = await request(createApp()).post("/api/groupes/nettoyer").send({
      mode: "suppression",
    });

    expect(response.status).toBe(200);
    expect(response.body.nb_supprimes).toBe(1);
    expect(response.body.erreurs).toEqual([
      expect.objectContaining({ nom_groupe: "G2" }),
      expect.objectContaining({ nom_groupe: "G3", raison: "suppression impossible" }),
    ]);
  });

  test("GET /api/groupes/:id retourne les metriques calculees du groupe", async () => {
    recupererGroupeParIdMock.mockResolvedValue({
      id_groupes_etudiants: 5,
      nom_groupe: "G-INF-01",
      programme: "INF",
    });
    poolQueryMock
      .mockResolvedValueOnce([[{ effectif: 28 }]])
      .mockResolvedValueOnce([[{ nb_seances: 4 }]]);

    const response = await request(createApp()).get("/api/groupes/5");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id_groupes_etudiants: 5,
      effectif_actuel: 28,
      taille_max: 30,
      a_horaire: true,
      nb_seances_planifiees: 4,
      est_complet: false,
    });
  });

  test("GET /api/groupes/:id/etudiants retourne les membres du groupe", async () => {
    poolQueryMock.mockResolvedValueOnce([
      [{ id_etudiant: 10, nom: "Diallo", prenom: "Aya", nb_cours_echoues: 1 }],
    ]);

    const response = await request(createApp()).get("/api/groupes/5/etudiants");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id_etudiant: 10, nom: "Diallo", prenom: "Aya", nb_cours_echoues: 1 },
    ]);
  });

  test("POST /api/groupes/:id/etudiants valide la liste des etudiants", async () => {
    const response = await request(createApp()).post("/api/groupes/5/etudiants").send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("liste d'ID d'étudiants");
  });

  test("POST /api/groupes/:id/etudiants bloque un depassement de capacite", async () => {
    poolQueryMock.mockResolvedValueOnce([[{ effectif: 29 }]]);

    const response = await request(createApp()).post("/api/groupes/5/etudiants").send({
      etudiantsIds: [1, 2],
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      effectif_actuel: 29,
      places_disponibles: 1,
    });
  });

  test("DELETE /api/groupes/:id/etudiants/:idEtudiant retire un etudiant du groupe", async () => {
    poolQueryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(createApp()).delete("/api/groupes/5/etudiants/8");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Étudiant retiré du groupe." });
  });

  test("DELETE /api/groupes/:id supprime le groupe et ses rattachements", async () => {
    poolQueryMock
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(createApp()).delete("/api/groupes/12");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Groupe supprimé avec succès." });
    expect(poolQueryMock).toHaveBeenNthCalledWith(
      1,
      "UPDATE etudiants SET id_groupes_etudiants = NULL WHERE id_groupes_etudiants = ?",
      [12]
    );
  });
});
