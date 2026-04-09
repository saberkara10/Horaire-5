/**
 * MODEL - Gestion des horaires
 *
 * Ce module centralise la generation,
 * la validation et la gestion des affectations.
 */
import pool from "../../db.js";
import {
  recupererDisponibilitesProfesseurs,
  recupererIndexCoursProfesseurs,
} from "./professeurs.model.js";
import {
  normaliserNomProgramme,
  programmesCorrespondent,
} from "../utils/programmes.js";
import { normaliserNomSession, sessionsCorrespondent } from "../utils/sessions.js";
import {
  calculerTaillesGroupesEquilibres,
  determinerCapaciteMaximaleGroupeCohorte,
  recupererSallesCompatiblesPourCours,
} from "../utils/groupes.js";
import { MAX_WEEKLY_SESSIONS_PER_PROFESSOR } from "../services/scheduler/AcademicCatalog.js";
import { disponibiliteCouvreDate } from "../services/professeurs/availability-temporal.js";
import { assurerSchemaSchedulerAcademique } from "../services/academic-scheduler-schema.js";

const CRENEAUX_DEBUT = ["08:00:00", "10:00:00", "13:00:00", "15:00:00"];
const NOMBRE_JOURS_GENERATION = 10;
const SESSION_ACTIVE_SQL = `(
  SELECT id_session
  FROM sessions
  WHERE active = TRUE
  ORDER BY id_session DESC
  LIMIT 1
)`;

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

function heureVersMinutes(heure) {
  const [heures = "0", minutes = "0"] = normaliserHeure(heure).split(":");
  return Number(heures) * 60 + Number(minutes);
}

function minutesVersHeure(minutes) {
  const heures = Math.floor(minutes / 60);
  const minutesRestantes = minutes % 60;

  return `${String(heures).padStart(2, "0")}:${String(minutesRestantes).padStart(2, "0")}:00`;
}

function determinerDureeSeance(dureeCours) {
  const duree = Number(dureeCours);

  // Le champ `duree` du cours n'est pas toujours une duree de seance exploitable.
  // On accepte donc uniquement 1 a 4 heures, sinon on retombe sur un creneau standard de 2 heures.
  if (Number.isInteger(duree) && duree >= 1 && duree <= 4) {
    return duree;
  }

  return 2;
}

function calculerHeureFin(heureDebut, dureeCours) {
  const minutesDebut = heureVersMinutes(heureDebut);
  const dureeSeanceHeures = determinerDureeSeance(dureeCours);

  return minutesVersHeure(minutesDebut + dureeSeanceHeures * 60);
}

function normaliserTexte(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function calculerScoreProfesseur(professeur, cours, coursParProfesseur = null) {
  const coursAutorises = coursParProfesseur?.get(Number(professeur.id_professeur));

  if (!coursAutorises || !coursAutorises.has(Number(cours.id_cours))) {
    return 0;
  }

  if (programmesCorrespondent(professeur.specialite, cours.programme)) {
    return 2;
  }

  return 1;
}

export function professeurEstCompatibleAvecCours(
  professeur,
  cours,
  coursParProfesseur = null
) {
  return calculerScoreProfesseur(professeur, cours, coursParProfesseur) > 0;
}

function trierProfesseursPourCours(
  cours,
  professeurs,
  compteurAffectations,
  coursParProfesseur
) {
  return professeurs
    .filter((professeur) =>
      professeurEstCompatibleAvecCours(professeur, cours, coursParProfesseur) &&
      (compteurAffectations.get(professeur.id_professeur) || 0) <
        MAX_WEEKLY_SESSIONS_PER_PROFESSOR
    )
    .sort((professeurA, professeurB) => {
    const scoreA = calculerScoreProfesseur(
      professeurA,
      cours,
      coursParProfesseur
    );
    const scoreB = calculerScoreProfesseur(
      professeurB,
      cours,
      coursParProfesseur
    );

    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    const nombreA = compteurAffectations.get(professeurA.id_professeur) || 0;
    const nombreB = compteurAffectations.get(professeurB.id_professeur) || 0;

    if (nombreA !== nombreB) {
      return nombreB - nombreA;
    }

    return `${professeurA.prenom} ${professeurA.nom}`.localeCompare(
      `${professeurB.prenom} ${professeurB.nom}`,
      "fr"
    );
  });
}

export function salleEstCompatibleAvecCours(salle, cours) {
  const idSalleReference = Number(cours?.id_salle_reference);

  if (Number.isInteger(idSalleReference) && idSalleReference > 0) {
    return Number(salle?.id_salle) === idSalleReference;
  }

  return normaliserTexte(salle?.type) === normaliserTexte(cours?.type_salle);
}

function normaliserEtape(etape) {
  const valeur = String(etape ?? "").trim();

  if (!valeur) {
    return "";
  }

  const valeurNumerique = Number(valeur);

  if (!Number.isNaN(valeurNumerique)) {
    return String(valeurNumerique);
  }

  return normaliserTexte(valeur);
}

function etapesCorrespondent(etapeCours, etapeGroupe) {
  const etapeCoursNormalisee = normaliserEtape(etapeCours);
  const etapeGroupeNormalisee = normaliserEtape(etapeGroupe);

  return Boolean(etapeCoursNormalisee) && etapeCoursNormalisee === etapeGroupeNormalisee;
}

function trouverGroupesCompatibles(cours, groupes) {
  return groupes.filter(
    (groupe) =>
      programmesCorrespondent(groupe.programme, cours.programme) &&
      etapesCorrespondent(cours.etape_etude, groupe.etape)
  );
}

function totaliserEffectifGroupes(groupes) {
  return groupes.reduce(
    (total, groupe) => total + (Number(groupe.effectif) || 0),
    0
  );
}

function construireNomGroupeAutomatique(programme, etape, session, index) {
  const programmeNettoye = String(programme || "Programme")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);

  return `${programmeNettoye} - E${etape} - ${session} - G${index}`;
}

function trierSallesCompatibles(cours, salles, capaciteMinimale = 0) {
  const seuilCapacite = Number(capaciteMinimale) || 0;
  const sallesCompatibles = recupererSallesCompatiblesPourCours(cours, salles);
  const sallesAssezGrandes =
    seuilCapacite > 0
      ? sallesCompatibles.filter((salle) => Number(salle.capacite) >= seuilCapacite)
      : sallesCompatibles;

  return sallesAssezGrandes.sort((salleA, salleB) => {
    if (salleA.capacite !== salleB.capacite) {
      return salleA.capacite - salleB.capacite;
    }

    return String(salleA.code).localeCompare(String(salleB.code), "fr");
  });
}

function genererJoursCalendaires(nombreJours, dateDebut = null) {
  const jours = [];
  const dateCourante = dateDebut
    ? new Date(`${dateDebut}T00:00:00`)
    : new Date();
  dateCourante.setHours(0, 0, 0, 0);

  while (jours.length < nombreJours) {
    jours.push(dateCourante.toISOString().slice(0, 10));
    dateCourante.setDate(dateCourante.getDate() + 1);
  }

  return jours;
}

