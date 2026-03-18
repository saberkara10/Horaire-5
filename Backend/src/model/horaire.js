import pool from "../../db.js";

/**
 * Retourne toutes les affectations de cours avec les details.
 * @returns La liste de toutes les affectations.
 */
export async function getAllAffectations() {
    const [rows] = await pool.query(
        `SELECT ac.id_affectation_cours,
                c.code AS cours_code,
                c.nom AS cours_nom,
                c.duree AS cours_duree,
                p.nom AS professeur_nom,
                p.prenom AS professeur_prenom,
                s.code AS salle_code,
                s.capacite AS salle_capacite,
                ph.date,
                ph.heure_debut,
                ph.heure_fin
        FROM affectation_cours ac
        JOIN cours c ON ac.id_cours = c.id_cours
        JOIN professeurs p ON ac.id_professeur = p.id_professeur
        JOIN salles s ON ac.id_salle = s.id_salle
        JOIN plages_horaires ph ON ac.id_plage_horaires = ph.id_plage_horaires
        ORDER BY ph.date, ph.heure_debut;`
    );

    return rows;
}

/**
 * Retourne une affectation par son identifiant.
 * @param {number} idAffectation L'identifiant de l'affectation.
 * @returns L'affectation correspondante ou undefined.
 */
export async function getAffectationById(idAffectation) {
    const [rows] = await pool.query(
        `SELECT ac.id_affectation_cours,
                ac.id_cours,
                ac.id_professeur,
                ac.id_salle,
                ac.id_plage_horaires,
                c.code AS cours_code,
                c.nom AS cours_nom,
                p.nom AS professeur_nom,
                p.prenom AS professeur_prenom,
                s.code AS salle_code,
                ph.date,
                ph.heure_debut,
                ph.heure_fin
        FROM affectation_cours ac
        JOIN cours c ON ac.id_cours = c.id_cours
        JOIN professeurs p ON ac.id_professeur = p.id_professeur
        JOIN salles s ON ac.id_salle = s.id_salle
        JOIN plages_horaires ph ON ac.id_plage_horaires = ph.id_plage_horaires
        WHERE ac.id_affectation_cours = ?;`,
        [idAffectation]
    );

    return rows[0];
}

/**
 * Cree une plage horaire.
 * @param {string} date La date du creneau.
 * @param {string} heureDebut L'heure de debut.
 * @param {string} heureFin L'heure de fin.
 * @returns Le resultat de l'insertion.
 */
export async function addPlageHoraire(date, heureDebut, heureFin) {
    const [result] = await pool.query(
        `INSERT INTO plages_horaires(date, heure_debut, heure_fin)
        VALUES(?, ?, ?);`,
        [date, heureDebut, heureFin]
    );

    return result;
}

/**
 * Cree une affectation de cours.
 * @param {number} idCours L'identifiant du cours.
 * @param {number} idProfesseur L'identifiant du professeur.
 * @param {number} idSalle L'identifiant de la salle.
 * @param {number} idPlageHoraires L'identifiant de la plage horaire.
 * @returns Le resultat de l'insertion.
 */
export async function addAffectation(idCours, idProfesseur, idSalle, idPlageHoraires) {
    const [result] = await pool.query(
        `INSERT INTO affectation_cours(id_cours, id_professeur, id_salle, id_plage_horaires)
        VALUES(?, ?, ?, ?);`,
        [idCours, idProfesseur, idSalle, idPlageHoraires]
    );

    return result;
}

/**
 * Supprime une affectation de cours.
 * @param {number} idAffectation L'identifiant de l'affectation a supprimer.
 * @returns Le resultat de la suppression.
 */
export async function deleteAffectation(idAffectation) {
    // Supprimer les groupes associes d'abord
    await pool.query(
        `DELETE FROM affectation_groupes
        WHERE id_affectation_cours = ?;`,
        [idAffectation]
    );

    const [result] = await pool.query(
        `DELETE FROM affectation_cours
        WHERE id_affectation_cours = ?;`,
        [idAffectation]
    );

    return result;
}

/**
 * Supprime toutes les affectations (reset horaire).
 * @returns Le resultat de la suppression.
 */
export async function deleteAllAffectations() {
    await pool.query(`DELETE FROM affectation_groupes;`);
    await pool.query(`DELETE FROM affectation_cours;`);
    await pool.query(`DELETE FROM plages_horaires;`);
}

/**
 * Assigne un groupe d'etudiants a une affectation de cours.
 * @param {number} idGroupeEtudiants L'identifiant du groupe.
 * @param {number} idAffectationCours L'identifiant de l'affectation.
 * @returns Le resultat de l'insertion.
 */
export async function addAffectationGroupe(idGroupeEtudiants, idAffectationCours) {
    const [result] = await pool.query(
        `INSERT INTO affectation_groupes(id_groupes_etudiants, id_affectation_cours)
        VALUES(?, ?);`,
        [idGroupeEtudiants, idAffectationCours]
    );

    return result;
}

/**
 * Verifie les conflits de salle pour une plage horaire.
 * @param {number} idSalle L'identifiant de la salle.
 * @param {number} idPlageHoraires L'identifiant de la plage horaire.
 * @returns Le nombre de conflits.
 */
export async function verifierConflitSalle(idSalle, idPlageHoraires) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS conflits
        FROM affectation_cours
        WHERE id_salle = ? AND id_plage_horaires = ?;`,
        [idSalle, idPlageHoraires]
    );

    return rows[0].conflits;
}

/**
 * Verifie les conflits de professeur pour une plage horaire.
 * @param {number} idProfesseur L'identifiant du professeur.
 * @param {number} idPlageHoraires L'identifiant de la plage horaire.
 * @returns Le nombre de conflits.
 */
export async function verifierConflitProfesseur(idProfesseur, idPlageHoraires) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS conflits
        FROM affectation_cours
        WHERE id_professeur = ? AND id_plage_horaires = ?;`,
        [idProfesseur, idPlageHoraires]
    );

    return rows[0].conflits;
}