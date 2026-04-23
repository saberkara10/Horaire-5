import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const poolQueryMock = jest.fn();
const recupererPlanningCompletGroupeMock = jest.fn();
const recupererHoraireProfesseurMock = jest.fn();
const recupererProfesseurParIdMock = jest.fn();
const recupererHoraireCompletEtudiantMock = jest.fn();
const genererPDFGroupeMock = jest.fn();
const genererPDFProfesseurMock = jest.fn();
const genererPDFEtudiantMock = jest.fn();
const genererExcelGroupeMock = jest.fn();
const genererExcelProfesseurMock = jest.fn();
const genererExcelEtudiantMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: poolQueryMock,
  },
}));

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (_request, _response, next) => next(),
}));

await jest.unstable_mockModule("../src/model/groupes.model.js", () => ({
  recupererPlanningCompletGroupe: recupererPlanningCompletGroupeMock,
}));

await jest.unstable_mockModule("../src/model/professeurs.model.js", () => ({
  recupererHoraireProfesseur: recupererHoraireProfesseurMock,
  recupererProfesseurParId: recupererProfesseurParIdMock,
}));

await jest.unstable_mockModule("../src/model/etudiants.model.js", () => ({
  recupererHoraireCompletEtudiant: recupererHoraireCompletEtudiantMock,
}));

await jest.unstable_mockModule("../src/services/ExportService.js", () => ({
  genererPDFGroupe: genererPDFGroupeMock,
  genererPDFProfesseur: genererPDFProfesseurMock,
  genererPDFEtudiant: genererPDFEtudiantMock,
  genererExcelGroupe: genererExcelGroupeMock,
  genererExcelProfesseur: genererExcelProfesseurMock,
  genererExcelEtudiant: genererExcelEtudiantMock,
}));

const { default: exportRoutes } = await import("../routes/export.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  exportRoutes(app);
  return app;
}

