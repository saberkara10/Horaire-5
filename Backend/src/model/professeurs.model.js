/**
 * MODEL - Gestion des professeurs
 *
 * Ce module gere les professeurs, leurs disponibilites,
 * leurs cours assignes et leur horaire.
 */

import pool from "../../db.js";

function normaliserHeure(heure) {
  const valeur = String(heure || "").trim();

  if (!valeur) {
    return "";
  }

  if (valeur.length === 5) {
    return `${valeur}:00`;
  }

  return valeur.slice(0, 8);
}

async function assurerTableDisponibilites(executor = pool) {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS disponibilites_professeurs (
      id_disponibilite_professeur INT NOT NULL AUTO_INCREMENT,
      id_professeur INT NOT NULL,
      jour_semaine TINYINT NOT NULL,
      heure_debut TIME NOT NULL,
      heure_fin TIME NOT NULL,
      PRIMARY KEY (id_disponibilite_professeur),
      UNIQUE KEY uniq_disponibilite_professeur (
        id_professeur,
        jour_semaine,
        heure_debut,
        heure_fin
      ),
      CONSTRAINT fk_disponibilite_professeur
        FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
        ON DELETE CASCADE,
      CONSTRAINT chk_disponibilite_jour
        CHECK (jour_semaine BETWEEN 1 AND 7),
      CONSTRAINT chk_disponibilite_heure
        CHECK (heure_debut < heure_fin)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       DROP CHECK chk_disponibilite_jour`
    );
  } catch {
    // Le check peut etre absent ou deja conforme selon l'etat de la base.
  }

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       ADD CONSTRAINT chk_disponibilite_jour
       CHECK (jour_semaine BETWEEN 1 AND 7)`
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();

    if (!message.includes("duplicate") && !message.includes("exists")) {
      throw error;
    }
  }
}

