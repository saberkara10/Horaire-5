/**
 * MODEL — Gestion des étudiants
 *
 * Ce module contient les requêtes SQL liées
 * à la consultation et à l'import des étudiants.
 */

import pool from "../../db.js";

/**
 * Récupérer un étudiant par son identifiant.
 *
 * @param {number} idEtudiant - Identifiant de l'étudiant.
 * @returns {Promise<Object|null>} L'étudiant trouvé ou null.
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
       e.etape
     FROM etudiants e
     INNER JOIN groupes_etudiants ge ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     WHERE e.id_etudiant = ?
     LIMIT 1`,
    [idEtudiant]
  );

  return etudiantTrouve.length ? etudiantTrouve[0] : null;
}

/**
 * Récupérer l'horaire d'un étudiant à partir de son groupe.
 *
 * @param {string} groupeEtudiant - Groupe de l'étudiant.
 * @returns {Promise<Array<Object>>} Liste des séances.
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
 * Récupérer tous les étudiants avec leur groupe.
 *
 * @returns {Promise<Array<Object>>} Liste des étudiants.
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
       e.etape
     FROM etudiants e
     INNER JOIN groupes_etudiants ge ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     ORDER BY e.matricule ASC`
  );

  return etudiants;
}

/**
 * Récupérer les informations complètes d'un étudiant avec son horaire.
 *
 * @param {number} idEtudiant - Identifiant de l'étudiant.
 * @returns {Promise<Object|null>} Données complètes ou null.
 */
export async function recupererHoraireCompletEtudiant(idEtudiant) {
  const etudiant = await recupererEtudiantParId(idEtudiant);

  if (!etudiant) {
    return null;
  }

  const horaire = await recupererHoraireParGroupe(etudiant.groupe);

  return {
    etudiant,
    horaire,
  };
}

/**
 * Vérifier si un matricule existe déjà.
 *
 * @param {string} matricule - Matricule à vérifier.
 * @returns {Promise<boolean>} True si le matricule existe.
 */
export async function matriculeExiste(matricule) {
  const [resultat] = await pool.query(
    "SELECT COUNT(*) as count FROM etudiants WHERE matricule = ?",
    [matricule]
  );
  return resultat[0].count > 0;
}

/**
 * Récupérer ou créer un groupe d'étudiants.
 *
 * @param {string} nomGroupe - Nom du groupe.
 * @returns {Promise<number>} ID du groupe.
 */
export async function recupererOuCreerGroupe(nomGroupe) {
  const [groupeExistant] = await pool.query(
    "SELECT id_groupes_etudiants FROM groupes_etudiants WHERE nom_groupe = ?",
    [nomGroupe]
  );

  if (groupeExistant.length > 0) {
    return groupeExistant[0].id_groupes_etudiants;
  }

  const [resultat] = await pool.query(
    "INSERT INTO groupes_etudiants (nom_groupe) VALUES (?)",
    [nomGroupe]
  );

  return resultat.insertId;
}

/**
 * Importer une liste d'étudiants avec validation et transaction.
 *
 * @param {Array<Object>} etudiants - Liste des étudiants à importer.
 * @returns {Promise<Object>} Résultat de l'import.
 */
export async function importerEtudiants(etudiants) {
  const erreurs = [];
  const groupesCache = new Map();

  for (let i = 0; i < etudiants.length; i++) {
    const ligne = i + 2;
    const etudiant = etudiants[i];

    if (!etudiant.matricule || etudiant.matricule.trim() === "") {
      erreurs.push(`Ligne ${ligne} : matricule obligatoire.`);
      continue;
    }
    if (!etudiant.nom || etudiant.nom.trim() === "") {
      erreurs.push(`Ligne ${ligne} : nom obligatoire.`);
      continue;
    }
    if (!etudiant.prenom || etudiant.prenom.trim() === "") {
      erreurs.push(`Ligne ${ligne} : prénom obligatoire.`);
      continue;
    }
    if (!etudiant.groupe || etudiant.groupe.trim() === "") {
      erreurs.push(`Ligne ${ligne} : groupe obligatoire.`);
      continue;
    }
    if (!etudiant.programme || etudiant.programme.trim() === "") {
      erreurs.push(`Ligne ${ligne} : programme obligatoire.`);
      continue;
    }
    if (
      !etudiant.etape ||
      isNaN(etudiant.etape) ||
      etudiant.etape < 1 ||
      etudiant.etape > 8
    ) {
      erreurs.push(
        `Ligne ${ligne} : étape invalide (doit être un entier entre 1 et 8).`
      );
      continue;
    }

    if (etudiant.matricule.length > 50) {
      erreurs.push(`Ligne ${ligne} : matricule trop long (max 50 caractères).`);
      continue;
    }
    if (etudiant.nom.length > 100) {
      erreurs.push(`Ligne ${ligne} : nom trop long (max 100 caractères).`);
      continue;
    }
    if (etudiant.prenom.length > 100) {
      erreurs.push(`Ligne ${ligne} : prénom trop long (max 100 caractères).`);
      continue;
    }
    if (etudiant.groupe.length > 100) {
      erreurs.push(`Ligne ${ligne} : groupe trop long (max 100 caractères).`);
      continue;
    }
    if (etudiant.programme.length > 150) {
      erreurs.push(`Ligne ${ligne} : programme trop long (max 150 caractères).`);
      continue;
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
  await connexion.beginTransaction();

  try {
    let nombreImportes = 0;

    for (let i = 0; i < etudiants.length; i++) {
      const ligne = i + 2;
      const etudiant = etudiants[i];

      const matriculeUtilise = await connexion.query(
        "SELECT COUNT(*) as count FROM etudiants WHERE matricule = ?",
        [etudiant.matricule]
      );

      if (matriculeUtilise[0][0].count > 0) {
        erreurs.push(`Ligne ${ligne} : matricule déjà utilisé.`);
        continue;
      }

      let idGroupe = groupesCache.get(etudiant.groupe);
      if (!idGroupe) {
        const [groupeExistant] = await connexion.query(
          "SELECT id_groupes_etudiants FROM groupes_etudiants WHERE nom_groupe = ?",
          [etudiant.groupe]
        );

        if (groupeExistant.length > 0) {
          idGroupe = groupeExistant[0].id_groupes_etudiants;
        } else {
          const [resultatGroupe] = await connexion.query(
            "INSERT INTO groupes_etudiants (nom_groupe) VALUES (?)",
            [etudiant.groupe]
          );
          idGroupe = resultatGroupe.insertId;
        }
        groupesCache.set(etudiant.groupe, idGroupe);
      }

      await connexion.query(
        `INSERT INTO etudiants
         (matricule, nom, prenom, id_groupes_etudiants, programme, etape)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          etudiant.matricule,
          etudiant.nom,
          etudiant.prenom,
          idGroupe,
          etudiant.programme,
          etudiant.etape,
        ]
      );

      nombreImportes++;
    }

    if (erreurs.length > 0) {
      await connexion.rollback();
      connexion.release();
      return {
        succes: false,
        message: "Import impossible.",
        erreurs,
      };
    }

    await connexion.commit();
    connexion.release();

    return {
      succes: true,
      message: "Import terminé avec succès.",
      nombreImportes,
    };
  } catch (erreur) {
    await connexion.rollback();
    connexion.release();
    throw erreur;
  }
}