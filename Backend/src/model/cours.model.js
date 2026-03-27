/**
 * MODEL - Gestion des cours
 *
 * Les cours restent lies a un programme et une etape,
 * mais leur salle de reference est maintenant choisie
 * par code de salle.
 */

import pool from "../../db.js";

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
 * Recuperer tous les cours.
 *
 * @returns {Promise<Array<Object>>} Liste des cours.
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
 * Recuperer un cours par son identifiant.
 *
 * @param {number} idCours - Identifiant du cours.
 * @returns {Promise<Object|null>} Le cours trouve ou null.
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
 * Verifier si un cours existe par son code.
 *
 * @param {string} codeCours - Code du cours.
 * @returns {Promise<Object|null>} Le cours trouve ou null.
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
     WHERE c.code = ?
     LIMIT 1`,
    [codeCours]
  );

  return coursTrouve.length ? coursTrouve[0] : null;
}

/**
 * Ajouter un nouveau cours.
 *
 * @param {Object} nouveauCours
 * @returns {Promise<Object>} Le cours ajoute.
 */
export async function ajouterCours(nouveauCours) {
  const { code, nom, duree, programme, etape_etude, id_salle_reference } =
    nouveauCours;
  const salleReference = await recupererSalleParId(id_salle_reference);

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
      code,
      nom,
      duree,
      programme,
      etape_etude,
      salleReference.type,
      salleReference.id_salle,
    ]
  );

  return recupererCoursParId(resultatInsertion.insertId);
}

/**
 * Modifier un cours existant.
 *
 * @param {number} idCours
 * @param {Object} donneesModification
 * @returns {Promise<Object|null>}
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
    valeurs.push(salleReference.type);
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
 * Verifier si un cours est deja affecte dans un horaire.
 *
 * @param {number} idCours
 * @returns {Promise<boolean>}
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
 * @param {number} idCours
 * @returns {Promise<boolean>}
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
 * Verifier si une salle existe par son identifiant.
 *
 * @param {number} idSalle
 * @returns {Promise<boolean>}
 */
export async function salleExisteParId(idSalle) {
  const salle = await recupererSalleParId(idSalle);
  return Boolean(salle);
}
