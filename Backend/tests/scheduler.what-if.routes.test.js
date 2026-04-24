/**
 * Tests de la route read-only what-if du scheduler.
 *
 * Ces tests verifient que :
 * - l'endpoint expose bien une previsualisation sans mutation ;
 * - le payload est relaye proprement au simulateur ;
 * - les erreurs de validation restent explicables cote API.
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, test, jest } from "@jest/globals";

const simulateOfficialScenarioMock = jest.fn();
const previewAssignmentModificationMock = jest.fn();
const schedulerGenererMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: jest.fn(),
  },
}));

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (_request, _response, next) => next(),
  userAdmin: (_request, _response, next) => next(),
  userAdminOrResponsable: (_request, _response, next) => next(),
}));

await jest.unstable_mockModule(
  "../src/services/scheduler/planning/ScheduleModificationService.js",
  () => ({
    ScheduleModificationService: {
      previewAssignmentModification: previewAssignmentModificationMock,
      modifyAssignment: jest.fn(),
    },
  })
);

await jest.unstable_mockModule(
  "../src/services/scheduler/simulation/ScenarioSimulator.js",
  () => ({
    ScenarioSimulator: {
      simulateOfficialScenario: simulateOfficialScenarioMock,
    },
  })
);

await jest.unstable_mockModule("../src/services/scheduler/SchedulerEngine.js", () => ({
  SchedulerEngine: {
    generer: schedulerGenererMock,
  },
}));

const { default: schedulerRoutes } = await import("../routes/scheduler.routes.js");

/**
 * Cree une application Express de test.
 *
 * @returns {import("express").Express} Application configuree.
 */
function createApp() {
  const app = express();
  app.use(express.json());
  schedulerRoutes(app);
  return app;
}

describe("scheduler what-if route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/scheduler/generer relaie le mode d'optimisation au moteur", async () => {
    schedulerGenererMock.mockResolvedValue({
      nb_cours_planifies: 12,
      score_qualite: 84,
      details: {
        modeOptimisationUtilise: "professeur",
      },
    });

    const response = await request(createApp())
      .post("/api/scheduler/generer")
      .send({
        id_session: 4,
        mode_optimisation: "professeur",
        sa_params: { maxIterParTemp: 40 },
      });

    expect(response.status).toBe(201);
    expect(response.body.mode_optimisation_utilise).toBe("professeur");
    expect(schedulerGenererMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idSession: 4,
        idUtilisateur: null,
        inclureWeekend: false,
        optimizationMode: "professeur",
        saParams: { maxIterParTemp: 40 },
        onProgress: null,
        performanceTracker: expect.any(Object),
      })
    );
  });

  test("GET /api/scheduler/generer-stream relaie le mode d'optimisation au moteur", async () => {
    schedulerGenererMock.mockResolvedValue({
      nb_cours_planifies: 18,
      score_qualite: 90,
      details: {
        modeOptimisationUtilise: "equilibre",
      },
    });

    const response = await request(createApp()).get(
      "/api/scheduler/generer-stream?id_session=9&mode_optimisation=equilibre&sa_params=%7B%22maxIterParTemp%22%3A60%7D"
    );

    expect(response.status).toBe(200);
    expect(schedulerGenererMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idSession: 9,
        idUtilisateur: null,
        inclureWeekend: false,
        optimizationMode: "equilibre",
        saParams: { maxIterParTemp: 60 },
        onProgress: expect.any(Function),
        performanceTracker: expect.any(Object),
      })
    );
    expect(response.text).toContain("\"type\":\"done\"");
  });

  test("POST /api/scheduler/what-if retourne le rapport du simulateur", async () => {
    simulateOfficialScenarioMock.mockResolvedValue({
      readOnly: true,
      faisable: true,
      scoreAvant: { scoreGlobal: 70 },
      scoreApres: { scoreGlobal: 78 },
    });

    const response = await request(createApp())
      .post("/api/scheduler/what-if")
      .send({
        id_session: 4,
        mode_optimisation: "etudiant",
        scenario: {
          type: "DEPLACER_SEANCE",
          id_affectation_cours: 8,
          date: "2026-09-07",
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.faisable).toBe(true);
    expect(simulateOfficialScenarioMock).toHaveBeenCalledWith(
      {
        idSession: 4,
        optimizationMode: "etudiant",
        scenario: {
          type: "DEPLACER_SEANCE",
          id_affectation_cours: 8,
          date: "2026-09-07",
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
        },
      },
      expect.any(Object)
    );
  });

  test("POST /api/scheduler/what-if valide la presence du scenario", async () => {
    const response = await request(createApp())
      .post("/api/scheduler/what-if")
      .send({
        mode_optimisation: "equilibre",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("SCENARIO_REQUIRED");
  });

  test("POST /api/scheduler/what-if relaie les erreurs metier du simulateur", async () => {
    simulateOfficialScenarioMock.mockRejectedValue({
      statusCode: 404,
      code: "ASSIGNMENT_NOT_FOUND",
      message: "La seance cible est introuvable.",
    });

    const response = await request(createApp())
      .post("/api/scheduler/what-if")
      .send({
        mode_optimisation: "legacy",
        scenario: {
          type: "CHANGER_SALLE",
          id_affectation_cours: 99,
          id_salle: 2,
        },
      });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("ASSIGNMENT_NOT_FOUND");
  });

  test("POST /api/scheduler/what-if previsualise une modification intelligente multi-occurrences", async () => {
    previewAssignmentModificationMock.mockResolvedValue({
      readOnly: true,
      simulationObligatoireExecutee: true,
      faisable: true,
      warnings: [],
      validation: {
        scope: "THIS_AND_FOLLOWING",
      },
    });

    const response = await request(createApp())
      .post("/api/scheduler/what-if")
      .send({
        id_session: 4,
        mode_optimisation: "equilibre",
        scenario: {
          type: "MODIFIER_AFFECTATION",
          id_affectation_cours: 18,
          modifications: {
            id_professeur: 20,
            id_salle: 3,
            date: "2026-09-16",
            heure_debut: "11:00:00",
            heure_fin: "14:00:00",
          },
          portee: "THIS_AND_FOLLOWING",
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.simulationObligatoireExecutee).toBe(true);
    expect(response.body.validation.scope).toBe("THIS_AND_FOLLOWING");
    expect(previewAssignmentModificationMock).toHaveBeenCalledWith(
      {
        idSeance: 18,
        modifications: {
          id_professeur: 20,
          id_salle: 3,
          date: "2026-09-16",
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
        },
        portee: "THIS_AND_FOLLOWING",
        modeOptimisation: "equilibre",
      },
      expect.any(Object)
    );
  });
});
