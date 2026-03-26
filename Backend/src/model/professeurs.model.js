/**
 * MODEL - Gestion des professeurs
 *
 * Ce module contient uniquement les requetes SQL liees a la table `professeurs`
 * et a leurs disponibilites.
 * Aucune validation metier ici.
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
        CHECK (jour_semaine BETWEEN 1 AND 5),
      CONSTRAINT chk_disponibilite_heure
        CHECK (heure_debut < heure_fin)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

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
 * Recuperer les disponibilites hebdomadaires d'un professeur.
 *
 * @param {number} idProfesseur
 * @returns {Promise<Array<Object>>}
 */
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

/**
 * Recuperer toutes les disponibilites indexees par professeur.
 *
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 * @returns {Promise<Map<number, Array<Object>>>}
 */
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

/**
 * Remplacer les disponibilites d'un professeur.
 *
 * @param {number} idProfesseur
 * @param {Array<Object>} disponibilites
 * @returns {Promise<Array<Object>>}
 */
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

/**
 * Ajouter un nouveau professeur.
 *
 * @param {Object} nouveauProfesseur
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
 * @param {number} idProfesseur
 * @param {Object} donneesModification
 * @returns {Promise<Object|null>}
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
 * @param {number} idProfesseur
 * @returns {Promise<boolean>}
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
 * @param {number} idProfesseur
 * @returns {Promise<boolean>}
 */
export async function supprimerProfesseur(idProfesseur) {
  await assurerTableDisponibilites();

  await pool.query(
    `DELETE FROM disponibilites_professeurs
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

/**
 * Recuperer l'horaire complet d'un professeur.
 *
 * @param {number} idProfesseur
 * @returns {Promise<Array<Object>>}
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
