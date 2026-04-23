/**
 * TESTS - Configuration Auth
 *
 * Ce fichier couvre la configuration Passport
 * et la resolution des utilisateurs.
 */
import { jest, describe, test, expect } from "@jest/globals";

const verifyPasswordMock = jest.fn();
const hashPasswordMock = jest.fn();
const isBcryptHashMock = jest.fn();
const findByEmailMock = jest.fn();
const findByIdMock = jest.fn();
const findRolesByUserIdMock = jest.fn();
const poolQueryMock = jest.fn();

let verifyCallback;
let serializeCallback;
let deserializeCallback;

// mock passport
jest.unstable_mockModule("passport", () => ({
  default: {
    use: (strategy) => {
      verifyCallback = strategy._verify;
    },
    serializeUser: (fn) => {
      serializeCallback = fn;
    },
    deserializeUser: (fn) => {
      deserializeCallback = fn;
    },
  },
}));

// mock passport-local
jest.unstable_mockModule("passport-local", () => ({
  Strategy: class {
    constructor(config, verify) {
      this._verify = verify;
    }
  },
}));

// mock model utilisateur
jest.unstable_mockModule("../src/model/utilisateur.js", () => ({
  findByEmail: findByEmailMock,
  findById: findByIdMock,
  findRolesByUserId: findRolesByUserIdMock,
}));

jest.unstable_mockModule("../src/utils/passwords.js", () => ({
  hashPassword: hashPasswordMock,
  isBcryptHash: isBcryptHashMock,
  verifyPassword: verifyPasswordMock,
}));

jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: poolQueryMock,
  },
}));

// ⚠️ IMPORTANT : importer APRÈS les mocks
await import("../auth.js");

describe("auth.js (passport config)", () => {
  test("login OK si mot de passe legacy en clair puis migre en hash", async () => {
    const user = { id: 7, mot_de_passe_hash: "Resp123!" };

    findByEmailMock.mockResolvedValue(user);
    verifyPasswordMock.mockResolvedValue(false);
    isBcryptHashMock.mockReturnValue(false);
    hashPasswordMock.mockResolvedValue("hash-migre");
    poolQueryMock
      .mockRejectedValueOnce({ code: "ER_BAD_FIELD_ERROR" })
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const done = jest.fn();

    await verifyCallback("responsable@ecole.ca", "Resp123!", done);

    expect(hashPasswordMock).toHaveBeenCalledWith("Resp123!");
    expect(poolQueryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET motdepasse = ?"),
      ["hash-migre", 7]
    );
    expect(user.mot_de_passe_hash).toBe("hash-migre");
    expect(done).toHaveBeenCalledWith(null, user);
  });

  test("wrong_user si utilisateur inexistant", async () => {
    findByEmailMock.mockResolvedValue(null);
    const done = jest.fn();

    await verifyCallback("test@mail.com", "123", done);

    expect(done).toHaveBeenCalledWith(null, false, { error: "wrong_user" });
  });

  test("wrong_password si mot de passe incorrect", async () => {
    findByEmailMock.mockResolvedValue({
      id: 1,
      mot_de_passe_hash: "hash",
    });
    verifyPasswordMock.mockResolvedValue(false);

    const done = jest.fn();

    await verifyCallback("test@mail.com", "123", done);

    expect(done).toHaveBeenCalledWith(null, false, { error: "wrong_password" });
  });

  test("login OK si mot de passe valide", async () => {
    const user = { id: 1, mot_de_passe_hash: "hash" };

    findByEmailMock.mockResolvedValue(user);
    verifyPasswordMock.mockResolvedValue(true);

    const done = jest.fn();

    await verifyCallback("test@mail.com", "123", done);

    expect(done).toHaveBeenCalledWith(null, user);
  });

  test("erreur si exception", async () => {
    const error = new Error("DB error");
    findByEmailMock.mockRejectedValue(error);

    const done = jest.fn();

    await verifyCallback("test@mail.com", "123", done);

    expect(done).toHaveBeenCalledWith(error);
  });

  test("serializeUser fonctionne", () => {
    const done = jest.fn();

    serializeCallback({ id: 5 }, done);

    expect(done).toHaveBeenCalledWith(null, 5);
  });

  test("deserializeUser avec roles", async () => {
    const done = jest.fn();

    findByIdMock.mockResolvedValue({ id: 1 });
    findRolesByUserIdMock.mockResolvedValue(["ADMIN"]);

    await deserializeCallback(1, done);

    expect(done).toHaveBeenCalledWith(null, {
      id: 1,
      roles: ["ADMIN"],
    });
  });

  test("deserializeUser null", async () => {
    const done = jest.fn();

    findByIdMock.mockResolvedValue(null);

    await deserializeCallback(1, done);

    expect(done).toHaveBeenCalledWith(null, null);
  });

  test("deserializeUser erreur", async () => {
    const done = jest.fn();
    const error = new Error("fail");

    findByIdMock.mockRejectedValue(error);

    await deserializeCallback(1, done);

    expect(done).toHaveBeenCalledWith(error);
  });
});
/**
 * TESTS - Configuration Auth
 *
 * Ce fichier couvre la configuration Passport
 * et la resolution des utilisateurs.
 */
