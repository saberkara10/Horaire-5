import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const poolQueryMock = jest.fn();
const schedulerGenererMock = jest.fn();
const genererRapportReprisesMock = jest.fn();
const listerRapportsMock = jest.fn();
const lireRapportMock = jest.fn();
const assurerSchemaSchedulerAcademiqueMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: poolQueryMock,
  },
}));

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (request, _response, next) => {
    request.user = { id: 91, role: "ADMIN_RESPONSABLE" };
    next();
  },
  userAdmin: (_request, _response, next) => next(),
  userAdminOrResponsable: (_request, _response, next) => next(),
}));

await jest.unstable_mockModule("../src/services/scheduler/SchedulerEngine.js", () => ({
  SchedulerEngine: {
    generer: schedulerGenererMock,
  },
}));

await jest.unstable_mockModule(
  "../src/services/scheduler/FailedCourseDebugService.js",
  () => ({
    FailedCourseDebugService: {
      genererRapport: genererRapportReprisesMock,
    },
  })
);

await jest.unstable_mockModule(
  "../src/services/scheduler/SchedulerReportService.js",
  () => ({
    SchedulerReportService: {
      listerRapports: listerRapportsMock,
      lireRapport: lireRapportMock,
    },
  })
);

await jest.unstable_mockModule(
  "../src/controllers/scheduler/ScheduleModificationController.js",
  () => ({
    ScheduleModificationController: {
      modifyAssignment: jest.fn(),
    },
  })
);

await jest.unstable_mockModule(
  "../src/services/scheduler/planning/ScheduleModificationService.js",
  () => ({
    ScheduleModificationService: {
      previewAssignmentModification: jest.fn(),
      modifyAssignment: jest.fn(),
    },
  })
);

await jest.unstable_mockModule(
  "../src/services/scheduler/simulation/ScenarioSimulator.js",
  () => ({
    ScenarioSimulator: {
      simulateOfficialScenario: jest.fn(),
    },
  })
);

await jest.unstable_mockModule(
  "../src/services/academic-scheduler-schema.js",
  () => ({
    assurerSchemaSchedulerAcademique: assurerSchemaSchedulerAcademiqueMock,
  })
);

const { default: schedulerRoutes } = await import("../routes/scheduler.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  schedulerRoutes(app);
  return app;
}