function convertirDateEnJourSemaine(date) {
  const dateReference = new Date(`${date}T00:00:00`);
  const jour = dateReference.getDay();

  return jour === 0 ? 7 : jour;
}

function professeurEstDisponible(
  professeur,
  date,
  heureDebut,
  heureFin,
  disponibilitesParProfesseur
) {
  const disponibilites = disponibilitesParProfesseur.get(professeur.id_professeur) || [];

  if (disponibilites.length === 0) {
    return true;
  }

  const jourSemaine = convertirDateEnJourSemaine(date);
  const minutesDebut = heureVersMinutes(heureDebut);
  const minutesFin = heureVersMinutes(heureFin);

  return disponibilites.some((disponibilite) => {
    if (Number(disponibilite.jour_semaine) !== jourSemaine) {
      return false;
    }

    if (!disponibiliteCouvreDate(disponibilite, date)) {
      return false;
    }

    const debutDisponibilite = heureVersMinutes(disponibilite.heure_debut);
    const finDisponibilite = heureVersMinutes(disponibilite.heure_fin);

    return debutDisponibilite <= minutesDebut && finDisponibilite >= minutesFin;
  });
}

function creerErreurHoraire(message, statusCode = 400) {
  const erreur = new Error(message);
  erreur.statusCode = statusCode;
  return erreur;
}

async function executerDansTransactionSiNecessaire(
  operation,
  executor = pool
) {
  const doitOuvrirTransaction =
    executor &&
    typeof executor.getConnection === "function" &&
    typeof executor.query === "function";
  const connexion = doitOuvrirTransaction
    ? await executor.getConnection()
    : executor;

  if (doitOuvrirTransaction) {
    await connexion.beginTransaction();
  }

  try {
    const resultat = await operation(connexion);

    if (doitOuvrirTransaction) {
      await connexion.commit();
    }

    return resultat;
  } catch (error) {
    if (doitOuvrirTransaction) {
      await connexion.rollback();
    }

    throw error;
  } finally {
    if (doitOuvrirTransaction) {
      connexion.release();
    }
  }
}

async function recupererSessionActive(executor = pool) {
  const [rows] = await executor.query(
    `SELECT id_session, nom
     FROM sessions
     WHERE active = TRUE
     ORDER BY id_session DESC
     LIMIT 1`
  );

  return rows[0] || null;
}

async function supprimerGroupesVidesSession(idSession, executor = pool) {
  if (!Number.isInteger(Number(idSession)) || Number(idSession) <= 0) {
    return;
  }

  await executor.query(
    `DELETE FROM groupes_etudiants
     WHERE id_groupes_etudiants IN (
       SELECT id_groupes_etudiants
       FROM (
         SELECT ge.id_groupes_etudiants
         FROM groupes_etudiants ge
         LEFT JOIN etudiants e
           ON e.id_groupes_etudiants = ge.id_groupes_etudiants
         LEFT JOIN affectation_etudiants ae
           ON ae.id_groupes_etudiants = ge.id_groupes_etudiants
          AND ae.id_session = ge.id_session
         WHERE ge.id_session = ?
         GROUP BY ge.id_groupes_etudiants
         HAVING COUNT(DISTINCT e.id_etudiant) = 0
            AND COUNT(DISTINCT ae.id_etudiant) = 0
       ) groupes_vides
     )`,
    [Number(idSession)]
  );
}

function construireFiltreAffectationExclue(idAffectationExclue) {
  if (!Number.isInteger(Number(idAffectationExclue)) || Number(idAffectationExclue) <= 0) {
    return {
      clause: "",
      valeurs: [],
    };
  }

  return {
    clause: " AND ac.id_affectation_cours <> ?",
    valeurs: [Number(idAffectationExclue)],
  };
}

async function recupererContexteAffectation(idCours, idProfesseur, idSalle, executor = pool) {
  const [[coursRows], [professeurRows], [salleRows]] = await Promise.all([
    executor.query(
      `SELECT id_cours, code, nom, programme, etape_etude, type_salle, id_salle_reference
       FROM cours
       WHERE id_cours = ?
       LIMIT 1`,
      [idCours]
    ),
    executor.query(
      `SELECT id_professeur, matricule, nom, prenom, specialite
       FROM professeurs
       WHERE id_professeur = ?
       LIMIT 1`,
      [idProfesseur]
    ),
    executor.query(
      `SELECT id_salle, code, type, capacite
       FROM salles
       WHERE id_salle = ?
       LIMIT 1`,
      [idSalle]
    ),
  ]);

  return {
    cours: coursRows[0] || null,
    professeur: professeurRows[0] || null,
    salle: salleRows[0] || null,
  };
}

async function recupererContexteGroupe(idGroupeEtudiants, executor = pool) {
  const [rows] = await executor.query(
    `SELECT ge.id_groupes_etudiants,
            ge.nom_groupe,
            ge.est_groupe_special,
            COALESCE(MAX(e.programme), ge.programme) AS programme,
            COALESCE(MAX(e.etape), ge.etape) AS etape,
            MAX(e.session) AS session,
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
      AND ae.source_type = 'reprise'
     WHERE ge.id_groupes_etudiants = ?
     GROUP BY ge.id_groupes_etudiants,
              ge.nom_groupe,
              ge.est_groupe_special,
              ge.programme,
              ge.etape
     LIMIT 1`,
    [idGroupeEtudiants]
  );

  return rows[0] || null;
}

function groupeEstCompatibleAvecCours(groupe, cours) {
  if (!groupe || !cours) {
    return false;
  }

  return (
    programmesCorrespondent(groupe.programme, cours.programme) &&
    etapesCorrespondent(groupe.etape, cours.etape_etude)
  );
}

function sallePeutAccueillirGroupe(salle, groupe) {
  const effectif = Number(groupe?.effectif) || 0;
  const capacite = Number(salle?.capacite) || 0;

  if (effectif <= 0) {
    return true;
  }

  return capacite >= effectif;
}

export async function verifierDisponibiliteProfesseur(
  idProfesseur,
  date,
  heureDebut,
  heureFin,
  executor = pool
) {
  const disponibilitesParProfesseur = await recupererDisponibilitesProfesseurs(executor);

  return professeurEstDisponible(
    { id_professeur: idProfesseur },
    date,
    heureDebut,
    heureFin,
    disponibilitesParProfesseur
  );
}

async function recupererEtudiantsAffectesIndividuellementAuGroupe(
  idGroupeEtudiants,
  executor = pool
) {
  const [rows] = await executor.query(
    `SELECT DISTINCT ae.id_etudiant
     FROM affectation_etudiants ae
     WHERE ae.id_groupes_etudiants = ?
       AND ae.source_type = 'reprise'`,
    [idGroupeEtudiants]
  );

  return rows
    .map((row) => Number(row.id_etudiant))
    .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0);
}

