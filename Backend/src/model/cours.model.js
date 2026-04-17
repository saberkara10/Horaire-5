/**
 * Modèle de données — Gestion des cours.
 *
 * Ce module gère toutes les opérations CRUD sur la table `cours`.
 * Un cours représente une matière enseignée dans un programme donné,
 * à une étape précise (E1, E2, E3...) et nécessitant un certain type de salle.
 *
 * Relation importante avec les salles :
 *  - Chaque cours a une `salle_reference` (une salle concrète qui sert de modèle).
 *  - Le `type_salle` du cours est automatiquement déduit du type de la salle choisie.
 *  - Cela garantit la cohérence : on ne peut pas avoir un cours "type Labo"
 *    associé à une salle de type "Classe".
 *
 * @module model/cours
 */

import pool from "../../db.js";
import { assurerProgrammeReference } from "./programmes.model.js";
import { normaliserNomProgramme } from "../utils/programmes.js";

/**
 * Normalise un code de cours en majuscules et sans espaces superflus.
 *
 * Les codes de cours sont des identifiants métier comme "INF-1001" ou "WEB-301".
 * On les standardise pour éviter des doublons du type "inf-1001" et "INF-1001".
 *
 * @param {*} codeCours - Le code brut reçu
 * @returns {string} Le code normalisé en majuscules
 */
function normaliserCodeCours(codeCours) {
  return String(codeCours || "").trim().toUpperCase();
}

/**
 * Récupère une salle par son identifiant (usage interne uniquement).
 *
 * Utilisée avant chaque insertion/modification de cours pour valider
 * que la salle de référence existe et pour récupérer son type.
 *
 * @param {number} idSalle - L'identifiant de la salle à chercher
 * @param {object} [executor=pool] - Connexion MySQL (pool ou transaction)
 * @returns {Promise<object|null>} La salle ou null si elle n'existe pas
 */
async function recupererSalleParId(idSalle, executor = pool) {
  const [salles] = await executor.query(
    `SELECT id_salle, code, type, capacite
     FROM salles
     WHERE id_salle = ?
     LIMIT 1`,
    [idSalle]
  );

  return salles[0] || null;
}

/**
 * Récupère tous les cours du système, triés par code.
 *
 * Inclut les informations de la salle de référence via une jointure LEFT JOIN.
 * Si un cours n'a pas de salle de référence, les champs `salle_code` et
 * `salle_type` seront null (LEFT JOIN ne filtre pas les cours sans salle).
 *
 * @returns {Promise<object[]>} La liste complète des cours avec détails de salle
 */
export async function recupererTousLesCours() {
  const [listeCours] = await pool.query(
    `SELECT c.id_cours,
            c.code,
            c.nom,
            c.duree,
            c.programme,
            c.etape_etude,
            c.type_salle,
            c.id_salle_reference,
            s.code AS salle_code,
            s.type AS salle_type
     FROM cours c
     LEFT JOIN salles s
       ON s.id_salle = c.id_salle_reference
     ORDER BY c.code ASC`
  );

  return listeCours;
}

/**
 * Récupère un cours par son identifiant.
 *
 * Même format de données que recupererTousLesCours(), mais pour un seul cours.
 *
 * @param {number} idCours - L'identifiant du cours à récupérer
 * @returns {Promise<object|null>} Le cours avec ses détails de salle, ou null
 */
export async function recupererCoursParId(idCours) {
  const [coursTrouve] = await pool.query(
    `SELECT c.id_cours,
            c.code,
            c.nom,
            c.duree,
            c.programme,
            c.etape_etude,
            c.type_salle,
            c.id_salle_reference,
            s.code AS salle_code,
            s.type AS salle_type
     FROM cours c
     LEFT JOIN salles s
       ON s.id_salle = c.id_salle_reference
     WHERE c.id_cours = ?
     LIMIT 1`,
    [idCours]
  );

  return coursTrouve.length ? coursTrouve[0] : null;
}

/**
 * Récupère la liste des types de salles distincts utilisés dans le système.
 *
 * Utilisée pour alimenter des listes déroulantes dans le formulaire de cours,
 * permettant à l'utilisateur de filtrer les cours par type de salle requis.
 *
 * @returns {Promise<string[]>} Liste triée des types de salles (ex: ["Classe", "Laboratoire"])
 */