async function assurerTableProfesseurCours(executor = pool) {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS professeur_cours (
      id_professeur_cours INT NOT NULL AUTO_INCREMENT,
      id_professeur INT NOT NULL,
      id_cours INT NOT NULL,
      PRIMARY KEY (id_professeur_cours),
      UNIQUE KEY uniq_professeur_cours (id_professeur, id_cours),
      CONSTRAINT fk_professeur_cours_professeur
        FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
        ON DELETE CASCADE,
      CONSTRAINT fk_professeur_cours_cours
        FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

function normaliserCoursIds(coursIds = []) {
  return [...new Set(
    coursIds
      .map((idCours) => Number(idCours))
      .filter((idCours) => Number.isInteger(idCours) && idCours > 0)
  )];
}

async function recupererProfesseurParColonne(colonne, valeur) {
  await assurerTableProfesseurCours();

  const [listeProfesseurs] = await pool.query(
    `SELECT p.id_professeur,
            p.matricule,
            p.nom,
            p.prenom,
            p.specialite,
            COALESCE(GROUP_CONCAT(DISTINCT c.code ORDER BY c.code SEPARATOR ', '), '') AS cours_assignes,
            COALESCE(GROUP_CONCAT(DISTINCT c.id_cours ORDER BY c.code SEPARATOR ','), '') AS cours_ids,
            COUNT(DISTINCT c.id_cours) AS nombre_cours
     FROM professeurs p
     LEFT JOIN professeur_cours pc
       ON pc.id_professeur = p.id_professeur
     LEFT JOIN cours c
       ON c.id_cours = pc.id_cours
     WHERE p.${colonne} = ?
     GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
     LIMIT 1`,
    [valeur]
  );

  return listeProfesseurs[0] || null;
}

export async function recupererTousLesProfesseurs() {
  await assurerTableProfesseurCours();

  const [listeProfesseurs] = await pool.query(
    `SELECT p.id_professeur,
            p.matricule,
            p.nom,
            p.prenom,
            p.specialite,
            COALESCE(GROUP_CONCAT(DISTINCT c.code ORDER BY c.code SEPARATOR ', '), '') AS cours_assignes,
            COALESCE(GROUP_CONCAT(DISTINCT c.id_cours ORDER BY c.code SEPARATOR ','), '') AS cours_ids,
            COUNT(DISTINCT c.id_cours) AS nombre_cours
     FROM professeurs p
     LEFT JOIN professeur_cours pc
       ON pc.id_professeur = p.id_professeur
     LEFT JOIN cours c
       ON c.id_cours = pc.id_cours
     GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
     ORDER BY p.matricule ASC`
  );

  return listeProfesseurs;
}

export async function recupererProfesseurParId(idProfesseur) {
  return recupererProfesseurParColonne("id_professeur", idProfesseur);
}

export async function recupererProfesseurParMatricule(matriculeProfesseur) {
  return recupererProfesseurParColonne("matricule", matriculeProfesseur);
}

export async function recupererCoursProfesseur(idProfesseur) {
  await assurerTableProfesseurCours();

  const [cours] = await pool.query(
    `SELECT c.id_cours,
            c.code,
            c.nom,
            c.programme,
            c.etape_etude
     FROM professeur_cours pc
     JOIN cours c
       ON c.id_cours = pc.id_cours
     WHERE pc.id_professeur = ?
     ORDER BY c.code ASC`,
    [idProfesseur]
  );

  return cours;
}

export async function recupererIndexCoursProfesseurs(executor = pool) {
  await assurerTableProfesseurCours(executor);

  const [liens] = await executor.query(
    `SELECT id_professeur, id_cours
     FROM professeur_cours
     ORDER BY id_professeur ASC, id_cours ASC`
  );

  const coursParProfesseur = new Map();

  liens.forEach((lien) => {
    const coursActuels = coursParProfesseur.get(lien.id_professeur) || new Set();
    coursActuels.add(Number(lien.id_cours));
    coursParProfesseur.set(lien.id_professeur, coursActuels);
  });

  return coursParProfesseur;
}

export async function recupererDisponibilitesProfesseur(idProfesseur) {
  await assurerTableDisponibilites();

  const [disponibilites] = await pool.query(
    `SELECT id_disponibilite_professeur,
            id_professeur,
            jour_semaine,
            heure_debut,
            heure_fin
     FROM disponibilites_professeurs
     WHERE id_professeur = ?
     ORDER BY jour_semaine ASC, heure_debut ASC`,
    [idProfesseur]
  );

  return disponibilites;
}

export async function recupererDisponibilitesProfesseurs(executor = pool) {
  await assurerTableDisponibilites(executor);

  const [disponibilites] = await executor.query(
    `SELECT id_professeur, jour_semaine, heure_debut, heure_fin
     FROM disponibilites_professeurs
     ORDER BY id_professeur ASC, jour_semaine ASC, heure_debut ASC`
  );

  const disponibilitesParProfesseur = new Map();

  disponibilites.forEach((disponibilite) => {
    const disponibilitesActuelles =
      disponibilitesParProfesseur.get(disponibilite.id_professeur) || [];
    disponibilitesActuelles.push(disponibilite);
    disponibilitesParProfesseur.set(
      disponibilite.id_professeur,
      disponibilitesActuelles
    );
  });

  return disponibilitesParProfesseur;
}

export async function remplacerDisponibilitesProfesseur(idProfesseur, disponibilites) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await assurerTableDisponibilites(connection);

    await connection.query(
      `DELETE FROM disponibilites_professeurs
       WHERE id_professeur = ?`,
      [idProfesseur]
    );

    for (const disponibilite of disponibilites) {
      await connection.query(
        `INSERT INTO disponibilites_professeurs (
          id_professeur,
          jour_semaine,
          heure_debut,
          heure_fin
        )
        VALUES (?, ?, ?, ?)`,
        [
          idProfesseur,
          disponibilite.jour_semaine,
          normaliserHeure(disponibilite.heure_debut),
          normaliserHeure(disponibilite.heure_fin),
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return recupererDisponibilitesProfesseur(idProfesseur);
}

export async function remplacerCoursProfesseur(idProfesseur, coursIds) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await assurerTableProfesseurCours(connection);

    await connection.query(
      `DELETE FROM professeur_cours
       WHERE id_professeur = ?`,
      [idProfesseur]
    );

    const coursNormalises = normaliserCoursIds(coursIds);

    for (const idCours of coursNormalises) {
      await connection.query(
        `INSERT INTO professeur_cours (id_professeur, id_cours)
         VALUES (?, ?)`,
        [idProfesseur, idCours]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return recupererCoursProfesseur(idProfesseur);
}

export async function ajouterProfesseur(nouveauProfesseur) {
  const { matricule, nom, prenom, specialite, cours_ids = [] } = nouveauProfesseur;

  const [resultatInsertion] = await pool.query(
    `INSERT INTO professeurs (matricule, nom, prenom, specialite)
     VALUES (?, ?, ?, ?)`,
    [matricule, nom, prenom, specialite ?? null]
  );

  const professeurAjoute = await recupererProfesseurParId(resultatInsertion.insertId);

  if (cours_ids !== undefined) {
    await remplacerCoursProfesseur(resultatInsertion.insertId, cours_ids);
  }

  return recupererProfesseurParId(professeurAjoute.id_professeur);
}

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

  if (champsAModifier.length > 0) {
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
  }

  if (donneesModification.cours_ids !== undefined) {
    await remplacerCoursProfesseur(idProfesseur, donneesModification.cours_ids);
  }

  return recupererProfesseurParId(idProfesseur);
}

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

export async function supprimerProfesseur(idProfesseur) {
  await assurerTableDisponibilites();
  await assurerTableProfesseurCours();

  await pool.query(
    `DELETE FROM disponibilites_professeurs
     WHERE id_professeur = ?`,
    [idProfesseur]
  );
  await pool.query(
    `DELETE FROM professeur_cours
     WHERE id_professeur = ?`,
    [idProfesseur]
  );

  const [resultatSuppression] = await pool.query(
    `DELETE FROM professeurs
     WHERE id_professeur = ?
     LIMIT 1`,
    [idProfesseur]
  );

  return resultatSuppression.affectedRows > 0;
}

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
        ph.heure_fin,
        COALESCE(
          GROUP_CONCAT(DISTINCT ge.nom_groupe ORDER BY ge.nom_groupe SEPARATOR ', '),
          ''
        ) AS groupes
     FROM affectation_cours ac
     JOIN cours c
       ON c.id_cours = ac.id_cours
     JOIN salles s
       ON s.id_salle = ac.id_salle
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     LEFT JOIN affectation_groupes ag
       ON ag.id_affectation_cours = ac.id_affectation_cours
     LEFT JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     WHERE ac.id_professeur = ?
     GROUP BY ac.id_affectation_cours,
              c.id_cours,
              c.code,
              c.nom,
              c.programme,
              c.etape_etude,
              c.duree,
              s.id_salle,
              s.code,
              s.type,
              ph.id_plage_horaires,
              ph.date,
              ph.heure_debut,
              ph.heure_fin
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [idProfesseur]
  );

  return horaireProfesseur;
}
