/**
 * TESTS - Routes Groupes
 *
 * Ce fichier couvre les routes HTTP
 * de consultation des groupes.
 */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const recupererGroupesMock = jest.fn();
const recupererGroupeParIdMock = jest.fn();
const recupererPlanningCompletGroupeMock = jest.fn();

await jest.unstable_mockModule("../src/model/groupes.model.js", () => ({
  recupererGroupes: recupererGroupesMock,
  recupererGroupeParId: recupererGroupeParIdMock,
  recupererPlanningCompletGroupe: recupererPlanningCompletGroupeMock,
}));

const { default: groupesRoutes } = await import("../routes/groupes.routes.js");

function creerAppTest() {
  const app = express();
  app.use(express.json());
  groupesRoutes(app);
  return app;
}

describe("Routes groupes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/groupes retourne la liste simple", async () => {
    recupererGroupesMock.mockResolvedValueOnce([{ id_groupes_etudiants: 1, nom_groupe: "G1" }]);

    const response = await request(creerAppTest()).get("/api/groupes");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ id_groupes_etudiants: 1, nom_groupe: "G1" }]);
    expect(recupererGroupesMock).toHaveBeenCalledWith(false, {
      sessionActive: false,
      seulementAvecEffectif: false,
      seulementAvecPlanning: false,
      inclureGroupesSpeciaux: false,
    });
  });

  test("GET /api/groupes accepte details=1", async () => {
    recupererGroupesMock.mockResolvedValueOnce([{ id_groupes_etudiants: 1, effectif: 25 }]);

    const response = await request(creerAppTest()).get("/api/groupes?details=1");

    expect(response.statusCode).toBe(200);
    expect(recupererGroupesMock).toHaveBeenCalledWith(true, {
      sessionActive: false,
      seulementAvecEffectif: false,
      seulementAvecPlanning: false,
      inclureGroupesSpeciaux: false,
    });
  });

  test("GET /api/groupes retourne 500 si lecture impossible", async () => {
    recupererGroupesMock.mockRejectedValueOnce(new Error("db"));

    const response = await request(creerAppTest()).get("/api/groupes");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: "Erreur lors de la recuperation des groupes.",
    });
  });

  test("GET /api/groupes/:id/planning retourne 400 si id invalide", async () => {
    const response = await request(creerAppTest()).get("/api/groupes/abc/planning");

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Identifiant invalide." });
  });

  test("GET /api/groupes/:id/planning retourne 404 si groupe absent", async () => {
    recupererPlanningCompletGroupeMock.mockResolvedValueOnce(null);

    const response = await request(creerAppTest()).get("/api/groupes/4/planning");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "Groupe introuvable." });
  });

  test("GET /api/groupes/:id/planning retourne le planning complet", async () => {
    recupererPlanningCompletGroupeMock.mockResolvedValueOnce({
      groupe: { id_groupes_etudiants: 8, nom_groupe: "G8" },
      horaire: [{ id_affectation_cours: 1 }],
    });

    const response = await request(creerAppTest()).get("/api/groupes/8/planning");

    expect(response.statusCode).toBe(200);
    expect(response.body.groupe.nom_groupe).toBe("G8");
    expect(recupererPlanningCompletGroupeMock).toHaveBeenCalledWith(8);
  });

  test("GET /api/groupes/:id/planning retourne 500 si erreur interne", async () => {
    recupererPlanningCompletGroupeMock.mockRejectedValueOnce(new Error("db"));

    const response = await request(creerAppTest()).get("/api/groupes/9/planning");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: "Erreur lors de la récupération du planning.",
    });
  });
});