describe("export routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/export/groupe/:id/pdf refuse un identifiant invalide", async () => {
    const response = await request(createApp()).get("/api/export/groupe/abc/pdf");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "ID invalide." });
  });

  test("GET /api/export/groupe/:id/pdf retourne 404 si le groupe est introuvable", async () => {
    recupererPlanningCompletGroupeMock.mockResolvedValue(null);

    const response = await request(createApp()).get("/api/export/groupe/3/pdf");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Groupe introuvable." });
  });

  test("GET /api/export/groupe/:id/pdf genere un fichier avec la session active en fallback", async () => {
    recupererPlanningCompletGroupeMock.mockResolvedValue({
      groupe: {
        nom_groupe: "Groupe Été 1",
      },
      horaire: [],
    });
    poolQueryMock.mockResolvedValue([[{ nom: "Automne", annee: 2026 }]]);
    genererPDFGroupeMock.mockResolvedValue(Buffer.from("pdf-groupe"));

    const response = await request(createApp()).get("/api/export/groupe/7/pdf");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toContain(
      'horaire-groupe-groupe-ete-1-automne-2026.pdf'
    );
    expect(genererPDFGroupeMock).toHaveBeenCalledWith({
      groupe: {
        nom_groupe: "Groupe Été 1",
        annee: 2026,
        session: "Automne",
      },
      horaire: [],
    });
  });

  test("GET /api/export/groupe/:id/excel genere un fichier xlsx", async () => {
    recupererPlanningCompletGroupeMock.mockResolvedValue({
      groupe: {
        nom_groupe: "G-INF-01",
        session: "Hiver",
        annee: 2027,
      },
      horaire: [],
    });
    genererExcelGroupeMock.mockResolvedValue(Buffer.from("excel-groupe"));

    const response = await request(createApp()).get("/api/export/groupe/4/excel");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers["content-disposition"]).toContain(
      'horaire-groupe-g-inf-01-hiver-2027.xlsx'
    );
  });

  test("GET /api/export/professeur/:id/pdf retourne 404 si le professeur est introuvable", async () => {
    recupererProfesseurParIdMock.mockResolvedValue(null);
    recupererHoraireProfesseurMock.mockResolvedValue([]);
    poolQueryMock.mockResolvedValue([[{ nom: "Automne", annee: 2026 }]]);

    const response = await request(createApp()).get("/api/export/professeur/11/pdf");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Professeur introuvable." });
  });

  test("GET /api/export/professeur/:id/pdf genere un PDF avec identifiant compose", async () => {
    recupererProfesseurParIdMock.mockResolvedValue({
      prenom: "Anne",
      nom: "L'Écuyer",
    });
    recupererHoraireProfesseurMock.mockResolvedValue([]);
    poolQueryMock.mockResolvedValue([[{ nom: "Printemps", annee: 2028 }]]);
    genererPDFProfesseurMock.mockResolvedValue(Buffer.from("pdf-prof"));

    const response = await request(createApp()).get("/api/export/professeur/8/pdf");

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain(
      'horaire-professeur-anne-l-ecuyer-printemps-2028.pdf'
    );
    expect(genererPDFProfesseurMock).toHaveBeenCalledWith({
      professeur: {
        prenom: "Anne",
        nom: "L'Écuyer",
        session: "Printemps",
        annee: 2028,
      },
      horaire: [],
    });
  });

  test("GET /api/export/professeur/:id/excel retourne 500 si la generation echoue", async () => {
    recupererProfesseurParIdMock.mockResolvedValue({
      prenom: "Marc",
      nom: "Tremblay",
      session: "Automne 2026",
      annee: 2026,
    });
    recupererHoraireProfesseurMock.mockResolvedValue([]);
    poolQueryMock.mockResolvedValue([[{ nom: "Automne", annee: 2026 }]]);
    genererExcelProfesseurMock.mockRejectedValue(new Error("boom"));

    const response = await request(createApp()).get("/api/export/professeur/2/excel");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur lors de la generation Excel." });
  });

  test("GET /api/export/etudiant/:id/pdf retourne 404 si l'etudiant est introuvable", async () => {
    recupererHoraireCompletEtudiantMock.mockResolvedValue(null);
    poolQueryMock.mockResolvedValue([[{ nom: "Automne", annee: 2026 }]]);

    const response = await request(createApp()).get("/api/export/etudiant/15/pdf");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Etudiant introuvable." });
  });

  test("GET /api/export/etudiant/:id/pdf genere un PDF avec fallback session", async () => {
    recupererHoraireCompletEtudiantMock.mockResolvedValue({
      etudiant: {
        prenom: "Aya",
        nom: "Diallo",
      },
      horaire: [],
      reprises: [],
      horaire_reprises: [],
    });
    poolQueryMock.mockResolvedValue([[{ nom: "Hiver", annee: 2029 }]]);
    genererPDFEtudiantMock.mockResolvedValue(Buffer.from("pdf-etudiant"));

    const response = await request(createApp()).get("/api/export/etudiant/9/pdf");

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain(
      'horaire-etudiant-aya-diallo-hiver-2029.pdf'
    );
    expect(genererPDFEtudiantMock).toHaveBeenCalledWith({
      etudiant: {
        prenom: "Aya",
        nom: "Diallo",
        session: "Hiver",
        annee: 2029,
      },
      horaire: [],
      reprises: [],
      horaire_reprises: [],
    });
  });

  test("GET /api/export/etudiant/:id/excel genere un fichier xlsx", async () => {
    recupererHoraireCompletEtudiantMock.mockResolvedValue({
      etudiant: {
        prenom: "Sara",
        nom: "Ben Ali",
        session: "Ete",
        annee: 2030,
      },
      horaire: [],
    });
    poolQueryMock.mockResolvedValue([[{ nom: "Automne", annee: 2026 }]]);
    genererExcelEtudiantMock.mockResolvedValue(Buffer.from("excel-etudiant"));

    const response = await request(createApp()).get("/api/export/etudiant/14/excel");

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain(
      'horaire-etudiant-sara-ben-ali-ete-2030.xlsx'
    );
  });
});
