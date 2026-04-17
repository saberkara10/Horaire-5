/**
 * Utilitaires pour la gestion des mots de passe.
 *
 * Ce module gère le hachage et la vérification des mots de passe
 * en utilisant bcrypt, l'algorithme standard et recommandé pour
 * cette tâche (résistant aux attaques par force brute).
 *
 * Note sur la compatibilité historique :
 * Le projet a vécu une migration depuis un ancien système qui stockait
 * les mots de passe en clair (plaintext). La fonction verifyPassword
 * gère les deux cas pour ne pas bloquer les anciens comptes.
 *
 * @module utils/passwords
 */

import bcrypt from "bcrypt";

/**
 * Expression régulière qui reconnaît les hashes bcrypt valides.
 *
 * Un hash bcrypt commence toujours par "$2a$", "$2b$" ou "$2y$" suivi
 * du facteur de coût (ex: $10$), puis du salt et du hash lui-même.
 * Ce pattern permet de détecter si un mot de passe est déjà haché
 * ou s'il est stocké en clair (anciens comptes).
 *
 * @type {RegExp}
 */
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

/**
 * Vérifie si une chaîne est un hash bcrypt valide.
 *
 * Utilisée pour distinguer les mots de passe hachés des mots de passe
 * en clair lors de la migration des anciens comptes.
 *
 * @param {*} value - La valeur à vérifier (n'importe quel type)
 * @returns {boolean} true si la valeur ressemble à un hash bcrypt, false sinon
 */
export function isBcryptHash(value) {
  return typeof value === "string" && BCRYPT_HASH_PATTERN.test(value);
}

/**
 * Vérifie qu'un mot de passe en clair correspond au mot de passe stocké.
 *
 * Gère deux scénarios :
 *  1. Mot de passe correctement haché (bcrypt) → on utilise bcrypt.compare()
 *  2. Ancien mot de passe en clair (comptes migrés) → comparaison directe
 *
 * En cas d'erreur bcrypt (ex: chaîne corrompue), on bascule sur la comparaison
 * directe pour ne pas bloquer des utilisateurs sur des anciens comptes.
 *
 * TODO: Forcer la migration de tous les comptes en clair, puis supprimer
 *       la comparaison directe. Ce chemin de code est une dette technique.
 *
 * @param {string} plainPassword - Le mot de passe en clair soumis par l'utilisateur
 * @param {string} storedPassword - Le mot de passe stocké en base (haché ou en clair)
 * @returns {Promise<boolean>} true si les mots de passe correspondent
 */
export async function verifyPassword(plainPassword, storedPassword) {
  // Refuser immédiatement si les types ne sont pas corrects
  if (typeof plainPassword !== "string" || typeof storedPassword !== "string") {
    return false;
  }

  try {
    const hashMatch = await bcrypt.compare(plainPassword, storedPassword);
    // Si bcrypt.compare() a fonctionné (sans erreur), on retourne son résultat
    if (hashMatch || isBcryptHash(storedPassword)) {
      return hashMatch;
    }
  } catch {
    // bcrypt a planté — probablement parce que storedPassword n'est pas un hash valide.
    // C'est le cas pour les anciens comptes migrés qui avaient le mot de passe en clair.
  }

  // Fallback : comparaison directe pour les comptes historiques non migrés.
  // À supprimer dès que tous les comptes sont migrés vers bcrypt.
  return plainPassword === storedPassword;
}

/**
 * Hache un mot de passe en utilisant bcrypt avec un facteur de coût de 10.
 *
 * Le facteur 10 signifie que bcrypt applique 2^10 = 1024 itérations de hachage,
 * ce qui prend environ 100ms sur un serveur standard. C'est suffisant pour
 * ralentir les attaques par force brute sans pénaliser l'expérience utilisateur.
 *
 * @param {string} password - Le mot de passe en clair à hacher
 * @returns {Promise<string>} Le hash bcrypt (chaîne de 60 caractères)
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
