import pool from "../../db.js";

export async function creerAffectation(data) {
  const {
    id_cours,
    id_professeur,
    id_salle,
    date,
    heure_debut,
    heure_fin,
    id_groupes,
  } = data;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [plage] = await connection.query(
      `INSERT INTO plages_horaires (date, heure_debut, heure_fin)
       VALUES (?, ?, ?)`,
      [date, heure_debut, heure_fin]
    );

    const id_plage_horaires = plage.insertId;

    const [affectation] = await connection.query(
      `INSERT INTO affectation_cours
       (id_cours, id_professeur, id_salle, id_plage_horaires)
       VALUES (?, ?, ?, ?)`,
      [id_cours, id_professeur, id_salle, id_plage_horaires]
    );

    const id_affectation_cours = affectation.insertId;

    for (const id_groupe of id_groupes) {
      await connection.query(
        `INSERT INTO affectation_groupes (id_groupes_etudiants, id_affectation_cours)
         VALUES (?, ?)`,
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