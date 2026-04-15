/**
 * Tests des routes de generation des groupes.
 *
 * Ces tests verrouillent uniquement la propagation du mode d'optimisation
 * vers SchedulerEngine sur les flux de generation reellement relies au moteur :
 * - generation d'un groupe ;
 * - generation ciblee par programme / etape.
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const poolQueryMock = jest.fn();
const genererGroupeMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: poolQueryMock,
  },
}));

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (request, _response, next) => {
    request.user = { id: 42 };
    next();
  },
  userAdminOrResponsable: (_request, _response, next) => next(),
}));

await jest.unstable_mockModule("../src/model/groupes.model.js", () => ({
  recupererGroupes: jest.fn(),
  recupererGroupeParId: jest.fn(),
  recupererPlanningCompletGroupe: jest.fn(),
}));

await jest.unstable_mockModule(
  "../src/services/academic-scheduler-schema.js",
  () => ({
    assurerSchemaSchedulerAcademique: jest.fn(),
  })
);

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

describe("groupes generation routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("PUT /api/groupes/:id/etudiants/:idEtudiant/deplacer retourne la synchronisation metier", async () => {
    poolQueryMock
      .mockResolvedValueOnce([
        [
          {
            id_groupes_etudiants: 3,
            programme: "INF",
            etape: "1",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id_groupes_etudiants: 5,
            nom_groupe: "G-INF-E1-2",
            programme: "INF",
            etape: "1",
            effectif: 18,
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id_etudiant: 44,
            nom: "Diallo",
            prenom: "Aya",
          },
        ],
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(createApp())
      .put("/api/groupes/3/etudiants/44/deplacer")
      .send({
        id_groupe_cible: 5,
      });

    expect(response.status).toBe(200);
    expect(response.body.id_etudiant).toBe(44);
    expect(response.body.id_groupe_source).toBe(3);
    expect(response.body.id_groupe_cible).toBe(5);
    expect(response.body.etudiants_impactes).toEqual([44]);
    expect(response.body.groupes_impactes).toEqual([3, 5]);
    expect(response.body.synchronisation).toEqual({
      type: "deplacement_etudiant_groupe",
      etudiants_impactes: [44],
      groupes_impactes: [3, 5],
    });
  });

  test("POST /api/groupes/generer-cible relaie le mode d'optimisation", async () => {
    poolQueryMock.mockResolvedValueOnce([
      [
        {
          id_groupes_etudiants: 7,
          nom_groupe: "G1",
          programme: "INF",
          etape: "1",
          effectif: 18,
        },
      ],
    ]);
    genererGroupeMock.mockResolvedValue({
      nb_cours_planifies: 9,
      nb_cours_non_planifies: 1,
      score_qualite: 88,
      details: {
        modeOptimisationUtilise: "etudiant",
      },
    });

    const response = await request(createApp())
      .post("/api/groupes/generer-cible")
      .send({
        programme: "INF",
        mode_optimisation: "etudiant",
      });

    expect(response.status).toBe(201);
    expect(response.body.mode_optimisation_utilise).toBe("etudiant");
    expect(response.body.resultats[0].mode_optimisation_utilise).toBe("etudiant");
    expect(genererGroupeMock).toHaveBeenCalledWith({
      idGroupe: 7,
      idUtilisateur: 42,
      optimizationMode: "etudiant",
    });
  });

  test("POST /api/groupes/:id/generer-horaire relaie l'alias optimization_mode", async () => {
    poolQueryMock.mockResolvedValueOnce([
      [
        {
          id_groupes_etudiants: 12,
          nom_groupe: "G12",
          programme: "INF",
          etape: "2",
          effectif: 22,
        },
      ],
    ]);
    genererGroupeMock.mockResolvedValue({
      nb_cours_planifies: 11,
      nb_cours_non_planifies: 0,
      score_qualite: 93,
      details: {
        modeOptimisationUtilise: "professeur",
      },
    });

    const response = await request(createApp())
      .post("/api/groupes/12/generer-horaire")
      .send({
        optimization_mode: "professeur",
      });

    expect(response.status).toBe(201);
    expect(response.body.mode_optimisation_utilise).toBe("professeur");
    expect(genererGroupeMock).toHaveBeenCalledWith({
      idGroupe: 12,
      idUtilisateur: 42,
      optimizationMode: "professeur",
    });
  });
});
