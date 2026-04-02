/**
 * MODEL - Gestion des groupes
 *
 * Ce module centralise la lecture
 * des groupes et de leurs horaires.
 */

import pool from "../../db.js";

/**
 * Recuperer la liste des groupes.
 *
 * @param {boolean} details Inclure programme, etape, session, annee et effectif.
 * @returns {Promise<Array<Object>>} Liste des groupes.
 */
export async function recupererGroupes(details = false) {
  const [groupes] = details
    ? await pool.query(
        `SELECT ge.id_groupes_etudiants,
                ge.nom_groupe,
                MAX(e.programme) AS programme,
                MAX(e.etape) AS etape,
                MAX(e.session) AS session,
                MAX(e.annee) AS annee,
                COUNT(e.id_etudiant) AS effectif
         FROM groupes_etudiants ge
         LEFT JOIN etudiants e
           ON e.id_groupes_etudiants = ge.id_groupes_etudiants
         GROUP BY ge.id_groupes_etudiants, ge.nom_groupe
         ORDER BY MAX(e.annee) DESC, ge.nom_groupe ASC`
      )
    : await pool.query(
        `SELECT id_groupes_etudiants, nom_groupe
         FROM groupes_etudiants
         ORDER BY nom_groupe ASC`
      );

  return groupes;
}

/**
 * Recuperer un groupe par son identifiant.
 *
 * @param {number} idGroupe Identifiant du groupe.
 * @returns {Promise<Object|null>} Groupe trouve ou null.
 */
export async function recupererGroupeParId(idGroupe) {
  const [groupes] = await pool.query(
    `SELECT ge.id_groupes_etudiants,
            ge.nom_groupe,
            MAX(e.programme) AS programme,
            MAX(e.etape) AS etape,
            MAX(e.session) AS session,
            MAX(e.annee) AS annee,
            COUNT(e.id_etudiant) AS effectif
     FROM groupes_etudiants ge
     LEFT JOIN etudiants e
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     WHERE ge.id_groupes_etudiants = ?
     GROUP BY ge.id_groupes_etudiants, ge.nom_groupe
     LIMIT 1`,
    [idGroupe]
  );

  return groupes[0] || null;
}

/**
 * Recuperer l'horaire detaille d'un groupe.
 *
 * @param {number} idGroupe Identifiant du groupe.
 * @returns {Promise<Array<Object>>} Liste des seances.
 */
export async function recupererHoraireGroupe(idGroupe) {
  const [horaire] = await pool.query(
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
     FROM affectation_groupes ag
     JOIN affectation_cours ac
       ON ac.id_affectation_cours = ag.id_affectation_cours
     JOIN cours c
       ON c.id_cours = ac.id_cours
     JOIN professeurs p
       ON p.id_professeur = ac.id_professeur
     JOIN salles s
       ON s.id_salle = ac.id_salle
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ag.id_groupes_etudiants = ?
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [idGroupe]
  );

  return horaire;
}

/**
 * Recuperer les informations completes d'un groupe avec son horaire.
 *
 * @param {number} idGroupe Identifiant du groupe.
 * @returns {Promise<Object|null>} Resume complet du groupe ou null.
 */
export async function recupererPlanningCompletGroupe(idGroupe) {
  const groupe = await recupererGroupeParId(idGroupe);

  if (!groupe) {
    return null;
  }

  const horaire = await recupererHoraireGroupe(idGroupe);

  return {
    groupe,
    horaire,
  };
}
