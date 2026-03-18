
/**
 * MODEL — Gestion des cours
 *
 * Ce module contient uniquement les requêtes SQL liées à la table `cours`.
 * Aucune validation métier ici.
 *
 * Table `cours` :
 * - id_cours (PK)
 * - code (UNIQUE)
 * - nom
 * - duree
 * - programme
 * - etape_etude
 * - type_salle
 */

import pool from "../../db.js";

/**
 * Récupérer tous les cours.
 *
 * @returns {Promise<Array<Object>>} Liste des cours.
 */
export async function recupererTousLesCours() {
  const [listeCours] = await pool.query(
    `SELECT id_cours, code, nom, duree, programme, etape_etude, type_salle
     FROM cours
     ORDER BY code ASC`
  );

  return listeCours;
}

/**
 * Récupérer un cours par son identifiant.
 *
 * @param {number} idCours - Identifiant du cours.
 * @returns {Promise<Object|null>} Le cours trouvé ou null.
 */
export async function recupererCoursParId(idCours) {
  const [coursTrouve] = await pool.query(
    `SELECT id_cours, code, nom, duree, programme, etape_etude, type_salle
     FROM cours
     WHERE id_cours = ?
     LIMIT 1`,
    [idCours]
  );

  return coursTrouve.length ? coursTrouve[0] : null;
}

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
 * Vérifier si un cours existe par son code.
 *
 * @param {string} codeCours - Code du cours.
 * @returns {Promise<Object|null>} Le cours trouvé ou null.
 */
export async function recupererCoursParCode(codeCours) {
  const [coursTrouve] = await pool.query(
    `SELECT id_cours, code, nom, duree, programme, etape_etude, type_salle
     FROM cours
     WHERE code = ?
     LIMIT 1`,
    [codeCours]
  );

  return coursTrouve.length ? coursTrouve[0] : null;
}

/**
 * Ajouter un nouveau cours.
 *
 * @param {Object} nouveauCours
 * @param {string} nouveauCours.code
 * @param {string} nouveauCours.nom
 * @param {number} nouveauCours.duree
 * @param {string} nouveauCours.programme
 * @param {string} nouveauCours.etape_etude
 * @param {string} nouveauCours.type_salle
 *
 * @returns {Promise<Object>} Le cours ajouté.
 */
export async function ajouterCours(nouveauCours) {
  const { code, nom, duree, programme, etape_etude, type_salle } = nouveauCours;

  const [resultatInsertion] = await pool.query(
    `INSERT INTO cours (code, nom, duree, programme, etape_etude, type_salle)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [code, nom, duree, programme, etape_etude, type_salle]
  );

  return recupererCoursParId(resultatInsertion.insertId);
}

/**
 * Modifier un cours existant.
 *
 * @param {number} idCours - Identifiant du cours.
 * @param {Object} donneesModification - Champs à modifier.
 *
 * @returns {Promise<Object|null>} Le cours modifié ou null si inexistant.
 */
export async function modifierCours(idCours, donneesModification) {
  const champsAModifier = [];
  const valeurs = [];

  if (donneesModification.code !== undefined) {
    champsAModifier.push("code = ?");
    valeurs.push(donneesModification.code);
  }

  if (donneesModification.nom !== undefined) {
    champsAModifier.push("nom = ?");
    valeurs.push(donneesModification.nom);
  }

  if (donneesModification.duree !== undefined) {
    champsAModifier.push("duree = ?");
    valeurs.push(donneesModification.duree);
  }

  if (donneesModification.programme !== undefined) {
    champsAModifier.push("programme = ?");
    valeurs.push(donneesModification.programme);
  }

  if (donneesModification.etape_etude !== undefined) {
    champsAModifier.push("etape_etude = ?");
    valeurs.push(donneesModification.etape_etude);
  }

  if (donneesModification.type_salle !== undefined) {
    champsAModifier.push("type_salle = ?");
    valeurs.push(donneesModification.type_salle);
  }

  if (champsAModifier.length === 0) {
    return recupererCoursParId(idCours);
  }

  valeurs.push(idCours);

  const [resultatModification] = await pool.query(
    `UPDATE cours
     SET ${champsAModifier.join(", ")}
     WHERE id_cours = ?
     LIMIT 1`,
    valeurs
  );

  if (resultatModification.affectedRows === 0) {
    return null;
  }

  return recupererCoursParId(idCours);
}

/**
 * Vérifier si un cours est déjà affecté dans un horaire.
 *
 * @param {number} idCours - Identifiant du cours.
 * @returns {Promise<boolean>} true si affecté, sinon false.
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
 * Supprimer un cours.
 *
 * @param {number} idCours - Identifiant du cours.
 * @returns {Promise<boolean>} true si supprimé.
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
 * Vérifier si un type de salle existe.
 *
 * @param {string} typeSalle
 * @returns {Promise<boolean>}
 */
export async function typeSalleExiste(typeSalle) {
  const [salles] = await pool.query(
    `SELECT 1
     FROM salles
     WHERE type = ?
     LIMIT 1`,
    [typeSalle]
  );

  return salles.length > 0;
}
