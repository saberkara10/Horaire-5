/**
 * TESTS - Validations Professeurs
 *
 * Ce fichier couvre les validations
 * appliquees aux donnees des professeurs.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const recupererProfesseurParId = jest.fn();
const recupererProfesseurParNomPrenom = jest.fn();
const recupererProfesseurParMatricule = jest.fn();
const professeurEstDejaAffecte = jest.fn();
const validerContrainteCoursProfesseur = jest.fn();

jest.unstable_mockModule("../src/model/professeurs.model.js", () => ({
  recupererProfesseurParId,
  recupererProfesseurParNomPrenom,
  recupererProfesseurParMatricule,
  professeurEstDejaAffecte,
  validerContrainteCoursProfesseur,
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
    recupererProfesseurParNomPrenom.mockResolvedValue(null);
    validerContrainteCoursProfesseur.mockResolvedValue("");
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

  it("validerCreateProfesseur refuse prenom invalide", async () => {
    const req = { body: { matricule: "P001", nom: "Ali", prenom: "123" } };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateProfesseur refuse matricule deja utilise", async () => {
    recupererProfesseurParMatricule.mockResolvedValue({ id_professeur: 3 });
    const req = {
      body: {
        matricule: "P001",
        nom: "Ali",
        prenom: "Test",
        specialite: "Programmation informatique",
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("validerCreateProfesseur refuse un nom complet deja utilise", async () => {
    recupererProfesseurParMatricule.mockResolvedValue(null);
    recupererProfesseurParNomPrenom.mockResolvedValue({ id_professeur: 8 });
    const req = {
      body: {
        matricule: "P111",
        nom: "Kara",
        prenom: "Saber",
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("validerCreateProfesseur accepte des donnees valides", async () => {
    recupererProfesseurParMatricule.mockResolvedValue(null);
    const req = {
      body: {
        matricule: "P001",
        nom: "Ali",
        prenom: "Test",
        specialite: "Web",
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateProfesseur(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("validerCreateProfesseur refuse plus de 2 cours dans le meme programme", async () => {
    recupererProfesseurParMatricule.mockResolvedValue(null);
    validerContrainteCoursProfesseur.mockResolvedValue(
      "Un professeur ne peut pas avoir plus de 2 cours dans le meme programme."
    );
    const req = {
      body: {
        matricule: "P050",
        nom: "Kara",
        prenom: "Saber",
        cours_ids: [4, 5, 6],
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateProfesseur accepte un professeur sans specialite", async () => {
    recupererProfesseurParMatricule.mockResolvedValue(null);
    const req = {
      body: { matricule: "P003", nom: "Ali", prenom: "Test", cours_ids: [1, 2] },
    };
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

  it("validerUpdateProfesseur refuse matricule duplique", async () => {
    recupererProfesseurParMatricule.mockResolvedValue({ id_professeur: 2 });
    const req = { params: { id: "1" }, body: { matricule: "P002" } };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("validerUpdateProfesseur accepte une modification valide", async () => {
    recupererProfesseurParMatricule.mockResolvedValue(null);
    const req = {
      params: { id: "1" },
      professeur: { id_professeur: 1, nom: "Ali", prenom: "Test" },
      body: { specialite: "Java" },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateProfesseur(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("validerUpdateProfesseur refuse un nom complet deja utilise par un autre professeur", async () => {
    recupererProfesseurParMatricule.mockResolvedValue(null);
    recupererProfesseurParNomPrenom.mockResolvedValue({ id_professeur: 2 });
    const req = {
      params: { id: "1" },
      professeur: { id_professeur: 1, nom: "Ali", prenom: "Test" },
      body: { nom: "Kara", prenom: "Saber" },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("validerUpdateProfesseur refuse un cours archive", async () => {
    recupererProfesseurParMatricule.mockResolvedValue(null);
    validerContrainteCoursProfesseur.mockResolvedValue(
      "Impossible d'assigner un cours archive a un professeur."
    );
    const req = {
      params: { id: "1" },
      professeur: { id_professeur: 1, nom: "Kara", prenom: "Saber" },
      body: { cours_ids: [7] },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerDeleteProfesseur refuse si deja affecte", async () => {
    professeurEstDejaAffecte.mockResolvedValue(true);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await validerDeleteProfesseur(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerDeleteProfesseur accepte si non affecte", async () => {
    professeurEstDejaAffecte.mockResolvedValue(false);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await validerDeleteProfesseur(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
