import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const recupererTousLesProfesseursMock = jest.fn();
const recupererProfesseurParIdMock = jest.fn();
const recupererProfesseurParNomPrenomMock = jest.fn();
const recupererProfesseurParMatriculeMock = jest.fn();
const recupererCoursProfesseurMock = jest.fn();
const recupererDisponibilitesProfesseurMock = jest.fn();
const recupererJournalDisponibilitesProfesseurMock = jest.fn();
const recupererAbsencesProfesseurMock = jest.fn();
const recupererHoraireProfesseurMock = jest.fn();
const remplacerCoursProfesseurMock = jest.fn();
const remplacerDisponibilitesProfesseurMock = jest.fn();
const remplacerAbsencesProfesseurMock = jest.fn();
const ajouterProfesseurMock = jest.fn();
const modifierProfesseurMock = jest.fn();
const supprimerProfesseurMock = jest.fn();
const professeurEstDejaAffecteMock = jest.fn();
const validerContrainteCoursProfesseurMock = jest.fn();
const genererModeleImportExcelMock = jest.fn();
const importerProfesseursDepuisFichierMock = jest.fn();

await jest.unstable_mockModule("../src/model/professeurs.model.js", () => ({
  TYPES_ABSENCE_PROFESSEUR: ["maladie", "vacances", "formation", "autre"],
  recupererTousLesProfesseurs: recupererTousLesProfesseursMock,
  recupererProfesseurParId: recupererProfesseurParIdMock,
  recupererProfesseurParNomPrenom: recupererProfesseurParNomPrenomMock,
  recupererProfesseurParMatricule: recupererProfesseurParMatriculeMock,
  recupererCoursProfesseur: recupererCoursProfesseurMock,
  recupererDisponibilitesProfesseur: recupererDisponibilitesProfesseurMock,
  recupererJournalDisponibilitesProfesseur:
    recupererJournalDisponibilitesProfesseurMock,
  recupererAbsencesProfesseur: recupererAbsencesProfesseurMock,
  recupererHoraireProfesseur: recupererHoraireProfesseurMock,
  remplacerCoursProfesseur: remplacerCoursProfesseurMock,
  remplacerDisponibilitesProfesseur: remplacerDisponibilitesProfesseurMock,
  remplacerAbsencesProfesseur: remplacerAbsencesProfesseurMock,
  ajouterProfesseur: ajouterProfesseurMock,
  modifierProfesseur: modifierProfesseurMock,
  supprimerProfesseur: supprimerProfesseurMock,
  professeurEstDejaAffecte: professeurEstDejaAffecteMock,
  validerContrainteCoursProfesseur: validerContrainteCoursProfesseurMock,
}));

await jest.unstable_mockModule("../middlewares/auth.js", () => ({
  userAuth: (request, _response, next) => {
    request.user = { id: 1, roles: ["ADMIN"] };
    next();
  },
  userAdmin: (_request, _response, next) => next(),
  userAdminOrResponsable: (_request, _response, next) => next(),
}));

await jest.unstable_mockModule(
  "../src/services/import-excel-template.service.js",
  () => ({
    genererModeleImportExcel: genererModeleImportExcelMock,
  })
);

await jest.unstable_mockModule(
  "../src/services/import-professeurs.service.js",
  () => ({
    importerProfesseursDepuisFichier: importerProfesseursDepuisFichierMock,
  })
);

const { default: professeursRoutes } = await import("../routes/professeurs.routes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  professeursRoutes(app);
  return app;
}

function createProfesseur() {
  return {
    id_professeur: 1,
    matricule: "PROF001",
    nom: "Diallo",
    prenom: "Awa",
    specialite: "Informatique",
  };
}

