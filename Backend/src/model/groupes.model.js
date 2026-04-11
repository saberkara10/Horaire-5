/**
 * MODEL - Gestion des groupes
 *
 * Ce module centralise la lecture
 * des groupes et de leurs horaires.
 */

import pool from "../../db.js";
import { assurerSchemaSchedulerAcademique } from "../services/academic-scheduler-schema.js";

const SESSION_ACTIVE_SQL = `(
  SELECT id_session
  FROM sessions
  WHERE active = TRUE
  ORDER BY id_session DESC
  LIMIT 1
)`;

/**
 * Recuperer la liste des groupes.
 *
 * @param {boolean} details Inclure programme, etape, session et effectif.
 * @returns {Promise<Array<Object>>} Liste des groupes.
 */
export async function recupererGroupes(details = false, options = {}) {
  const {
    sessionActive = false,
    seulementAvecEffectif = false,
    seulementAvecPlanning = false,
    inclureGroupesSpeciaux = false,
  } = options;

  await assurerSchemaSchedulerAcademique();

  const clauses = [];
  const valeurs = [];

  if (sessionActive) {
    clauses.push(
      `ge.id_session = (
        SELECT id_session
        FROM sessions
        WHERE active = TRUE
        ORDER BY id_session DESC
        LIMIT 1
      )`
    );
  }

  if (seulementAvecPlanning) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM affectation_groupes ag
        WHERE ag.id_groupes_etudiants = ge.id_groupes_etudiants
      )`
    );
  }

  if (!inclureGroupesSpeciaux) {
    clauses.push(`COALESCE(ge.est_groupe_special, 0) = 0`);
  }

  const clauseWhere =
    clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const clauseHaving = seulementAvecEffectif
    ? `HAVING CASE
         WHEN COALESCE(ge.est_groupe_special, 0) = 1
           THEN COUNT(DISTINCT ae.id_etudiant)
         ELSE COUNT(DISTINCT e.id_etudiant)
       END > 0`
    : "";

  const [groupes] = details
    ? await pool.query(
        `SELECT ge.id_groupes_etudiants,
                ge.nom_groupe,
                ge.est_groupe_special,
                COALESCE(MAX(e.programme), ge.programme) AS programme,
                COALESCE(MAX(e.etape), ge.etape) AS etape,
                COALESCE(MAX(e.session), s.nom) AS session,
                CASE
                  WHEN COALESCE(ge.est_groupe_special, 0) = 1
                    THEN COUNT(DISTINCT ae.id_etudiant)
                  ELSE COUNT(DISTINCT e.id_etudiant)
                END AS effectif,
                (SELECT COUNT(*) FROM affectation_groupes ag2
                 WHERE ag2.id_groupes_etudiants = ge.id_groupes_etudiants) AS nb_seances,
                CASE
                  WHEN (SELECT COUNT(*) FROM affectation_groupes ag3
                        WHERE ag3.id_groupes_etudiants = ge.id_groupes_etudiants) > 0
                  THEN 1 ELSE 0
                END AS a_horaire
         FROM groupes_etudiants ge
         LEFT JOIN etudiants e
           ON e.id_groupes_etudiants = ge.id_groupes_etudiants
         LEFT JOIN affectation_etudiants ae
           ON ae.id_groupes_etudiants = ge.id_groupes_etudiants
          AND ae.id_session = ge.id_session
         LEFT JOIN sessions s
           ON s.id_session = ge.id_session
         ${clauseWhere}
         GROUP BY ge.id_groupes_etudiants,
                  ge.nom_groupe,
                  ge.est_groupe_special,
                  ge.programme,
                  ge.etape,
                  s.nom
         ${clauseHaving}
         ORDER BY ge.nom_groupe ASC`,
        valeurs
      )
    : await pool.query(
        `SELECT ge.id_groupes_etudiants, ge.nom_groupe, ge.est_groupe_special
         FROM groupes_etudiants ge
         ${clauseWhere}
         ORDER BY ge.nom_groupe ASC`,
        valeurs
      );

  return groupes;
}

/**
 * Recuperer un groupe par son identifiant.
 *
 * @param {number} idGroupe Identifiant du groupe.
 * @returns {Promise<Object|null>} Groupe trouve ou null.
 */
export async function recupererGroupeParId(idGroupe) {
  await assurerSchemaSchedulerAcademique();

  const [groupes] = await pool.query(
    `SELECT ge.id_groupes_etudiants,
            ge.nom_groupe,
            ge.est_groupe_special,
            COALESCE(MAX(e.programme), ge.programme) AS programme,
            COALESCE(MAX(e.etape), ge.etape) AS etape,
            COALESCE(MAX(e.session), s.nom) AS session,
            CASE
              WHEN COALESCE(ge.est_groupe_special, 0) = 1
                THEN COUNT(DISTINCT ae.id_etudiant)
              ELSE COUNT(DISTINCT e.id_etudiant)
            END AS effectif
     FROM groupes_etudiants ge
     LEFT JOIN etudiants e
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     LEFT JOIN affectation_etudiants ae
       ON ae.id_groupes_etudiants = ge.id_groupes_etudiants
      AND ae.id_session = ge.id_session
     LEFT JOIN sessions s
       ON s.id_session = ge.id_session
     WHERE ge.id_groupes_etudiants = ?
     GROUP BY ge.id_groupes_etudiants,
              ge.nom_groupe,
              ge.est_groupe_special,
              ge.programme,
              ge.etape,
              s.nom
     LIMIT 1`,
    [idGroupe]
  );

  return groupes[0] || null;
}

/**
 * Recuperer l'horaire detaille d'un groupe.
 *
 * @param {number} idGroupe Identifiant du groupe.
 * @returns {Promise<Array<Object>>} Liste des seances.
 */
export async function recupererHoraireGroupe(idGroupe) {
  const [horaire] = await pool.query(
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
       DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
       ph.heure_debut,
       ph.heure_fin
     FROM affectation_groupes ag
     JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     JOIN affectation_cours ac
       ON ac.id_affectation_cours = ag.id_affectation_cours
     JOIN cours c
       ON c.id_cours = ac.id_cours
     JOIN professeurs p
       ON p.id_professeur = ac.id_professeur
     LEFT JOIN salles s
       ON s.id_salle = ac.id_salle
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ag.id_groupes_etudiants = ?
       AND ge.id_session = ${SESSION_ACTIVE_SQL}
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [idGroupe]
  );

  return horaire;
}

/**
 * Recuperer les informations completes d'un groupe avec son horaire.
 *
 * @param {number} idGroupe Identifiant du groupe.
 * @returns {Promise<Object|null>} Resume complet du groupe ou null.
 */
export async function recupererPlanningCompletGroupe(idGroupe) {
  const groupe = await recupererGroupeParId(idGroupe);

  if (!groupe) {
    return null;
  }

  const horaire = await recupererHoraireGroupe(idGroupe);

  return {
    groupe,
    horaire,
  };
}
