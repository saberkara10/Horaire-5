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
const importerEtudiants = jest.fn();
const supprimerTousLesEtudiants = jest.fn();

jest.unstable_mockModule("../src/model/etudiants.model.js", () => ({
  recupererTousLesEtudiants,
  recupererEtudiantParId,
  importerEtudiants,
  supprimerTousLesEtudiants,
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

  it("POST /api/etudiants/import retourne 400 sans fichier", async () => {
    const app = createApp();

    const response = await request(app).post("/api/etudiants/import");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Aucun fichier recu.");
  });

  it("POST /api/etudiants/import retourne 400 si colonnes manquantes", async () => {
    const app = createApp();

    const csv = "matricule,nom\nE001,Ali";
    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from(csv), "etudiants.csv");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain("Colonnes obligatoires manquantes");
  });

  it("POST /api/etudiants/import retourne 400 si le modele refuse l'import", async () => {
    importerEtudiants.mockResolvedValue({
      succes: false,
      message: "Import impossible.",
      erreurs: ["Erreur 1"],
    });
    const app = createApp();

    const csv =
      "matricule,nom,prenom,programme,etape,session,annee\nE001,Ali,Test,INF,1,Automne,2026";

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from(csv), "etudiants.csv");

    expect(response.statusCode).toBe(400);
    expect(response.body.succes).toBe(false);
  });

  it("POST /api/etudiants/import retourne 200 si succes", async () => {
    importerEtudiants.mockResolvedValue({
      succes: true,
      message: "Import termine avec succes.",
      nombreImportes: 1,
    });
    const app = createApp();

    const csv =
      "matricule,nom,prenom,programme,etape,session,annee\nE001,Ali,Test,INF,1,Automne,2026";

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from(csv), "etudiants.csv");

    expect(response.statusCode).toBe(200);
    expect(response.body.succes).toBe(true);
  });

  it("DELETE /api/etudiants retourne 200 si succes", async () => {
    supprimerTousLesEtudiants.mockResolvedValue();
    const app = createApp();

    const response = await request(app).delete("/api/etudiants");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe(
      "Tous les etudiants et groupes generes ont ete supprimes."
    );
  });
});