describe("scheduler admin routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/scheduler/bootstrap indique que le bootstrap est desactive", async () => {
    const response = await request(createApp()).post("/api/scheduler/bootstrap");

    expect(response.status).toBe(410);
    expect(response.body.message).toContain("bootstrap du scheduler est desactive");
  });

  test("GET /api/scheduler/generer-stream retourne un evenement d'erreur si le moteur echoue", async () => {
    schedulerGenererMock.mockRejectedValue(new Error("Generation impossible"));

    const response = await request(createApp()).get("/api/scheduler/generer-stream");

    expect(response.status).toBe(200);
    expect(response.text).toContain('"type":"error"');
    expect(response.text).toContain("Generation impossible");
  });

  test("GET /api/scheduler/rapports retourne la liste historisee", async () => {
    listerRapportsMock.mockResolvedValue([{ id: 1, score_qualite: 87 }]);

    const response = await request(createApp()).get("/api/scheduler/rapports");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 1, score_qualite: 87 }]);
    expect(listerRapportsMock).toHaveBeenCalledWith(expect.any(Object));
  });

  test("GET /api/scheduler/rapports/:id retourne 404 si le rapport est absent", async () => {
    lireRapportMock.mockResolvedValue(null);

    const response = await request(createApp()).get("/api/scheduler/rapports/77");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Rapport introuvable." });
  });

  test("GET /api/scheduler/sessions retourne les sessions triees", async () => {
    poolQueryMock.mockResolvedValue([
      [{ id_session: 3, nom: "Automne 2026", active: 1 }],
    ]);

    const response = await request(createApp()).get("/api/scheduler/sessions");

    expect(response.status).toBe(200);
    expect(response.body[0].nom).toBe("Automne 2026");
  });

  test("POST /api/scheduler/sessions valide les champs requis", async () => {
    const response = await request(createApp()).post("/api/scheduler/sessions").send({
      nom: "Automne 2026",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Champs requis");
  });

  test("POST /api/scheduler/sessions desactive les anciennes sessions puis cree la nouvelle", async () => {
    poolQueryMock
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      .mockResolvedValueOnce([{ insertId: 14 }]);

    const response = await request(createApp()).post("/api/scheduler/sessions").send({
      nom: "Automne 2026",
      date_debut: "2026-08-25",
      date_fin: "2026-12-20",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id_session: 14,
      nom: "Automne 2026",
      date_debut: "2026-08-25",
      date_fin: "2026-12-20",
      active: true,
    });
    expect(poolQueryMock).toHaveBeenNthCalledWith(1, "UPDATE sessions SET active = FALSE");
  });

  test("PUT /api/scheduler/sessions/:id/activer bascule la session active", async () => {
    poolQueryMock
      .mockResolvedValueOnce([{ affectedRows: 3 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(createApp()).put("/api/scheduler/sessions/5/activer");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Session activee." });
    expect(poolQueryMock).toHaveBeenNthCalledWith(2, "UPDATE sessions SET active = TRUE WHERE id_session = ?", [5]);
  });

  test("GET /api/scheduler/cours-echoues assure le schema puis retourne les reprises", async () => {
    poolQueryMock.mockResolvedValue([
      [{ id: 1, etudiant_nom: "Diallo", cours_code: "INF101" }],
    ]);

    const response = await request(createApp()).get("/api/scheduler/cours-echoues");

    expect(response.status).toBe(200);
    expect(response.body[0].cours_code).toBe("INF101");
    expect(assurerSchemaSchedulerAcademiqueMock).toHaveBeenCalled();
  });

  test("GET /api/scheduler/debug/reprises retourne le rapport du service", async () => {
    genererRapportReprisesMock.mockResolvedValue({
      warnings: [],
      lignes: [{ matricule: "E001" }],
    });

    const response = await request(createApp()).get(
      "/api/scheduler/debug/reprises?codes=INF101&matricules=E001&id_etudiant=4"
    );

    expect(response.status).toBe(200);
    expect(response.body.lignes).toEqual([{ matricule: "E001" }]);
    expect(genererRapportReprisesMock).toHaveBeenCalledWith({
      codes: "INF101",
      matricules: "E001",
      idEtudiant: "4",
      statut: "resolution_manuelle",
    });
  });

  test("POST /api/scheduler/cours-echoues valide les champs requis", async () => {
    const response = await request(createApp()).post("/api/scheduler/cours-echoues").send({
      id_etudiant: 3,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "id_etudiant et id_cours requis." });
  });

  test("POST /api/scheduler/cours-echoues enregistre une reprise", async () => {
    poolQueryMock.mockResolvedValueOnce([{ insertId: 22 }]);

    const response = await request(createApp()).post("/api/scheduler/cours-echoues").send({
      id_etudiant: 8,
      id_cours: 19,
      id_session: 3,
      note_echec: 54,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      message: "Cours echoue enregistre.",
      id: 22,
    });
    expect(assurerSchemaSchedulerAcademiqueMock).toHaveBeenCalled();
  });

  test("DELETE /api/scheduler/cours-echoues/:id supprime une reprise", async () => {
    poolQueryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(createApp()).delete("/api/scheduler/cours-echoues/9");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Supprime." });
  });

  test("GET /api/scheduler/absences retourne les absences professeurs", async () => {
    poolQueryMock.mockResolvedValue([
      [{ id: 4, prof_nom: "Tremblay", prof_prenom: "Marc" }],
    ]);

    const response = await request(createApp()).get("/api/scheduler/absences");

    expect(response.status).toBe(200);
    expect(response.body[0].prof_nom).toBe("Tremblay");
  });

  test("POST /api/scheduler/absences valide les champs requis", async () => {
    const response = await request(createApp()).post("/api/scheduler/absences").send({
      id_professeur: 5,
      date_debut: "2026-09-01",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("id_professeur, date_debut, date_fin requis");
  });

  test("POST /api/scheduler/absences enregistre une absence avec l'utilisateur courant", async () => {
    poolQueryMock.mockResolvedValueOnce([{ insertId: 18 }]);

    const response = await request(createApp()).post("/api/scheduler/absences").send({
      id_professeur: 5,
      date_debut: "2026-09-01",
      date_fin: "2026-09-03",
      type: "maladie",
      commentaire: "Repos",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ message: "Absence enregistree.", id: 18 });
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO absences_professeurs"),
      [5, "2026-09-01", "2026-09-03", "maladie", "Repos", 91]
    );
  });

  test("DELETE /api/scheduler/absences/:id supprime une absence", async () => {
    poolQueryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(createApp()).delete("/api/scheduler/absences/12");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Absence supprimee." });
  });

  test("GET /api/scheduler/salles-indisponibles retourne les indisponibilites", async () => {
    poolQueryMock.mockResolvedValue([
      [{ id: 2, salle_code: "A-201", salle_type: "Laboratoire" }],
    ]);

    const response = await request(createApp()).get("/api/scheduler/salles-indisponibles");

    expect(response.status).toBe(200);
    expect(response.body[0].salle_code).toBe("A-201");
  });

  test("POST /api/scheduler/salles-indisponibles valide les champs requis", async () => {
    const response = await request(createApp())
      .post("/api/scheduler/salles-indisponibles")
      .send({
        id_salle: 2,
        date_debut: "2026-10-12",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("id_salle, date_debut, date_fin requis");
  });

  test("POST /api/scheduler/salles-indisponibles enregistre une indisponibilite", async () => {
    poolQueryMock.mockResolvedValueOnce([{ insertId: 25 }]);

    const response = await request(createApp())
      .post("/api/scheduler/salles-indisponibles")
      .send({
        id_salle: 2,
        date_debut: "2026-10-12",
        date_fin: "2026-10-14",
        raison: "travaux",
        commentaire: "Maintenance HVAC",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ message: "Salle marquee indisponible.", id: 25 });
  });

  test("DELETE /api/scheduler/salles-indisponibles/:id supprime une indisponibilite", async () => {
    poolQueryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(createApp()).delete("/api/scheduler/salles-indisponibles/6");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Supprime." });
  });

  test("GET /api/scheduler/prerequis retourne les prerequis du catalogue", async () => {
    poolQueryMock.mockResolvedValue([
      [{ id: 1, code_prerequis: "INF101", code_cours_suivant: "INF201" }],
    ]);

    const response = await request(createApp()).get("/api/scheduler/prerequis");

    expect(response.status).toBe(200);
    expect(response.body[0].code_prerequis).toBe("INF101");
  });

  test("POST /api/scheduler/prerequis valide les champs requis", async () => {
    const response = await request(createApp()).post("/api/scheduler/prerequis").send({
      id_cours_prerequis: 1,
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("id_cours_prerequis et id_cours_suivant requis");
  });

  test("POST /api/scheduler/prerequis ajoute un prerequis", async () => {
    poolQueryMock.mockResolvedValueOnce([{ insertId: 31 }]);

    const response = await request(createApp()).post("/api/scheduler/prerequis").send({
      id_cours_prerequis: 1,
      id_cours_suivant: 2,
      est_bloquant: false,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ message: "Prerequis ajoute.", id: 31 });
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO prerequis_cours"),
      [1, 2, 0]
    );
  });

  test("DELETE /api/scheduler/prerequis/:id supprime un prerequis", async () => {
    poolQueryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(createApp()).delete("/api/scheduler/prerequis/4");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Prerequis supprime." });
  });
});
