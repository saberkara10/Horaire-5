import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const recupererProfesseurParId = jest.fn();
const recupererProfesseurParMatricule = jest.fn();
const professeurEstDejaAffecte = jest.fn();

jest.unstable_mockModule("../src/model/professeurs.model.js", () => ({
  recupererProfesseurParId,
  recupererProfesseurParMatricule,
  professeurEstDejaAffecte,
}));

const {
  validerIdProfesseur,
  verifierProfesseurExiste,
  validerCreateProfesseur,
  validerUpdateProfesseur,
  validerDeleteProfesseur,
} = await import("../src/validations/professeurs.validation.js");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("validations professeurs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("validerIdProfesseur refuse un id invalide", () => {
    const req = { params: { id: "abc" } };
    const res = createResponse();
    const next = jest.fn();

    validerIdProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("verifierProfesseurExiste retourne 404 si absent", async () => {
    recupererProfesseurParId.mockResolvedValue(null);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await verifierProfesseurExiste(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("validerCreateProfesseur refuse matricule vide", async () => {
    const req = { body: { matricule: "", nom: "Ali", prenom: "Test" } };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateProfesseur refuse nom invalide", async () => {
    const req = { body: { matricule: "P001", nom: "123", prenom: "Test" } };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateProfesseur refuse prénom invalide", async () => {
    const req = { body: { matricule: "P001", nom: "Ali", prenom: "123" } };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateProfesseur refuse matricule déjà utilisé", async () => {
    recupererProfesseurParMatricule.mockResolvedValue({ id_professeur: 3 });
    const req = { body: { matricule: "P001", nom: "Ali", prenom: "Test" } };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("validerCreateProfesseur accepte des données valides", async () => {
    recupererProfesseurParMatricule.mockResolvedValue(null);
    const req = { body: { matricule: "P001", nom: "Ali", prenom: "Test", specialite: "Web" } };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateProfesseur(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("validerUpdateProfesseur refuse aucun champ", async () => {
    const req = { params: { id: "1" }, body: {} };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerUpdateProfesseur refuse matricule dupliqué", async () => {
    recupererProfesseurParMatricule.mockResolvedValue({ id_professeur: 2 });
    const req = { params: { id: "1" }, body: { matricule: "P002" } };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("validerUpdateProfesseur accepte une modification valide", async () => {
    recupererProfesseurParMatricule.mockResolvedValue(null);
    const req = { params: { id: "1" }, body: { specialite: "Java" } };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateProfesseur(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("validerDeleteProfesseur refuse si déjà affecté", async () => {
    professeurEstDejaAffecte.mockResolvedValue(true);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await validerDeleteProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerDeleteProfesseur accepte si non affecté", async () => {
    professeurEstDejaAffecte.mockResolvedValue(false);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await validerDeleteProfesseur(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});