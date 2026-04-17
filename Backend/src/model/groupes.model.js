/**
 * Modèle de données — Gestion des groupes d'étudiants.
 *
 * Ce module gère la lecture des groupes d'étudiants et de leurs horaires.
 * Les groupes sont des entités centrales dans le système : chaque étudiant
 * appartient à un groupe, et chaque groupe reçoit un horaire généré
 * par le planificateur (scheduler).
 *
 * Types de groupes :
 *  - Groupes normaux : formés automatiquement lors de la création de cohortes
 *  - Groupes spéciaux (`est_groupe_special = 1`) : groupes créés manuellement
 *    pour des situations particulières (étudiants en reprise, cas exceptionnels)
 *
 * @module model/groupes
 */

import pool from "../../db.js";
import { assurerSchemaSchedulerAcademique } from "../services/academic-scheduler-schema.js";

/**
 * Sous-requête SQL réutilisable pour récupérer l'ID de la session active.
 *
 * On prend la session avec `active = TRUE` et l'ID le plus élevé
 * au cas où plusieurs sessions seraient marquées actives par erreur.
 * Cette constante est injectée directement dans les requêtes SQL pour éviter
 * les répétitions et maintenir la cohérence.
 *
 * @type {string}
 */
const SESSION_ACTIVE_SQL = `(
  SELECT id_session
  FROM sessions
  WHERE active = TRUE
  ORDER BY id_session DESC
  LIMIT 1
)`;

/**
 * Récupère la liste des groupes d'étudiants avec options de filtrage.
 *
 * Mode simple (details = false) : retourne seulement id + nom_groupe.
 * Mode détaillé (details = true) : inclut programme, étape, session,
 * effectif calculé, nombre de séances planifiées et indicateur d'horaire.
 *
 * Les filtres dans `options` peuvent être combinés librement :
 *  - sessionActive         → limiter à la session académique active
 *  - seulementAvecEffectif → exclure les groupes vides
 *  - seulementAvecPlanning → exclure les groupes sans aucune séance planifiée
 *  - inclureGroupesSpeciaux → inclure les groupes spéciaux (exclus par défaut)
 *
 * L'effectif est calculé différemment selon le type de groupe :
 *  - Groupes normaux : COUNT(DISTINCT e.id_etudiant)
 *  - Groupes spéciaux : COUNT via affectation_etudiants pour la session active
 *
 * @param {boolean} [details=false] - Si true, inclut les informations détaillées
 * @param {object} [options={}] - Options de filtrage
 * @param {boolean} [options.sessionActive=false] - Limiter à la session active
 * @param {boolean} [options.seulementAvecEffectif=false] - Exclure les groupes vides
 * @param {boolean} [options.seulementAvecPlanning=false] - Exclure sans planning
 * @param {boolean} [options.inclureGroupesSpeciaux=false] - Inclure les groupes spéciaux
 * @returns {Promise<object[]>} Liste des groupes selon les critères demandés
 */
export async function recupererGroupes(details = false, options = {}) {
  const {
    sessionActive = false,
    seulementAvecEffectif = false,
    seulementAvecPlanning = false,
    inclureGroupesSpeciaux = false,
  } = options;

  // Vérifier que le schéma de la BDD est à jour avant toute requête
  await assurerSchemaSchedulerAcademique();

  // Construction dynamique des clauses WHERE selon les options
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
    // Sous-requête EXISTS : rapide et optimisée par MySQL même sur grandes tables
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM affectation_groupes ag
        WHERE ag.id_groupes_etudiants = ge.id_groupes_etudiants
      )`
    );
  }

  if (!inclureGroupesSpeciaux) {
    // COALESCE gère le cas où est_groupe_special est NULL dans l'ancien schéma
    clauses.push(`COALESCE(ge.est_groupe_special, 0) = 0`);
  }

  const clauseWhere =
    clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  // HAVING sur l'effectif calculé (ne peut pas être dans WHERE car c'est un agrégat)
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
        // Mode simplifié — pas de jointures, juste l'essentiel
        `SELECT ge.id_groupes_etudiants, ge.nom_groupe, ge.est_groupe_special
         FROM groupes_etudiants ge
         ${clauseWhere}
         ORDER BY ge.nom_groupe ASC`,
        valeurs
      );

  return groupes;
}

/**
 * Récupère les informations complètes d'un groupe par son identifiant.
 *
 * Retourne les mêmes colonnes que recupererGroupes() en mode détaillé,
 * mais pour un seul groupe. Inclut programme, étape, session et effectif.
 *
 * @param {number} idGroupe - L'identifiant du groupe à récupérer
 * @returns {Promise<object|null>} Le groupe avec ses détails, ou null s'il n'existe pas
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
 * Récupère l'horaire détaillé d'un groupe (toutes ses séances planifiées).
 *
 * Retourne uniquement les séances de la session active via la sous-requête
 * SESSION_ACTIVE_SQL. Les séances sont triées par date puis par heure de début.
 *
 * Champs retournés par séance :
 *  - Identifiants (affectation, cours, professeur, salle, plage horaire)
 *  - Code et nom du cours
 *  - Nom et prénom du professeur
 *  - Code et type de la salle
 *  - Date (format YYYY-MM-DD), heure_debut, heure_fin
 *
 * @param {number} idGroupe - L'identifiant du groupe
 * @returns {Promise<object[]>} Liste des séances triées par date et heure
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
 * Récupère le planning complet d'un groupe : informations du groupe + toutes ses séances.
 *
 * Combine recupererGroupeParId() et recupererHoraireGroupe() en un seul appel.
 * Retourne null si le groupe n'existe pas.
 *
 * @param {number} idGroupe - L'identifiant du groupe
 * @returns {Promise<{groupe: object, horaire: object[]}|null>} Planning complet ou null
 */
export async function recupererPlanningCompletGroupe(idGroupe) {
  const groupe = await recupererGroupeParId(idGroupe);

  if (!groupe) {
    return null; // Le groupe n'existe pas, inutile de chercher son horaire
  }

  const horaire = await recupererHoraireGroupe(idGroupe);

  return {
    groupe,
    horaire,
  };
}
