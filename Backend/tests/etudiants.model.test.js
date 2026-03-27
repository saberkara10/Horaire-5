import { jest, describe, test, expect, beforeEach } from "@jest/globals";

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

  test("recupererEtudiantParId retourne un étudiant", async () => {
    queryMock.mockResolvedValue([
      [{ id_etudiant: 1, groupe: "INF2025-A" }],
    ]);

    const result = await etudiantsModel.recupererEtudiantParId(1);

    expect(result.id_etudiant).toBe(1);
  });

  test("recupererEtudiantParId retourne null si absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await etudiantsModel.recupererEtudiantParId(999);

    expect(result).toBeNull();
  });

  test("recupererHoraireParGroupe retourne les séances", async () => {
    queryMock.mockResolvedValue([
      [{ id_affectation_cours: 1, code_cours: "INF101" }],
    ]);

    const result = await etudiantsModel.recupererHoraireParGroupe("INF2025-A");

    expect(result).toHaveLength(1);
    expect(result[0].code_cours).toBe("INF101");
  });

  test("recupererTousLesEtudiants retourne la liste", async () => {
    queryMock.mockResolvedValue([
      [{ id_etudiant: 1, matricule: "E001" }],
    ]);

    const result = await etudiantsModel.recupererTousLesEtudiants();

    expect(result).toHaveLength(1);
    expect(result[0].matricule).toBe("E001");
  });

  test("recupererHoraireCompletEtudiant retourne null si étudiant absent", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    const result = await etudiantsModel.recupererHoraireCompletEtudiant(999);

    expect(result).toBeNull();
  });

  test("recupererHoraireCompletEtudiant retourne étudiant + horaire", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id_etudiant: 1, groupe: "INF2025-A" }]])
      .mockResolvedValueOnce([[{ id_affectation_cours: 10 }]]);

    const result = await etudiantsModel.recupererHoraireCompletEtudiant(1);

    expect(result.etudiant.id_etudiant).toBe(1);
    expect(result.horaire).toHaveLength(1);
  });

  test("matriculeExiste retourne true si le matricule existe", async () => {
    queryMock.mockResolvedValue([[{ count: 1 }]]);

    const result = await etudiantsModel.matriculeExiste("E001");

    expect(result).toBe(true);
  });

  test("matriculeExiste retourne false si le matricule n'existe pas", async () => {
    queryMock.mockResolvedValue([[{ count: 0 }]]);

    const result = await etudiantsModel.matriculeExiste("E001");

    expect(result).toBe(false);
  });

  test("recupererOuCreerGroupe retourne l'id existant si groupe trouvé", async () => {
    queryMock.mockResolvedValueOnce([[{ id_groupes_etudiants: 3 }]]);

    const result = await etudiantsModel.recupererOuCreerGroupe("INF2025-A");

    expect(result).toBe(3);
  });

  test("recupererOuCreerGroupe crée le groupe si absent", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 8 }]);

    const result = await etudiantsModel.recupererOuCreerGroupe("INF2025-B");

    expect(result).toBe(8);
  });

  test("importerEtudiants refuse des données invalides avant transaction", async () => {
    const result = await etudiantsModel.importerEtudiants([
      {
        matricule: "",
        nom: "Ali",
        prenom: "Test",
        groupe: "G1",
        programme: "INF",
        etape: 1,
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
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 7 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    getConnectionMock.mockResolvedValue(connection);

    const result = await etudiantsModel.importerEtudiants([
      {
        matricule: "E001",
        nom: "Ali",
        prenom: "Test",
        groupe: "G1",
        programme: "INF",
        etape: 1,
      },
    ]);

    expect(result.succes).toBe(true);
    expect(result.nombreImportes).toBe(1);
    expect(connection.commit).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test("importerEtudiants rollback si matricule déjà utilisé pendant transaction", async () => {
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
        groupe: "G1",
        programme: "INF",
        etape: 1,
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
          groupe: "G1",
          programme: "INF",
          etape: 1,
        },
      ])
    ).rejects.toThrow("DB error");

    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
});