async function verifierConflitEtudiantPlanifie(
  idEtudiant,
  date,
  heureDebut,
  heureFin,
  idAffectationExclue = null,
  executor = pool
) {
  const filtreExclusion = construireFiltreAffectationExclue(idAffectationExclue);
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS conflits
     FROM (
       SELECT DISTINCT ac.id_affectation_cours
       FROM etudiants e
       JOIN affectation_groupes ag
         ON ag.id_groupes_etudiants = e.id_groupes_etudiants
       JOIN affectation_cours ac
         ON ac.id_affectation_cours = ag.id_affectation_cours
       JOIN plages_horaires ph
         ON ph.id_plage_horaires = ac.id_plage_horaires
       WHERE e.id_etudiant = ?
         AND ph.date = ?
         AND ph.heure_debut < ?
         AND ph.heure_fin > ?${filtreExclusion.clause}

       UNION

       SELECT DISTINCT ac.id_affectation_cours
       FROM affectation_etudiants ae
       JOIN affectation_groupes ag
         ON ag.id_groupes_etudiants = ae.id_groupes_etudiants
       JOIN affectation_cours ac
         ON ac.id_affectation_cours = ag.id_affectation_cours
        AND ac.id_cours = ae.id_cours
       JOIN plages_horaires ph
         ON ph.id_plage_horaires = ac.id_plage_horaires
       WHERE ae.id_etudiant = ?
         AND ae.source_type = 'reprise'
         AND ph.date = ?
         AND ph.heure_debut < ?
         AND ph.heure_fin > ?${filtreExclusion.clause}
     ) conflits_etudiant`,
    [
      idEtudiant,
      date,
      normaliserHeure(heureFin),
      normaliserHeure(heureDebut),
      ...filtreExclusion.valeurs,
      idEtudiant,
      date,
      normaliserHeure(heureFin),
      normaliserHeure(heureDebut),
      ...filtreExclusion.valeurs,
    ]
  );

  return Number(rows[0]?.conflits || 0);
}

async function verifierConflitEtudiantsAffectesAuGroupeSpecial(
  idGroupeEtudiants,
  date,
  heureDebut,
  heureFin,
  idAffectationExclue = null,
  executor = pool
) {
  const idsEtudiants = await recupererEtudiantsAffectesIndividuellementAuGroupe(
    idGroupeEtudiants,
    executor
  );

  for (const idEtudiant of idsEtudiants) {
    const conflits = await verifierConflitEtudiantPlanifie(
      idEtudiant,
      date,
      heureDebut,
      heureFin,
      idAffectationExclue,
      executor
    );

    if (conflits > 0) {
      return {
        conflits,
        idEtudiant,
      };
    }
  }

  return {
    conflits: 0,
    idEtudiant: null,
  };
}

/**
 * Retourne toutes les affectations de cours avec les details.
 * @returns {Promise<Array<Object>>} La liste de toutes les affectations.
 */
export async function getAllAffectations(options = {}, executor = pool) {
  const sessionActive = Boolean(options?.sessionActive);
  const clauses = [];

  if (sessionActive) {
    clauses.push(
      `EXISTS (
         SELECT 1
         FROM affectation_groupes ag2
         JOIN groupes_etudiants ge2
           ON ge2.id_groupes_etudiants = ag2.id_groupes_etudiants
         WHERE ag2.id_affectation_cours = ac.id_affectation_cours
           AND ge2.id_session = ${SESSION_ACTIVE_SQL}
       )`
    );
  }

  const clauseWhere = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const [rows] = await executor.query(
    `SELECT ac.id_affectation_cours,
            ac.id_cours,
            ac.id_professeur,
            ac.id_salle,
            c.code AS cours_code,
            c.nom AS cours_nom,
            c.duree AS cours_duree,
            p.nom AS professeur_nom,
            p.prenom AS professeur_prenom,
            s.code AS salle_code,
            s.capacite AS salle_capacite,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            ph.heure_debut,
            ph.heure_fin,
            MIN(ag.id_groupes_etudiants) AS id_groupes_etudiants,
            COALESCE(
              GROUP_CONCAT(DISTINCT ge.nom_groupe ORDER BY ge.nom_groupe SEPARATOR ', '),
              ''
            ) AS groupes
     FROM affectation_cours ac
     JOIN cours c ON ac.id_cours = c.id_cours
     JOIN professeurs p ON ac.id_professeur = p.id_professeur
     LEFT JOIN salles s ON ac.id_salle = s.id_salle
     JOIN plages_horaires ph ON ac.id_plage_horaires = ph.id_plage_horaires
     LEFT JOIN affectation_groupes ag ON ag.id_affectation_cours = ac.id_affectation_cours
     LEFT JOIN groupes_etudiants ge ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     ${clauseWhere}
     GROUP BY ac.id_affectation_cours,
              ac.id_cours,
              ac.id_professeur,
              ac.id_salle,
              c.code,
              c.nom,
              c.duree,
              p.nom,
              p.prenom,
              s.code,
              s.capacite,
              ph.date,
              ph.heure_debut,
              ph.heure_fin
     ORDER BY ph.date, ph.heure_debut;`
  );

  return rows;
}

/**
 * Retourne une affectation par son identifiant.
 * @param {number} idAffectation L'identifiant de l'affectation.
 * @returns {Promise<Object|undefined>} L'affectation correspondante ou undefined.
 */
export async function getAffectationById(idAffectation, executor = pool) {
  const [rows] = await executor.query(
    `SELECT ac.id_affectation_cours,
            ac.id_cours,
            ac.id_professeur,
            ac.id_salle,
            ac.id_plage_horaires,
            c.code AS cours_code,
            c.nom AS cours_nom,
            p.nom AS professeur_nom,
            p.prenom AS professeur_prenom,
            s.code AS salle_code,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            ph.heure_debut,
            ph.heure_fin,
            MIN(ag.id_groupes_etudiants) AS id_groupes_etudiants,
            COALESCE(
              GROUP_CONCAT(DISTINCT ge.nom_groupe ORDER BY ge.nom_groupe SEPARATOR ', '),
              ''
            ) AS groupes
     FROM affectation_cours ac
     JOIN cours c ON ac.id_cours = c.id_cours
     JOIN professeurs p ON ac.id_professeur = p.id_professeur
     LEFT JOIN salles s ON ac.id_salle = s.id_salle
     JOIN plages_horaires ph ON ac.id_plage_horaires = ph.id_plage_horaires
     LEFT JOIN affectation_groupes ag ON ag.id_affectation_cours = ac.id_affectation_cours
     LEFT JOIN groupes_etudiants ge ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     WHERE ac.id_affectation_cours = ?
     GROUP BY ac.id_affectation_cours,
              ac.id_cours,
              ac.id_professeur,
              ac.id_salle,
              ac.id_plage_horaires,
              c.code,
              c.nom,
              p.nom,
              p.prenom,
              s.code,
              ph.date,
              ph.heure_debut,
              ph.heure_fin;`,
    [idAffectation]
  );

  return rows[0];
}

/**
 * Cree une plage horaire.
 * @param {string} date La date du creneau.
 * @param {string} heureDebut L'heure de debut.
 * @param {string} heureFin L'heure de fin.
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 * @returns {Promise<Object>} Le resultat de l'insertion.
 */
export async function addPlageHoraire(date, heureDebut, heureFin, executor = pool) {
  const [result] = await executor.query(
    `INSERT INTO plages_horaires(date, heure_debut, heure_fin)
     VALUES(?, ?, ?);`,
    [date, normaliserHeure(heureDebut), normaliserHeure(heureFin)]
  );

  return result;
}

/**
 * Cree une affectation de cours.
 * @param {number} idCours L'identifiant du cours.
 * @param {number} idProfesseur L'identifiant du professeur.
 * @param {number} idSalle L'identifiant de la salle.
 * @param {number} idPlageHoraires L'identifiant de la plage horaire.
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 * @returns {Promise<Object>} Le resultat de l'insertion.
 */
export async function addAffectation(
  idCours,
  idProfesseur,
  idSalle,
  idPlageHoraires,
  executor = pool
) {
  const [result] = await executor.query(
    `INSERT INTO affectation_cours(id_cours, id_professeur, id_salle, id_plage_horaires)
     VALUES(?, ?, ?, ?);`,
    [idCours, idProfesseur, idSalle, idPlageHoraires]
  );

  return result;
}

/**
 * Supprime une affectation de cours.
 * @param {number} idAffectation L'identifiant de l'affectation a supprimer.
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 * @returns {Promise<Object>} Le resultat de la suppression.
 */
export async function deleteAffectation(idAffectation, executor = pool) {
  await executor.query(
    `DELETE FROM affectation_groupes
     WHERE id_affectation_cours = ?;`,
    [idAffectation]
  );

  const [result] = await executor.query(
    `DELETE FROM affectation_cours
     WHERE id_affectation_cours = ?;`,
    [idAffectation]
  );

  return result;
}

/**
 * Supprime toutes les affectations (reset horaire).
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 */
export async function deleteAllAffectations(options = {}, executor = pool) {
  return executerDansTransactionSiNecessaire(async (transactionExecutor) => {
    await assurerSchemaSchedulerAcademique(transactionExecutor);

    if (options?.sessionActive) {
      const sessionActive = await recupererSessionActive(transactionExecutor);

      if (!sessionActive?.id_session) {
        return;
      }

      await transactionExecutor.query(
        `DELETE FROM affectation_etudiants
         WHERE id_session = ${SESSION_ACTIVE_SQL}`
      );

      await transactionExecutor.query(
        `DELETE ag
         FROM affectation_groupes ag
         INNER JOIN groupes_etudiants ge
           ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
         WHERE ge.id_session = ${SESSION_ACTIVE_SQL}`
      );

      await transactionExecutor.query(
        `DELETE ac
         FROM affectation_cours ac
         LEFT JOIN affectation_groupes ag
           ON ag.id_affectation_cours = ac.id_affectation_cours
         WHERE ag.id_affectation_cours IS NULL`
      );

      await transactionExecutor.query(
        `DELETE ph
         FROM plages_horaires ph
         LEFT JOIN affectation_cours ac
           ON ac.id_plage_horaires = ph.id_plage_horaires
         WHERE ac.id_plage_horaires IS NULL`
      );

      await transactionExecutor.query(
        `UPDATE cours_echoues
         SET statut = 'a_reprendre',
             id_groupe_reprise = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_session = ${SESSION_ACTIVE_SQL}
           AND statut <> 'reussi'`
      );

      if (options?.deleteStudents) {
        await transactionExecutor.query(
          `DELETE e
           FROM etudiants e
           INNER JOIN groupes_etudiants ge
             ON ge.id_groupes_etudiants = e.id_groupes_etudiants
           WHERE ge.id_session = ?`,
          [Number(sessionActive.id_session)]
        );

        await supprimerGroupesVidesSession(sessionActive.id_session, transactionExecutor);
      }

      return;
    }

    await transactionExecutor.query(`DELETE FROM affectation_etudiants;`);
    await transactionExecutor.query(`DELETE FROM affectation_groupes;`);
    await transactionExecutor.query(`DELETE FROM affectation_cours;`);
    await transactionExecutor.query(`DELETE FROM plages_horaires;`);
    await transactionExecutor.query(
      `UPDATE cours_echoues
       SET statut = 'a_reprendre',
           id_groupe_reprise = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE statut <> 'reussi'`
    );
  }, executor);
}

async function deleteAffectationsPourGroupes(idsGroupes, executor = pool) {
  const idsValides = idsGroupes
    .map((idGroupe) => Number(idGroupe))
    .filter((idGroupe) => Number.isInteger(idGroupe) && idGroupe > 0);

  if (idsValides.length === 0) {
    return;
  }

  const placeholders = idsValides.map(() => "?").join(", ");

  const [affectationsLiees] = await executor.query(
    `SELECT DISTINCT ac.id_affectation_cours, ac.id_plage_horaires
     FROM affectation_cours ac
     JOIN affectation_groupes ag
       ON ag.id_affectation_cours = ac.id_affectation_cours
     WHERE ag.id_groupes_etudiants IN (${placeholders})`,
    idsValides
  );

  await executor.query(
    `DELETE FROM affectation_groupes
     WHERE id_groupes_etudiants IN (${placeholders})`,
    idsValides
  );

  if (affectationsLiees.length === 0) {
    return;
  }

  const idsAffectations = affectationsLiees.map(
    (affectation) => affectation.id_affectation_cours
  );
  const placeholdersAffectations = idsAffectations.map(() => "?").join(", ");

  const [affectationsSansGroupes] = await executor.query(
    `SELECT ac.id_affectation_cours, ac.id_plage_horaires
     FROM affectation_cours ac
     LEFT JOIN affectation_groupes ag
       ON ag.id_affectation_cours = ac.id_affectation_cours
     WHERE ac.id_affectation_cours IN (${placeholdersAffectations})
     GROUP BY ac.id_affectation_cours, ac.id_plage_horaires
     HAVING COUNT(ag.id_affectation_groupes) = 0`,
    idsAffectations
  );

  if (affectationsSansGroupes.length === 0) {
    return;
  }

  const idsAffectationsASupprimer = affectationsSansGroupes.map(
    (affectation) => affectation.id_affectation_cours
  );
  const idsPlagesASupprimer = affectationsSansGroupes.map(
    (affectation) => affectation.id_plage_horaires
  );
  const placeholdersSuppressionAffectations = idsAffectationsASupprimer
    .map(() => "?")
    .join(", ");
  const placeholdersSuppressionPlages = idsPlagesASupprimer
    .map(() => "?")
    .join(", ");

  await executor.query(
    `DELETE FROM affectation_cours
     WHERE id_affectation_cours IN (${placeholdersSuppressionAffectations})`,
    idsAffectationsASupprimer
  );
  await executor.query(
    `DELETE FROM plages_horaires
     WHERE id_plage_horaires IN (${placeholdersSuppressionPlages})`,
    idsPlagesASupprimer
  );
}

async function supprimerGroupesCohorte(
  programmeCible,
  etapeCible,
  sessionCible,
  executor = pool
) {
  const [etudiantsCohorte] = await executor.query(
    `SELECT id_etudiant, id_groupes_etudiants, programme, etape, session
     FROM etudiants
     ORDER BY matricule ASC`
  );

  const etudiantsSelectionnes = etudiantsCohorte.filter(
    (etudiant) =>
      programmesCorrespondent(etudiant.programme, programmeCible) &&
      etapesCorrespondent(etudiant.etape, etapeCible) &&
      sessionsCorrespondent(etudiant.session, sessionCible)
  );

  const idsGroupes = [
    ...new Set(
      etudiantsSelectionnes
        .map((etudiant) => Number(etudiant.id_groupes_etudiants))
        .filter((idGroupe) => Number.isInteger(idGroupe) && idGroupe > 0)
    ),
  ];

  if (idsGroupes.length > 0) {
    await deleteAffectationsPourGroupes(idsGroupes, executor);

    const placeholders = idsGroupes.map(() => "?").join(", ");

    await executor.query(
      `UPDATE etudiants
       SET id_groupes_etudiants = NULL
       WHERE id_groupes_etudiants IN (${placeholders})`,
      idsGroupes
    );

    await executor.query(
      `DELETE FROM groupes_etudiants
       WHERE id_groupes_etudiants IN (${placeholders})`,
      idsGroupes
    );
  }

  return etudiantsSelectionnes.map((etudiant) => ({
    ...etudiant,
    id_groupes_etudiants: null,
  }));
}

async function creerGroupesAutomatiquesPourCohorte(
  programmeCible,
  etapeCible,
  sessionCible,
  programmeAffichage,
  sessionAffichage,
  coursCohorte,
  sallesDisponibles,
  executor = pool
) {
  const etudiantsSelectionnes = await supprimerGroupesCohorte(
    programmeCible,
    etapeCible,
    sessionCible,
    executor
  );

  if (etudiantsSelectionnes.length === 0) {
    throw creerErreurHoraire(
      "Aucun etudiant ne correspond a ce programme, cette etape et cette session.",
      400
    );
  }

  const capaciteMaximaleCohorte = determinerCapaciteMaximaleGroupeCohorte(
    coursCohorte,
    sallesDisponibles
  );
  const taillesGroupes = calculerTaillesGroupesEquilibres(
    etudiantsSelectionnes.length,
    capaciteMaximaleCohorte
  );
  const groupes = [];
  let positionCourante = 0;

  for (let index = 0; index < taillesGroupes.length; index += 1) {
    const tailleGroupe = taillesGroupes[index];
    const nomGroupe = construireNomGroupeAutomatique(
      programmeAffichage,
      etapeCible,
      sessionAffichage,
      index + 1
    );
    const [resultatGroupe] = await executor.query(
      `INSERT INTO groupes_etudiants (nom_groupe)
       VALUES (?)`,
      [nomGroupe]
    );
    const etudiantsDuGroupe = etudiantsSelectionnes.slice(
      positionCourante,
      positionCourante + tailleGroupe
    );
    positionCourante += tailleGroupe;

    if (etudiantsDuGroupe.length > 0) {
      const idsEtudiants = etudiantsDuGroupe.map((etudiant) => etudiant.id_etudiant);
      const placeholders = idsEtudiants.map(() => "?").join(", ");

      await executor.query(
        `UPDATE etudiants
         SET id_groupes_etudiants = ?
         WHERE id_etudiant IN (${placeholders})`,
        [resultatGroupe.insertId, ...idsEtudiants]
      );
    }

    groupes.push({
      id_groupes_etudiants: resultatGroupe.insertId,
      nom_groupe: nomGroupe,
      programme: programmeAffichage,
      etape: etapeCible,
      session: sessionAffichage,
      effectif: etudiantsDuGroupe.length,
      taille_max: capaciteMaximaleCohorte,
    });
  }

  return groupes;
}

/**
 * Assigne un groupe d'etudiants a une affectation de cours.
 * @param {number} idGroupeEtudiants L'identifiant du groupe.
 * @param {number} idAffectationCours L'identifiant de l'affectation.
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 * @returns {Promise<Object>} Le resultat de l'insertion.
 */
export async function addAffectationGroupe(
  idGroupeEtudiants,
  idAffectationCours,
  executor = pool
) {
  const [result] = await executor.query(
    `INSERT INTO affectation_groupes(id_groupes_etudiants, id_affectation_cours)
     VALUES(?, ?);`,
    [idGroupeEtudiants, idAffectationCours]
  );

  return result;
}

async function remplacerAffectationGroupe(
  idAffectationCours,
  idGroupeEtudiants,
  executor = pool
) {
  await executor.query(
    `DELETE FROM affectation_groupes
     WHERE id_affectation_cours = ?`,
    [idAffectationCours]
  );

  return addAffectationGroupe(idGroupeEtudiants, idAffectationCours, executor);
}

/**
 * Verifie les conflits de groupe pour un creneau.
 * @param {number} idGroupeEtudiants L'identifiant du groupe.
 * @param {string} date La date du creneau.
 * @param {string} heureDebut L'heure de debut.
 * @param {string} heureFin L'heure de fin.
 * @param {number|null} idAffectationExclue Affectation a ignorer.
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 * @returns {Promise<number>} Le nombre de conflits.
 */
export async function verifierConflitGroupe(
  idGroupeEtudiants,
  date,
  heureDebut,
  heureFin,
  idAffectationExclue = null,
  executor = pool
) {
  const filtreExclusion = construireFiltreAffectationExclue(idAffectationExclue);
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS conflits
     FROM affectation_groupes ag
     JOIN affectation_cours ac
       ON ac.id_affectation_cours = ag.id_affectation_cours
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ag.id_groupes_etudiants = ?
       AND ph.date = ?
       AND ph.heure_debut < ?
       AND ph.heure_fin > ?${filtreExclusion.clause};`,
    [
      idGroupeEtudiants,
      date,
      normaliserHeure(heureFin),
      normaliserHeure(heureDebut),
      ...filtreExclusion.valeurs,
    ]
  );

  return rows[0].conflits;
}

