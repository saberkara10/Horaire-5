/**
 * TESTS - Routes Etudiants
 *
 * Ce fichier couvre les principaux cas
 * des routes de gestion des etudiants.
 */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const recupererTousLesEtudiants = jest.fn();
const recupererEtudiantParId = jest.fn();
const recupererHoraireCompletEtudiant = jest.fn();
const supprimerTousLesEtudiants = jest.fn();
const importerEtudiantsDepuisFichier = jest.fn();
const listerCoursCommunsEchangeables = jest.fn();
const previsualiserEchangeCoursEtudiants = jest.fn();
const executerEchangeCoursEtudiants = jest.fn();

class ImportEtudiantsErrorMock extends Error {
  constructor(message, { status = 400, erreurs = [] } = {}) {
    super(message);
    this.status = status;
    this.erreurs = erreurs;
  }
}

jest.unstable_mockModule("../src/model/etudiants.model.js", () => ({
  recupererTousLesEtudiants,
  recupererEtudiantParId,
  recupererHoraireCompletEtudiant,
  supprimerTousLesEtudiants,
}));

jest.unstable_mockModule("../src/services/import-etudiants.service.js", () => ({
  importerEtudiantsDepuisFichier,
  ImportEtudiantsError: ImportEtudiantsErrorMock,
}));

jest.unstable_mockModule("../src/services/etudiants/student-course-exchange.service.js", () => ({
  listerCoursCommunsEchangeables,
  previsualiserEchangeCoursEtudiants,
  executerEchangeCoursEtudiants,
}));

const { default: etudiantsRoutes } = await import("../routes/etudiants.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  etudiantsRoutes(app);

  app.use((error, request, response, next) => {
    response.status(500).json({
      message: error.message || "Erreur serveur.",
    });
  });

  return app;
}

