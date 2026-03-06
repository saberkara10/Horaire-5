import pool from "../../db.js";

/**
 * Retourne la liste de toutes les salles.
 * @returns La liste de toutes les salles.
 */

export async function getAllSalles() {
    const [salles]= await pool.query(
         `SELECT id_salle, code, type, capacite
        FROM salles 
        ORDER BY code;`
    );
    return salles;
}

/**
 * Retourne une salle par son identifiant.
 * @param {number} idSalle L'identifiant de la salle à retourner.
 * @return La salle correspondante ou undefined si non trouvée.
 * */

export async function getSalleById(idSalle) {
    const [salles]= await pool.query(
         `SELECT id_salle, code, type, capacite
        FROM salles 
        WHERE id_salle = ?;`,
        [idSalle]
    );
    return salles[0];
}

/**
 * Retourne une salle par son code.
 * @param {string} codeSalle Le code de la salle à retourner.
 * @return La salle correspondante ou undefined si non trouvée.
 * */   

export async function getSalleByCode(codeSalle) {
    const [salles]= await pool.query(
         `SELECT id_salle, code, type, capacite
        FROM salles 
        WHERE code = ?;`,
        [codeSalle]
    );
    return salles[0];
}

/**
 * Crée une nouvelle salle.
 * @param {string} code Le code unique de la salle .
 * @param {string} type Le type de la salle .
 * @param {number} capacite La capacité de la salle.
 */

export async function addSalle(code, type, capacite) {
    const [result] = await pool.query(
        `INSERT INTO salles (code, type, capacite)
        VALUES (?, ?, ?);`, 
        [code, type, capacite]
    );
    return result;
}

/**
 * Modifie une salle existante.
 * @param {number} idSalle L'identifiant de la salle à modifier.
 * @param {string} type Le nouveau type de la salle.
 * @param {number} capacite La nouvelle capacité de la salle.
 */

export async function modifySalle(idSalle, type, capacite) {
    const [result] = await pool.query(
        `UPDATE salles 
        SET type = ?, capacite = ?
        WHERE id_salle = ?;`,
        [type, capacite, idSalle]
    );
    return result;
}

/**
 * Supprime une salle par son identifiant.
 * @param {number} idSalle L'identifiant de la salle à supprimer.
 */

export async function deleteSalle(idSalle) {
    const [result] = await pool.query(
        `DELETE FROM salles 
        WHERE id_salle = ?;`,
        [idSalle]
    );
    return result;
}