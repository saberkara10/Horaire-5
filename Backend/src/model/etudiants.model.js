/**
 * MODEL - Gestion des etudiants
 *
 * Ce module gere la consultation
 * et l'import des etudiants.
 */

import pool from "../../db.js";
import {
  anneeSessionValide,
  normaliserNomSession,
} from "../utils/sessions.js";

/**
 * Recuperer un etudiant par son identifiant.
 *
 * @param {number} idEtudiant Identifiant de l'etudiant.
 * @returns {Promise<Object|null>} L'etudiant trouve ou null.
 */
export async function recupererEtudiantParId(idEtudiant) {
  const [etudiants] = await pool.query(
    `SELECT
       e.id_etudiant,
       e.matricule,
       e.nom,
       e.prenom,
       ge.nom_groupe AS groupe,
       e.programme,
       e.etape,
       e.session,
       e.annee
     FROM etudiants e
     LEFT JOIN groupes_etudiants ge
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     WHERE e.id_etudiant = ?
     LIMIT 1`,
    [idEtudiant]
  );

  return etudiants[0] || null;
}

/**
 * Recuperer tous les etudiants avec leur groupe eventuel.
 *
 * @returns {Promise<Array<Object>>} Liste des etudiants.
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
       e.etape,
       e.session,
       e.annee
     FROM etudiants e
     LEFT JOIN groupes_etudiants ge
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     ORDER BY e.programme ASC,
              e.annee DESC,
              FIELD(e.session, 'Automne', 'Hiver', 'Printemps', 'Ete'),
              e.etape ASC,
              e.matricule ASC`
  );

  return etudiants;
}

/**
 * Verifier si un matricule existe deja.
 *
 * @param {string} matricule Matricule a verifier.
 * @returns {Promise<boolean>} True si le matricule existe deja.
 */
export async function matriculeExiste(matricule) {
  const [resultat] = await pool.query(
    "SELECT COUNT(*) AS count FROM etudiants WHERE matricule = ?",
    [matricule]
  );

  return Number(resultat[0]?.count || 0) > 0;
}

async function enregistrerProgrammeReference(connexion, programme) {
  await connexion.query(
    `INSERT IGNORE INTO programmes_reference (nom_programme)
     VALUES (?)`,
    [programme]
  );
}

/**
 * Importer une liste d'etudiants avec validation et transaction.
 *
 * @param {Array<Object>} etudiants Liste des etudiants a importer.
 * @returns {Promise<Object>} Resultat de l'import.
 */
export async function importerEtudiants(etudiants) {
  const erreurs = [];

  for (let i = 0; i < etudiants.length; i += 1) {
    const ligne = i + 2;
    const etudiant = etudiants[i];
    const sessionNormalisee = normaliserNomSession(etudiant.session);

    if (!etudiant.matricule || !String(etudiant.matricule).trim()) {
      erreurs.push(`Ligne ${ligne} : matricule obligatoire.`);
      continue;
    }

    if (!etudiant.nom || !String(etudiant.nom).trim()) {
      erreurs.push(`Ligne ${ligne} : nom obligatoire.`);
      continue;
    }

    if (!etudiant.prenom || !String(etudiant.prenom).trim()) {
      erreurs.push(`Ligne ${ligne} : prenom obligatoire.`);
      continue;
    }

    if (!etudiant.programme || !String(etudiant.programme).trim()) {
      erreurs.push(`Ligne ${ligne} : programme obligatoire.`);
      continue;
    }

    if (
      !Number.isInteger(Number(etudiant.etape)) ||
      Number(etudiant.etape) < 1 ||
      Number(etudiant.etape) > 8
    ) {
      erreurs.push(
        `Ligne ${ligne} : etape invalide (doit etre un entier entre 1 et 8).`
      );
      continue;
    }

    if (!sessionNormalisee) {
      erreurs.push(
        `Ligne ${ligne} : session invalide (Automne, Hiver, Printemps ou Ete).`
      );
      continue;
    }

    if (!anneeSessionValide(etudiant.annee)) {
      erreurs.push(
        `Ligne ${ligne} : annee invalide (doit etre un entier entre 2000 et 2100).`
      );
      continue;
    }

    if (String(etudiant.matricule).length > 50) {
      erreurs.push(`Ligne ${ligne} : matricule trop long (max 50 caracteres).`);
      continue;
    }

    if (String(etudiant.nom).length > 100) {
      erreurs.push(`Ligne ${ligne} : nom trop long (max 100 caracteres).`);
      continue;
    }

    if (String(etudiant.prenom).length > 100) {
      erreurs.push(`Ligne ${ligne} : prenom trop long (max 100 caracteres).`);
      continue;
    }

    if (String(etudiant.programme).length > 150) {
      erreurs.push(`Ligne ${ligne} : programme trop long (max 150 caracteres).`);
    }
  }

  if (erreurs.length > 0) {
    return {
      succes: false,
      message: "Import impossible.",
      erreurs,
    };
  }

  const connexion = await pool.getConnection();

  try {
    await connexion.beginTransaction();

    let nombreImportes = 0;

    for (let i = 0; i < etudiants.length; i += 1) {
      const ligne = i + 2;
      const etudiant = etudiants[i];

      const [matricules] = await connexion.query(
        "SELECT COUNT(*) AS count FROM etudiants WHERE matricule = ?",
        [etudiant.matricule]
      );

      if (Number(matricules[0]?.count || 0) > 0) {
        erreurs.push(`Ligne ${ligne} : matricule deja utilise.`);
        continue;
      }

      await enregistrerProgrammeReference(connexion, etudiant.programme);

      await connexion.query(
        `INSERT INTO etudiants
           (matricule, nom, prenom, id_groupes_etudiants, programme, etape, session, annee)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
        [
          String(etudiant.matricule).trim(),
          String(etudiant.nom).trim(),
          String(etudiant.prenom).trim(),
          String(etudiant.programme).trim(),
          Number(etudiant.etape),
          normaliserNomSession(etudiant.session),
          Number(etudiant.annee),
        ]
      );

      nombreImportes += 1;
    }

    if (erreurs.length > 0) {
      await connexion.rollback();
      return {
        succes: false,
        message: "Import impossible.",
        erreurs,
      };
    }

    await connexion.commit();

    return {
      succes: true,
      message: "Import termine avec succes.",
      nombreImportes,
    };
  } catch (error) {
    await connexion.rollback();
    throw error;
  } finally {
    connexion.release();
  }
}

/**
 * Supprimer tous les etudiants importes
 * ainsi que les groupes et horaires generes.
 *
 * @returns {Promise<void>}
 */
export async function supprimerTousLesEtudiants() {
  const connexion = await pool.getConnection();

  try {
    await connexion.beginTransaction();

    await connexion.query("DELETE FROM affectation_groupes");
    await connexion.query("DELETE FROM affectation_cours");
    await connexion.query("DELETE FROM plages_horaires");
    await connexion.query("DELETE FROM etudiants");
    await connexion.query("DELETE FROM groupes_etudiants");

    await connexion.commit();
  } catch (error) {
    await connexion.rollback();
    throw error;
  } finally {
    connexion.release();
  }
}
