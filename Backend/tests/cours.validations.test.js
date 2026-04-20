/**
 * TESTS - Validations Cours
 *
 * Ce fichier couvre les validations
 * appliquees aux donnees de cours.
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const recupererCoursParId = jest.fn();
const recupererCoursParCode = jest.fn();
const coursEstDejaAffecte = jest.fn();
const salleExisteParId = jest.fn();

jest.unstable_mockModule("../src/model/cours.model.js", () => ({
  DUREE_COURS_FIXE: 3,
  MODES_COURS: ["Presentiel", "En ligne"],
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
        mode_cours: "Presentiel",
        programme: "Programmation informatique",
        etape_etude: 1,
        type_salle: "Laboratoire informatique",
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
        mode_cours: "Presentiel",
        programme: "Programmation informatique",
        etape_etude: 1,
        type_salle: "Laboratoire informatique",
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateCours refuse un mode de cours manquant", async () => {
    const req = {
      body: {
        code: "INF101",
        nom: "Algo",
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
        mode_cours: "Presentiel",
        programme: "Programmation informatique",
        etape_etude: 1,
        type_salle: "Laboratoire informatique",
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
        mode_cours: "Presentiel",
        programme: "Programmation informatique",
        etape_etude: 1,
        type_salle: "Laboratoire informatique",
        id_salle_reference: 99,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerCreateCours accepte des donnees presencielles valides", async () => {
    recupererCoursParCode.mockResolvedValue(null);
    salleExisteParId.mockResolvedValue(true);
    const req = {
      body: {
        code: "INF101",
        nom: "Algo",
        mode_cours: "Presentiel",
        programme: "Programmation informatique",
        etape_etude: 1,
        type_salle: "Laboratoire informatique",
        id_salle_reference: 4,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.duree).toBe(3);
  });

  it("validerCreateCours accepte un cours en ligne sans salle", async () => {
    recupererCoursParCode.mockResolvedValue(null);
    const req = {
      body: {
        code: "LAN101",
        nom: "Langues",
        mode_cours: "En ligne",
        programme: "Programmation informatique",
        etape_etude: 1,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.type_salle).toBeNull();
    expect(req.body.id_salle_reference).toBeNull();
    expect(req.body.duree).toBe(3);
  });

  it("validerCreateCours neutralise les champs de salle pour un cours en ligne", async () => {
    recupererCoursParCode.mockResolvedValue(null);
    const req = {
      body: {
        code: "LAN101",
        nom: "Langues",
        mode_cours: "En ligne",
        programme: "Programmation informatique",
        etape_etude: 1,
        type_salle: "Salle standard",
        id_salle_reference: 2,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerCreateCours(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.type_salle).toBeNull();
    expect(req.body.id_salle_reference).toBeNull();
  });

  it("validerUpdateCours neutralise les champs de salle si le cours passe en ligne", async () => {
    const req = {
      params: { id: "1" },
      cours: {
        id_cours: 1,
        mode_cours: "Presentiel",
        type_salle: "Salle standard",
        id_salle_reference: 4,
      },
      body: {
        mode_cours: "En ligne",
        type_salle: "Salle standard",
        id_salle_reference: 4,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateCours(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.type_salle).toBeNull();
    expect(req.body.id_salle_reference).toBeNull();
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
    const req = {
      params: { id: "1" },
      cours: { id_cours: 1, mode_cours: "Presentiel" },
      body: { id_salle_reference: 12 },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateCours(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("validerUpdateCours accepte une modification valide", async () => {
    recupererCoursParCode.mockResolvedValue(null);
    const req = {
      params: { id: "1" },
      cours: { id_cours: 1, mode_cours: "Presentiel", type_salle: "Salle standard" },
      body: { nom: "Nouveau nom" },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateCours(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("validerUpdateCours autorise de retirer la salle de reference", async () => {
    const req = {
      params: { id: "1" },
      cours: {
        id_cours: 1,
        mode_cours: "Presentiel",
        type_salle: "Salle standard",
        id_salle_reference: 4,
      },
      body: { id_salle_reference: null },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateCours(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("validerUpdateCours autorise un passage en ligne", async () => {
    const req = {
      params: { id: "1" },
      cours: {
        id_cours: 1,
        mode_cours: "Presentiel",
        type_salle: "Salle standard",
        id_salle_reference: 4,
      },
      body: { mode_cours: "En ligne" },
    };
    const res = createResponse();
    const next = jest.fn();

    await validerUpdateCours(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.type_salle).toBeNull();
    expect(req.body.id_salle_reference).toBeNull();
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