describe("professeurs routes extra", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recupererProfesseurParIdMock.mockResolvedValue(createProfesseur());
    recupererProfesseurParNomPrenomMock.mockResolvedValue(null);
    recupererProfesseurParMatriculeMock.mockResolvedValue(null);
    professeurEstDejaAffecteMock.mockResolvedValue(false);
    validerContrainteCoursProfesseurMock.mockResolvedValue("");
    genererModeleImportExcelMock.mockReturnValue({
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "modele-import-professeurs.xlsx",
      buffer: Buffer.from("modele"),
    });
  });

  test("GET /api/professeurs retourne 500 si la lecture echoue", async () => {
    recupererTousLesProfesseursMock.mockRejectedValue(new Error("db ko"));

    const response = await request(createApp()).get("/api/professeurs");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("GET /api/professeurs/import/template telecharge le modele Excel", async () => {
    const response = await request(createApp()).get("/api/professeurs/import/template");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers["content-disposition"]).toBe(
      'attachment; filename="modele-import-professeurs.xlsx"'
    );
    expect(Number(response.headers["content-length"])).toBe(Buffer.from("modele").length);
    expect(genererModeleImportExcelMock).toHaveBeenCalledWith("professeurs");
  });

  test("GET /api/professeurs/import/template relaie les erreurs structurees", async () => {
    const erreur = new Error("modele indisponible");
    erreur.status = 422;
    erreur.erreurs = ["Le module est temporairement indisponible."];
    genererModeleImportExcelMock.mockImplementation(() => {
      throw erreur;
    });

    const response = await request(createApp()).get("/api/professeurs/import/template");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      message: "modele indisponible",
      erreurs: ["Le module est temporairement indisponible."],
    });
  });

  test("POST /api/professeurs/import retourne 500 sur une erreur inattendue", async () => {
    importerProfesseursDepuisFichierMock.mockRejectedValue(new Error("import ko"));

    const response = await request(createApp())
      .post("/api/professeurs/import")
      .attach("fichier", Buffer.from("contenu"), "professeurs.xlsx");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "import ko" });
  });

  test("GET /api/professeurs/:id retourne le professeur du middleware", async () => {
    const response = await request(createApp()).get("/api/professeurs/1");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id_professeur: 1,
      matricule: "PROF001",
    });
  });

  test("GET /api/professeurs/:id/cours retourne 500 si le modele echoue", async () => {
    recupererCoursProfesseurMock.mockRejectedValue(new Error("lecture ko"));

    const response = await request(createApp()).get("/api/professeurs/1/cours");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test.each([
    ["le payload n'est pas un tableau", { cours_ids: "1,2" }, "Le champ cours_ids doit etre un tableau."],
    [
      "un identifiant de cours est invalide",
      { cours_ids: [1, 0] },
      "Chaque cours assigne doit etre un identifiant positif.",
    ],
    [
      "des cours sont dupliques",
      { cours_ids: [2, 2] },
      "Les cours assignes dupliques ne sont pas autorises.",
    ],
  ])("PUT /api/professeurs/:id/cours retourne 400 si %s", async (_label, payload, message) => {
    const response = await request(createApp())
      .put("/api/professeurs/1/cours")
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(remplacerCoursProfesseurMock).not.toHaveBeenCalled();
  });

  test("PUT /api/professeurs/:id/cours retourne 500 si la mise a jour echoue", async () => {
    remplacerCoursProfesseurMock.mockRejectedValue(new Error("maj ko"));

    const response = await request(createApp())
      .put("/api/professeurs/1/cours")
      .send({ cours_ids: [1, 2] });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("GET /api/professeurs/:id/disponibilites retourne 400 si semaine_cible est invalide", async () => {
    const response = await request(createApp()).get(
      "/api/professeurs/1/disponibilites?semaine_cible=0"
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "La semaine_cible doit etre un entier positif.",
    });
  });

  test("GET /api/professeurs/:id/disponibilites retourne les disponibilites detaillees", async () => {
    recupererDisponibilitesProfesseurMock.mockResolvedValue([
      { jour_semaine: 2, heure_debut: "08:00:00", heure_fin: "10:00:00" },
    ]);

    const response = await request(createApp()).get(
      "/api/professeurs/1/disponibilites?semaine_cible=3"
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(recupererDisponibilitesProfesseurMock).toHaveBeenCalledWith(1, {
      format: "detail",
      semaine_cible: "3",
    });
  });

  test("GET /api/professeurs/:id/disponibilites/journal retourne 500 si le journal echoue", async () => {
    recupererJournalDisponibilitesProfesseurMock.mockRejectedValue(
      new Error("journal ko")
    );

    const response = await request(createApp()).get(
      "/api/professeurs/1/disponibilites/journal"
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("PUT /api/professeurs/:id/disponibilites retourne 400 si mode_application est invalide", async () => {
    const response = await request(createApp())
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [{ jour_semaine: 2, heure_debut: "10:00", heure_fin: "12:00" }],
        mode_application: "mensuel",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "Le mode_application doit valoir semaine_unique, semaine_et_suivantes, a_partir_date, plage_dates ou permanente.",
    });
  });

  test("PUT /api/professeurs/:id/disponibilites retourne 400 si a_partir_date n'a pas de date", async () => {
    const response = await request(createApp())
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [{ jour_semaine: 2, heure_debut: "10:00", heure_fin: "12:00" }],
        mode_application: "a_partir_date",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "La date_debut_effet est obligatoire au format YYYY-MM-DD.",
    });
  });

  test("PUT /api/professeurs/:id/disponibilites accepte a_partir_date avec une date valide", async () => {
    remplacerDisponibilitesProfesseurMock.mockResolvedValue({
      disponibilites: [{ jour_semaine: 2, heure_debut: "10:00:00", heure_fin: "12:00:00" }],
    });

    const response = await request(createApp())
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [{ jour_semaine: 2, heure_debut: "10:00", heure_fin: "12:00" }],
        mode_application: "a_partir_date",
        date_debut_effet: "2026-05-03",
      });

    expect(response.status).toBe(200);
    expect(remplacerDisponibilitesProfesseurMock).toHaveBeenCalledWith(
      1,
      [{ jour_semaine: 2, heure_debut: "10:00", heure_fin: "12:00" }],
      {
        semaine_cible: undefined,
        mode_application: "a_partir_date",
        date_debut_effet: "2026-05-03",
        date_fin_effet: undefined,
      }
    );
  });

  test("PUT /api/professeurs/:id/disponibilites retourne 400 si plage_dates est incomplete", async () => {
    const response = await request(createApp())
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [{ jour_semaine: 2, heure_debut: "10:00", heure_fin: "12:00" }],
        mode_application: "plage_dates",
        date_debut_effet: "2026-04-20",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "Les dates_debut_effet et date_fin_effet sont obligatoires au format YYYY-MM-DD.",
    });
  });

  test("PUT /api/professeurs/:id/disponibilites retourne 400 si la plage de dates est inversee", async () => {
    const response = await request(createApp())
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [{ jour_semaine: 2, heure_debut: "10:00", heure_fin: "12:00" }],
        mode_application: "plage_dates",
        date_debut_effet: "2026-05-02",
        date_fin_effet: "2026-05-01",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "La date_fin_effet doit etre posterieure ou egale a la date_debut_effet.",
    });
  });

  test("PUT /api/professeurs/:id/disponibilites relaie les erreurs metier avec replanification", async () => {
    const erreur = new Error("Replanification partielle");
    erreur.statusCode = 409;
    erreur.details = ["Une seance reste en conflit."];
    erreur.replanification = {
      statut: "partiel",
      seances_non_replanifiees: [{ id_affectation_cours: 17 }],
    };
    remplacerDisponibilitesProfesseurMock.mockRejectedValue(erreur);

    const response = await request(createApp())
      .put("/api/professeurs/1/disponibilites")
      .send({
        disponibilites: [{ jour_semaine: 2, heure_debut: "10:00", heure_fin: "12:00" }],
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Replanification partielle",
      details: ["Une seance reste en conflit."],
      replanification: {
        statut: "partiel",
        seances_non_replanifiees: [{ id_affectation_cours: 17 }],
      },
    });
  });

  test("GET /api/professeurs/:id/absences retourne 200 avec les absences", async () => {
    recupererAbsencesProfesseurMock.mockResolvedValue([
      { date_debut: "2026-04-21", date_fin: "2026-04-22", type_absence: "maladie" },
    ]);

    const response = await request(createApp()).get("/api/professeurs/1/absences");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { date_debut: "2026-04-21", date_fin: "2026-04-22", type_absence: "maladie" },
    ]);
  });

  test("GET /api/professeurs/:id/absences retourne 500 si la lecture echoue", async () => {
    recupererAbsencesProfesseurMock.mockRejectedValue(new Error("lecture ko"));

    const response = await request(createApp()).get("/api/professeurs/1/absences");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test.each([
    ["absences n'est pas un tableau", { absences: "2026-04-20" }, "Le champ absences doit etre un tableau."],
    [
      "une date est invalide",
      { absences: [{ date_debut: "2026/04/20", date_fin: "2026-04-21", type_absence: "maladie" }] },
      "Chaque absence doit avoir une date de debut et une date de fin valides.",
    ],
    [
      "la date de fin precede la date de debut",
      { absences: [{ date_debut: "2026-04-22", date_fin: "2026-04-21", type_absence: "maladie" }] },
      "La date de fin doit etre apres ou egale a la date de debut.",
    ],
    [
      "le type d'absence est vide",
      { absences: [{ date_debut: "2026-04-20", date_fin: "2026-04-21", type_absence: "" }] },
      "Chaque absence doit avoir un type d'absence.",
    ],
    [
      "le type d'absence est inconnu",
      { absences: [{ date_debut: "2026-04-20", date_fin: "2026-04-21", type_absence: "conge-parental" }] },
      "Le type d'absence est invalide.",
    ],
    [
      "la periode est dupliquee",
      {
        absences: [
          { date_debut: "2026-04-20", date_fin: "2026-04-21", type_absence: "maladie" },
          { date_debut: "2026-04-20", date_fin: "2026-04-21", type_absence: "vacances" },
        ],
      },
      "Les absences dupliquees sur la meme periode ne sont pas autorisees.",
    ],
  ])("PUT /api/professeurs/:id/absences retourne 400 si %s", async (_label, payload, message) => {
    const response = await request(createApp())
      .put("/api/professeurs/1/absences")
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(remplacerAbsencesProfesseurMock).not.toHaveBeenCalled();
  });

  test("PUT /api/professeurs/:id/absences retourne 200 si le remplacement reussit", async () => {
    remplacerAbsencesProfesseurMock.mockResolvedValue([
      { date_debut: "2026-04-20", date_fin: "2026-04-21", type_absence: "formation" },
    ]);

    const response = await request(createApp())
      .put("/api/professeurs/1/absences")
      .send({
        absences: [
          { date_debut: "2026-04-20", date_fin: "2026-04-21", type_absence: "formation" },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { date_debut: "2026-04-20", date_fin: "2026-04-21", type_absence: "formation" },
    ]);
    expect(remplacerAbsencesProfesseurMock).toHaveBeenCalledWith(1, [
      { date_debut: "2026-04-20", date_fin: "2026-04-21", type_absence: "formation" },
    ]);
  });

  test("PUT /api/professeurs/:id/absences retourne 500 si le remplacement echoue", async () => {
    remplacerAbsencesProfesseurMock.mockRejectedValue(new Error("maj ko"));

    const response = await request(createApp())
      .put("/api/professeurs/1/absences")
      .send({
        absences: [
          { date_debut: "2026-04-20", date_fin: "2026-04-21", type_absence: "formation" },
        ],
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("POST /api/professeurs retourne 500 si l'ajout echoue", async () => {
    ajouterProfesseurMock.mockRejectedValue(new Error("creation ko"));

    const response = await request(createApp()).post("/api/professeurs").send({
      matricule: "PROF123",
      nom: "Sy",
      prenom: "Ibrahima",
      specialite: "Reseaux",
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("PUT /api/professeurs/:id retourne 200 avec le professeur modifie", async () => {
    modifierProfesseurMock.mockResolvedValue({
      ...createProfesseur(),
      specialite: "Reseaux",
    });

    const response = await request(createApp())
      .put("/api/professeurs/1")
      .send({ specialite: "Reseaux" });

    expect(response.status).toBe(200);
    expect(response.body.specialite).toBe("Reseaux");
    expect(modifierProfesseurMock).toHaveBeenCalledWith(1, { specialite: "Reseaux" });
  });

  test("PUT /api/professeurs/:id retourne 500 si la modification echoue", async () => {
    modifierProfesseurMock.mockRejectedValue(new Error("modif ko"));

    const response = await request(createApp())
      .put("/api/professeurs/1")
      .send({ specialite: "Reseaux" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("DELETE /api/professeurs/:id retourne 200 si la suppression reussit", async () => {
    const response = await request(createApp()).delete("/api/professeurs/1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Professeur supprime." });
    expect(supprimerProfesseurMock).toHaveBeenCalledWith(1);
  });

  test("DELETE /api/professeurs/:id retourne 500 si la suppression echoue", async () => {
    supprimerProfesseurMock.mockRejectedValue(new Error("suppression ko"));

    const response = await request(createApp()).delete("/api/professeurs/1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });

  test("GET /api/professeurs/:id/horaire retourne 400 si l'identifiant est invalide", async () => {
    const response = await request(createApp()).get("/api/professeurs/abc/horaire");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Identifiant invalide." });
  });

  test("GET /api/professeurs/:id/horaire retourne 404 si le professeur est absent", async () => {
    recupererProfesseurParIdMock.mockResolvedValue(null);

    const response = await request(createApp()).get("/api/professeurs/999/horaire");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Professeur introuvable." });
  });

  test("GET /api/professeurs/:id/horaire retourne 500 si la lecture echoue", async () => {
    recupererHoraireProfesseurMock.mockRejectedValue(new Error("horaire ko"));

    const response = await request(createApp()).get("/api/professeurs/1/horaire");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erreur serveur." });
  });
});
