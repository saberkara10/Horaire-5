/**
 * TESTS - Modele Utilisateur
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des utilisateurs.
 */
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();
const hashMock = jest.fn();
const connectionQueryMock = jest.fn();
const connectionMock = {
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
  query: connectionQueryMock,
};

await jest.unstable_mockModule("bcrypt", () => ({
  default: {
    hash: hashMock,
  },
}));

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
    getConnection: jest.fn().mockResolvedValue(connectionMock),
  },
}));

const utilisateurModel = await import("../src/model/utilisateur.js");

describe("model utilisateur", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hashMock.mockResolvedValue("hash-securise");
    connectionMock.beginTransaction.mockResolvedValue(undefined);
    connectionMock.commit.mockResolvedValue(undefined);
    connectionMock.rollback.mockResolvedValue(undefined);
    connectionMock.release.mockResolvedValue(undefined);
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

  test("findByEmail relance les erreurs non liees au schema", async () => {
    queryMock.mockRejectedValue(new Error("DB down"));

    await expect(utilisateurModel.findByEmail("admin@ecole.ca")).rejects.toThrow(
      "DB down"
    );
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

  test("findRolesByUserId retourne un tableau de roles uniques nettoyes", async () => {
    queryMock.mockResolvedValue([
      [{ code: " ADMIN " }, { code: "RESPONSABLE" }, { code: "ADMIN" }],
    ]);

    const result = await utilisateurModel.findRolesByUserId(1);

    expect(result).toEqual(["ADMIN", "RESPONSABLE"]);
  });

  test("findRolesByUserId retourne [] si aucun role", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await utilisateurModel.findRolesByUserId(1);

    expect(result).toEqual([]);
  });

  test("findRolesByUserId retourne [] si role vide", async () => {
    queryMock.mockResolvedValue([[{ role: null }]]);

    const result = await utilisateurModel.findRolesByUserId(1);

    expect(result).toEqual([]);
  });

  test("findByEmail utilise le fallback legacy si le schema moderne manque", async () => {
    queryMock
      .mockRejectedValueOnce({ code: "ER_BAD_FIELD_ERROR" })
      .mockResolvedValueOnce([
        [
          {
            id: 1,
            email: "admin@ecole.ca",
            mot_de_passe_hash: "Admin123!",
            nom: "Admin",
            prenom: "Systeme",
            actif: 1,
            role: "ADMIN",
          },
        ],
      ]);

    const result = await utilisateurModel.findByEmail("admin@ecole.ca");

    expect(result).toEqual({
      id: 1,
      email: "admin@ecole.ca",
      mot_de_passe_hash: "Admin123!",
      nom: "Admin",
      prenom: "Systeme",
      actif: 1,
      role: "ADMIN",
    });
  });

  test("findById utilise le fallback legacy si le schema moderne manque", async () => {
    queryMock
      .mockRejectedValueOnce({ code: "ER_BAD_FIELD_ERROR" })
      .mockResolvedValueOnce([
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

    expect(result).toEqual({
      id: 1,
      email: "admin@ecole.ca",
      nom: "Admin",
      prenom: "Systeme",
      actif: 1,
      role: "ADMIN",
    });
  });

  test("findRolesByUserId utilise le fallback legacy si les tables roles manquent", async () => {
    queryMock
      .mockRejectedValueOnce({ code: "ER_NO_SUCH_TABLE" })
      .mockResolvedValueOnce([[{ role: "ADMIN" }]]);

    const result = await utilisateurModel.findRolesByUserId(1);

    expect(result).toEqual(["ADMIN"]);
  });

  test("recupererSousAdmins retourne la liste schema moderne", async () => {
    queryMock.mockResolvedValueOnce([[{ id: 2, email: "admin2@ecole.ca", role: "ADMIN" }]]);

    const result = await utilisateurModel.recupererSousAdmins();

    expect(result).toHaveLength(1);
    expect(queryMock.mock.calls[0][1]).toEqual(["ADMIN"]);
  });

  test("recupererSousAdmins utilise le fallback legacy", async () => {
    queryMock
      .mockRejectedValueOnce({ code: "ER_BAD_TABLE_ERROR" })
      .mockResolvedValueOnce([[{ id: 2, email: "admin2@ecole.ca", role: "ADMIN" }]]);

    const result = await utilisateurModel.recupererSousAdmins();

    expect(result[0].role).toBe("ADMIN");
  });

  test("recupererSousAdminParId retourne le sous-admin schema moderne", async () => {
    queryMock.mockResolvedValueOnce([[{ id: 4, email: "a@ecole.ca", role: "ADMIN" }]]);

    const result = await utilisateurModel.recupererSousAdminParId(4);

    expect(result).toEqual({ id: 4, email: "a@ecole.ca", role: "ADMIN" });
  });

  test("recupererSousAdminParId utilise le fallback legacy", async () => {
    queryMock
      .mockRejectedValueOnce({ code: "ER_NO_SUCH_TABLE" })
      .mockResolvedValueOnce([[{ id: 4, email: "a@ecole.ca", role: "ADMIN" }]]);

    const result = await utilisateurModel.recupererSousAdminParId(4);

    expect(result).toEqual({ id: 4, email: "a@ecole.ca", role: "ADMIN" });
  });

  test("creerSousAdmin cree un compte avec le schema moderne", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 8, email: "new@ecole.ca", role: "ADMIN" }]]);

    const result = await utilisateurModel.creerSousAdmin({
      nom: "Nouveau",
      prenom: "Admin",
      email: " NEW@ECOLE.CA ",
      password: "Test123!",
    });

    expect(hashMock).toHaveBeenCalledWith("Test123!", 10);
    expect(connectionMock.beginTransaction).toHaveBeenCalled();
    expect(connectionMock.commit).toHaveBeenCalled();
    expect(result).toEqual({ id: 8, email: "new@ecole.ca", role: "ADMIN" });
  });

  test("creerSousAdmin rollback si role ADMIN introuvable", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockResolvedValueOnce([[]]);

    await expect(
      utilisateurModel.creerSousAdmin({
        nom: "Nouveau",
        prenom: "Admin",
        email: "new@ecole.ca",
        password: "Test123!",
      })
    ).rejects.toThrow("Role ADMIN introuvable.");

    expect(connectionMock.rollback).toHaveBeenCalled();
  });

  test("creerSousAdmin utilise le fallback legacy si schema moderne indisponible", async () => {
    queryMock
      .mockResolvedValueOnce([{ insertId: 9 }])
      .mockResolvedValueOnce([[{ id: 9, email: "legacy@ecole.ca", role: "ADMIN" }]]);
    connectionMock.beginTransaction.mockRejectedValueOnce({ code: "ER_BAD_FIELD_ERROR" });

    const result = await utilisateurModel.creerSousAdmin({
      nom: "Legacy",
      prenom: "Admin",
      email: "legacy@ecole.ca",
      password: "Test123!",
    });

    expect(result).toEqual({ id: 9, email: "legacy@ecole.ca", role: "ADMIN" });
  });

  test("mettreAJourSousAdmin retourne null si absent sur schema moderne", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    const result = await utilisateurModel.mettreAJourSousAdmin(15, {
      nom: "A",
      prenom: "B",
      email: "a@b.ca",
      password: "",
    });

    expect(result).toBeNull();
  });

  test("mettreAJourSousAdmin met a jour sans mot de passe sur schema moderne", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id: 5, email: "old@ecole.ca", role: "ADMIN" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 5, email: "new@ecole.ca", role: "ADMIN", nom: "Nom" }]]);

    const result = await utilisateurModel.mettreAJourSousAdmin(5, {
      nom: "Nom",
      prenom: "Prenom",
      email: " NEW@ECOLE.CA ",
      password: "   ",
    });

    expect(hashMock).not.toHaveBeenCalled();
    expect(result.email).toBe("new@ecole.ca");
  });

  test("mettreAJourSousAdmin met a jour avec mot de passe sur fallback legacy", async () => {
    queryMock
      .mockRejectedValueOnce({ code: "ER_BAD_FIELD_ERROR" })
      .mockResolvedValueOnce([[{ id: 6, email: "old@ecole.ca", role: "ADMIN" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 6, email: "legacy@ecole.ca", role: "ADMIN" }]]);

    const result = await utilisateurModel.mettreAJourSousAdmin(6, {
      nom: "Nom",
      prenom: "Prenom",
      email: "legacy@ecole.ca",
      password: "Secret123!",
    });

    expect(hashMock).toHaveBeenCalledWith("Secret123!", 10);
    expect(result.email).toBe("legacy@ecole.ca");
  });

  test("supprimerSousAdmin supprime en schema moderne", async () => {
    queryMock.mockResolvedValueOnce([[{ id: 7, email: "a@ecole.ca", role: "ADMIN" }]]);
    connectionQueryMock
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await utilisateurModel.supprimerSousAdmin(7);

    expect(result).toBe(true);
    expect(connectionMock.commit).toHaveBeenCalled();
  });

  test("supprimerSousAdmin retourne false si absent en schema moderne", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    const result = await utilisateurModel.supprimerSousAdmin(7);

    expect(result).toBe(false);
  });

  test("supprimerSousAdmin utilise le fallback legacy", async () => {
    queryMock
      .mockRejectedValueOnce({ code: "ER_BAD_FIELD_ERROR" })
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await utilisateurModel.supprimerSousAdmin(7);

    expect(result).toBe(true);
  });
});
