/**
 * TESTS - Modele Etudiants
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des etudiants.
 */
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const queryMock = jest.fn();
const getConnectionMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
    getConnection: getConnectionMock,
  },
}));

const etudiantsModel = await import("../src/model/etudiants.model.js");

describe("Model etudiants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("recupererEtudiantParId retourne un etudiant", async () => {
    queryMock.mockResolvedValue([[{ id_etudiant: 1, groupe: "INF - E1 - G1" }]]);

    const result = await etudiantsModel.recupererEtudiantParId(1);

    expect(result.id_etudiant).toBe(1);
  });

  test("recupererEtudiantParId retourne null si absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await etudiantsModel.recupererEtudiantParId(999);

    expect(result).toBeNull();
  });

  test("recupererTousLesEtudiants retourne la liste", async () => {
    queryMock.mockResolvedValue([[{ id_etudiant: 1, matricule: "E001" }]]);

    const result = await etudiantsModel.recupererTousLesEtudiants();

    expect(result).toHaveLength(1);
    expect(result[0].matricule).toBe("E001");
  });

  test("matriculeExiste retourne true si le matricule existe", async () => {
    queryMock.mockResolvedValue([[{ count: 1 }]]);

    const result = await etudiantsModel.matriculeExiste("E001");

    expect(result).toBe(true);
  });

  test("matriculeExiste retourne false si le matricule n'existe pas", async () => {
    queryMock.mockResolvedValue([[{ count: 0 }]]);

    const result = await etudiantsModel.matriculeExiste("E009");

    expect(result).toBe(false);
  });

  test("importerEtudiants refuse des donnees invalides avant transaction", async () => {
    const result = await etudiantsModel.importerEtudiants([
      {
        matricule: "",
        nom: "Ali",
        prenom: "Test",
        programme: "INF",
        etape: 1,
        session: "Automne",
        annee: 2026,
      },
    ]);

    expect(result.succes).toBe(false);
    expect(result.message).toBe("Import impossible.");
    expect(getConnectionMock).not.toHaveBeenCalled();
  });

  test("importerEtudiants retourne succes true si import complet", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    connection.query
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 7 }]);

    getConnectionMock.mockResolvedValue(connection);

    const result = await etudiantsModel.importerEtudiants([
      {
        matricule: "E001",
        nom: "Ali",
        prenom: "Test",
        programme: "INF",
        etape: 1,
        session: "Automne",
        annee: 2026,
      },
    ]);

    expect(result.succes).toBe(true);
    expect(result.nombreImportes).toBe(1);
    expect(connection.commit).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test("importerEtudiants rollback si matricule deja utilise pendant transaction", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    connection.query.mockResolvedValueOnce([[{ count: 1 }]]);
    getConnectionMock.mockResolvedValue(connection);

    const result = await etudiantsModel.importerEtudiants([
      {
        matricule: "E001",
        nom: "Ali",
        prenom: "Test",
        programme: "INF",
        etape: 1,
        session: "Automne",
        annee: 2026,
      },
    ]);

    expect(result.succes).toBe(false);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test("importerEtudiants rollback et relance si erreur SQL", async () => {
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
      etudiantsModel.importerEtudiants([
        {
          matricule: "E001",
          nom: "Ali",
          prenom: "Test",
          programme: "INF",
          etape: 1,
          session: "Automne",
          annee: 2026,
        },
      ])
    ).rejects.toThrow("DB error");

    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
});