/**
 * Verifie les conflits de salle pour un creneau.
 * @param {number} idSalle L'identifiant de la salle.
 * @param {string} date La date du creneau.
 * @param {string} heureDebut L'heure de debut.
 * @param {string} heureFin L'heure de fin.
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 * @returns {Promise<number>} Le nombre de conflits.
 */
export async function verifierConflitSalle(
  idSalle,
  date,
  heureDebut,
  heureFin,
  idAffectationExclue = null,
  executor = pool
) {
  const filtreExclusion = construireFiltreAffectationExclue(idAffectationExclue);
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS conflits
     FROM affectation_cours ac
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ac.id_salle = ?
       AND ph.date = ?
       AND ph.heure_debut < ?
       AND ph.heure_fin > ?${filtreExclusion.clause};`,
    [
      idSalle,
      date,
      normaliserHeure(heureFin),
      normaliserHeure(heureDebut),
      ...filtreExclusion.valeurs,
    ]
  );

  return rows[0].conflits;
}

/**
 * Verifie les conflits de professeur pour un creneau.
 * @param {number} idProfesseur L'identifiant du professeur.
 * @param {string} date La date du creneau.
 * @param {string} heureDebut L'heure de debut.
 * @param {string} heureFin L'heure de fin.
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 * @returns {Promise<number>} Le nombre de conflits.
 */
export async function verifierConflitProfesseur(
  idProfesseur,
  date,
  heureDebut,
  heureFin,
  idAffectationExclue = null,
  executor = pool
) {
  const filtreExclusion = construireFiltreAffectationExclue(idAffectationExclue);
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS conflits
     FROM affectation_cours ac
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ac.id_professeur = ?
       AND ph.date = ?
       AND ph.heure_debut < ?
       AND ph.heure_fin > ?${filtreExclusion.clause};`,
    [
      idProfesseur,
      date,
      normaliserHeure(heureFin),
      normaliserHeure(heureDebut),
      ...filtreExclusion.valeurs,
    ]
  );

  return rows[0].conflits;
}

