import pool from "../../../db.js";
import { assurerSchemaSchedulerAcademique } from "../academic-scheduler-schema.js";
import { AvailabilityChecker } from "../scheduler/AvailabilityChecker.js";
import { recupererDisponibilitesProfesseurs } from "../../model/professeurs.model.js";
import { programmesCorrespondent } from "../../utils/programmes.js";

function normaliserTexte(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

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

function formatDateIso(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function parseDateIso(value) {
  const texte = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) {
    return null;
  }

  const date = new Date(`${texte}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ajouterJours(date, nbJours) {
  const copie = new Date(date.getTime());
  copie.setDate(copie.getDate() + Number(nbJours || 0));
  return copie;
}

function normaliserEtape(value) {
  const texte = String(value ?? "").trim();

  if (!texte) {
    return "";
  }

  const numerique = Number(texte);
  if (!Number.isNaN(numerique)) {
    return String(numerique);
  }

  return normaliserTexte(texte);
}

function etapesCorrespondent(a, b) {
  const etapeA = normaliserEtape(a);
  const etapeB = normaliserEtape(b);

  return Boolean(etapeA) && etapeA === etapeB;
}

const STATUTS_COURS_ECHOUES_PLANIFICATION_MANUELLE_SQL = `
  'a_reprendre',
  'planifie',
  'resolution_manuelle',
  'groupe_special'
`;

function creerErreurPlanification(
  message,
  statusCode = 400,
  code = "PLANNING_ERROR",
  details = {}
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

async function executerDansTransactionSiNecessaire(operation, executor = pool) {
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

async function tableExiste(tableName, executor = pool) {
  const [rows] = await executor.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?
     LIMIT 1`,
    [tableName]
  );

  return rows.length > 0;
}

async function recupererSessionActive(executor = pool) {
  const [rows] = await executor.query(
    `SELECT id_session,
            nom,
            DATE_FORMAT(date_debut, '%Y-%m-%d') AS date_debut,
            DATE_FORMAT(date_fin, '%Y-%m-%d') AS date_fin
     FROM sessions
     WHERE active = TRUE
     ORDER BY id_session DESC
     LIMIT 1`
  );

  return rows[0] || null;
}

function normaliserResumeRepriseManuelleEtudiant(etudiant) {
  const nbCoursEchouesTotal = Number(etudiant?.nb_cours_echoues_total || 0);
  const nbCoursEchouesPlanifies = Number(etudiant?.nb_cours_echoues_planifies || 0);
  const nbCoursEchouesNonPlanifies = Number(
    etudiant?.nb_cours_echoues_non_planifies || 0
  );

  return {
    ...etudiant,
    reprise_manuelle: {
      statut:
        nbCoursEchouesNonPlanifies > 0
          ? "a_traiter"
          : nbCoursEchouesTotal > 0
            ? "planifie"
            : "aucune_reprise",
      a_traiter: nbCoursEchouesNonPlanifies > 0,
      nb_total: nbCoursEchouesTotal,
      nb_planifies: nbCoursEchouesPlanifies,
      nb_non_planifies: nbCoursEchouesNonPlanifies,
    },
  };
}

async function recupererContextePlanification(
  { idCours, idProfesseur, idSalle, idGroupeEtudiants = null },
  executor = pool
) {
  const requetes = [
    executor.query(
      `SELECT c.id_cours,
              c.code,
              c.nom,
              c.programme,
              c.etape_etude,
              c.type_salle,
              c.id_salle_reference,
              COALESCE(c.est_en_ligne, 0) AS est_en_ligne,
              COALESCE(c.sessions_par_semaine, 1) AS sessions_par_semaine
       FROM cours c
       WHERE c.id_cours = ?
       LIMIT 1`,
      [Number(idCours)]
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
       WHERE p.id_professeur = ?
       GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
       LIMIT 1`,
      [Number(idProfesseur)]
    ),
    executor.query(
      `SELECT s.id_salle,
              s.code,
              s.type,
              s.capacite
       FROM salles s
       WHERE s.id_salle = ?
       LIMIT 1`,
      [Number(idSalle)]
    ),
  ];

  if (Number.isInteger(Number(idGroupeEtudiants)) && Number(idGroupeEtudiants) > 0) {
    requetes.push(
      executor.query(
        `SELECT ge.id_groupes_etudiants,
                ge.nom_groupe,
                ge.est_groupe_special,
                ge.programme,
                ge.etape,
                ge.id_session,
                s.nom AS session_nom,
                DATE_FORMAT(s.date_debut, '%Y-%m-%d') AS session_date_debut,
                DATE_FORMAT(s.date_fin, '%Y-%m-%d') AS session_date_fin,
                COUNT(DISTINCT e.id_etudiant) AS effectif_regulier
         FROM groupes_etudiants ge
         LEFT JOIN etudiants e
           ON e.id_groupes_etudiants = ge.id_groupes_etudiants
         LEFT JOIN sessions s
           ON s.id_session = ge.id_session
         WHERE ge.id_groupes_etudiants = ?
         GROUP BY ge.id_groupes_etudiants,
                  ge.nom_groupe,
                  ge.est_groupe_special,
                  ge.programme,
                  ge.etape,
                  ge.id_session,
                  s.nom,
                  s.date_debut,
                  s.date_fin
         LIMIT 1`,
        [Number(idGroupeEtudiants)]
      )
    );
  }

  const resultats = await Promise.all(requetes);

  return {
    cours: resultats[0][0]?.[0] || null,
    professeur: resultats[1][0]?.[0] || null,
    salle: resultats[2][0]?.[0] || null,
    groupe: resultats[3]?.[0]?.[0] || null,
  };
}

async function recupererEtudiantsReguliersGroupe(
  idGroupeEtudiants,
  idCours = null,
  idSession = null,
  executor = pool
) {
  const filtreCours =
    Number.isInteger(Number(idCours)) && Number(idCours) > 0
      ? `AND NOT EXISTS (
           SELECT 1
           FROM affectation_etudiants ae_override
           WHERE ae_override.id_etudiant = e.id_etudiant
             AND ae_override.id_cours = ?
             AND ae_override.id_session = ?
             AND ae_override.source_type = 'individuelle'
         )`
      : "";
  const valeurs = [Number(idGroupeEtudiants)];

  if (filtreCours) {
    valeurs.push(Number(idCours), Number(idSession));
  }

  const [rows] = await executor.query(
    `SELECT e.id_etudiant,
            e.nom,
            e.prenom,
            e.id_groupes_etudiants
     FROM etudiants e
     WHERE e.id_groupes_etudiants = ?
       ${filtreCours}
     ORDER BY e.id_etudiant ASC`,
    valeurs
  );

  return rows;
}

async function recupererEtudiantsAffectesCoursGroupe(
  idGroupeEtudiants,
  idCours,
  idSession,
  executor = pool
) {
  const [rows] = await executor.query(
    `SELECT DISTINCT e.id_etudiant,
            e.nom,
            e.prenom,
            e.id_groupes_etudiants
     FROM (
       SELECT ae.id_etudiant
       FROM affectation_etudiants ae
       WHERE ae.id_groupes_etudiants = ?
         AND ae.id_cours = ?
         AND ae.id_session = ?

       UNION

       SELECT ce.id_etudiant
       FROM cours_echoues ce
       WHERE ce.id_groupe_reprise = ?
         AND ce.id_cours = ?
         AND ce.id_session = ?
         AND ce.statut = 'planifie'
     ) reprises
     JOIN etudiants e
       ON e.id_etudiant = reprises.id_etudiant
     ORDER BY e.id_etudiant ASC`,
    [
      Number(idGroupeEtudiants),
      Number(idCours),
      Number(idSession),
      Number(idGroupeEtudiants),
      Number(idCours),
      Number(idSession),
    ]
  );

  return rows;
}

async function recupererParticipantsSeance(
  idGroupeEtudiants,
  idCours,
  idSession,
  executor = pool
) {
  const [etudiantsReguliers, etudiantsAffectes] = await Promise.all([
    recupererEtudiantsReguliersGroupe(idGroupeEtudiants, idCours, idSession, executor),
    recupererEtudiantsAffectesCoursGroupe(
      idGroupeEtudiants,
      idCours,
      idSession,
      executor
    ),
  ]);

  const idsReguliers = new Set(
    etudiantsReguliers.map((etudiant) => Number(etudiant.id_etudiant))
  );
  const affectesExternes = etudiantsAffectes.filter(
    (etudiant) => !idsReguliers.has(Number(etudiant.id_etudiant))
  );
  const participants = [...etudiantsReguliers, ...affectesExternes];

  return {
    etudiantsReguliers,
    etudiantsReprises: affectesExternes,
    participants,
    idsParticipants: participants
      .map((etudiant) => Number(etudiant.id_etudiant))
      .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0),
    effectifReel: participants.length,
  };
}

function salleCompatibleAvecCours(salle, cours) {
  if (!salle || !cours) {
    return false;
  }

  if (Number(cours.est_en_ligne || 0) === 1) {
    return true;
  }

  const typeSalle = normaliserTexte(salle.type);
  const typeCours = normaliserTexte(cours.type_salle);

  if (!typeSalle || !typeCours) {
    return false;
  }

  return typeSalle === typeCours;
}

function groupeCompatibleAvecCours(groupe, cours) {
  if (!groupe || !cours) {
    return false;
  }

  return (
    programmesCorrespondent(groupe.programme, cours.programme) &&
    etapesCorrespondent(groupe.etape, cours.etape_etude)
  );
}

function ensureDateDansSession(date, session, messagePrefix = "La date") {
  const dateIso = formatDateIso(parseDateIso(date));
  const dateDebut = formatDateIso(parseDateIso(session?.date_debut));
  const dateFin = formatDateIso(parseDateIso(session?.date_fin));

  if (!dateIso || !dateDebut || !dateFin) {
    throw creerErreurPlanification(
      "La session active ne fournit pas de borne de planification exploitable.",
      409,
      "SESSION_RANGE_INVALID"
    );
  }

  if (dateIso < dateDebut || dateIso > dateFin) {
    throw creerErreurPlanification(
      `${messagePrefix} doit se situer entre ${dateDebut} et ${dateFin}.`,
      409,
      "DATE_OUTSIDE_SESSION",
      {
        date: dateIso,
        session_date_debut: dateDebut,
        session_date_fin: dateFin,
      }
    );
  }
}

function normaliserPortee(portee = {}) {
  const mode = String(
    portee.mode || portee.type || "single"
  ).trim().toLowerCase();

  if (
    mode === "single" ||
    mode === "single_occurrence" ||
    mode === "this_week" ||
    mode === "cette_semaine"
  ) {
    return { mode: "single" };
  }

  if (
    mode === "from_this_week" ||
    mode === "from_date" ||
    mode === "until_session_end" ||
    mode === "jusqua_fin_session"
  ) {
    return { mode: "until_session_end" };
  }

  if (mode === "custom_range" || mode === "periode_personnalisee") {
    return {
      mode: "custom_range",
      date_debut: portee.date_debut || null,
      date_fin: portee.date_fin || null,
    };
  }

  return { mode: "single" };
}

function resoudreDatesOccurrences(dateAncre, portee, session) {
  const ancre = parseDateIso(dateAncre);
  if (!ancre) {
    throw creerErreurPlanification(
      "La date de planification est invalide.",
      400,
      "INVALID_DATE"
    );
  }

  ensureDateDansSession(dateAncre, session, "La date de planification");
  const porteeNormalisee = normaliserPortee(portee);

  if (porteeNormalisee.mode === "single") {
    return [formatDateIso(ancre)];
  }

  const sessionFin = parseDateIso(session?.date_fin);
  if (!sessionFin) {
    throw creerErreurPlanification(
      "Impossible de determiner la fin de session pour la recurrence.",
      409,
      "SESSION_END_MISSING"
    );
  }

  let debut = ancre;
  let fin = sessionFin;

  if (porteeNormalisee.mode === "custom_range") {
    const debutDemande = parseDateIso(porteeNormalisee.date_debut || dateAncre);
    const finDemandee = parseDateIso(porteeNormalisee.date_fin);

    if (!debutDemande || !finDemandee) {
      throw creerErreurPlanification(
        "La periode personnalisee exige une date_debut et une date_fin valides.",
        400,
        "CUSTOM_RANGE_INVALID"
      );
    }

    if (formatDateIso(debutDemande) > formatDateIso(finDemandee)) {
      throw creerErreurPlanification(
        "La date de fin doit etre posterieure ou egale a la date de debut.",
        400,
        "CUSTOM_RANGE_ORDER_INVALID"
      );
    }

    ensureDateDansSession(formatDateIso(debutDemande), session, "La date de debut");
    ensureDateDansSession(formatDateIso(finDemandee), session, "La date de fin");

    debut = debutDemande;
    fin = finDemandee;
  }

  const dates = [];
  let courant = new Date(ancre.getTime());

  while (formatDateIso(courant) < formatDateIso(debut)) {
    courant = ajouterJours(courant, 7);
  }

  while (formatDateIso(courant) <= formatDateIso(fin)) {
    dates.push(formatDateIso(courant));
    courant = ajouterJours(courant, 7);
  }

  if (dates.length === 0) {
    throw creerErreurPlanification(
      "Aucune occurrence ne correspond a la portee demandee.",
      409,
      "NO_OCCURRENCE_IN_SCOPE"
    );
  }

  return dates;
}

async function recupererDisponibilitesEtAbsencesProfesseurs(executor = pool) {
  const disponibilitesParProfesseur = await recupererDisponibilitesProfesseurs(executor);
  const absencesParProfesseur = new Map();

  if (!(await tableExiste("absences_professeurs", executor))) {
    return { disponibilitesParProfesseur, absencesParProfesseur };
  }

  const [rows] = await executor.query(
    `SELECT id_professeur,
            DATE_FORMAT(date_debut, '%Y-%m-%d') AS date_debut,
            DATE_FORMAT(date_fin, '%Y-%m-%d') AS date_fin
     FROM absences_professeurs`
  );

  for (const row of rows) {
    const idProfesseur = Number(row.id_professeur);
    if (!absencesParProfesseur.has(idProfesseur)) {
      absencesParProfesseur.set(idProfesseur, []);
    }
    absencesParProfesseur.get(idProfesseur).push(row);
  }

  return { disponibilitesParProfesseur, absencesParProfesseur };
}

async function recupererIndisponibilitesSalles(executor = pool) {
  const indispoParSalle = new Map();

  if (!(await tableExiste("salles_indisponibles", executor))) {
    return indispoParSalle;
  }

  const [rows] = await executor.query(
    `SELECT id_salle,
            DATE_FORMAT(date_debut, '%Y-%m-%d') AS date_debut,
            DATE_FORMAT(date_fin, '%Y-%m-%d') AS date_fin
     FROM salles_indisponibles`
  );

  for (const row of rows) {
    const idSalle = Number(row.id_salle);
    if (!indispoParSalle.has(idSalle)) {
      indispoParSalle.set(idSalle, []);
    }
    indispoParSalle.get(idSalle).push(row);
  }

  return indispoParSalle;
}

function construireClauseExclusionAffectations(idsAExclure = []) {
  const ids = idsAExclure
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (ids.length === 0) {
    return { clause: "", valeurs: [] };
  }

  return {
    clause: ` AND ac.id_affectation_cours NOT IN (${ids.map(() => "?").join(", ")})`,
    valeurs: ids,
  };
}

async function verifierConflitEntity(
  {
    type,
    idValeur,
    date,
    heureDebut,
    heureFin,
    idsAffectationsExclues = [],
  },
  executor = pool
) {
  const champs = {
    salle: "ac.id_salle",
    professeur: "ac.id_professeur",
  };

  if (!champs[type]) {
    return 0;
  }

  const exclusion = construireClauseExclusionAffectations(idsAffectationsExclues);
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS conflits
     FROM affectation_cours ac
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ${champs[type]} = ?
       AND ph.date = ?
       AND ph.heure_debut < ?
       AND ph.heure_fin > ?${exclusion.clause}`,
    [
      Number(idValeur),
      date,
      normaliserHeure(heureFin),
      normaliserHeure(heureDebut),
      ...exclusion.valeurs,
    ]
  );

  return Number(rows[0]?.conflits || 0);
}

async function verifierConflitGroupe(
  idGroupeEtudiants,
  date,
  heureDebut,
  heureFin,
  idsAffectationsExclues = [],
  executor = pool
) {
  const exclusion = construireClauseExclusionAffectations(idsAffectationsExclues);
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
       AND ph.heure_fin > ?${exclusion.clause}`,
    [
      Number(idGroupeEtudiants),
      date,
      normaliserHeure(heureFin),
      normaliserHeure(heureDebut),
      ...exclusion.valeurs,
    ]
  );

  return Number(rows[0]?.conflits || 0);
}

async function listerConflitsEtudiants(
  idsEtudiants,
  date,
  heureDebut,
  heureFin,
  idSession,
  idsAffectationsExclues = [],
  executor = pool
) {
  const ids = [...new Set(
    (Array.isArray(idsEtudiants) ? idsEtudiants : [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => "?").join(", ");
  const exclusion = construireClauseExclusionAffectations(idsAffectationsExclues);
  const requete = `
    SELECT DISTINCT conflits.id_etudiant,
                    e.nom,
                    e.prenom,
                    conflits.id_affectation_cours,
                    conflits.source_horaire
    FROM (
      SELECT e.id_etudiant,
             ac.id_affectation_cours,
             'groupe' AS source_horaire
      FROM etudiants e
      JOIN groupes_etudiants ge
        ON ge.id_groupes_etudiants = e.id_groupes_etudiants
      JOIN affectation_groupes ag
        ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
      JOIN affectation_cours ac
        ON ac.id_affectation_cours = ag.id_affectation_cours
      JOIN plages_horaires ph
        ON ph.id_plage_horaires = ac.id_plage_horaires
      WHERE e.id_etudiant IN (${placeholders})
        AND NOT EXISTS (
          SELECT 1
          FROM affectation_etudiants ae_override
          WHERE ae_override.id_etudiant = e.id_etudiant
            AND ae_override.id_cours = ac.id_cours
            AND ae_override.id_session = ge.id_session
            AND ae_override.source_type = 'individuelle'
        )
        AND ph.date = ?
        AND ph.heure_debut < ?
        AND ph.heure_fin > ?${exclusion.clause}

      UNION

      SELECT ae.id_etudiant,
             ac.id_affectation_cours,
             'reprise' AS source_horaire
      FROM affectation_etudiants ae
      JOIN affectation_groupes ag
        ON ag.id_groupes_etudiants = ae.id_groupes_etudiants
      JOIN affectation_cours ac
        ON ac.id_affectation_cours = ag.id_affectation_cours
       AND ac.id_cours = ae.id_cours
      JOIN plages_horaires ph
        ON ph.id_plage_horaires = ac.id_plage_horaires
      WHERE ae.id_etudiant IN (${placeholders})
        AND ae.id_session = ?
        AND ae.source_type IN ('reprise', 'individuelle')
        AND ph.date = ?
        AND ph.heure_debut < ?
        AND ph.heure_fin > ?${exclusion.clause}
    ) conflits
    JOIN etudiants e
      ON e.id_etudiant = conflits.id_etudiant
    ORDER BY conflits.id_etudiant ASC
  `;

  const valeurs = [
    ...ids,
    date,
    normaliserHeure(heureFin),
    normaliserHeure(heureDebut),
    ...exclusion.valeurs,
    ...ids,
    Number(idSession),
    date,
    normaliserHeure(heureFin),
    normaliserHeure(heureDebut),
    ...exclusion.valeurs,
  ];

  const [rows] = await executor.query(requete, valeurs);
  return rows;
}

async function creerPlageHoraire(date, heureDebut, heureFin, executor = pool) {
  const [result] = await executor.query(
    `INSERT INTO plages_horaires (date, heure_debut, heure_fin)
     VALUES (?, ?, ?)`,
    [date, normaliserHeure(heureDebut), normaliserHeure(heureFin)]
  );

  return Number(result.insertId);
}

async function creerSeriePlanification(
  { idSession, typePlanification = "groupe", recurrence = "hebdomadaire", dateDebut, dateFin },
  executor = pool
) {
  const [result] = await executor.query(
    `INSERT INTO planification_series (
       id_session,
       type_planification,
       recurrence,
       date_debut,
       date_fin
     )
     VALUES (?, ?, ?, ?, ?)`,
    [
      Number(idSession),
      typePlanification,
      recurrence,
      dateDebut,
      dateFin,
    ]
  );

  return Number(result.insertId);
}

async function mettreAJourSeriePlanification(idSerie, executor = pool) {
  if (!Number.isInteger(Number(idSerie)) || Number(idSerie) <= 0) {
    return;
  }

  await executor.query(
    `UPDATE planification_series ps
     JOIN (
       SELECT ac.id_planification_serie,
              MIN(ph.date) AS date_debut,
              MAX(ph.date) AS date_fin
       FROM affectation_cours ac
       JOIN plages_horaires ph
         ON ph.id_plage_horaires = ac.id_plage_horaires
       WHERE ac.id_planification_serie = ?
       GROUP BY ac.id_planification_serie
     ) serie_calculee
       ON serie_calculee.id_planification_serie = ps.id_planification_serie
     SET ps.date_debut = serie_calculee.date_debut,
         ps.date_fin = serie_calculee.date_fin,
         ps.updated_at = CURRENT_TIMESTAMP
     WHERE ps.id_planification_serie = ?`,
    [Number(idSerie), Number(idSerie)]
  );
}

async function supprimerSeriesOrphelines(executor = pool) {
  await executor.query(
    `DELETE ps
     FROM planification_series ps
     LEFT JOIN affectation_cours ac
       ON ac.id_planification_serie = ps.id_planification_serie
     WHERE ac.id_affectation_cours IS NULL`
  );
}

async function creerAffectationAvecLiens(
  {
    idCours,
    idProfesseur,
    idSalle,
    idGroupeEtudiants,
    date,
    heureDebut,
    heureFin,
    idPlanificationSerie = null,
  },
  executor = pool
) {
  const idPlage = await creerPlageHoraire(date, heureDebut, heureFin, executor);
  const [affectationResult] = await executor.query(
    `INSERT INTO affectation_cours (
       id_cours,
       id_professeur,
       id_salle,
       id_plage_horaires,
       id_planification_serie
     )
     VALUES (?, ?, ?, ?, ?)`,
    [
      Number(idCours),
      Number(idProfesseur),
      Number(idSalle),
      Number(idPlage),
      Number.isInteger(Number(idPlanificationSerie)) && Number(idPlanificationSerie) > 0
        ? Number(idPlanificationSerie)
        : null,
    ]
  );

  const idAffectation = Number(affectationResult.insertId);

  await executor.query(
    `INSERT INTO affectation_groupes (id_groupes_etudiants, id_affectation_cours)
     VALUES (?, ?)`,
    [Number(idGroupeEtudiants), idAffectation]
  );

  return {
    id_affectation_cours: idAffectation,
    id_plage_horaires: idPlage,
  };
}

async function supprimerAffectationComplete(idAffectation, executor = pool) {
  const [plages] = await executor.query(
    `SELECT id_plage_horaires
     FROM affectation_cours
     WHERE id_affectation_cours = ?`,
    [Number(idAffectation)]
  );

  const idPlage = Number(plages[0]?.id_plage_horaires || 0);

  await executor.query(
    `DELETE FROM affectation_groupes
     WHERE id_affectation_cours = ?`,
    [Number(idAffectation)]
  );

  await executor.query(
    `DELETE FROM affectation_cours
     WHERE id_affectation_cours = ?`,
    [Number(idAffectation)]
  );

  if (idPlage > 0) {
    await executor.query(
      `DELETE FROM plages_horaires
       WHERE id_plage_horaires = ?`,
      [idPlage]
    );
  }
}

async function validerOccurrenceGroupe(
  {
    cours,
    professeur,
    salle,
    groupe,
    session,
    participants,
    occurrence,
    idsAffectationsExclues = [],
    caches = {},
  },
  executor = pool
) {
  if (!cours) {
    throw creerErreurPlanification("Cours introuvable.", 404, "COURSE_NOT_FOUND");
  }

  if (!professeur) {
    throw creerErreurPlanification(
      "Professeur introuvable.",
      404,
      "PROFESSOR_NOT_FOUND"
    );
  }

  if (!salle) {
    throw creerErreurPlanification("Salle introuvable.", 404, "ROOM_NOT_FOUND");
  }

  if (!groupe) {
    throw creerErreurPlanification("Groupe introuvable.", 404, "GROUP_NOT_FOUND");
  }

  if (!groupeCompatibleAvecCours(groupe, cours)) {
    throw creerErreurPlanification(
      "Le groupe ne correspond pas au programme ou a l'etape du cours.",
      409,
      "GROUP_COURSE_MISMATCH"
    );
  }

  if (!AvailabilityChecker.profCompatible(professeur, cours)) {
    throw creerErreurPlanification(
      "Le professeur n'est pas compatible avec ce cours.",
      409,
      "PROFESSOR_COURSE_MISMATCH"
    );
  }

  if (!salleCompatibleAvecCours(salle, cours)) {
    throw creerErreurPlanification(
      "La salle n'est pas compatible avec le type reel de ce cours.",
      409,
      "ROOM_COURSE_TYPE_MISMATCH",
      {
        type_salle_cours: cours.type_salle,
        type_salle: salle.type,
      }
    );
  }

  const effectifReel = Number(participants.effectifReel || 0);
  if (!AvailabilityChecker.salleCompatible(salle, cours, effectifReel)) {
    throw creerErreurPlanification(
      `La salle ne peut pas accueillir l'effectif reel de la seance (${effectifReel} etudiants).`,
      409,
      "ROOM_CAPACITY_INSUFFICIENT",
      {
        capacite_salle: Number(salle.capacite || 0),
        effectif_reel: effectifReel,
      }
    );
  }

  ensureDateDansSession(
    occurrence.date,
    session,
    "La date de la seance"
  );

  const heureDebut = normaliserHeure(occurrence.heureDebut);
  const heureFin = normaliserHeure(occurrence.heureFin);
  if (!heureDebut || !heureFin || heureVersMinutes(heureDebut) >= heureVersMinutes(heureFin)) {
    throw creerErreurPlanification(
      "Le creneau horaire est invalide.",
      400,
      "INVALID_TIME_RANGE"
    );
  }

  const disponibilitesEtAbsences =
    caches.disponibilitesEtAbsences ||
    await recupererDisponibilitesEtAbsencesProfesseurs(executor);
  const indispoSalles =
    caches.indisponibilitesSalles || await recupererIndisponibilitesSalles(executor);

  if (
    !AvailabilityChecker.profDisponible(
      Number(professeur.id_professeur),
      occurrence.date,
      heureDebut,
      heureFin,
      disponibilitesEtAbsences.disponibilitesParProfesseur,
      disponibilitesEtAbsences.absencesParProfesseur
    )
  ) {
    throw creerErreurPlanification(
      "Le professeur est indisponible sur ce creneau.",
      409,
      "PROFESSOR_UNAVAILABLE"
    );
  }

  if (
    !AvailabilityChecker.salleDisponible(
      Number(salle.id_salle),
      occurrence.date,
      indispoSalles
    )
  ) {
    throw creerErreurPlanification(
      "La salle est indisponible sur cette date.",
      409,
      "ROOM_UNAVAILABLE"
    );
  }

  const [conflitSalle, conflitProfesseur, conflitGroupe, conflitsEtudiants] =
    await Promise.all([
      verifierConflitEntity(
        {
          type: "salle",
          idValeur: salle.id_salle,
          date: occurrence.date,
          heureDebut,
          heureFin,
          idsAffectationsExclues,
        },
        executor
      ),
      verifierConflitEntity(
        {
          type: "professeur",
          idValeur: professeur.id_professeur,
          date: occurrence.date,
          heureDebut,
          heureFin,
          idsAffectationsExclues,
        },
        executor
      ),
      verifierConflitGroupe(
        groupe.id_groupes_etudiants,
        occurrence.date,
        heureDebut,
        heureFin,
        idsAffectationsExclues,
        executor
      ),
      listerConflitsEtudiants(
        participants.idsParticipants,
        occurrence.date,
        heureDebut,
        heureFin,
        session.id_session,
        idsAffectationsExclues,
        executor
      ),
    ]);

  if (conflitSalle > 0) {
    throw creerErreurPlanification(
      "La salle est deja occupee sur ce creneau.",
      409,
      "ROOM_TIME_CONFLICT"
    );
  }

  if (conflitProfesseur > 0) {
    throw creerErreurPlanification(
      "Le professeur est deja assigne sur ce creneau.",
      409,
      "PROFESSOR_TIME_CONFLICT"
    );
  }

  if (conflitGroupe > 0) {
    throw creerErreurPlanification(
      "Le groupe est deja occupe sur ce creneau.",
      409,
      "GROUP_TIME_CONFLICT"
    );
  }

  if (conflitsEtudiants.length > 0) {
    const conflit = conflitsEtudiants[0];
    throw creerErreurPlanification(
      `Conflit horaire detecte pour ${conflit.prenom} ${conflit.nom}.`,
      409,
      "STUDENT_TIME_CONFLICT",
      {
        id_etudiant: Number(conflit.id_etudiant),
        source_horaire: conflit.source_horaire,
      }
    );
  }
}

