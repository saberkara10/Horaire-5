/**
 * Acces base de donnees pour l'import des etudiants.
 *
 * Ce module est separe du modele etudiants existant afin de ne pas
 * melanger la consultation d'horaire avec la logique d'import.
 * L'import suit une strategie transactionnelle :
 * - controler les doublons de matricule en base ;
 * - resoudre ou creer les groupes mentionnes dans le fichier ;
 * - inserer tous les etudiants dans une seule transaction.
 * Si une erreur survient, aucune ligne n'est conservee en base.
 */

import pool from "../../db.js";

async function recupererMatriculesExistants(connection, matricules) {
  if (matricules.length === 0) {
    return [];
  }

  const placeholders = matricules.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT matricule
     FROM etudiants
     WHERE matricule IN (${placeholders})`,
    matricules
  );

  return rows.map(({ matricule }) => matricule);
}

async function recupererGroupesParNoms(connection, nomsGroupes) {
  if (nomsGroupes.length === 0) {
    return [];
  }

  const placeholders = nomsGroupes.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT id_groupes_etudiants, nom_groupe
     FROM groupes_etudiants
     WHERE nom_groupe IN (${placeholders})`,
    nomsGroupes
  );

  return rows;
}

async function creerGroupeEtudiant(connection, nomGroupe) {
  const [resultat] = await connection.query(
    `INSERT INTO groupes_etudiants (nom_groupe)
     VALUES (?)`,
    [nomGroupe]
  );

  return resultat.insertId;
}

async function ajouterEtudiant(connection, etudiant) {
  const [resultat] = await connection.query(
    `INSERT INTO etudiants (
       matricule,
       nom,
       prenom,
       programme,
       etape_etude,
       id_groupes_etudiants
     )
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      etudiant.matricule,
      etudiant.nom,
      etudiant.prenom,
      etudiant.programme,
      etudiant.etape,
      etudiant.id_groupes_etudiants,
    ]
  );

  return resultat.insertId;
}

async function recupererGroupeParNom(connection, nomGroupe) {
  const [rows] = await connection.query(
    `SELECT id_groupes_etudiants, nom_groupe
     FROM groupes_etudiants
     WHERE nom_groupe = ?
     LIMIT 1`,
    [nomGroupe]
  );

  return rows[0] ?? null;
}

/**
 * Enregistrer un lot d'etudiants deja valides par le service d'import.
 *
 * Le service en amont garantit deja la structure du fichier et la qualite des
 * donnees ligne par ligne. Ici, on se concentre uniquement sur la coherence
 * base de donnees et sur la persistance transactionnelle.
 *
 * @param {Array<Object>} etudiants Liste des etudiants pre-valides.
 * @returns {Promise<{nombreImportes?: number, erreurs?: string[]}>}
 */
export async function enregistrerEtudiantsImportes(etudiants) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const matricules = etudiants.map((etudiant) => etudiant.matricule);
    const matriculesExistants = new Set(
      await recupererMatriculesExistants(connection, matricules)
    );

    const erreurs = etudiants
      .filter((etudiant) => matriculesExistants.has(etudiant.matricule))
      .map(
        (etudiant) =>
          `Ligne ${etudiant.numeroLigne} : l'etudiant au matricule ${etudiant.matricule} est deja present dans la base de donnees.`
      );

    if (erreurs.length > 0) {
      await connection.rollback();
      return { erreurs };
    }

    // Un meme groupe peut apparaitre sur plusieurs lignes du fichier.
    // On charge d'abord les groupes deja presents pour eviter les requetes
    // repetitives et conserver un mapping nom -> identifiant SQL.
    const groupesParNom = new Map();
    const nomsGroupes = [...new Set(etudiants.map((etudiant) => etudiant.groupe))];
    const groupesExistants = await recupererGroupesParNoms(connection, nomsGroupes);

    for (const groupe of groupesExistants) {
      groupesParNom.set(groupe.nom_groupe, groupe.id_groupes_etudiants);
    }

    for (const nomGroupe of nomsGroupes) {
      if (groupesParNom.has(nomGroupe)) {
        continue;
      }

      try {
        const idGroupe = await creerGroupeEtudiant(connection, nomGroupe);
        groupesParNom.set(nomGroupe, idGroupe);
      } catch (error) {
        // En environnement concurrent, un autre import peut avoir cree le groupe
        // entre notre lecture initiale et l'insertion. Dans ce cas, on relit
        // simplement le groupe deja cree au lieu d'ecrire un doublon.
        if (error.code !== "ER_DUP_ENTRY") {
          throw error;
        }

        const groupeExistant = await recupererGroupeParNom(connection, nomGroupe);
        groupesParNom.set(nomGroupe, groupeExistant.id_groupes_etudiants);
      }
    }

    for (const etudiant of etudiants) {
      await ajouterEtudiant(connection, {
        ...etudiant,
        id_groupes_etudiants: groupesParNom.get(etudiant.groupe),
      });
    }

    // Le commit n'intervient qu'une fois tout le lot traite avec succes.
    await connection.commit();

    return { nombreImportes: etudiants.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
