/**
 * MODEL — Gestion des étudiants
 *
 * Ce module contient uniquement les requêtes SQL liées
 * à la consultation d'un étudiant et de son horaire.
 */

import pool from "../../db.js";

/**
 * Récupérer un étudiant par son identifiant.
 *
 * @param {number} idEtudiant - Identifiant de l'étudiant.
 * @returns {Promise<Object|null>} L'étudiant trouvé ou null.
 */
export async function recupererEtudiantParId(idEtudiant) {
  const [etudiantTrouve] = await pool.query(
    `SELECT
       id_etudiant,
       matricule,
       nom,
       prenom,
       groupe,
       programme,
       etape
     FROM etudiants
     WHERE id_etudiant = ?
     LIMIT 1`,
    [idEtudiant]
  );

  return etudiantTrouve.length ? etudiantTrouve[0] : null;
}

/**
 * Récupérer l'horaire d'un étudiant à partir de son groupe.
 *
 * @param {string} groupeEtudiant - Groupe de l'étudiant.
 * @returns {Promise<Array<Object>>} Liste des séances.
 */
export async function recupererHoraireParGroupe(groupeEtudiant) {
  const [horaireTrouve] = await pool.query(
    `SELECT
       ac.id_affectation_cours,
       c.id_cours,
       c.code AS code_cours,
       c.nom AS nom_cours,
       p.id_professeur,
       p.nom AS nom_professeur,
       p.prenom AS prenom_professeur,
       s.id_salle,
       s.code AS code_salle,
       s.type AS type_salle,
       ph.id_plage_horaires,
       ph.date,
       ph.heure_debut,
       ph.heure_fin
     FROM groupes_etudiants ge
     INNER JOIN affectation_groupes ag
       ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     INNER JOIN affectation_cours ac
       ON ag.id_affectation_cours = ac.id_affectation_cours
     INNER JOIN cours c
       ON ac.id_cours = c.id_cours
     INNER JOIN professeurs p
       ON ac.id_professeur = p.id_professeur
     INNER JOIN salles s
       ON ac.id_salle = s.id_salle
     INNER JOIN plages_horaires ph
       ON ac.id_plage_horaires = ph.id_plage_horaires
     WHERE ge.nom_groupe = ?
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [groupeEtudiant]
  );

  return horaireTrouve;
}

/**
 * Récupérer les informations complètes d'un étudiant avec son horaire.
 *
 * @param {number} idEtudiant - Identifiant de l'étudiant.
 * @returns {Promise<Object|null>} Données complètes ou null.
 */
export async function recupererHoraireCompletEtudiant(idEtudiant) {
  const etudiant = await recupererEtudiantParId(idEtudiant);

  if (!etudiant) {
    return null;
  }

  const horaire = await recupererHoraireParGroupe(etudiant.groupe);

  return {
    etudiant,
    horaire,
  };
}