async function recupererAffectationDetaillee(idAffectation, executor = pool) {
  const [rows] = await executor.query(
    `SELECT ac.id_affectation_cours,
            ac.id_cours,
            ac.id_professeur,
            ac.id_salle,
            ac.id_plage_horaires,
            ac.id_planification_serie,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            ph.heure_debut,
            ph.heure_fin,
            MIN(ag.id_groupes_etudiants) AS id_groupes_etudiants
     FROM affectation_cours ac
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     LEFT JOIN affectation_groupes ag
       ON ag.id_affectation_cours = ac.id_affectation_cours
     WHERE ac.id_affectation_cours = ?
     GROUP BY ac.id_affectation_cours,
              ac.id_cours,
              ac.id_professeur,
              ac.id_salle,
              ac.id_plage_horaires,
              ac.id_planification_serie,
              ph.date,
              ph.heure_debut,
              ph.heure_fin
     LIMIT 1`,
    [Number(idAffectation)]
  );

  return rows[0] || null;
}

async function recupererOccurrencesSerieParPortee(
  affectationReference,
  portee = {},
  session,
  executor = pool
) {
  const idSerie = Number(affectationReference?.id_planification_serie || 0);
  const dateReference = String(affectationReference?.date || "");
  const porteeNormalisee = normaliserPortee(portee);

  if (porteeNormalisee.mode === "single") {
    return [affectationReference];
  }

  if (!Number.isInteger(idSerie) || idSerie <= 0) {
    throw creerErreurPlanification(
      "Cette seance n'appartient pas a une recurrence geree. Seule la modification de l'occurrence est disponible.",
      409,
      "RECURRENCE_NOT_SUPPORTED"
    );
  }

  let clausePeriode = "AND ph.date >= ?";
  let valeurs = [idSerie, dateReference];

  if (porteeNormalisee.mode === "custom_range") {
    const dateDebut = porteeNormalisee.date_debut || dateReference;
    const dateFin = porteeNormalisee.date_fin;

    if (!dateDebut || !dateFin) {
      throw creerErreurPlanification(
        "La modification sur periode exige une date_debut et une date_fin.",
        400,
        "UPDATE_RANGE_INVALID"
      );
    }

    ensureDateDansSession(dateDebut, session, "La date de debut");
    ensureDateDansSession(dateFin, session, "La date de fin");
    clausePeriode = "AND ph.date BETWEEN ? AND ?";
    valeurs = [idSerie, dateDebut, dateFin];
  }

  const [rows] = await executor.query(
    `SELECT ac.id_affectation_cours,
            ac.id_cours,
            ac.id_professeur,
            ac.id_salle,
            ac.id_plage_horaires,
            ac.id_planification_serie,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            ph.heure_debut,
            ph.heure_fin,
            MIN(ag.id_groupes_etudiants) AS id_groupes_etudiants
     FROM affectation_cours ac
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     LEFT JOIN affectation_groupes ag
       ON ag.id_affectation_cours = ac.id_affectation_cours
     WHERE ac.id_planification_serie = ?
       ${clausePeriode}
     GROUP BY ac.id_affectation_cours,
              ac.id_cours,
              ac.id_professeur,
              ac.id_salle,
              ac.id_plage_horaires,
              ac.id_planification_serie,
              ph.date,
              ph.heure_debut,
              ph.heure_fin
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    valeurs
  );

  if (rows.length === 0) {
    throw creerErreurPlanification(
      "Aucune occurrence ne correspond a la portee de modification.",
      404,
      "NO_ASSIGNMENT_IN_SCOPE"
    );
  }

  return rows;
}

function construirePayloadOccurrence(affectation, overrides = {}) {
  return {
    idCours: Number(overrides.idCours ?? affectation.id_cours),
    idProfesseur: Number(overrides.idProfesseur ?? affectation.id_professeur),
    idSalle: Number(overrides.idSalle ?? affectation.id_salle),
    idGroupeEtudiants: Number(
      overrides.idGroupeEtudiants ?? affectation.id_groupes_etudiants
    ),
    date: String(overrides.date ?? affectation.date),
    heureDebut: String(overrides.heureDebut ?? affectation.heure_debut),
    heureFin: String(overrides.heureFin ?? affectation.heure_fin),
  };
}

async function rechargerContexteParticipants(payload, executor = pool) {
  const session = await recupererSessionActive(executor);
  if (!session?.id_session) {
    throw creerErreurPlanification(
      "Aucune session active n'est disponible.",
      409,
      "ACTIVE_SESSION_MISSING"
    );
  }

  const contexte = await recupererContextePlanification(payload, executor);
  const participants = await recupererParticipantsSeance(
    payload.idGroupeEtudiants,
    payload.idCours,
    contexte.groupe?.id_session || session.id_session,
    executor
  );

  return {
    session: contexte.groupe?.id_session
      ? {
          id_session: contexte.groupe.id_session,
          date_debut: contexte.groupe.session_date_debut || session.date_debut,
          date_fin: contexte.groupe.session_date_fin || session.date_fin,
          nom: contexte.groupe.session_nom || session.nom,
        }
      : session,
    contexte,
    participants,
  };
}

export async function planifierCoursGroupeManuellement(payload, executor = pool) {
  return executerDansTransactionSiNecessaire(async (transactionExecutor) => {
    await assurerSchemaSchedulerAcademique(transactionExecutor);

    const basePayload = {
      idCours: Number(payload.idCours),
      idProfesseur: Number(payload.idProfesseur),
      idSalle: Number(payload.idSalle),
      idGroupeEtudiants: Number(payload.idGroupeEtudiants),
      date: String(payload.date || ""),
      heureDebut: String(payload.heureDebut || ""),
      heureFin: String(payload.heureFin || ""),
    };

    const { session, contexte, participants } =
      await rechargerContexteParticipants(basePayload, transactionExecutor);
    const dates = resoudreDatesOccurrences(basePayload.date, payload.portee, session);
    const idSerie =
      dates.length > 1
        ? await creerSeriePlanification(
            {
              idSession: session.id_session,
              typePlanification: "groupe",
              recurrence: "hebdomadaire",
              dateDebut: dates[0],
              dateFin: dates[dates.length - 1],
            },
            transactionExecutor
          )
        : null;

    const caches = {
      disponibilitesEtAbsences: await recupererDisponibilitesEtAbsencesProfesseurs(
        transactionExecutor
      ),
      indisponibilitesSalles: await recupererIndisponibilitesSalles(transactionExecutor),
    };

    const occurrencesCreees = [];

    for (const date of dates) {
      await validerOccurrenceGroupe(
        {
          cours: contexte.cours,
          professeur: contexte.professeur,
          salle: contexte.salle,
          groupe: contexte.groupe,
          session,
          participants,
          occurrence: {
            date,
            heureDebut: basePayload.heureDebut,
            heureFin: basePayload.heureFin,
          },
          idsAffectationsExclues: [],
          caches,
        },
        transactionExecutor
      );

      const resultat = await creerAffectationAvecLiens(
        {
          ...basePayload,
          date,
          idPlanificationSerie: idSerie,
        },
        transactionExecutor
      );

      occurrencesCreees.push({
        ...resultat,
        date,
      });
    }

    return {
      message:
        occurrencesCreees.length > 1
          ? `${occurrencesCreees.length} occurrence(s) planifiee(s).`
          : "Cours planifie avec succes.",
      occurrences: occurrencesCreees,
      id_planification_serie: idSerie,
      groupes_impactes: [basePayload.idGroupeEtudiants],
      professeurs_impactes: [basePayload.idProfesseur],
      salles_impactees: [basePayload.idSalle],
      etudiants_impactes: participants.etudiantsReguliers.map((etudiant) =>
        Number(etudiant.id_etudiant)
      ),
      etudiants_reprises_impactes: participants.etudiantsReprises.map((etudiant) =>
        Number(etudiant.id_etudiant)
      ),
      effectif_reel: participants.effectifReel,
    };
  }, executor);
}

export async function replanifierCoursGroupeManuellement(
  idAffectation,
  payload,
  executor = pool
) {
  return executerDansTransactionSiNecessaire(async (transactionExecutor) => {
    await assurerSchemaSchedulerAcademique(transactionExecutor);

    const affectationReference = await recupererAffectationDetaillee(
      idAffectation,
      transactionExecutor
    );

    if (!affectationReference) {
      throw creerErreurPlanification(
        "Affectation introuvable.",
        404,
        "ASSIGNMENT_NOT_FOUND"
      );
    }

    const session = await recupererSessionActive(transactionExecutor);
    if (!session?.id_session) {
      throw creerErreurPlanification(
        "Aucune session active n'est disponible.",
        409,
        "ACTIVE_SESSION_MISSING"
      );
    }

    const occurrencesCibles = await recupererOccurrencesSerieParPortee(
      affectationReference,
      payload.portee,
      session,
      transactionExecutor
    );

    const payloadBase = construirePayloadOccurrence(affectationReference, payload);
    const { contexte, participants } = await rechargerContexteParticipants(
      payloadBase,
      transactionExecutor
    );
    const caches = {
      disponibilitesEtAbsences: await recupererDisponibilitesEtAbsencesProfesseurs(
        transactionExecutor
      ),
      indisponibilitesSalles: await recupererIndisponibilitesSalles(transactionExecutor),
    };
    const idsExclues = occurrencesCibles.map((occurrence) =>
      Number(occurrence.id_affectation_cours)
    );

    const dateAncre = payload.date || occurrencesCibles[0].date;
    const datesCibles =
      occurrencesCibles.length > 1
        ? resoudreDatesOccurrences(
            dateAncre,
            {
              mode: "custom_range",
              date_debut: dateAncre,
              date_fin: formatDateIso(
                ajouterJours(
                  parseDateIso(dateAncre),
                  (occurrencesCibles.length - 1) * 7
                )
              ),
            },
            session
          )
        : [payloadBase.date];

    if (datesCibles.length !== occurrencesCibles.length) {
      throw creerErreurPlanification(
        "Le nombre d'occurrences ciblees ne correspond pas a la nouvelle portee demandee.",
        409,
        "RECURRENCE_LENGTH_MISMATCH"
      );
    }

    for (let index = 0; index < occurrencesCibles.length; index += 1) {
      await validerOccurrenceGroupe(
        {
          cours: contexte.cours,
          professeur: contexte.professeur,
          salle: contexte.salle,
          groupe: contexte.groupe,
          session,
          participants,
          occurrence: {
            date: datesCibles[index],
            heureDebut: payloadBase.heureDebut,
            heureFin: payloadBase.heureFin,
          },
          idsAffectationsExclues: idsExclues,
          caches,
        },
        transactionExecutor
      );
    }

    for (let index = 0; index < occurrencesCibles.length; index += 1) {
      const occurrence = occurrencesCibles[index];

      await transactionExecutor.query(
        `UPDATE plages_horaires
         SET date = ?, heure_debut = ?, heure_fin = ?
         WHERE id_plage_horaires = ?`,
        [
          datesCibles[index],
          normaliserHeure(payloadBase.heureDebut),
          normaliserHeure(payloadBase.heureFin),
          Number(occurrence.id_plage_horaires),
        ]
      );

      await transactionExecutor.query(
        `UPDATE affectation_cours
         SET id_cours = ?,
             id_professeur = ?,
             id_salle = ?
         WHERE id_affectation_cours = ?`,
        [
          payloadBase.idCours,
          payloadBase.idProfesseur,
          payloadBase.idSalle,
          Number(occurrence.id_affectation_cours),
        ]
      );

      await transactionExecutor.query(
        `DELETE FROM affectation_groupes
         WHERE id_affectation_cours = ?`,
        [Number(occurrence.id_affectation_cours)]
      );

      await transactionExecutor.query(
        `INSERT INTO affectation_groupes (id_groupes_etudiants, id_affectation_cours)
         VALUES (?, ?)`,
        [
          payloadBase.idGroupeEtudiants,
          Number(occurrence.id_affectation_cours),
        ]
      );
    }

    await mettreAJourSeriePlanification(
      affectationReference.id_planification_serie,
      transactionExecutor
    );
    await supprimerSeriesOrphelines(transactionExecutor);

    return {
      message:
        occurrencesCibles.length > 1
          ? `${occurrencesCibles.length} occurrence(s) replanifiee(s).`
          : "Affectation mise a jour.",
      occurrences_modifiees: occurrencesCibles.map((occurrence, index) => ({
        id_affectation_cours: Number(occurrence.id_affectation_cours),
        date: datesCibles[index],
      })),
      groupes_impactes: [payloadBase.idGroupeEtudiants],
      professeurs_impactes: [payloadBase.idProfesseur],
      salles_impactees: [payloadBase.idSalle],
      etudiants_impactes: participants.etudiantsReguliers.map((etudiant) =>
        Number(etudiant.id_etudiant)
      ),
      etudiants_reprises_impactes: participants.etudiantsReprises.map((etudiant) =>
        Number(etudiant.id_etudiant)
      ),
      effectif_reel: participants.effectifReel,
    };
  }, executor);
}

export async function listerCoursEchouesEtudiant(idEtudiant, executor = pool) {
  await assurerSchemaSchedulerAcademique(executor);

  const session = await recupererSessionActive(executor);
  if (!session?.id_session) {
    throw creerErreurPlanification(
      "Aucune session active n'est disponible.",
      409,
      "ACTIVE_SESSION_MISSING"
    );
  }

  const [rows] = await executor.query(
    `SELECT ce.id,
            ce.id_etudiant,
            ce.id_cours,
            ce.statut,
            ce.note_echec,
            CASE
              WHEN ce.statut <> 'planifie' OR ce.id_groupe_reprise IS NULL THEN 1
              ELSE 0
            END AS est_non_planifie,
            c.code AS code_cours,
            c.nom AS nom_cours,
            c.programme,
            c.etape_etude,
            c.type_salle,
            ge.id_groupes_etudiants AS id_groupe_reprise,
            ge.nom_groupe AS groupe_reprise
     FROM cours_echoues ce
     JOIN cours c
       ON c.id_cours = ce.id_cours
     LEFT JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = ce.id_groupe_reprise
     WHERE ce.id_etudiant = ?
       AND ce.id_session = ?
       AND ce.statut IN (${STATUTS_COURS_ECHOUES_PLANIFICATION_MANUELLE_SQL})
     ORDER BY est_non_planifie DESC,
              c.code ASC`,
    [Number(idEtudiant), Number(session.id_session)]
  );

  return rows.map((row) => ({
    ...row,
    est_non_planifie: Number(row.est_non_planifie || 0) === 1,
  }));
}

export async function listerEtudiantsPourPlanificationReprise(executor = pool) {
  await assurerSchemaSchedulerAcademique(executor);

  const session = await recupererSessionActive(executor);
  if (!session?.id_session) {
    throw creerErreurPlanification(
      "Aucune session active n'est disponible.",
      409,
      "ACTIVE_SESSION_MISSING"
    );
  }

  const [rows] = await executor.query(
    `SELECT e.id_etudiant,
            e.matricule,
            e.nom,
            e.prenom,
            ge.id_groupes_etudiants AS id_groupe_principal,
            ge.nom_groupe AS groupe,
            e.programme,
            e.etape,
            e.session,
            COALESCE(reprises.nb_cours_echoues_total, 0) AS nb_cours_echoues_total,
            COALESCE(reprises.nb_cours_echoues_planifies, 0) AS nb_cours_echoues_planifies,
            COALESCE(reprises.nb_cours_echoues_non_planifies, 0) AS nb_cours_echoues_non_planifies
     FROM etudiants e
     JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = e.id_groupes_etudiants
      AND ge.id_session = ?
     LEFT JOIN (
       SELECT ce.id_etudiant,
              COUNT(*) AS nb_cours_echoues_total,
              SUM(
                CASE
                  WHEN ce.statut = 'planifie' AND ce.id_groupe_reprise IS NOT NULL THEN 1
                  ELSE 0
                END
              ) AS nb_cours_echoues_planifies,
              SUM(
                CASE
                  WHEN ce.statut <> 'planifie' OR ce.id_groupe_reprise IS NULL THEN 1
                  ELSE 0
                END
              ) AS nb_cours_echoues_non_planifies
       FROM cours_echoues ce
       WHERE ce.id_session = ?
         AND ce.statut IN (${STATUTS_COURS_ECHOUES_PLANIFICATION_MANUELLE_SQL})
       GROUP BY ce.id_etudiant
     ) reprises
       ON reprises.id_etudiant = e.id_etudiant
     ORDER BY
       CASE
         WHEN COALESCE(reprises.nb_cours_echoues_non_planifies, 0) > 0 THEN 0
         ELSE 1
       END ASC,
       e.nom ASC,
       e.prenom ASC,
       e.matricule ASC`,
    [Number(session.id_session), Number(session.id_session)]
  );

  return rows.map((etudiant) => normaliserResumeRepriseManuelleEtudiant(etudiant));
}

async function recupererContexteCoursEchoue(
  idEtudiant,
  idCoursEchoue,
  executor = pool
) {
  const session = await recupererSessionActive(executor);
  if (!session?.id_session) {
    throw creerErreurPlanification(
      "Aucune session active n'est disponible.",
      409,
      "ACTIVE_SESSION_MISSING"
    );
  }

  const [[etudiantRows], [coursEchoueRows]] = await Promise.all([
    executor.query(
      `SELECT e.id_etudiant,
              e.nom,
              e.prenom,
              e.programme,
              e.etape,
              e.id_groupes_etudiants AS id_groupe_principal
       FROM etudiants e
       WHERE e.id_etudiant = ?
       LIMIT 1`,
      [Number(idEtudiant)]
    ),
    executor.query(
      `SELECT ce.id,
              ce.id_etudiant,
              ce.id_cours,
              ce.id_session,
              ce.statut,
              ce.id_groupe_reprise,
              c.code AS code_cours,
              c.nom AS nom_cours,
              c.programme,
              c.etape_etude,
              c.type_salle
       FROM cours_echoues ce
       JOIN cours c
         ON c.id_cours = ce.id_cours
       WHERE ce.id = ?
         AND ce.id_etudiant = ?
         AND ce.id_session = ?
       LIMIT 1`,
      [Number(idCoursEchoue), Number(idEtudiant), Number(session.id_session)]
    ),
  ]);

  return {
    session,
    etudiant: etudiantRows[0] || null,
    coursEchoue: coursEchoueRows[0] || null,
  };
}

export async function listerGroupesCompatiblesPourCoursEchoue(
  idEtudiant,
  idCoursEchoue,
  executor = pool
) {
  await assurerSchemaSchedulerAcademique(executor);

  const { session, etudiant, coursEchoue } = await recupererContexteCoursEchoue(
    idEtudiant,
    idCoursEchoue,
    executor
  );

  if (!etudiant) {
    throw creerErreurPlanification(
      "Etudiant introuvable.",
      404,
      "STUDENT_NOT_FOUND"
    );
  }

  if (!coursEchoue) {
    throw creerErreurPlanification(
      "Cours echoue introuvable pour cet etudiant.",
      404,
      "FAILED_COURSE_NOT_FOUND"
    );
  }

  const [rows] = await executor.query(
    `SELECT ge.id_groupes_etudiants,
            ge.nom_groupe,
            ge.programme,
            ge.etape,
            ge.id_session,
            COUNT(DISTINCT e.id_etudiant) AS effectif_regulier,
            COUNT(DISTINCT ae.id_etudiant) AS reprises_deja_associees
     FROM groupes_etudiants ge
     JOIN affectation_groupes ag
       ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
     JOIN affectation_cours ac
       ON ac.id_affectation_cours = ag.id_affectation_cours
      AND ac.id_cours = ?
     LEFT JOIN etudiants e
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     LEFT JOIN affectation_etudiants ae
       ON ae.id_groupes_etudiants = ge.id_groupes_etudiants
      AND ae.id_cours = ?
      AND ae.id_session = ?
     WHERE ge.id_session = ?
       AND COALESCE(ge.est_groupe_special, 0) = 0
     GROUP BY ge.id_groupes_etudiants,
              ge.nom_groupe,
              ge.programme,
              ge.etape,
              ge.id_session
     ORDER BY ge.nom_groupe ASC`,
    [
      Number(coursEchoue.id_cours),
      Number(coursEchoue.id_cours),
      Number(session.id_session),
      Number(session.id_session),
    ]
  );

  const [sallesCompatibles] = await executor.query(
    `SELECT id_salle, code, type, capacite
     FROM salles
     ORDER BY capacite ASC, code ASC`
  );
  const compatibles = [];

  for (const groupe of rows) {
    if (!groupeCompatibleAvecCours(groupe, coursEchoue)) {
      continue;
    }

    const participants = await recupererParticipantsSeance(
      groupe.id_groupes_etudiants,
      coursEchoue.id_cours,
      session.id_session,
      executor
    );

    const dejaAssocie = participants.idsParticipants.includes(Number(idEtudiant));
    const effectifProjete = participants.effectifReel + (dejaAssocie ? 0 : 1);
    const aSalleSuffisante = sallesCompatibles.some((salle) =>
      AvailabilityChecker.salleCompatible(salle, coursEchoue, effectifProjete)
    );

    if (!aSalleSuffisante) {
      continue;
    }

    const [seancesCours] = await executor.query(
      `SELECT DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
              ph.heure_debut,
              ph.heure_fin
       FROM affectation_groupes ag
       JOIN affectation_cours ac
         ON ac.id_affectation_cours = ag.id_affectation_cours
       JOIN plages_horaires ph
         ON ph.id_plage_horaires = ac.id_plage_horaires
       WHERE ag.id_groupes_etudiants = ?
         AND ac.id_cours = ?
       ORDER BY ph.date ASC, ph.heure_debut ASC`,
      [Number(groupe.id_groupes_etudiants), Number(coursEchoue.id_cours)]
    );

    let conflitEtudiant = false;

    for (const seance of seancesCours) {
      const conflits = await listerConflitsEtudiants(
        [Number(idEtudiant)],
        seance.date,
        seance.heure_debut,
        seance.heure_fin,
        session.id_session,
        [],
        executor
      );

      if (conflits.length > 0) {
        conflitEtudiant = true;
        break;
      }
    }

    if (conflitEtudiant) {
      continue;
    }

    compatibles.push({
      ...groupe,
      effectif_reel_projete: effectifProjete,
      etudiant_deja_associe: dejaAssocie,
      nb_seances_cours: seancesCours.length,
    });
  }

  return compatibles;
}

export async function planifierCoursEchouePourEtudiant(payload, executor = pool) {
  return executerDansTransactionSiNecessaire(async (transactionExecutor) => {
    await assurerSchemaSchedulerAcademique(transactionExecutor);

    const idEtudiant = Number(payload.idEtudiant);
    const idCoursEchoue = Number(payload.idCoursEchoue);
    const idGroupeEtudiants = Number(payload.idGroupeEtudiants);

    const { session, etudiant, coursEchoue } = await recupererContexteCoursEchoue(
      idEtudiant,
      idCoursEchoue,
      transactionExecutor
    );

    if (!etudiant) {
      throw creerErreurPlanification(
        "Etudiant introuvable.",
        404,
        "STUDENT_NOT_FOUND"
      );
    }

    if (!coursEchoue) {
      throw creerErreurPlanification(
        "Cours echoue introuvable pour cet etudiant.",
        404,
        "FAILED_COURSE_NOT_FOUND"
      );
    }

    const groupesCompatibles = await listerGroupesCompatiblesPourCoursEchoue(
      idEtudiant,
      idCoursEchoue,
      transactionExecutor
    );
    const groupeCible = groupesCompatibles.find(
      (groupe) => Number(groupe.id_groupes_etudiants) === idGroupeEtudiants
    );

    if (!groupeCible) {
      throw creerErreurPlanification(
        "Le groupe choisi n'est pas compatible avec cette reprise.",
        409,
        "FAILED_COURSE_GROUP_INVALID"
      );
    }

    await transactionExecutor.query(
      `INSERT INTO affectation_etudiants (
         id_etudiant,
         id_groupes_etudiants,
         id_cours,
         id_session,
         source_type,
         id_cours_echoue
       )
       VALUES (?, ?, ?, ?, 'reprise', ?)
       ON DUPLICATE KEY UPDATE
         id_groupes_etudiants = VALUES(id_groupes_etudiants),
         id_cours = VALUES(id_cours),
         id_session = VALUES(id_session),
         source_type = VALUES(source_type),
         id_cours_echoue = VALUES(id_cours_echoue)`,
      [
        idEtudiant,
        idGroupeEtudiants,
        Number(coursEchoue.id_cours),
        Number(session.id_session),
        idCoursEchoue,
      ]
    );

    await transactionExecutor.query(
      `UPDATE cours_echoues
       SET statut = 'planifie',
           id_groupe_reprise = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND id_etudiant = ?
         AND id_session = ?`,
      [
        idGroupeEtudiants,
        idCoursEchoue,
        idEtudiant,
        Number(session.id_session),
      ]
    );

    return {
      message: "Cours echoue planifie pour l'etudiant.",
      id_etudiant: idEtudiant,
      id_cours_echoue: idCoursEchoue,
      id_groupe_etudiants: idGroupeEtudiants,
      etudiants_reprises_impactes: [idEtudiant],
      groupes_impactes: [idGroupeEtudiants],
    };
  }, executor);
}

export async function supprimerAffectationEtSeriesOrphelines(
  idAffectation,
  executor = pool
) {
  return executerDansTransactionSiNecessaire(async (transactionExecutor) => {
    await assurerSchemaSchedulerAcademique(transactionExecutor);

    const affectation = await recupererAffectationDetaillee(
      idAffectation,
      transactionExecutor
    );
    if (!affectation) {
      return null;
    }

    await supprimerAffectationComplete(idAffectation, transactionExecutor);
    await mettreAJourSeriePlanification(
      affectation.id_planification_serie,
      transactionExecutor
    );
    await supprimerSeriesOrphelines(transactionExecutor);

    return affectation;
  }, executor);
}