export async function recupererTypesSalleDisponibles() {
  const [typesSalle] = await pool.query(
    `SELECT DISTINCT type
     FROM salles
     WHERE type IS NOT NULL
       AND TRIM(type) <> ''
     ORDER BY type ASC`
  );

  return typesSalle.map(({ type }) => type);
}

/**
 * Recherche un cours par son code unique.
 *
 * La comparaison est insensible à la casse — "inf-1001" et "INF-1001"
 * retournent le même cours.
 *
 * @param {string} codeCours - Le code du cours à rechercher
 * @returns {Promise<object|null>} Le cours trouvé ou null si aucun résultat
 */
export async function recupererCoursParCode(codeCours) {
  const [coursTrouve] = await pool.query(
    `SELECT c.id_cours,
            c.code,
            c.nom,
            c.duree,
            c.programme,
            c.etape_etude,
            c.type_salle,
            c.id_salle_reference,
            s.code AS salle_code,
            s.type AS salle_type
     FROM cours c
     LEFT JOIN salles s
       ON s.id_salle = c.id_salle_reference
     WHERE UPPER(TRIM(c.code)) = ?
     LIMIT 1`,
    [normaliserCodeCours(codeCours)]
  );

  return coursTrouve.length ? coursTrouve[0] : null;
}

/**
 * Ajoute un nouveau cours dans la base de données.
 *
 * Validations préalables effectuées dans cette fonction :
 *  1. La salle de référence doit exister (sinon erreur).
 *  2. Le code est normalisé en majuscules.
 *  3. Le programme est normalisé et enregistré dans programmes_reference si absent.
 *  4. Le type_salle est automatiquement déduit du type de la salle choisie.
 *
 * @param {object} nouveauCours - Les données du cours à créer
 * @param {string} nouveauCours.code - Code unique du cours (ex: "INF-1001")
 * @param {string} nouveauCours.nom - Nom complet du cours
 * @param {number} nouveauCours.duree - Durée en heures
 * @param {string} nouveauCours.programme - Nom du programme associé
 * @param {string} nouveauCours.etape_etude - Étape d'études (ex: "1", "2", "3")
 * @param {number} nouveauCours.id_salle_reference - ID de la salle de référence
 * @returns {Promise<object>} Le cours créé avec ses données complètes
 * @throws {Error} Si la salle de référence n'existe pas
 */
