/**
 * TESTS - Configuration Auth
 *
 * Ce fichier couvre la configuration Passport
 * et la resolution des utilisateurs.
 */
import { jest, describe, test, expect } from "@jest/globals";

const compareMock = jest.fn();
const findByEmailMock = jest.fn();
const findByIdMock = jest.fn();
const findRolesByUserIdMock = jest.fn();

let verifyCallback;
let serializeCallback;
let deserializeCallback;

// mock bcrypt
jest.unstable_mockModule("bcrypt", () => ({
  default: {
    compare: compareMock,
  },
}));

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

// ⚠️ IMPORTANT : importer APRÈS les mocks
await import("../auth.js");

describe("auth.js (passport config)", () => {
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
    compareMock.mockResolvedValue(false);

    const done = jest.fn();

    await verifyCallback("test@mail.com", "123", done);

    expect(done).toHaveBeenCalledWith(null, false, { error: "wrong_password" });
  });

  test("login OK si mot de passe valide", async () => {
    const user = { id: 1, mot_de_passe_hash: "hash" };

    findByEmailMock.mockResolvedValue(user);
    compareMock.mockResolvedValue(true);

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
