import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const compareMock = jest.fn();
const hashMock = jest.fn();

await jest.unstable_mockModule("bcrypt", () => ({
  default: {
    compare: compareMock,
    hash: hashMock,
  },
}));

const { hashPassword, isBcryptHash, verifyPassword } = await import(
  "../src/utils/passwords.js"
);

describe("password utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("isBcryptHash reconnait les hashes bcrypt valides", () => {
    expect(isBcryptHash("$2b$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuu")).toBe(true);
    expect(isBcryptHash("motdepasse-en-clair")).toBe(false);
    expect(isBcryptHash(null)).toBe(false);
  });

  test("verifyPassword refuse les valeurs non textuelles", async () => {
    await expect(verifyPassword(null, "hash")).resolves.toBe(false);
    await expect(verifyPassword("secret", null)).resolves.toBe(false);
  });

  test("verifyPassword retourne le resultat bcrypt pour un hash valide", async () => {
    compareMock.mockResolvedValue(true);

    await expect(verifyPassword("Resp123!", "$2b$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuu")).resolves.toBe(
      true
    );
    expect(compareMock).toHaveBeenCalledWith(
      "Resp123!",
      "$2b$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuu"
    );
  });

  test("verifyPassword retourne false si bcrypt compare un vrai hash non correspondant", async () => {
    compareMock.mockResolvedValue(false);

    await expect(verifyPassword("mauvais", "$2b$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuu")).resolves.toBe(
      false
    );
  });

  test("verifyPassword retombe sur la comparaison directe pour un mot de passe historique", async () => {
    compareMock.mockResolvedValue(false);

    await expect(verifyPassword("legacy-pass", "legacy-pass")).resolves.toBe(true);
    await expect(verifyPassword("legacy-pass", "autre")).resolves.toBe(false);
  });

  test("verifyPassword garde le fallback direct si bcrypt leve une exception", async () => {
    compareMock.mockRejectedValue(new Error("invalid salt"));

    await expect(verifyPassword("ancien", "ancien")).resolves.toBe(true);
    await expect(verifyPassword("ancien", "different")).resolves.toBe(false);
  });

  test("hashPassword delegue a bcrypt avec un cout de 10", async () => {
    hashMock.mockResolvedValue("hash-final");

    await expect(hashPassword("Resp123!")).resolves.toBe("hash-final");
    expect(hashMock).toHaveBeenCalledWith("Resp123!", 10);
  });
});
