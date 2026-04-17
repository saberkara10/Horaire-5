/**
 * Modèle de données — Programmes de référence.
 *
 * Ce module gère la table `programmes_reference`, qui sert d'index centralisé
 * de tous les programmes académiques connus du système.
 *
 * Pourquoi cette table existe-t-elle ?
 * Les programmes arrivent de partout : import Excel d'étudiants, saisie manuelle
 * de cours, données de professeurs. Chacun peut écrire "web", "Dev Web",
 * "Développement Web" etc. Ce module normalise et regroupe tout ça dans
 * une source de vérité unique.
 *
 * Fonctionnement :
 *  - assurerProgrammeReference() : insère si absent (INSERT IGNORE)
 *  - recupererProgrammesDisponibles() : agrège depuis 4 tables différentes
 *
 * @module model/programmes
 */

import pool from "../../db.js";
import {
  normaliserNomProgramme,
  normaliserTexte,
} from "../utils/programmes.js";

/**
 * Normalise et déduplique une liste de noms de programmes.
 *
 * Chaque programme est normalisé vers son nom officiel, puis indexé
 * dans une Map avec sa forme normalisée comme clé. Si deux programmes
 * ont la même clé normalisée (ex: "web" et "Dev Web"), seul le premier
 * est conservé.
 *
 * Le résultat est trié alphabétiquement selon les règles françaises.
 *
 * @param {string[]} programmes - Liste brute de noms de programmes
 * @returns {string[]} Liste normalisée, dédupliquée et triée
 */
export function normaliserEtDedupliquerProgrammes(programmes) {
  const programmesParCle = new Map();

  for (const programme of programmes) {
    const valeurBrute = String(programme || "").trim();

    if (!valeurBrute) {
      continue; // Ignorer les valeurs vides
    }

    // Normaliser vers le nom officiel (ou garder la valeur si inconnu)
    const valeurNormalisee = normaliserNomProgramme(valeurBrute) || valeurBrute;

    // La clé est la version double-normalisée (pour absorber toutes les variantes)
    const cle = normaliserTexte(valeurNormalisee);

    if (!cle || programmesParCle.has(cle)) {
      continue; // Doublon → on garde le premier occurrence
    }

    programmesParCle.set(cle, valeurNormalisee);
  }

  // Convertir la Map en tableau et trier par ordre alphabétique français
  return [...programmesParCle.values()].sort((programmeA, programmeB) =>
    programmeA.localeCompare(programmeB, "fr")
  );
}

/**
 * Assure qu'un programme est enregistré dans la table programmes_reference.
 *
 * Si le programme n'existe pas encore dans la table, il est inséré.
 * Si il existe déjà, INSERT IGNORE ne fait rien (pas d'erreur, pas de doublon).
 *
 * Cette fonction est appelée automatiquement lors de la création/modification
 * de cours, d'étudiants ou de groupes pour maintenir programmes_reference à jour.
 *
 * @param {string} programme - Le nom du programme à assurer
 * @param {object} [executor=pool] - Connexion MySQL (pool ou transaction courante)
 * @returns {Promise<string>} Le nom officiel normalisé, ou "" si programme vide/inconnu
 */
export async function assurerProgrammeReference(programme, executor = pool) {
  const programmeNormalise = normaliserNomProgramme(programme);

  if (!programmeNormalise) {
    return ""; // Programme vide ou non reconnu → on ne l'insère pas
  }

  // INSERT IGNORE : si l'enregistrement existe déjà (contrainte UNIQUE), pas d'erreur
  await executor.query(
    `INSERT IGNORE INTO programmes_reference (nom_programme)
     VALUES (?)`,
    [programmeNormalise]
  );

  return programmeNormalise;
}

/**
 * Récupère la liste consolidée de tous les programmes disponibles dans le système.
 *
 * Agrège depuis 4 sources différentes via UNION SQL :
 *  1. programmes_reference → référentiel officiel
 *  2. cours               → programmes des cours existants
 *  3. etudiants           → programmes des étudiants inscrits
 *  4. professeurs         → spécialités (réutilisées comme programmes dans certains contextes)
 *
 * Ensuite, normaliserEtDedupliquerProgrammes() nettoie et déduplique le tout.
 *
 * @param {object} [executor=pool] - Connexion MySQL à utiliser
 * @returns {Promise<string[]>} Liste normalisée et triée des programmes
 */
export async function recupererProgrammesDisponibles(executor = pool) {
  const [programmes] = await executor.query(
    `SELECT DISTINCT programme
     FROM (
       SELECT nom_programme AS programme
       FROM programmes_reference
       WHERE nom_programme IS NOT NULL AND TRIM(nom_programme) <> ''
       UNION
       SELECT programme
       FROM cours
       WHERE programme IS NOT NULL AND TRIM(programme) <> ''
       UNION
       SELECT programme
       FROM etudiants
       WHERE programme IS NOT NULL AND TRIM(programme) <> ''
       UNION
       SELECT specialite AS programme
       FROM professeurs
       WHERE specialite IS NOT NULL AND TRIM(specialite) <> ''
     ) AS programmes_uniques`
  );

  return normaliserEtDedupliquerProgrammes(
    programmes.map((programme) => programme.programme)
  );
}