/**
 * Cree une affectation en verifiant d'abord les conflits.
 * @param {Object} affectation
 * @param {number} affectation.idCours
 * @param {number} affectation.idProfesseur
 * @param {number} affectation.idSalle
 * @param {string} affectation.date
 * @param {string} affectation.heureDebut
 * @param {string} affectation.heureFin
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 * @returns {Promise<Object>} Le resultat de creation.
 */
export async function creerAffectationValidee(affectation, executor = pool) {
  return executerDansTransactionSiNecessaire(async (transactionExecutor) => {
    await assurerSchemaSchedulerAcademique(transactionExecutor);

    const {
      idCours,
      idProfesseur,
      idSalle,
      idGroupeEtudiants,
      date,
      heureDebut,
      heureFin,
    } = affectation;
    const idGroupeNumerique = Number(idGroupeEtudiants);

    const { cours, professeur, salle } = await recupererContexteAffectation(
      idCours,
      idProfesseur,
      idSalle,
      transactionExecutor
    );

    const coursParProfesseur =
      await recupererIndexCoursProfesseurs(transactionExecutor);

    if (!cours) {
      throw creerErreurHoraire("Cours introuvable.", 404);
    }

    if (!professeur) {
      throw creerErreurHoraire("Professeur introuvable.", 404);
    }

    if (!salle) {
      throw creerErreurHoraire("Salle introuvable.", 404);
    }

    let groupe = null;

    if (Number.isInteger(idGroupeNumerique) && idGroupeNumerique > 0) {
      groupe = await recupererContexteGroupe(idGroupeNumerique, transactionExecutor);

      if (!groupe) {
        throw creerErreurHoraire("Groupe introuvable.", 404);
      }

      if (!groupeEstCompatibleAvecCours(groupe, cours)) {
        throw creerErreurHoraire(
          "Le groupe ne correspond pas au programme ou a l'etape du cours.",
          409
        );
      }

      if (!sallePeutAccueillirGroupe(salle, groupe)) {
        throw creerErreurHoraire(
          "La salle ne peut pas accueillir l'effectif de ce groupe.",
          409
        );
      }
    }

    if (!professeurEstCompatibleAvecCours(professeur, cours, coursParProfesseur)) {
      throw creerErreurHoraire("Professeur non compatible avec ce cours.", 409);
    }

    if (!salleEstCompatibleAvecCours(salle, cours)) {
      throw creerErreurHoraire("Salle non compatible avec ce cours.", 409);
    }

    const professeurDisponible = await verifierDisponibiliteProfesseur(
      idProfesseur,
      date,
      heureDebut,
      heureFin,
      transactionExecutor
    );

    if (!professeurDisponible) {
      throw creerErreurHoraire("Professeur indisponible sur ce creneau.", 409);
    }

    if (groupe) {
      const conflitGroupe = await verifierConflitGroupe(
        idGroupeNumerique,
        date,
        heureDebut,
        heureFin,
        null,
        transactionExecutor
      );

      if (conflitGroupe > 0) {
        throw creerErreurHoraire("Groupe deja occupe sur ce creneau.", 409);
      }

      if (Number(groupe.est_groupe_special || 0) === 1) {
        const conflitEtudiants = await verifierConflitEtudiantsAffectesAuGroupeSpecial(
          idGroupeNumerique,
          date,
          heureDebut,
          heureFin,
          null,
          transactionExecutor
        );

        if (conflitEtudiants.conflits > 0) {
          throw creerErreurHoraire(
            `Conflit etudiant detecte sur ce creneau pour la section speciale ${groupe.nom_groupe}.`,
            409
          );
        }
      }
    }

    const conflitSalle = await verifierConflitSalle(
      idSalle,
      date,
      heureDebut,
      heureFin,
      null,
      transactionExecutor
    );

    if (conflitSalle > 0) {
      throw creerErreurHoraire("Salle deja occupee sur ce creneau.", 409);
    }

    const conflitProfesseur = await verifierConflitProfesseur(
      idProfesseur,
      date,
      heureDebut,
      heureFin,
      null,
      transactionExecutor
    );

    if (conflitProfesseur > 0) {
      throw creerErreurHoraire("Professeur deja assigne sur ce creneau.", 409);
    }

    const plageResultat = await addPlageHoraire(
      date,
      heureDebut,
      heureFin,
      transactionExecutor
    );
    const affectationResultat = await addAffectation(
      idCours,
      idProfesseur,
      idSalle,
      plageResultat.insertId,
      transactionExecutor
    );

    if (groupe) {
      await addAffectationGroupe(
        idGroupeNumerique,
        affectationResultat.insertId,
        transactionExecutor
      );
    }

    return {
      id_affectation_cours: affectationResultat.insertId,
      id_plage_horaires: plageResultat.insertId,
    };
  }, executor);
}

