import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const getSalleByCode = jest.fn();
const getSalleById = jest.fn();
const salleEstDejaAffectee = jest.fn();

await jest.unstable_mockModule("../src/model/salle.js", () => ({
  getSalleByCode,
  getSalleById,
  salleEstDejaAffectee,
}));

const {
  capaciteSalleIsValide,
  codeSalleIsValide,
  typeSalleIsValide,
  validerCreateSalle,
  validerDeleteSalle,
  validerIdSalle,
  validerUpdateSalle,
  verifierSalleExiste,
} = await import("../src/validations/salles.validation.js");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("validations salles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("valide le code de salle present", () => {
    const req = { body: { code: "A101" } };
    const res = createResponse();
    const next = jest.fn();

    codeSalleIsValide(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("refuse le code de salle absent", () => {
    const req = { body: { code: "   " } };
    const res = createResponse();
    const next = jest.fn();

    codeSalleIsValide(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Code de salle invalide." });
  });

  it("valide le type de salle present", () => {
    const req = { body: { type: "Laboratoire informatique" } };
    const res = createResponse();
    const next = jest.fn();

    typeSalleIsValide(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("refuse le type de salle absent", () => {
    const req = { body: { type: "" } };
    const res = createResponse();
    const next = jest.fn();

    typeSalleIsValide(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Type de salle invalide." });
  });

  it("valide une capacite positive entiere", () => {
    const req = { body: { capacite: 24 } };
    const res = createResponse();
    const next = jest.fn();

    capaciteSalleIsValide(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("refuse une capacite invalide", () => {
    const req = { body: { capacite: -1 } };
    const res = createResponse();
    const next = jest.fn();

    capaciteSalleIsValide(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Capacite de salle invalide.",
    });
  });

  it("valide un identifiant de salle positif", () => {
    const req = { params: { id: "2" } };
    const res = createResponse();
    const next = jest.fn();

    validerIdSalle(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("refuse un identifiant de salle invalide", () => {
    const req = { params: { id: "abc" } };
    const res = createResponse();
    const next = jest.fn();

    validerIdSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Identifiant invalide." });
  });

  it("attache la salle sur la requete si elle existe", async () => {
    getSalleById.mockResolvedValue({ id_salle: 1, code: "A101" });
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await verifierSalleExiste(req, res, next);

    expect(req.salle).toEqual({ id_salle: 1, code: "A101" });
    expect(next).toHaveBeenCalled();
  });

  it("retourne 404 si la salle est introuvable", async () => {
    getSalleById.mockResolvedValue(null);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await verifierSalleExiste(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Salle introuvable." });
  });

  it("refuse la creation sans code", async () => {
    const req = { body: { code: "", type: "Salle standard", capacite: 20 } };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Code obligatoire." });
  });

  it("refuse la creation sans type", async () => {
    const req = { body: { code: "A101", type: "", capacite: 20 } };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Type obligatoire." });
  });

  it("refuse la creation avec capacite invalide", async () => {
    const req = { body: { code: "A101", type: "Salle standard", capacite: 0 } };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Capacite invalide (> 0)." });
  });

  it("refuse la creation avec depassement du plafond metier", async () => {
    const req = { body: { code: "A101", type: "Salle standard", capacite: 31 } };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Capacite invalide pour ce type de salle (maximum 30).",
    });
  });

  it("refuse la creation si le code existe deja", async () => {
    getSalleByCode.mockResolvedValue({ id_salle: 8 });
    const req = {
      body: { code: "A101", type: "Salle standard", capacite: 20 },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Code deja utilise." });
  });

  it("normalise le type et accepte une creation valide", async () => {
    getSalleByCode.mockResolvedValue(null);
    const req = {
      body: { code: "A101", type: " laboratoire informatique ", capacite: 20 },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateSalle(req, res, next);

    expect(req.body.type).toBe("Laboratoire informatique");
    expect(next).toHaveBeenCalled();
  });

  it("refuse la mise a jour si aucun champ n'est fourni", async () => {
    const req = { body: {}, salle: { type: "Salle standard", capacite: 20 } };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Aucun champ a modifier." });
  });

  it("refuse la mise a jour avec type vide", async () => {
    const req = { body: { type: " " }, salle: { type: "Salle standard", capacite: 20 } };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Type invalide." });
  });

  it("refuse la mise a jour avec capacite numerique invalide", async () => {
    const req = {
      body: { capacite: "abc" },
      salle: { type: "Salle standard", capacite: 20 },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Capacite invalide (> 0)." });
  });

  it("refuse la mise a jour si le nouveau couple type/capacite depasse le plafond", async () => {
    const req = {
      body: { type: "Salle standard", capacite: 35 },
      salle: { type: "Salle standard", capacite: 20 },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Capacite invalide pour ce type de salle (maximum 30).",
    });
  });

  it("valide une mise a jour partielle en reutilisant la salle courante", async () => {
    const req = {
      body: { capacite: 25 },
      salle: { type: "Salle standard", capacite: 20 },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateSalle(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("normalise le type sur une mise a jour valide", async () => {
    const req = {
      body: { type: "amphitheatre", capacite: 40 },
      salle: { type: "Salle standard", capacite: 20 },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateSalle(req, res, next);

    expect(req.body.type).toBe("Amphitheatre");
    expect(next).toHaveBeenCalled();
  });

  it("refuse la suppression si la salle est affectee", async () => {
    salleEstDejaAffectee.mockResolvedValue(true);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await validerDeleteSalle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Suppression impossible : salle deja affectee.",
    });
  });

  it("autorise la suppression si la salle n'est pas affectee", async () => {
    salleEstDejaAffectee.mockResolvedValue(false);
    const req = { params: { id: "1" } };
    const res = createResponse();
    const next = jest.fn();

    await validerDeleteSalle(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
