/**
 * Utilitaires pour la gestion securisee des mots de passe.
 *
 * Les mots de passe stockes doivent toujours etre des hashes bcrypt. Aucune
 * comparaison directe avec une valeur en clair stockee en base n'est autorisee.
 *
 * @module utils/passwords
 */

import bcrypt from "bcrypt";

/**
 * Un hash bcrypt commence par "$2a$", "$2b$" ou "$2y$", suivi du cout.
 *
 * @type {RegExp}
 */
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

/**
 * Verifie si une valeur ressemble a un hash bcrypt.
 *
 * @param {*} value - Valeur a verifier.
 * @returns {boolean} true si la valeur est un hash bcrypt, false sinon.
 */
export function isBcryptHash(value) {
  return typeof value === "string" && BCRYPT_HASH_PATTERN.test(value);
}

/**
 * Verifie qu'un mot de passe correspond au hash stocke.
 *
 * Si la valeur stockee n'est pas un hash bcrypt valide, l'authentification est
 * refusee. Cela empeche les anciens mots de passe en clair de fonctionner.
 *
 * @param {string} plainPassword - Mot de passe soumis par l'utilisateur.
 * @param {string} storedPassword - Hash bcrypt stocke en base.
 * @returns {Promise<boolean>} true si le mot de passe correspond.
 */
export async function verifyPassword(plainPassword, storedPassword) {
  if (typeof plainPassword !== "string" || typeof storedPassword !== "string") {
    return false;
  }

  if (!isBcryptHash(storedPassword)) {
    return false;
  }

  try {
    return await bcrypt.compare(plainPassword, storedPassword);
  } catch {
    return false;
  }
}

/**
 * Hache un mot de passe avec bcrypt.
 *
 * @param {string} password - Mot de passe a hacher.
 * @returns {Promise<string>} Hash bcrypt.
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