export async function updateAffectationValidee(
  idAffectation,
  affectation,
  executor = pool
) {
  return executerDansTransactionSiNecessaire(async (transactionExecutor) => {
    await assurerSchemaSchedulerAcademique(transactionExecutor);

    const idAffectationNumerique = Number(idAffectation);

    if (!Number.isInteger(idAffectationNumerique) || idAffectationNumerique <= 0) {
      throw creerErreurHoraire("Affectation introuvable.", 404);
    }

    const affectationExistante = await getAffectationById(
      idAffectationNumerique,
      transactionExecutor
    );

    if (!affectationExistante) {
      throw creerErreurHoraire("Affectation introuvable.", 404);
    }

    const {
      idCours,
      idProfesseur,
      idSalle,
      idGroupeEtudiants,
      date,
      heureDebut,
      heureFin,
    } = affectation;
    const idGroupeNumerique = Number(idGroupeEtudiants);

    const { cours, professeur, salle } = await recupererContexteAffectation(
      idCours,
      idProfesseur,
      idSalle,
      transactionExecutor
    );
    const coursParProfesseur =
      await recupererIndexCoursProfesseurs(transactionExecutor);

    if (!cours) {
      throw creerErreurHoraire("Cours introuvable.", 404);
    }

    if (!professeur) {
      throw creerErreurHoraire("Professeur introuvable.", 404);
    }

    if (!salle) {
      throw creerErreurHoraire("Salle introuvable.", 404);
    }

    let groupe = null;

    if (Number.isInteger(idGroupeNumerique) && idGroupeNumerique > 0) {
      groupe = await recupererContexteGroupe(idGroupeNumerique, transactionExecutor);

      if (!groupe) {
        throw creerErreurHoraire("Groupe introuvable.", 404);
      }

      if (!groupeEstCompatibleAvecCours(groupe, cours)) {
        throw creerErreurHoraire(
          "Le groupe ne correspond pas au programme ou a l'etape du cours.",
          409
        );
      }

      if (!sallePeutAccueillirGroupe(salle, groupe)) {
        throw creerErreurHoraire(
          "La salle ne peut pas accueillir l'effectif de ce groupe.",
          409
        );
      }
    }

    if (!professeurEstCompatibleAvecCours(professeur, cours, coursParProfesseur)) {
      throw creerErreurHoraire("Professeur non compatible avec ce cours.", 409);
    }

    if (!salleEstCompatibleAvecCours(salle, cours)) {
      throw creerErreurHoraire("Salle non compatible avec ce cours.", 409);
    }

    const professeurDisponible = await verifierDisponibiliteProfesseur(
      idProfesseur,
      date,
      heureDebut,
      heureFin,
      transactionExecutor
    );

    if (!professeurDisponible) {
      throw creerErreurHoraire("Professeur indisponible sur ce creneau.", 409);
    }

    const conflitSalle = await verifierConflitSalle(
      idSalle,
      date,
      heureDebut,
      heureFin,
      idAffectationNumerique,
      transactionExecutor
    );

    if (conflitSalle > 0) {
      throw creerErreurHoraire("Salle deja occupee sur ce creneau.", 409);
    }

    const conflitProfesseur = await verifierConflitProfesseur(
      idProfesseur,
      date,
      heureDebut,
      heureFin,
      idAffectationNumerique,
      transactionExecutor
    );

    if (conflitProfesseur > 0) {
      throw creerErreurHoraire("Professeur deja assigne sur ce creneau.", 409);
    }

    if (groupe) {
      const conflitGroupe = await verifierConflitGroupe(
        idGroupeNumerique,
        date,
        heureDebut,
        heureFin,
        idAffectationNumerique,
        transactionExecutor
      );

      if (conflitGroupe > 0) {
        throw creerErreurHoraire("Groupe deja occupe sur ce creneau.", 409);
      }

      if (Number(groupe.est_groupe_special || 0) === 1) {
        const conflitEtudiants = await verifierConflitEtudiantsAffectesAuGroupeSpecial(
          idGroupeNumerique,
          date,
          heureDebut,
          heureFin,
          idAffectationNumerique,
          transactionExecutor
        );

        if (conflitEtudiants.conflits > 0) {
          throw creerErreurHoraire(
            `Conflit etudiant detecte sur ce creneau pour la section speciale ${groupe.nom_groupe}.`,
            409
          );
        }
      }
    } else {
      const [groupesAssocies] = await transactionExecutor.query(
        `SELECT id_groupes_etudiants
         FROM affectation_groupes
         WHERE id_affectation_cours = ?`,
        [idAffectationNumerique]
      );

      for (const groupeAssocie of groupesAssocies) {
        const conflitGroupe = await verifierConflitGroupe(
          groupeAssocie.id_groupes_etudiants,
          date,
          heureDebut,
          heureFin,
          idAffectationNumerique,
          transactionExecutor
        );

        if (conflitGroupe > 0) {
          throw creerErreurHoraire(
            "Un groupe lie a cette affectation est deja occupe.",
            409
          );
        }
      }
    }

    await transactionExecutor.query(
      `UPDATE plages_horaires
       SET date = ?, heure_debut = ?, heure_fin = ?
       WHERE id_plage_horaires = ?`,
      [
        date,
        normaliserHeure(heureDebut),
        normaliserHeure(heureFin),
        affectationExistante.id_plage_horaires,
      ]
    );

    await transactionExecutor.query(
      `UPDATE affectation_cours
       SET id_cours = ?, id_professeur = ?, id_salle = ?
       WHERE id_affectation_cours = ?`,
      [idCours, idProfesseur, idSalle, idAffectationNumerique]
    );

    if (groupe) {
      await remplacerAffectationGroupe(
        idAffectationNumerique,
        idGroupeNumerique,
        transactionExecutor
      );
    }

    return getAffectationById(idAffectationNumerique, transactionExecutor);
  }, executor);
}

