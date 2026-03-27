import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();
const getConnectionMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
    getConnection: getConnectionMock,
  },
}));

const affectationsModel = await import("../src/model/affectations.model.js");

describe("Model affectations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("recupererToutesLesAffectations retourne la liste", async () => {
    queryMock.mockResolvedValue([
      [{ id_affectation_cours: 1, code_cours: "INF101" }],
    ]);

    const result = await affectationsModel.recupererToutesLesAffectations();

    expect(result).toHaveLength(1);
    expect(result[0].code_cours).toBe("INF101");
  });

  test("creerAffectation commit et retourne id_affectation_cours", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    connection.query
      .mockResolvedValueOnce([{ insertId: 10 }])
      .mockResolvedValueOnce([{ insertId: 20 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    getConnectionMock.mockResolvedValue(connection);

    const result = await affectationsModel.creerAffectation({
      id_cours: 1,
      id_professeur: 1,
      id_salle: 1,
      date: "2026-03-26",
      heure_debut: "08:00",
      heure_fin: "11:00",
      id_groupes: [1, 2],
    });

    expect(result.id_affectation_cours).toBe(20);
    expect(connection.commit).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test("creerAffectation rollback si erreur", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    connection.query.mockRejectedValue(new Error("DB error"));
    getConnectionMock.mockResolvedValue(connection);

    await expect(
      affectationsModel.creerAffectation({
        id_cours: 1,
        id_professeur: 1,
        id_salle: 1,
        date: "2026-03-26",
        heure_debut: "08:00",
        heure_fin: "11:00",
        id_groupes: [1],
      })
    ).rejects.toThrow("DB error");

    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test("supprimerAffectation commit si affectation trouvée", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    connection.query
      .mockResolvedValueOnce([[{ id_plage_horaires: 99 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    getConnectionMock.mockResolvedValue(connection);

    await affectationsModel.supprimerAffectation(1);

    expect(connection.commit).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test("supprimerAffectation rollback si introuvable", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    connection.query.mockResolvedValueOnce([[]]);
    getConnectionMock.mockResolvedValue(connection);

    await expect(affectationsModel.supprimerAffectation(999)).rejects.toThrow(
      "Affectation introuvable."
    );

    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
});