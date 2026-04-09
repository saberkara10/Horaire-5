import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (request, response, next) => next(),
}));

const { default: dashboardRoutes } = await import("../routes/dashboard.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  dashboardRoutes(app);
  return app;
}

describe("routes dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/dashboard/overview retourne une synthese exploitable", async () => {
    queryMock.mockImplementation(async (sql, params = []) => {
      if (sql.includes("FROM sessions") && sql.includes("WHERE active = TRUE")) {
        return [[
          {
            id_session: 1,
            nom: "Automne 2026",
            date_debut: "2026-08-25",
            date_fin: "2026-12-20",
          },
        ]];
      }

      if (sql.includes("nb_cours_actifs")) {
        return [[
          {
            nb_cours_actifs: 120,
            nb_professeurs: 34,
            nb_salles: 18,
            capacite_totale_salles: 640,
            nb_etudiants: 480,
            nb_groupes: 22,
            nb_etudiants_sans_groupe: 3,
            nb_programmes_actifs: 7,
          },
        ]];
      }

      if (sql.includes("FROM rapports_generation")) {
        return [[
          {
            score_qualite: 94,
            nb_cours_planifies: 320,
            nb_cours_non_planifies: 2,
            date_generation: "2026-09-03T10:00:00.000Z",
          },
        ]];
      }

      if (sql.includes("FROM cours") && sql.includes("ORDER BY id_cours DESC")) {
        return [[
          {
            id_cours: 9,
            code: "ADM101",
            nom: "Introduction",
            programme: "Administration",
          },
        ]];
      }

      if (sql.includes("FROM professeurs p")) {
        return [[
          {
            id_professeur: 5,
            matricule: "P-01",
            nom: "Benali",
            prenom: "Maya",
            programmes_assignes: "Administration | Analyse de donnees",
          },
        ]];
      }

      if (sql.includes("nb_groupes_actifs")) {
        expect(params).toEqual([1, 1, 1, 1, 1]);
        return [[
          {
            nb_groupes_actifs: 10,
            nb_groupes_avec_horaire: 8,
            nb_groupes_sans_horaire: 2,
            nb_etudiants_session_active: 220,
            nb_etudiants_avec_horaire: 200,
          },
        ]];
      }

      if (sql.includes("WHERE ge.id_session = ?") && sql.includes("LIMIT 8")) {
        expect(params).toEqual([1]);
        return [[
          {
            id_groupes_etudiants: 77,
            nom_groupe: "Administration - E1 - G4",
            programme: "Administration",
            etape: 1,
            effectif: 20,
          },
        ]];
      }

      if (
        sql.includes("SELECT COUNT(*) AS total") &&
        sql.includes("etape_etude = ?")
      ) {
        expect(params).toEqual(["Administration", "1"]);
        return [[{ total: 0 }]];
      }

      throw new Error(`Requete non prise en charge dans le test: ${sql}`);
    });

    const app = createApp();
    const response = await request(app).get("/api/dashboard/overview");

    expect(response.status).toBe(200);
    expect(response.body.compteurs_globaux.nb_groupes).toBe(22);
    expect(response.body.resume_session_active.nb_etudiants_sans_horaire).toBe(20);
    expect(response.body.groupes_sans_horaire).toHaveLength(1);
    expect(response.body.cas_particuliers[0]).toEqual(
      expect.objectContaining({
        titre: "Etudiants sans groupe",
        valeur: 3,
      })
    );
  });

  it("GET /api/dashboard/overview retourne 500 si la synthese echoue", async () => {
    queryMock.mockRejectedValue(new Error("DB error"));

    const app = createApp();
    const response = await request(app).get("/api/dashboard/overview");

    expect(response.status).toBe(500);
    expect(response.body.message).toBe(
      "Erreur lors de la recuperation du tableau de bord."
    );
  });
});