export async function ajouterCours(nouveauCours) {
  const { code, nom, duree, programme, etape_etude, id_salle_reference } =
    nouveauCours;

  // Valider que la salle existe avant d'insérer
  const salleReference = await recupererSalleParId(id_salle_reference);
  const codeNormalise = normaliserCodeCours(code);

  // Assurer l'existence du programme dans programmes_reference et récupérer son nom officiel
  const programmeNormalise = await assurerProgrammeReference(programme);

  if (!salleReference) {
    throw new Error("Salle de reference introuvable.");
  }

  const [resultatInsertion] = await pool.query(
    `INSERT INTO cours (
      code,
      nom,
      duree,
      programme,
      etape_etude,
      type_salle,
      id_salle_reference
    )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      codeNormalise,
      String(nom || "").trim(),
      duree,
      // Priorité : nom officiel via programmes_reference, sinon normalisation locale
      programmeNormalise || normaliserNomProgramme(programme),
      String(etape_etude).trim(),
      salleReference.type,        // type_salle déduit de la salle choisie
      salleReference.id_salle,    // on stocke l'ID validé, pas celui reçu brut
    ]
  );

  // Relire le cours créé pour retourner les données complètes avec jointures
  return recupererCoursParId(resultatInsertion.insertId);
}

/**
 * Modifie les données d'un cours existant.
 *
 * Seuls les champs présents dans `donneesModification` sont mis à jour.
 * Si un champ n'est pas inclus, sa valeur actuelle est conservée.
 * Cette approche (UPDATE partiel) évite d'écraser accidentellement des données.
 *
 * Si `id_salle_reference` est fourni, le `type_salle` est automatiquement
 * recalculé à partir de la nouvelle salle.
 *
 * @param {number} idCours - L'identifiant du cours à modifier
 * @param {object} donneesModification - Les champs à mettre à jour (partiels)
 * @returns {Promise<object|null>} Le cours mis à jour, ou null si non trouvé
 * @throws {Error} Si la salle de référence fournie n'existe pas
 */
export async function modifierCours(idCours, donneesModification) {
  // Construction dynamique de la requête SQL selon les champs fournis
  const champsAModifier = [];
  const valeurs = [];

  if (donneesModification.code !== undefined) {
    champsAModifier.push("code = ?");
    valeurs.push(normaliserCodeCours(donneesModification.code));
  }

  if (donneesModification.nom !== undefined) {
    champsAModifier.push("nom = ?");
    valeurs.push(String(donneesModification.nom || "").trim());
  }

  if (donneesModification.duree !== undefined) {
    champsAModifier.push("duree = ?");
    valeurs.push(donneesModification.duree);
  }

  if (donneesModification.programme !== undefined) {
    const programmeNormalise = await assurerProgrammeReference(
      donneesModification.programme
    );
    champsAModifier.push("programme = ?");
    valeurs.push(
      programmeNormalise ||
        normaliserNomProgramme(donneesModification.programme)
    );
  }

  if (donneesModification.etape_etude !== undefined) {
    champsAModifier.push("etape_etude = ?");
    valeurs.push(String(donneesModification.etape_etude).trim());
  }

  if (donneesModification.id_salle_reference !== undefined) {
    const salleReference = await recupererSalleParId(
      donneesModification.id_salle_reference
    );

    if (!salleReference) {
      throw new Error("Salle de reference introuvable.");
    }

    champsAModifier.push("id_salle_reference = ?");
    valeurs.push(salleReference.id_salle);
    champsAModifier.push("type_salle = ?");
    valeurs.push(salleReference.type); // Synchroniser le type avec la nouvelle salle
  }

  // Si aucun champ n'a été fourni → retourner l'état actuel sans modifier
  if (champsAModifier.length === 0) {
    return recupererCoursParId(idCours);
  }

  valeurs.push(idCours); // L'ID va dans le WHERE

  const [resultatModification] = await pool.query(
    `UPDATE cours
     SET ${champsAModifier.join(", ")}
     WHERE id_cours = ?
     LIMIT 1`,
    valeurs
  );

  if (resultatModification.affectedRows === 0) {
    return null; // Le cours n'existait pas
  }

  return recupererCoursParId(idCours);
}

/**
 * Vérifie si un cours est déjà utilisé dans un horaire généré.
 *
 * Utilisée avant suppression pour protéger l'intégrité des données :
 * on ne doit pas supprimer un cours qui a des séances planifiées.
 *
 * @param {number} idCours - L'identifiant du cours à vérifier
 * @returns {Promise<boolean>} true si le cours a au moins une affectation
 */
export async function coursEstDejaAffecte(idCours) {
  const [affectations] = await pool.query(
    `SELECT 1
     FROM affectation_cours
     WHERE id_cours = ?
     LIMIT 1`,
    [idCours]
  );

  return affectations.length > 0;
}

/**
 * Supprime un cours de la base de données.
 *
 * Attention : ne pas appeler cette fonction sans avoir vérifié d'abord avec
 * coursEstDejaAffecte() que le cours n'est pas utilisé dans un horaire.
 * La suppression en cascade n'est pas garantie par cette fonction seule.
 *
 * @param {number} idCours - L'identifiant du cours à supprimer
 * @returns {Promise<boolean>} true si supprimé, false si le cours n'existait pas
 */
export async function supprimerCours(idCours) {
  const [resultatSuppression] = await pool.query(
    `DELETE FROM cours
     WHERE id_cours = ?
     LIMIT 1`,
    [idCours]
  );

  return resultatSuppression.affectedRows > 0;
}

/**
 * Vérifie qu'une salle existe dans la base de données.
 *
 * Utilisée dans les validations pour confirmer qu'une salle de référence
 * soumise par le client est bien réelle avant de l'utiliser.
 *
 * @param {number} idSalle - L'identifiant de la salle à vérifier
 * @returns {Promise<boolean>} true si la salle existe
 */
export async function salleExisteParId(idSalle) {
  const salle = await recupererSalleParId(idSalle);
  return Boolean(salle);
}
