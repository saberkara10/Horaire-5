/**
 * ContextLoader - Phase 1 du Scheduler Engine
 *
 * Charge tout le contexte necessaire a la generation depuis la base.
 * Les cohortes sont filtrees sur la session cible afin d'eviter de
 * melanger plusieurs sessions dans une meme generation.
 */

import pool from "../../../db.js";
import { devinerNomSession, normaliserNomSession } from "../../utils/sessions.js";

const STATUTS_REPRISES_PLANIFIABLES_SQL = `
  'a_reprendre',
  'planifie',
  'en_ligne',
  'groupe_special',
  'resolution_manuelle'
`;

export class ContextLoader {
  /**
   * Charge le contexte complet pour la generation.
   *
   * @param {number|null} idSession
   * @param {import("mysql2/promise").PoolConnection} executor
   * @returns {Promise<Object>}
   */
  static async charger(idSession = null, executor = pool) {
    const [sessions] = await executor.query(
      `SELECT id_session, nom, date_debut, date_fin
       FROM sessions
       WHERE ${idSession ? "id_session = ?" : "active = TRUE"}
       LIMIT 1`,
      idSession ? [idSession] : []
    );

    const session = sessions[0];

    if (!session) {
      throw new Error(
        "Aucune session active trouvee. Veuillez creer et activer une session."
      );
    }

    const sessionSaison =
      normaliserNomSession(session.nom) ||
      devinerNomSession(session.nom, session.date_debut) ||
      devinerNomSession("", session.date_debut);

    const [
      [cours],
      [professeursBruts],
      [salles],
      [etudiantsBruts],
      [groupesBruts],
      [disponibilites],
      [absences],
      [sallesIndisponibles],
      [affectationsExistantes],
      [coursEchoues],
      [prerequis],
    ] = await Promise.all([
      executor.query(
        `SELECT c.id_cours, c.code, c.nom, c.duree, c.programme, c.etape_etude,
                c.type_salle, c.est_cours_cle, c.est_en_ligne,
                c.max_etudiants_par_groupe, c.min_etudiants_par_groupe,
                c.sessions_par_semaine, c.archive
         FROM cours c
         WHERE c.archive = FALSE
         ORDER BY c.est_cours_cle DESC, c.code ASC`
      ),
      executor.query(
        `SELECT p.id_professeur,
                p.matricule,
                p.nom,
                p.prenom,
                p.specialite,
                COALESCE(
                  GROUP_CONCAT(DISTINCT pc.id_cours ORDER BY pc.id_cours SEPARATOR ','),
                  ''
                ) AS cours_ids
         FROM professeurs p
         LEFT JOIN professeur_cours pc
           ON pc.id_professeur = p.id_professeur
         GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
         ORDER BY p.nom ASC, p.prenom ASC`
      ),
      executor.query(
        `SELECT id_salle, code, type, capacite
         FROM salles
         ORDER BY capacite ASC, code ASC`
      ),
      executor.query(
        `SELECT e.id_etudiant,
                e.matricule,
                e.nom,
                e.prenom,
                e.id_groupes_etudiants,
                e.programme,
                e.etape,
                e.session
         FROM etudiants e
         ORDER BY e.programme, e.etape, e.nom`
      ),
      executor.query(
        `SELECT ge.id_groupes_etudiants,
                ge.nom_groupe,
                ge.taille_max,
                ge.est_groupe_special,
                ge.id_session,
                ge.programme,
                ge.etape
         FROM groupes_etudiants ge
         WHERE ge.id_session IS NULL OR ge.id_session = ?`,
        [session.id_session]
      ),
      executor.query(
        `SELECT id_professeur,
                jour_semaine,
                heure_debut,
                heure_fin,
                DATE_FORMAT(date_debut_effet, '%Y-%m-%d') AS date_debut_effet,
                DATE_FORMAT(date_fin_effet, '%Y-%m-%d') AS date_fin_effet
         FROM disponibilites_professeurs
         WHERE date_fin_effet >= ?
           AND date_debut_effet <= ?
         ORDER BY id_professeur, jour_semaine`
        ,
        [session.date_debut, session.date_fin]
      ),
      executor.query(
        `SELECT id_professeur, date_debut, date_fin, type
         FROM absences_professeurs
         WHERE date_fin >= CURDATE()
         ORDER BY id_professeur, date_debut`
      ),
      executor.query(
        `SELECT id_salle, date_debut, date_fin, raison
         FROM salles_indisponibles
         WHERE date_fin >= CURDATE()
         ORDER BY id_salle, date_debut`
      ),
      executor.query(
        `SELECT ac.id_affectation_cours,
                ac.id_cours,
                ac.id_professeur,
                ac.id_salle,
                ge.id_groupes_etudiants,
                ge.nom_groupe,
                ge.est_groupe_special,
                DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
                ph.heure_debut,
                ph.heure_fin
         FROM affectation_cours ac
         JOIN plages_horaires ph
           ON ph.id_plage_horaires = ac.id_plage_horaires
         JOIN affectation_groupes ag
           ON ag.id_affectation_cours = ac.id_affectation_cours
         JOIN groupes_etudiants ge
           ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
         WHERE ge.id_session = ?
         ORDER BY ge.nom_groupe ASC, ac.id_cours ASC, ph.date ASC, ph.heure_debut ASC`,
        [session.id_session]
      ),
      executor.query(
        `SELECT ce.id, ce.id_etudiant, ce.id_cours, ce.id_session, ce.id_groupe_reprise,
                ce.statut, ce.note_echec,
                c.code, c.nom, c.programme, c.type_salle, c.est_cours_cle,
                c.max_etudiants_par_groupe, c.est_en_ligne
         FROM cours_echoues ce
         JOIN cours c ON c.id_cours = ce.id_cours
         WHERE ce.id_session = ?
           AND ce.statut IN (${STATUTS_REPRISES_PLANIFIABLES_SQL})
         ORDER BY c.est_cours_cle DESC, ce.id_etudiant`
        ,
        [session.id_session]
      ),
      executor.query(
        `SELECT id_cours_prerequis, id_cours_suivant, est_bloquant
         FROM prerequis_cours`
      ),
    ]);

    const professeurs = professeursBruts.map((professeur) => ({
      ...professeur,
      cours_ids: String(professeur.cours_ids || "")
        .split(",")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    }));

    const etudiants = etudiantsBruts.filter((etudiant) => {
      if (!sessionSaison) {
        return true;
      }

      return normaliserNomSession(etudiant.session) === sessionSaison;
    });

    const groupes = groupesBruts.filter(
      (groupe) =>
        groupe.id_session == null ||
        Number(groupe.id_session) === Number(session.id_session)
    );

    const dispParProf = new Map();
    for (const disponibilite of disponibilites) {
      const key = disponibilite.id_professeur;
      if (!dispParProf.has(key)) {
        dispParProf.set(key, []);
      }
      dispParProf.get(key).push(disponibilite);
    }

    const absencesParProf = new Map();
    for (const absence of absences) {
      const key = absence.id_professeur;
      if (!absencesParProf.has(key)) {
        absencesParProf.set(key, []);
      }
      absencesParProf.get(key).push(absence);
    }

    const indispoParSalle = new Map();
    for (const indisponibilite of sallesIndisponibles) {
      const key = indisponibilite.id_salle;
      if (!indispoParSalle.has(key)) {
        indispoParSalle.set(key, []);
      }
      indispoParSalle.get(key).push(indisponibilite);
    }

    const etudiantsSession = new Set(etudiants.map((etudiant) => etudiant.id_etudiant));
    const echouesParEtudiant = new Map();

    for (const coursEchoue of coursEchoues) {
      if (!etudiantsSession.has(coursEchoue.id_etudiant)) {
        continue;
      }

      const key = coursEchoue.id_etudiant;
      if (!echouesParEtudiant.has(key)) {
        echouesParEtudiant.set(key, []);
      }
      echouesParEtudiant.get(key).push(coursEchoue);
    }

    const prerequisMap = new Map();
    for (const prerequisItem of prerequis) {
      if (!prerequisMap.has(prerequisItem.id_cours_suivant)) {
        prerequisMap.set(prerequisItem.id_cours_suivant, []);
      }
      prerequisMap.get(prerequisItem.id_cours_suivant).push({
        idPrerequisCours: prerequisItem.id_cours_prerequis,
        estBloquant: prerequisItem.est_bloquant,
      });
    }

    return {
      session,
      sessionSaison,
      cours,
      professeurs,
      salles,
      etudiants,
      groupes,
      dispParProf,
      absencesParProf,
      indispoParSalle,
      affectationsExistantes,
      echouesParEtudiant,
      prerequisMap,
      coursEchoues,
    };
  }
}