/**
 * Genere automatiquement un horaire en respectant les conflits
 * de professeurs et de salles.
 * @returns {Promise<Object>} Resume de generation.
 */
export async function genererHoraireAutomatiquement(options = {}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const programmeCible = normaliserNomProgramme(options.programme);
    const etapeCible = normaliserEtape(options.etape);
    const sessionCible = normaliserNomSession(options.session);
    const programmeAffichage = String(options.programme || "").trim();
    const sessionAffichage = normaliserNomSession(options.session);
    const dateDebut = String(options.dateDebut || "").trim() || null;

    if (!programmeCible || !etapeCible || !sessionCible) {
      throw creerErreurHoraire(
        "Le programme, l'etape et la session sont obligatoires pour generer l'horaire.",
        400
      );
    }

    const [cours] = await connection.query(
      `SELECT id_cours,
              code,
              nom,
              duree,
              programme,
              etape_etude,
              type_salle,
              id_salle_reference
       FROM cours
       WHERE archive = 0
       ORDER BY code ASC;`
    );
    const [professeurs] = await connection.query(
      `SELECT id_professeur, matricule, nom, prenom, specialite
       FROM professeurs
       ORDER BY nom ASC, prenom ASC;`
    );
    const [salles] = await connection.query(
      `SELECT id_salle, code, type, capacite
       FROM salles
       ORDER BY code ASC;`
    );

    if (cours.length === 0 || professeurs.length === 0 || salles.length === 0) {
      throw creerErreurHoraire(
        "Il faut au moins 1 cours, 1 professeur et 1 salle.",
        400
      );
    }

    const disponibilitesParProfesseur =
      await recupererDisponibilitesProfesseurs(connection);
    const coursParProfesseur = await recupererIndexCoursProfesseurs(connection);
    const coursSelectionnes = cours.filter((coursActuel) => {
      if (!programmesCorrespondent(coursActuel.programme, programmeCible)) {
        return false;
      }

      if (!etapesCorrespondent(coursActuel.etape_etude, etapeCible)) {
        return false;
      }

      return true;
    });

    if (coursSelectionnes.length === 0) {
      throw creerErreurHoraire(
        "Aucun cours ne correspond a ce programme et cette etape.",
        400
      );
    }

    const groupesSelectionnes = await creerGroupesAutomatiquesPourCohorte(
      programmeCible,
      etapeCible,
      sessionCible,
      programmeAffichage || options.programme || "Programme",
      sessionAffichage || options.session || "",
      coursSelectionnes,
      salles,
      connection
    );

    const jours = genererJoursCalendaires(NOMBRE_JOURS_GENERATION, dateDebut);
    const compteurAffectations = new Map();
    const affectations = [];
    const nonPlanifies = [];

    const coursTries = [...(coursSelectionnes.length > 0 ? coursSelectionnes : cours)].sort((coursA, coursB) => {
      const sallesCoursA = trierSallesCompatibles(coursA, salles).length;
      const sallesCoursB = trierSallesCompatibles(coursB, salles).length;

      if (sallesCoursA !== sallesCoursB) {
        return sallesCoursA - sallesCoursB;
      }

      return String(coursA.code).localeCompare(String(coursB.code), "fr");
    });

    for (const coursActuel of coursTries) {
      const groupesCompatibles = trouverGroupesCompatibles(
        coursActuel,
        groupesSelectionnes
      );

      if (groupesCompatibles.length === 0) {
        nonPlanifies.push({
          id_cours: coursActuel.id_cours,
          code_cours: coursActuel.code,
          raison: "Aucun groupe correspondant au programme et a l'etape du cours.",
        });
        continue;
      }

      const professeursCompatibles = trierProfesseursPourCours(
        coursActuel,
        professeurs,
        compteurAffectations,
        coursParProfesseur
      );

      if (professeursCompatibles.length === 0) {
        nonPlanifies.push({
          id_cours: coursActuel.id_cours,
          code_cours: coursActuel.code,
          raison: "Aucun professeur compatible pour ce cours.",
        });
        continue;
      }

      const heureFinParCreneau = new Map(
        CRENEAUX_DEBUT.map((heureDebut) => [
          heureDebut,
          calculerHeureFin(heureDebut, coursActuel.duree),
        ])
      );

      for (const groupe of groupesCompatibles) {
        const sallesCompatibles = trierSallesCompatibles(
          coursActuel,
          salles,
          Number(groupe.effectif) || 0
        );

        if (sallesCompatibles.length === 0) {
          nonPlanifies.push({
            id_cours: coursActuel.id_cours,
            code_cours: coursActuel.code,
            groupe: groupe.nom_groupe,
            raison: `Aucune salle compatible ne peut accueillir ${Number(groupe.effectif) || 0} etudiants pour le type ${coursActuel.type_salle}.`,
          });
          continue;
        }

        let affectationCreee = null;

        for (const date of jours) {
          for (const heureDebut of CRENEAUX_DEBUT) {
            const heureFin = heureFinParCreneau.get(heureDebut);
            const conflitGroupe = await verifierConflitGroupe(
              groupe.id_groupes_etudiants,
              date,
              heureDebut,
              heureFin,
              null,
              connection
            );

            if (conflitGroupe > 0) {
              continue;
            }

            for (const professeur of professeursCompatibles) {
              if (
                (compteurAffectations.get(professeur.id_professeur) || 0) >=
                MAX_WEEKLY_SESSIONS_PER_PROFESSOR
              ) {
                continue;
              }

              const disponible = professeurEstDisponible(
                professeur,
                date,
                heureDebut,
                heureFin,
                disponibilitesParProfesseur
              );

              if (!disponible) {
                continue;
              }

              const conflitProfesseur = await verifierConflitProfesseur(
                professeur.id_professeur,
                date,
                heureDebut,
                heureFin,
                null,
                connection
              );

              if (conflitProfesseur > 0) {
                continue;
              }

              for (const salle of sallesCompatibles) {
                const conflitSalle = await verifierConflitSalle(
                  salle.id_salle,
                  date,
                  heureDebut,
                  heureFin,
                  null,
                  connection
                );

                if (conflitSalle > 0) {
                  continue;
                }

                const resultat = await creerAffectationValidee(
                  {
                    idCours: coursActuel.id_cours,
                    idProfesseur: professeur.id_professeur,
                    idSalle: salle.id_salle,
                    date,
                    heureDebut,
                    heureFin,
                  },
                  connection
                );

                await addAffectationGroupe(
                  groupe.id_groupes_etudiants,
                  resultat.id_affectation_cours,
                  connection
                );

                compteurAffectations.set(
                  professeur.id_professeur,
                  (compteurAffectations.get(professeur.id_professeur) || 0) + 1
                );

                affectationCreee = {
                  id_affectation_cours: resultat.id_affectation_cours,
                  cours: `${coursActuel.code} - ${coursActuel.nom}`,
                  professeur: `${professeur.prenom} ${professeur.nom}`,
                  salle: salle.code,
                  date,
                  heure_debut: heureDebut,
                  heure_fin: heureFin,
                  groupes: groupe.nom_groupe,
                  effectif: Number(groupe.effectif) || 0,
                };

                affectations.push(affectationCreee);
                break;
              }

              if (affectationCreee) {
                break;
              }
            }

            if (affectationCreee) {
              break;
            }
          }

          if (affectationCreee) {
            break;
          }
        }

        if (!affectationCreee) {
          nonPlanifies.push({
            id_cours: coursActuel.id_cours,
            code_cours: coursActuel.code,
            groupe: groupe.nom_groupe,
            raison: "Aucun creneau disponible avec un professeur et une salle libres.",
          });
        }
      }
    }

    await connection.commit();

    return {
      message: `${affectations.length} affectation(s) generee(s).`,
      selection: {
        programme: options.programme || "",
        etape: options.etape || "",
        session: sessionAffichage || "",
      },
      groupes_generes: groupesSelectionnes,
      periode: {
        debut: jours[0],
        fin: jours[jours.length - 1],
      },
      affectations,
      non_planifies: nonPlanifies,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
/**
 * MODEL - Gestion des horaires
 *
 * Ce module centralise la generation,
 * la validation et la gestion des affectations.
 */
