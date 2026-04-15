/**
 * Tests de la route de replanification intelligente du scheduler.
 *
 * Ces tests verifient que :
 * - l'endpoint relaye bien le payload vers le service ;
 * - la reponse de succes retourne simulation et resultat ;
 * - les blocages de simulation restent explicables cote API.
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const modifyAssignmentMock = jest.fn();

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
      modifyAssignment: modifyAssignmentMock,
    },
  })
);

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

describe("scheduler modify-assignment route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/scheduler/modify-assignment retourne le resultat du service", async () => {
    modifyAssignmentMock.mockResolvedValue({
      message: "Affectation modifiee avec succes.",
      simulationObligatoireExecutee: true,
      simulation: {
        faisable: true,
      },
      result: {
        portee: "THIS_OCCURRENCE",
      },
    });

    const response = await request(createApp())
      .post("/api/scheduler/modify-assignment")
      .send({
        idSeance: 201,
        modifications: {
          id_professeur: 20,
          id_salle: 3,
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
        },
        portee: "THIS_OCCURRENCE",
        modeOptimisation: "equilibre",
      });

    expect(response.status).toBe(200);
    expect(response.body.simulationObligatoireExecutee).toBe(true);
    expect(response.body.result.portee).toBe("THIS_OCCURRENCE");
    expect(modifyAssignmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idSeance: 201,
        modeOptimisation: "equilibre",
        idUtilisateur: null,
      }),
      expect.any(Object)
    );
  });

  test("POST /api/scheduler/modify-assignment relaie un blocage de simulation", async () => {
    modifyAssignmentMock.mockRejectedValue({
      statusCode: 409,
      code: "MODIFICATION_BLOCKED_BY_SIMULATION",
      message: "La modification demandee est infaisable dans l'etat actuel des horaires.",
      details: {
        simulation: {
          faisable: false,
        },
      },
    });

    const response = await request(createApp())
      .post("/api/scheduler/modify-assignment")
      .send({
        idSeance: 201,
        modifications: {
          id_salle: 3,
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
        },
        portee: "THIS_OCCURRENCE",
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("MODIFICATION_BLOCKED_BY_SIMULATION");
    expect(response.body.simulation).toEqual({
      faisable: false,
    });
  });
});
