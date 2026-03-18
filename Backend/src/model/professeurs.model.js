/**
 * MODEL - Gestion des professeurs
 *
 * Ce module contient uniquement les requetes SQL liees a la table `professeurs`.
 * Aucune validation metier ici.
 *
 * Table `professeurs` :
 * - id_professeur (PK)
 * - matricule (UNIQUE)
 * - nom
 * - prenom
 * - specialite
 */

import pool from "../../db.js";

/**
 * Recuperer tous les professeurs.
 *
 * @returns {Promise<Array<Object>>} Liste des professeurs.
 */
export async function recupererTousLesProfesseurs() {
  const [listeProfesseurs] = await pool.query(
    `SELECT id_professeur, matricule, nom, prenom, specialite
     FROM professeurs
     ORDER BY matricule ASC`
  );

  return listeProfesseurs;
}

/**
 * Recuperer un professeur par son identifiant.
 *
 * @param {number} idProfesseur - Identifiant du professeur.
 * @returns {Promise<Object|null>} Le professeur trouve ou null.
 */
export async function recupererProfesseurParId(idProfesseur) {
  const [professeurTrouve] = await pool.query(
    `SELECT id_professeur, matricule, nom, prenom, specialite
     FROM professeurs
     WHERE id_professeur = ?
     LIMIT 1`,
    [idProfesseur]
  );

  return professeurTrouve.length ? professeurTrouve[0] : null;
}

/**
 * Verifier si un professeur existe par son matricule.
 *
 * @param {string} matriculeProfesseur - Matricule du professeur.
 * @returns {Promise<Object|null>} Le professeur trouve ou null.
 */
export async function recupererProfesseurParMatricule(matriculeProfesseur) {
  const [professeurTrouve] = await pool.query(
    `SELECT id_professeur, matricule, nom, prenom, specialite
     FROM professeurs
     WHERE matricule = ?
     LIMIT 1`,
    [matriculeProfesseur]
  );

  return professeurTrouve.length ? professeurTrouve[0] : null;
}

/**
 * Ajouter un nouveau professeur.
 *
 * @param {Object} nouveauProfesseur
 * @param {string} nouveauProfesseur.matricule
 * @param {string} nouveauProfesseur.nom
 * @param {string} nouveauProfesseur.prenom
 * @param {string|null} nouveauProfesseur.specialite
 *
 * @returns {Promise<Object>} Le professeur ajoute.
 */
export async function ajouterProfesseur(nouveauProfesseur) {
  const { matricule, nom, prenom, specialite } = nouveauProfesseur;

  const [resultatInsertion] = await pool.query(
    `INSERT INTO professeurs (matricule, nom, prenom, specialite)
     VALUES (?, ?, ?, ?)`,
    [matricule, nom, prenom, specialite ?? null]
  );

  return recupererProfesseurParId(resultatInsertion.insertId);
}

/**
 * Modifier un professeur existant.
 *
 * @param {number} idProfesseur - Identifiant du professeur.
 * @param {Object} donneesModification - Champs a modifier.
 *
 * @returns {Promise<Object|null>} Le professeur modifie ou null si inexistant.
 */
export async function modifierProfesseur(idProfesseur, donneesModification) {
  const champsAModifier = [];
  const valeurs = [];

  if (donneesModification.matricule !== undefined) {
    champsAModifier.push("matricule = ?");
    valeurs.push(donneesModification.matricule);
  }

  if (donneesModification.nom !== undefined) {
    champsAModifier.push("nom = ?");
    valeurs.push(donneesModification.nom);
  }

  if (donneesModification.prenom !== undefined) {
    champsAModifier.push("prenom = ?");
    valeurs.push(donneesModification.prenom);
  }

  if (donneesModification.specialite !== undefined) {
    champsAModifier.push("specialite = ?");
    valeurs.push(donneesModification.specialite);
  }

  if (champsAModifier.length === 0) {
    return recupererProfesseurParId(idProfesseur);
  }

  valeurs.push(idProfesseur);

  const [resultatModification] = await pool.query(
    `UPDATE professeurs
     SET ${champsAModifier.join(", ")}
     WHERE id_professeur = ?
     LIMIT 1`,
    valeurs
  );

  if (resultatModification.affectedRows === 0) {
    return null;
  }

  return recupererProfesseurParId(idProfesseur);
}

/**
 * Verifier si un professeur est deja affecte dans un horaire.
 *
 * @param {number} idProfesseur - Identifiant du professeur.
 * @returns {Promise<boolean>} true si affecte, sinon false.
 */
export async function professeurEstDejaAffecte(idProfesseur) {
  const [affectations] = await pool.query(
    `SELECT 1
     FROM affectation_cours
     WHERE id_professeur = ?
     LIMIT 1`,
    [idProfesseur]
  );

  return affectations.length > 0;
}

/**
 * Supprimer un professeur.
 *
 * @param {number} idProfesseur - Identifiant du professeur.
 * @returns {Promise<boolean>} true si supprime.
 */
export async function supprimerProfesseur(idProfesseur) {
  const [resultatSuppression] = await pool.query(
    `DELETE FROM professeurs
     WHERE id_professeur = ?
     LIMIT 1`,
    [idProfesseur]
  );

  return resultatSuppression.affectedRows > 0;
}

/**
 * recuperer l'horaire complet d'un professeur.
 * 
 * @param {number} idProfesseur -Identifiant du professeur .
 * @returns {Promise<Array<Object>>}  Liste des cours planifies.
 */

export async function recupererHoraireProfesseur(idProfesseur) {
  const [horaireProfesseur] = await pool.query(
    `SELECT
        ac.id_affectation_cours,
        c.id_cours,
        c.code AS code_cours,
        c.nom AS nom_cours,
        c.programme,
        c.etape_etude,
        c.duree,
        s.id_salle,
        s.code AS code_salle,
        s.type AS type_salle,
        ph.id_plage_horaires,
        ph.date,
        ph.heure_debut,
        ph.heure_fin
     FROM affectation_cours ac
     JOIN cours c
       ON c.id_cours = ac.id_cours
     JOIN salles s
       ON s.id_salle = ac.id_salle
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ac.id_professeur = ?
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [idProfesseur]
  );

  return horaireProfesseur;
}