import express from "express";
import request from "supertest";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const recupererTousLesEtudiants = jest.fn();
const recupererEtudiantParId = jest.fn();
const importerEtudiants = jest.fn();
const recupererHoraireCompletEtudiant = jest.fn();

jest.unstable_mockModule("../src/model/etudiants.model.js", () => ({
  recupererTousLesEtudiants,
  recupererEtudiantParId,
  importerEtudiants,
  recupererHoraireCompletEtudiant,
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

  it("GET /api/etudiants retourne 500 si erreur modèle", async () => {
    recupererTousLesEtudiants.mockRejectedValue(new Error("DB error"));
    const app = createApp();

    const response = await request(app).get("/api/etudiants");

    expect(response.statusCode).toBe(500);
  });

  it("GET /api/etudiants/:id/planning retourne 400 si id invalide", async () => {
    const app = createApp();

    const response = await request(app).get("/api/etudiants/abc/planning");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("ID invalide.");
  });

  it("GET /api/etudiants/:id/planning retourne 404 si étudiant introuvable", async () => {
    recupererHoraireCompletEtudiant.mockResolvedValue(null);
    const app = createApp();

    const response = await request(app).get("/api/etudiants/9999/planning");

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Etudiant introuvable.");
  });

  it("GET /api/etudiants/:id/planning retourne 200 si succès", async () => {
    recupererHoraireCompletEtudiant.mockResolvedValue({
      etudiant: { id_etudiant: 1 },
      horaire: [],
    });
    const app = createApp();

    const response = await request(app).get("/api/etudiants/1/planning");

    expect(response.statusCode).toBe(200);
    expect(response.body.etudiant.id_etudiant).toBe(1);
  });

  it("GET /api/etudiants/:id/planning retourne 500 si erreur", async () => {
    recupererHoraireCompletEtudiant.mockRejectedValue(new Error("Erreur"));
    const app = createApp();

    const response = await request(app).get("/api/etudiants/1/planning");

    expect(response.statusCode).toBe(500);
  });

  it("GET /api/etudiants/:id retourne 404 si étudiant introuvable", async () => {
    recupererEtudiantParId.mockResolvedValue(null);
    const app = createApp();

    const response = await request(app).get("/api/etudiants/999");

    expect(response.statusCode).toBe(404);
  });

  it("GET /api/etudiants/:id retourne 200 si étudiant trouvé", async () => {
    recupererEtudiantParId.mockResolvedValue({ id_etudiant: 1, nom: "Ali" });
    const app = createApp();

    const response = await request(app).get("/api/etudiants/1");

    expect(response.statusCode).toBe(200);
    expect(response.body.nom).toBe("Ali");
  });

  it("GET /api/etudiants/:id retourne 500 si erreur", async () => {
    recupererEtudiantParId.mockRejectedValue(new Error("Erreur"));
    const app = createApp();

    const response = await request(app).get("/api/etudiants/1");

    expect(response.statusCode).toBe(500);
  });

  it("POST /api/etudiants/import retourne 400 sans fichier", async () => {
    const app = createApp();

    const response = await request(app).post("/api/etudiants/import");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Aucun fichier recu.");
  });

  it("POST /api/etudiants/import retourne 500 si extension invalide", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from("abc"), "etudiants.txt");

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Format invalide. Utilisez un fichier Excel ou CSV.");
  });

  it("POST /api/etudiants/import retourne 400 si fichier csv vide", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from(""), "etudiants.csv");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Le fichier est vide ou invalide.");
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

  it("POST /api/etudiants/import retourne 400 si le modèle refuse l'import", async () => {
    importerEtudiants.mockResolvedValue({
      succes: false,
      message: "Import impossible.",
      erreurs: ["Erreur 1"],
    });
    const app = createApp();

    const csv =
      "matricule,nom,prenom,groupe,programme,etape\nE001,Ali,Test,G1,INF,1";

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from(csv), "etudiants.csv");

    expect(response.statusCode).toBe(400);
    expect(response.body.succes).toBe(false);
  });

  it("POST /api/etudiants/import retourne 200 si succès", async () => {
    importerEtudiants.mockResolvedValue({
      succes: true,
      message: "Import terminé avec succès.",
      nombreImportes: 1,
    });
    const app = createApp();

    const csv =
      "matricule,nom,prenom,groupe,programme,etape\nE001,Ali,Test,G1,INF,1";

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from(csv), "etudiants.csv");

    expect(response.statusCode).toBe(200);
    expect(response.body.succes).toBe(true);
  });

  it("POST /api/etudiants/import retourne 500 si le modèle lance une erreur", async () => {
    importerEtudiants.mockRejectedValue(new Error("Erreur import"));
    const app = createApp();

    const csv =
      "matricule,nom,prenom,groupe,programme,etape\nE001,Ali,Test,G1,INF,1";

    const response = await request(app)
      .post("/api/etudiants/import")
      .attach("fichier", Buffer.from(csv), "etudiants.csv");

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Erreur import");
  });
});


