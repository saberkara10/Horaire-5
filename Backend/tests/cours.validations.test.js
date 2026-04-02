/**
 * TESTS - Validations Cours
 *
 * Ce fichier couvre les validations
 * appliquees aux donnees de cours.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const recupererCoursParId = jest.fn();
const recupererCoursParCode = jest.fn();
const coursEstDejaAffecte = jest.fn();
const salleExisteParId = jest.fn();

jest.unstable_mockModule("../src/model/cours.model.js", () => ({
  recupererCoursParId,
  recupererCoursParCode,
  coursEstDejaAffecte,
  salleExisteParId,
}));

const {
  validerIdCours,
  verifierCoursExiste,
  validerCreateCours,
  validerUpdateCours,
  validerDeleteCours,
} = await import("../src/validations/cours.validations.js");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("validations cours", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("validerIdCours accepte un id valide", () => {
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    validerIdCours(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("validerIdCours refuse un id invalide", () => {
    const req = { params: { id: "abc" } };
    const res = createResponse();
    const next = jest.fn();

    validerIdCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("verifierCoursExiste retourne 404 si absent", async () => {
    recupererCoursParId.mockResolvedValue(null);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await verifierCoursExiste(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("verifierCoursExiste stocke le cours si trouve", async () => {
    recupererCoursParId.mockResolvedValue({ id_cours: 1 });
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await verifierCoursExiste(req, res, next);

    expect(req.cours).toEqual({ id_cours: 1 });
    expect(next).toHaveBeenCalled();
  });

  it("validerCreateCours refuse un code vide", async () => {
    const req = {
      body: {
        code: "",
        nom: "Algo",
        duree: 3,
        programme: "Programmation informatique",
        etape_etude: 1,
        id_salle_reference: 1,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateCours refuse un nom invalide", async () => {
    const req = {
      body: {
        code: "INF101",
        nom: "12345",
        duree: 3,
        programme: "Programmation informatique",
        etape_etude: 1,
        id_salle_reference: 1,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateCours refuse une salle de reference manquante", async () => {
    const req = {
      body: {
        code: "INF101",
        nom: "Algo",
        duree: 3,
        programme: "Programmation informatique",
        etape_etude: 1,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateCours refuse un code deja utilise", async () => {
    recupererCoursParCode.mockResolvedValue({ id_cours: 2 });
    const req = {
      body: {
        code: "INF101",
        nom: "Algo",
        duree: 3,
        programme: "Programmation informatique",
        etape_etude: 1,
        id_salle_reference: 1,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("validerCreateCours refuse une salle de reference inexistante", async () => {
    recupererCoursParCode.mockResolvedValue(null);
    salleExisteParId.mockResolvedValue(false);
    const req = {
      body: {
        code: "INF101",
        nom: "Algo",
        duree: 3,
        programme: "Programmation informatique",
        etape_etude: 1,
        id_salle_reference: 99,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateCours accepte des donnees valides", async () => {
    recupererCoursParCode.mockResolvedValue(null);
    salleExisteParId.mockResolvedValue(true);
    const req = {
      body: {
        code: "INF101",
        nom: "Algo",
        duree: 3,
        programme: "Programmation informatique",
        etape_etude: 1,
        id_salle_reference: 4,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("validerUpdateCours refuse archive", async () => {
    const req = { params: { id: "1" }, body: { archive: true } };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerUpdateCours refuse aucun champ", async () => {
    const req = { params: { id: "1" }, body: {} };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerUpdateCours refuse une salle inexistante", async () => {
    salleExisteParId.mockResolvedValue(false);
    const req = { params: { id: "1" }, body: { id_salle_reference: 12 } };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerUpdateCours accepte une modification valide", async () => {
    salleExisteParId.mockResolvedValue(true);
    recupererCoursParCode.mockResolvedValue(null);
    const req = { params: { id: "1" }, body: { nom: "Nouveau nom" } };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateCours(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("validerDeleteCours refuse suppression si cours affecte", async () => {
    coursEstDejaAffecte.mockResolvedValue(true);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await validerDeleteCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerDeleteCours accepte si cours non affecte", async () => {
    coursEstDejaAffecte.mockResolvedValue(false);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await validerDeleteCours(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
/**
 * TESTS - Validations Cours
 *
 * Ce fichier couvre les validations
 * appliquees aux donnees de cours.
 */
