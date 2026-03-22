import pool from "../../db.js";

export async function creerAffectation(data) {
  const { id_cours, id_professeur, id_salle, date, heure_debut, heure_fin, id_groupes } = data;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [plage] = await connection.query(
      `INSERT INTO plages_horaires (date, heure_debut, heure_fin) VALUES (?, ?, ?)`,
      [date, heure_debut, heure_fin]
    );
    const id_plage_horaires = plage.insertId;
    const [affectation] = await connection.query(
      `INSERT INTO affectation_cours (id_cours, id_professeur, id_salle, id_plage_horaires) VALUES (?, ?, ?, ?)`,
      [id_cours, id_professeur, id_salle, id_plage_horaires]
    );
    const id_affectation_cours = affectation.insertId;
    for (const id_groupe of id_groupes) {
      await connection.query(
        `INSERT INTO affectation_groupes (id_groupes_etudiants, id_affectation_cours) VALUES (?, ?)`,
        [id_groupe, id_affectation_cours]
      );
    }
    await connection.commit();
    return { id_affectation_cours };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function recupererToutesLesAffectations() {
  const [rows] = await pool.query(
    `SELECT
       ac.id_affectation_cours,
       c.code AS code_cours, c.nom AS nom_cours,
       p.nom AS nom_professeur, p.prenom AS prenom_professeur,
       s.code AS code_salle,
       ph.date, ph.heure_debut, ph.heure_fin,
       GROUP_CONCAT(ge.nom_groupe ORDER BY ge.nom_groupe SEPARATOR ', ') AS groupes
     FROM affectation_cours ac
     INNER JOIN cours c ON ac.id_cours = c.id_cours
     INNER JOIN professeurs p ON ac.id_professeur = p.id_professeur
     INNER JOIN salles s ON ac.id_salle = s.id_salle
     INNER JOIN plages_horaires ph ON ac.id_plage_horaires = ph.id_plage_horaires
     LEFT JOIN affectation_groupes ag ON ac.id_affectation_cours = ag.id_affectation_cours
     LEFT JOIN groupes_etudiants ge ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
     GROUP BY ac.id_affectation_cours
     ORDER BY ph.date ASC, ph.heure_debut ASC`
  );
  return rows;
}

export async function supprimerAffectation(id) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [ac] = await connection.query(
      `SELECT id_plage_horaires FROM affectation_cours WHERE id_affectation_cours = ?`, [id]
    );
    if (!ac.length) throw new Error("Affectation introuvable.");
    const id_plage = ac[0].id_plage_horaires;
    await connection.query(`DELETE FROM affectation_groupes WHERE id_affectation_cours = ?`, [id]);
    await connection.query(`DELETE FROM affectation_cours WHERE id_affectation_cours = ?`, [id]);
    await connection.query(`DELETE FROM plages_horaires WHERE id_plage_horaires = ?`, [id_plage]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}