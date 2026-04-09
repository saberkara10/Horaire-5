import bcrypt from "bcrypt";

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

export function isBcryptHash(value) {
  return typeof value === "string" && BCRYPT_HASH_PATTERN.test(value);
}

export async function verifyPassword(plainPassword, storedPassword) {
  if (typeof plainPassword !== "string" || typeof storedPassword !== "string") {
    return false;
  }

  try {
    const hashMatch = await bcrypt.compare(plainPassword, storedPassword);
    if (hashMatch || isBcryptHash(storedPassword)) {
      return hashMatch;
    }
  } catch {
    // Le compte peut venir d'une ancienne migration qui stockait le mot de passe en clair.
  }

  // Compatibilite temporaire avec des comptes historiques stockes en clair.
  return plainPassword === storedPassword;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
