import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

const utilisateurModel = await import("../src/model/utilisateur.js");

describe("model utilisateur", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("findByEmail retourne un utilisateur", async () => {
    queryMock.mockResolvedValue([
      [
        {
          id: 1,
          email: "admin@ecole.ca",
          mot_de_passe_hash: "hash",
          nom: "Admin",
          prenom: "Systeme",
          actif: 1,
          role: "ADMIN",
        },
      ],
    ]);

    const result = await utilisateurModel.findByEmail("admin@ecole.ca");

    expect(result.id).toBe(1);
    expect(result.email).toBe("admin@ecole.ca");
    expect(result.role).toBe("ADMIN");
  });

  test("findByEmail retourne null si absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await utilisateurModel.findByEmail("x@x.com");

    expect(result).toBeNull();
  });

  test("findById retourne un utilisateur", async () => {
    queryMock.mockResolvedValue([
      [
        {
          id: 1,
          email: "admin@ecole.ca",
          nom: "Admin",
          prenom: "Systeme",
          actif: 1,
          role: "ADMIN",
        },
      ],
    ]);

    const result = await utilisateurModel.findById(1);

    expect(result.id).toBe(1);
    expect(result.email).toBe("admin@ecole.ca");
  });

  test("findById retourne null si absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await utilisateurModel.findById(999);

    expect(result).toBeNull();
  });

  test("findRolesByUserId retourne un tableau avec le rôle", async () => {
    queryMock.mockResolvedValue([
      [{ role: "ADMIN" }],
    ]);

    const result = await utilisateurModel.findRolesByUserId(1);

    expect(result).toEqual(["ADMIN"]);
  });

  test("findRolesByUserId retourne [] si aucun rôle", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await utilisateurModel.findRolesByUserId(1);

    expect(result).toEqual([]);
  });

  test("findRolesByUserId retourne [] si rôle vide", async () => {
    queryMock.mockResolvedValue([
      [{ role: null }],
    ]);

    const result = await utilisateurModel.findRolesByUserId(1);

    expect(result).toEqual([]);
  });
});