describe("routes etudiants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/etudiants retourne 200", async () => {
    recupererTousLesEtudiants.mockResolvedValue([{ id_etudiant: 1 }]);
    const app = createApp();

    const response = await request(app).get("/api/etudiants");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ id_etudiant: 1 }]);
    expect(recupererTousLesEtudiants).toHaveBeenCalledWith({
      sessionActive: false,
    });
  });

  it("GET /api/etudiants accepte session_active=1", async () => {
    recupererTousLesEtudiants.mockResolvedValue([{ id_etudiant: 1 }]);
    const app = createApp();

    const response = await request(app).get("/api/etudiants?session_active=1");

    expect(response.statusCode).toBe(200);
    expect(recupererTousLesEtudiants).toHaveBeenCalledWith({
      sessionActive: true,
    });
  });

  it("GET /api/etudiants retourne 500 si erreur modele", async () => {
    recupererTousLesEtudiants.mockRejectedValue(new Error("DB error"));
    const app = createApp();

    const response = await request(app).get("/api/etudiants");

    expect(response.statusCode).toBe(500);
  });

  it("GET /api/etudiants/:id retourne 404 si etudiant introuvable", async () => {
    recupererEtudiantParId.mockResolvedValue(null);
    const app = createApp();

    const response = await request(app).get("/api/etudiants/999");

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Etudiant introuvable.");
  });

  it("GET /api/etudiants/:id retourne 200 si etudiant trouve", async () => {
    recupererEtudiantParId.mockResolvedValue({ id_etudiant: 1, nom: "Ali" });
    const app = createApp();

    const response = await request(app).get("/api/etudiants/1");

    expect(response.statusCode).toBe(200);
    expect(response.body.nom).toBe("Ali");
  });

  it("GET /api/etudiants/:id/horaire retourne 404 si etudiant introuvable", async () => {
    recupererHoraireCompletEtudiant.mockResolvedValue(null);
    const app = createApp();

    const response = await request(app).get("/api/etudiants/1/horaire");

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Etudiant introuvable.");
  });

  it("GET /api/etudiants/:id/horaire retourne 200 si horaire trouve", async () => {
    recupererHoraireCompletEtudiant.mockResolvedValue({
      etudiant: { id_etudiant: 1, nom: "Ali" },
      horaire: [{ id_affectation_cours: 10 }],
    });
    const app = createApp();

    const response = await request(app).get("/api/etudiants/1/horaire");

    expect(response.statusCode).toBe(200);
    expect(response.body.horaire).toHaveLength(1);
  });

  it("GET /api/etudiants/echange-cours/options retourne 200", async () => {
    listerCoursCommunsEchangeables.mockResolvedValue({
      cours_communs: [{ id_cours: 4, code_cours: "POO" }],
    });
    const app = createApp();

    const response = await request(app).get(
      "/api/etudiants/echange-cours/options?etudiant_a=1&etudiant_b=2"
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.cours_communs).toHaveLength(1);
    expect(listerCoursCommunsEchangeables).toHaveBeenCalledWith(1, 2);
  });

  it("GET /api/etudiants/echange-cours/preview retourne 200", async () => {
    previsualiserEchangeCoursEtudiants.mockResolvedValue({
      echange_possible: true,
      cours: { id_cours: 4, code_cours: "POO" },
    });
    const app = createApp();

    const response = await request(app).get(
      "/api/etudiants/echange-cours/preview?etudiant_a=1&etudiant_b=2&id_cours=4"
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.echange_possible).toBe(true);
    expect(previsualiserEchangeCoursEtudiants).toHaveBeenCalledWith({
      idEtudiantA: 1,
      idEtudiantB: 2,
      idCours: 4,
    });
  });

  it("POST /api/etudiants/echange-cours retourne 200", async () => {
    executerEchangeCoursEtudiants.mockResolvedValue({
      message: "Echange de cours effectue avec succes.",
      etudiants_impactes: [1, 2],
    });
    const app = createApp();

    const response = await request(app)
      .post("/api/etudiants/echange-cours")
      .send({
        id_etudiant_a: 1,
        id_etudiant_b: 2,
        id_cours: 4,
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.etudiants_impactes).toEqual([1, 2]);
    expect(executerEchangeCoursEtudiants).toHaveBeenCalledWith({
      idEtudiantA: 1,
      idEtudiantB: 2,
      idCours: 4,
    });
  });

  it("POST /api/etudiants/import retourne 400 sans fichier", async () => {
    const app = createApp();

    const response = await request(app).post("/api/etudiants/import");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Aucun fichier fourni.");
  });

  it("POST /api/etudiants/import retourne 400 si extension invalide", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from("abc"), "etudiants.txt");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Format de fichier non supporte.");
  });

  it("POST /api/etudiants/import retourne 409 si le service refuse l'import", async () => {
    importerEtudiantsDepuisFichier.mockRejectedValue(
      new ImportEtudiantsErrorMock("Import impossible.", {
        status: 409,
        erreurs: ["Erreur 1"],
      })
    );
    const app = createApp();

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from("abc"), "etudiants.csv");

    expect(response.statusCode).toBe(409);
    expect(response.body.erreurs).toEqual(["Erreur 1"]);
  });

  it("POST /api/etudiants/import retourne 200 si succes", async () => {
    importerEtudiantsDepuisFichier.mockResolvedValue({
      message: "Import termine avec succes.",
      nombre_importes: 1,
    });
    const app = createApp();

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from("abc"), "etudiants.csv");

    expect(response.statusCode).toBe(200);
    expect(response.body.nombre_importes).toBe(1);
    expect(importerEtudiantsDepuisFichier).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: "etudiants.csv" })
    );
  });

  it("DELETE /api/etudiants retourne 200 si succes", async () => {
    supprimerTousLesEtudiants.mockResolvedValue();
    const app = createApp();

    const response = await request(app).delete("/api/etudiants");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe(
      "Tous les etudiants importes et leurs groupes orphelins ont ete supprimes."
    );
  });
});
