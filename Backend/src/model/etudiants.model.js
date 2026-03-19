/**
 * MODEL - Gestion des etudiants
 *
 * Ce module centralise les requetes SQL de consultation des etudiants.
 * Il couvre :
 * - la liste des etudiants importes ;
 * - la fiche detaillee d'un etudiant ;
 * - la consultation de l'horaire via le groupe de l'etudiant.
 *
 * Le lien metier important est le suivant :
 * l'etudiant est rattache a un groupe, puis le groupe est relie aux
 * affectations de cours qui permettent de reconstruire l'horaire.
 */

import pool from "../../db.js";

/**
 * Recuperer tous les etudiants avec leur groupe.
 *
 * @returns {Promise<Array<Object>>} Liste ordonnee des etudiants.
 */
export async function recupererTousLesEtudiants() {
  const [etudiants] = await pool.query(
    `SELECT
       e.id_etudiant,
       e.matricule,
       e.nom,
       e.prenom,
       ge.nom_groupe AS groupe,
       e.programme,
       e.etape_etude AS etape
     FROM etudiants e
     INNER JOIN groupes_etudiants ge
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     ORDER BY e.matricule ASC, e.nom ASC, e.prenom ASC`
  );

  return etudiants;
}

/**
 * Recuperer un etudiant par son identifiant.
 *
 * @param {number} idEtudiant - Identifiant de l'etudiant.
 * @returns {Promise<Object|null>} L'etudiant trouve ou null.
 */
export async function recupererEtudiantParId(idEtudiant) {
  const [etudiantTrouve] = await pool.query(
    `SELECT
       e.id_etudiant,
       e.matricule,
       e.nom,
       e.prenom,
       ge.nom_groupe AS groupe,
       e.programme,
       e.etape_etude AS etape
     FROM etudiants e
     INNER JOIN groupes_etudiants ge
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     WHERE e.id_etudiant = ?
     LIMIT 1`,
    [idEtudiant]
  );

  return etudiantTrouve.length ? etudiantTrouve[0] : null;
}

/**
 * Recuperer l'horaire d'un etudiant a partir de son groupe.
 *
 * @param {string} groupeEtudiant - Groupe de l'etudiant.
 * @returns {Promise<Array<Object>>} Liste des seances.
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
 * Recuperer les informations completes d'un etudiant avec son horaire.
 *
 * @param {number} idEtudiant - Identifiant de l'etudiant.
 * @returns {Promise<Object|null>} Donnees completes ou null.
 */
export async function recupererHoraireCompletEtudiant(idEtudiant) {
  const etudiant = await recupererEtudiantParId(idEtudiant);

  if (!etudiant) {
    return null;
  }

  // L'horaire n'est pas stocke directement sur l'etudiant.
  // On le reconstruit dynamiquement a partir de son groupe courant.
  const horaire = await recupererHoraireParGroupe(etudiant.groupe);

  return {
    etudiant,
    horaire,
  };
}
