/**
 * Service de gestion des exceptions d'horaire cote etudiant.
 *
 * Ce module consolide trois responsabilites liees entre elles :
 * - reconstituer l'horaire effectif d'un etudiant a partir des affectations de groupe
 *   et des surcharges individuelles ;
 * - exposer les exceptions individuelles visibles dans l'horaire etudiant ;
 * - preparer et executer les echanges cibles de cours entre deux etudiants
 *   sans violer les contraintes de conflit horaire.
 */
import pool from "../../../db.js";
import { assurerSchemaSchedulerAcademique } from "../academic-scheduler-schema.js";

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

function trierSeances(a, b) {
  const dateA = String(a?.date || "");
  const dateB = String(b?.date || "");
  if (dateA !== dateB) {
    return dateA.localeCompare(dateB, "fr");
  }

  const heureA = String(a?.heure_debut || "");
  const heureB = String(b?.heure_debut || "");
  if (heureA !== heureB) {
    return heureA.localeCompare(heureB, "fr");
  }

  return Number(a?.id_affectation_cours || 0) - Number(b?.id_affectation_cours || 0);
}

function nettoyerIds(valeurs = []) {
  return [...new Set(
    (Array.isArray(valeurs) ? valeurs : [valeurs])
      .map((valeur) => Number(valeur))
      .filter((valeur) => Number.isInteger(valeur) && valeur > 0)
  )];
}

function construireClauseExclusionCours(prefixeParametres, idsCours = []) {
  const ids = nettoyerIds(idsCours);

  if (ids.length === 0) {
    return {
      clause: "",
      valeurs: [],
    };
  }

  return {
    clause: ` AND ${prefixeParametres} NOT IN (${ids.map(() => "?").join(", ")})`,
    valeurs: ids,
  };
}

function creerErreurEchange(
  message,
  statusCode = 400,
  code = "COURSE_EXCHANGE_ERROR",
  details = []
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = Array.isArray(details) ? details : [];
  return error;
}

async function executerDansTransactionSiNecessaire(operation, executor = pool) {
  const ouvreTransaction =
    executor &&
    typeof executor.getConnection === "function" &&
    typeof executor.query === "function";
  const connexion = ouvreTransaction ? await executor.getConnection() : executor;

  if (ouvreTransaction) {
    await connexion.beginTransaction();
  }

  try {
    const resultat = await operation(connexion);

    if (ouvreTransaction) {
      await connexion.commit();
    }

    return resultat;
  } catch (error) {
    if (ouvreTransaction) {
      await connexion.rollback();
    }
    throw error;
  } finally {
    if (ouvreTransaction) {
      connexion.release();
    }
  }
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

async function resoudreSession(idSession = null, executor = pool) {
  await assurerSchemaSchedulerAcademique(executor);

  const sessionDemandee = Number(idSession);
  if (Number.isInteger(sessionDemandee) && sessionDemandee > 0) {
    const [rows] = await executor.query(
      `SELECT id_session,
              nom,
              DATE_FORMAT(date_debut, '%Y-%m-%d') AS date_debut,
              DATE_FORMAT(date_fin, '%Y-%m-%d') AS date_fin
       FROM sessions
       WHERE id_session = ?
       LIMIT 1`,
      [sessionDemandee]
    );

    return rows[0] || null;
  }

  return recupererSessionActive(executor);
}

async function recupererResumeEtudiant(idEtudiant, executor = pool) {
  const [rows] = await executor.query(
    `SELECT e.id_etudiant,
            e.matricule,
            e.nom,
            e.prenom,
            e.id_groupes_etudiants AS id_groupe_principal,
            ge.nom_groupe AS groupe_principal
     FROM etudiants e
     LEFT JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = e.id_groupes_etudiants
     WHERE e.id_etudiant = ?
     LIMIT 1`,
    [Number(idEtudiant)]
  );

  return rows[0] || null;
}

function normaliserSeance(row) {
  const sourceHoraire = String(row?.source_horaire || "groupe");
  const estReprise = Boolean(Number(row?.est_reprise || 0));
  const estExceptionIndividuelle =
    Boolean(Number(row?.est_exception_individuelle || 0)) || sourceHoraire === "individuelle";

  return {
    ...row,
    est_reprise: estReprise,
    est_exception_individuelle: estExceptionIndividuelle,
    source_horaire: sourceHoraire,
    note_echec:
      row?.note_echec === null || row?.note_echec === undefined
        ? null
        : Number(row.note_echec),
  };
}

/**
 * Recupere les seances issues du groupe principal de l'etudiant pour une session.
 *
 * @param {number} idEtudiant Identifiant de l'etudiant cible.
 * @param {Object} [options={}] Options de session et d'exclusion de cours.
 * @param {Object} [executor=pool] Executeur SQL ou connexion transactionnelle.
 * @returns {Promise<Array<Object>>} Seances de groupe normalisees.
 */
export async function recupererSeancesGroupeEffectivesEtudiant(
  idEtudiant,
  options = {},
  executor = pool
) {
  const session = await resoudreSession(options.idSession, executor);

  if (!session) {
    return [];
  }

  const exclusionCours = construireClauseExclusionCours(
    "ac.id_cours",
    options.exclureCoursIds
  );

  // Cette requete reconstruit uniquement l'horaire "heritage du groupe".
  // Les affectations individuelles sur le meme cours sont exclues pour eviter
  // d'afficher simultanement la section d'origine et la section de remplacement.
  const [rows] = await executor.query(
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
       ph.id_plage_horaires,
       DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
       ph.heure_debut,
       ph.heure_fin,
       ge.id_groupes_etudiants AS id_groupe_source,
       ge.nom_groupe AS groupe_source,
       ge.id_groupes_etudiants AS id_groupe_principal,
       ge.nom_groupe AS groupe_principal,
       0 AS est_reprise,
       0 AS est_exception_individuelle,
       'groupe' AS source_horaire,
       NULL AS statut_reprise,
       NULL AS note_echec,
       NULL AS id_cours_echoue,
       NULL AS id_affectation_etudiant,
       NULL AS id_echange_cours,
       NULL AS type_exception,
       NULL AS etudiant_echange
     FROM etudiants e
     JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = e.id_groupes_etudiants
     JOIN affectation_groupes ag
       ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
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
     WHERE e.id_etudiant = ?
       AND ge.id_session = ?
       AND NOT EXISTS (
         SELECT 1
         FROM affectation_etudiants ae_override
         WHERE ae_override.id_etudiant = e.id_etudiant
           AND ae_override.id_session = ge.id_session
           AND ae_override.id_cours = ac.id_cours
           AND ae_override.source_type = 'individuelle'
       )${exclusionCours.clause}
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [Number(idEtudiant), Number(session.id_session), ...exclusionCours.valeurs]
  );

  return rows.map(normaliserSeance);
}

/**
 * Recupere les seances individuelles appliquees a un etudiant.
 *
 * @param {number} idEtudiant Identifiant de l'etudiant cible.
 * @param {Object} [options={}] Options de session, de filtres de source et d'exclusion.
 * @param {Object} [executor=pool] Executeur SQL ou connexion transactionnelle.
 * @returns {Promise<Array<Object>>} Seances de reprise ou d'exception individuelle.
 */
export async function recupererSeancesIndividuellesEtudiant(
  idEtudiant,
  options = {},
  executor = pool
) {
  const session = await resoudreSession(options.idSession, executor);

  if (!session) {
    return [];
  }

  const sourceTypes = [...new Set(
    (Array.isArray(options.sourceTypes) ? options.sourceTypes : ["reprise", "individuelle"])
      .map((value) => String(value || "").trim())
      .filter((value) => value === "reprise" || value === "individuelle")
  )];

  if (sourceTypes.length === 0) {
    return [];
  }

  const exclusionCours = construireClauseExclusionCours(
    "ae.id_cours",
    options.exclureCoursIds
  );

  // Les exceptions individuelles passent par `affectation_etudiants`.
  // On y retrouve les reprises, les rattachements individuels et les echanges
  // de cours traces par `id_echange_cours`.
  const [rows] = await executor.query(
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
       ph.id_plage_horaires,
       DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
       ph.heure_debut,
       ph.heure_fin,
       ge.id_groupes_etudiants AS id_groupe_source,
       ge.nom_groupe AS groupe_source,
       ge_principal.id_groupes_etudiants AS id_groupe_principal,
       ge_principal.nom_groupe AS groupe_principal,
       CASE WHEN ae.source_type = 'reprise' THEN 1 ELSE 0 END AS est_reprise,
       CASE WHEN ae.source_type = 'individuelle' THEN 1 ELSE 0 END AS est_exception_individuelle,
       ae.source_type AS source_horaire,
       ce.statut AS statut_reprise,
       ce.note_echec,
       ae.id_cours_echoue,
       ae.id_affectation_etudiant,
       ae.id_echange_cours,
       CASE
         WHEN ae.source_type = 'reprise' THEN 'reprise'
         WHEN ae.id_echange_cours IS NOT NULL THEN 'echange_cours'
         ELSE 'affectation_individuelle'
       END AS type_exception,
       TRIM(CONCAT_WS(' ', autre.prenom, autre.nom)) AS etudiant_echange
     FROM affectation_etudiants ae
     JOIN etudiants e
       ON e.id_etudiant = ae.id_etudiant
     LEFT JOIN groupes_etudiants ge_principal
       ON ge_principal.id_groupes_etudiants = e.id_groupes_etudiants
     JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = ae.id_groupes_etudiants
     JOIN affectation_groupes ag
       ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
     JOIN affectation_cours ac
       ON ac.id_affectation_cours = ag.id_affectation_cours
      AND ac.id_cours = ae.id_cours
     JOIN cours c
       ON c.id_cours = ac.id_cours
     JOIN professeurs p
       ON p.id_professeur = ac.id_professeur
     LEFT JOIN salles s
       ON s.id_salle = ac.id_salle
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     LEFT JOIN cours_echoues ce
       ON ce.id = ae.id_cours_echoue
     LEFT JOIN echanges_cours_etudiants ec
       ON ec.id_echange_cours = ae.id_echange_cours
     LEFT JOIN etudiants autre
       ON autre.id_etudiant = CASE
         WHEN ec.id_etudiant_a = ae.id_etudiant THEN ec.id_etudiant_b
         WHEN ec.id_etudiant_b = ae.id_etudiant THEN ec.id_etudiant_a
         ELSE NULL
       END
     WHERE ae.id_etudiant = ?
       AND ae.id_session = ?
       AND ae.source_type IN (${sourceTypes.map(() => "?").join(", ")})${exclusionCours.clause}
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [
      Number(idEtudiant),
      Number(session.id_session),
      ...sourceTypes,
      ...exclusionCours.valeurs,
    ]
  );

  return rows.map(normaliserSeance);
}

/**
 * Recompose l'horaire effectif complet de l'etudiant.
 *
 * @param {number} idEtudiant Identifiant de l'etudiant cible.
 * @param {Object} [options={}] Options de session et de filtrage.
 * @param {Object} [executor=pool] Executeur SQL ou connexion transactionnelle.
 * @returns {Promise<Array<Object>>} Fusion triee du groupe principal et des exceptions.
 */
export async function recupererSeancesEffectivesEtudiant(
  idEtudiant,
  options = {},
  executor = pool
) {
  const inclureReprises = options.inclureReprises !== false;
  const inclureIndividuelles = options.inclureIndividuelles !== false;
  const sourceTypes = [];

  if (inclureReprises) {
    sourceTypes.push("reprise");
  }

  if (inclureIndividuelles) {
    sourceTypes.push("individuelle");
  }

  const [seancesGroupe, seancesIndividuelles] = await Promise.all([
    recupererSeancesGroupeEffectivesEtudiant(idEtudiant, options, executor),
    recupererSeancesIndividuellesEtudiant(
      idEtudiant,
      {
        ...options,
        sourceTypes,
      },
      executor
    ),
  ]);

  return [...seancesGroupe, ...seancesIndividuelles].sort(trierSeances);
}

/**
 * Agrege les seances par cours afin de produire une vue stable exploitable
 * pour l'API et pour les validations d'echange.
 *
 * @param {Array<Object>} seances Liste de seances deja normalisees.
 * @returns {Map<number, Object>} Index par `id_cours`.
 */
function agregerCoursDepuisSeances(seances = []) {
  const index = new Map();

  for (const seance of Array.isArray(seances) ? seances : []) {
    const idCours = Number(seance?.id_cours || 0);
    if (!Number.isInteger(idCours) || idCours <= 0) {
      continue;
    }

    if (!index.has(idCours)) {
      index.set(idCours, {
        id_cours: idCours,
        code_cours: seance.code_cours || null,
        nom_cours: seance.nom_cours || null,
        source_horaire: seance.source_horaire || "groupe",
        est_reprise: Boolean(seance.est_reprise),
        est_exception_individuelle: Boolean(seance.est_exception_individuelle),
        id_groupe_source: Number(seance.id_groupe_source || 0) || null,
        groupe_source: seance.groupe_source || null,
        id_groupe_principal: Number(seance.id_groupe_principal || 0) || null,
        groupe_principal: seance.groupe_principal || null,
        id_affectation_etudiant: Number(seance.id_affectation_etudiant || 0) || null,
        id_echange_cours: Number(seance.id_echange_cours || 0) || null,
        type_exception: seance.type_exception || null,
        etudiant_echange: seance.etudiant_echange || null,
        occurrences: [],
      });
    }

    const entree = index.get(idCours);
    entree.occurrences.push({
      id_affectation_cours: Number(seance.id_affectation_cours || 0) || null,
      id_plage_horaires: Number(seance.id_plage_horaires || 0) || null,
      date: seance.date || null,
      heure_debut: normaliserHeure(seance.heure_debut),
      heure_fin: normaliserHeure(seance.heure_fin),
      id_professeur: Number(seance.id_professeur || 0) || null,
      nom_professeur: seance.nom_professeur || null,
      prenom_professeur: seance.prenom_professeur || null,
      id_salle: Number(seance.id_salle || 0) || null,
      code_salle: seance.code_salle || null,
      id_groupe_source: Number(seance.id_groupe_source || 0) || null,
      groupe_source: seance.groupe_source || null,
    });
  }

  for (const entree of index.values()) {
    entree.occurrences.sort(trierSeances);
  }

  return index;
}

/**
 * Retourne l'affectation effective d'un cours pour un etudiant donne.
 *
 * @param {number} idEtudiant Identifiant de l'etudiant.
 * @param {number} idCours Identifiant du cours.
 * @param {Object} [options={}] Options de session et de filtrage.
 * @param {Object} [executor=pool] Executeur SQL ou connexion transactionnelle.
 * @returns {Promise<Object|null>} Affectation agregee ou `null`.
 */
export async function recupererAffectationEffectiveCoursEtudiant(
  idEtudiant,
  idCours,
  options = {},
  executor = pool
) {
  const seances = await recupererSeancesEffectivesEtudiant(
    idEtudiant,
    {
      ...options,
      inclureReprises: options.inclureReprises === true,
    },
    executor
  );
  const index = agregerCoursDepuisSeances(seances);
  return index.get(Number(idCours)) || null;
}

/**
 * Liste uniquement les exceptions individuelles visibles par l'etudiant.
 *
 * Cette vue sert surtout a l'ecran d'horaire et aux exports qui doivent
 * distinguer les seances du groupe principal des surcharges ponctuelles.
 *
 * @param {number} idEtudiant Identifiant de l'etudiant.
 * @param {Object} [options={}] Options de session et d'exclusion.
 * @param {Object} [executor=pool] Executeur SQL ou connexion transactionnelle.
 * @returns {Promise<Array<Object>>} Exceptions individuelles agregees par cours.
 */
export async function recupererExceptionsIndividuellesEtudiant(
  idEtudiant,
  options = {},
  executor = pool
) {
  const seances = await recupererSeancesIndividuellesEtudiant(
    idEtudiant,
    {
      ...options,
      sourceTypes: ["individuelle"],
    },
    executor
  );

  return [...agregerCoursDepuisSeances(seances).values()].sort((a, b) =>
    String(a.code_cours || "").localeCompare(String(b.code_cours || ""), "fr")
  );
}

function seancesSeChevauchent(seanceA, seanceB) {
  if (String(seanceA?.date || "") !== String(seanceB?.date || "")) {
    return false;
  }

  return (
    heureVersMinutes(seanceA?.heure_debut) < heureVersMinutes(seanceB?.heure_fin) &&
    heureVersMinutes(seanceA?.heure_fin) > heureVersMinutes(seanceB?.heure_debut)
  );
}

function listerConflitsEntreSeances(seancesReference = [], occurrencesCibles = []) {
  const conflits = [];

  for (const occurrence of Array.isArray(occurrencesCibles) ? occurrencesCibles : []) {
    for (const seance of Array.isArray(seancesReference) ? seancesReference : []) {
      if (!seancesSeChevauchent(seance, occurrence)) {
        continue;
      }

      conflits.push({
        date: occurrence.date || null,
        heure_debut: occurrence.heure_debut || null,
        heure_fin: occurrence.heure_fin || null,
        code_cours_cible: occurrence.code_cours || null,
        nom_cours_cible: occurrence.nom_cours || null,
        groupe_cible: occurrence.groupe_source || null,
        code_cours_conflit: seance.code_cours || null,
        nom_cours_conflit: seance.nom_cours || null,
        groupe_conflit: seance.groupe_source || null,
        source_horaire_conflit: seance.source_horaire || "groupe",
        heure_debut_conflit: seance.heure_debut || null,
        heure_fin_conflit: seance.heure_fin || null,
      });
    }
  }

  return conflits.sort((a, b) => {
    const date = String(a.date || "").localeCompare(String(b.date || ""), "fr");
    if (date !== 0) {
      return date;
    }

    return String(a.heure_debut || "").localeCompare(String(b.heure_debut || ""), "fr");
  });
}

function enrichirOccurrencesAvecCours(affectation) {
  return (affectation?.occurrences || []).map((occurrence) => ({
    ...occurrence,
    code_cours: affectation?.code_cours || null,
    nom_cours: affectation?.nom_cours || null,
  }));
}

/**
 * Monte le projet d'echange complet sans rien persister.
 *
 * Le resultat sert a deux usages :
 * - la previsualisation dans l'interface ;
 * - la validation finale juste avant l'ecriture transactionnelle.
 *
 * @param {Object} payload Identifiants des deux etudiants, du cours et de la session.
 * @param {Object} [executor=pool] Executeur SQL ou connexion transactionnelle.
 * @returns {Promise<Object>} Projet d'echange, conflits et blocages metier.
 */
async function construireProjetEchange(
  { idEtudiantA, idEtudiantB, idCours, idSession = null },
  executor = pool
) {
  const ids = [Number(idEtudiantA), Number(idEtudiantB)];
  if (!ids.every((id) => Number.isInteger(id) && id > 0)) {
    throw creerErreurEchange(
      "Les deux etudiants doivent etre renseignes.",
      400,
      "COURSE_EXCHANGE_STUDENTS_REQUIRED"
    );
  }

  if (ids[0] === ids[1]) {
    throw creerErreurEchange(
      "Un echange de cours doit impliquer deux etudiants differents.",
      409,
      "COURSE_EXCHANGE_SAME_STUDENT"
    );
  }

  const idCoursNumerique = Number(idCours);
  if (!Number.isInteger(idCoursNumerique) || idCoursNumerique <= 0) {
    throw creerErreurEchange(
      "Le cours a echanger est obligatoire.",
      400,
      "COURSE_EXCHANGE_COURSE_REQUIRED"
    );
  }

  const session = await resoudreSession(idSession, executor);

  if (!session) {
    throw creerErreurEchange(
      "Aucune session active n'est disponible pour cet echange.",
      409,
      "COURSE_EXCHANGE_NO_ACTIVE_SESSION"
    );
  }

  const [etudiantA, etudiantB] = await Promise.all([
    recupererResumeEtudiant(ids[0], executor),
    recupererResumeEtudiant(ids[1], executor),
  ]);

  if (!etudiantA || !etudiantB) {
    throw creerErreurEchange(
      "Un des etudiants est introuvable.",
      404,
      "COURSE_EXCHANGE_STUDENT_NOT_FOUND"
    );
  }

  const [affectationA, affectationB] = await Promise.all([
    recupererAffectationEffectiveCoursEtudiant(
      ids[0],
      idCoursNumerique,
      {
        idSession: session.id_session,
        inclureReprises: false,
      },
      executor
    ),
    recupererAffectationEffectiveCoursEtudiant(
      ids[1],
      idCoursNumerique,
      {
        idSession: session.id_session,
        inclureReprises: false,
      },
      executor
    ),
  ]);

  if (!affectationA || !affectationB) {
    throw creerErreurEchange(
      "Les deux etudiants ne suivent pas actuellement ce cours dans la session active.",
      409,
      "COURSE_EXCHANGE_NOT_SHARED"
    );
  }

  const [horaireSansCoursA, horaireSansCoursB] = await Promise.all([
    recupererSeancesEffectivesEtudiant(
      ids[0],
      {
        idSession: session.id_session,
        exclureCoursIds: [idCoursNumerique],
      },
      executor
    ),
    recupererSeancesEffectivesEtudiant(
      ids[1],
      {
        idSession: session.id_session,
        exclureCoursIds: [idCoursNumerique],
      },
      executor
    ),
  ]);

  const occurrencesCiblesA = enrichirOccurrencesAvecCours(affectationB);
  const occurrencesCiblesB = enrichirOccurrencesAvecCours(affectationA);
  const conflitsA = listerConflitsEntreSeances(horaireSansCoursA, occurrencesCiblesA);
  const conflitsB = listerConflitsEntreSeances(horaireSansCoursB, occurrencesCiblesB);
  const memeSection =
    Number(affectationA.id_groupe_source || 0) === Number(affectationB.id_groupe_source || 0);

  const blocages = [];
  if (memeSection) {
    blocages.push("Les deux etudiants suivent deja ce cours dans la meme section.");
  }
  if (conflitsA.length > 0) {
    blocages.push(
      `${etudiantA.prenom || etudiantA.nom || "Etudiant A"} n'est pas libre sur la section recue.`
    );
  }
  if (conflitsB.length > 0) {
    blocages.push(
      `${etudiantB.prenom || etudiantB.nom || "Etudiant B"} n'est pas libre sur la section recue.`
    );
  }

  return {
    session,
    cours: {
      id_cours: idCoursNumerique,
      code_cours: affectationA.code_cours,
      nom_cours: affectationA.nom_cours,
    },
    etudiant_a: {
      ...etudiantA,
      affectation_actuelle: affectationA,
      affectation_cible: {
        ...affectationB,
        provenance_etudiant: etudiantB.id_etudiant,
      },
      conflits: conflitsA,
    },
    etudiant_b: {
      ...etudiantB,
      affectation_actuelle: affectationB,
      affectation_cible: {
        ...affectationA,
        provenance_etudiant: etudiantA.id_etudiant,
      },
      conflits: conflitsB,
    },
    echange_possible: !memeSection && conflitsA.length === 0 && conflitsB.length === 0,
    blocages,
  };
}

function agregerCoursCommuns(
  etudiantA,
  etudiantB,
  affectationsA,
  affectationsB
) {
  const indexA = agregerCoursDepuisSeances(affectationsA);
  const indexB = agregerCoursDepuisSeances(affectationsB);
  const idsCoursCommuns = [...indexA.keys()].filter((idCours) => indexB.has(idCours));

  return idsCoursCommuns
    .map((idCours) => {
      const affectationA = indexA.get(idCours);
      const affectationB = indexB.get(idCours);
      const echangeUtile =
        Number(affectationA?.id_groupe_source || 0) !== Number(affectationB?.id_groupe_source || 0);

      return {
        id_cours: idCours,
        code_cours: affectationA?.code_cours || affectationB?.code_cours || null,
        nom_cours: affectationA?.nom_cours || affectationB?.nom_cours || null,
        echange_utile: echangeUtile,
        etudiant_a: {
          id_etudiant: Number(etudiantA.id_etudiant),
          groupe_source: affectationA?.groupe_source || null,
          id_groupe_source: Number(affectationA?.id_groupe_source || 0) || null,
          source_horaire: affectationA?.source_horaire || "groupe",
        },
        etudiant_b: {
          id_etudiant: Number(etudiantB.id_etudiant),
          groupe_source: affectationB?.groupe_source || null,
          id_groupe_source: Number(affectationB?.id_groupe_source || 0) || null,
          source_horaire: affectationB?.source_horaire || "groupe",
        },
      };
    })
    .sort((a, b) => {
      const utile = Number(b.echange_utile) - Number(a.echange_utile);
      if (utile !== 0) {
        return utile;
      }

      return String(a.code_cours || "").localeCompare(String(b.code_cours || ""), "fr");
    });
}

/**
 * Liste les cours que deux etudiants suivent deja en commun et qui peuvent
 * donc faire l'objet d'un echange de section.
 *
 * @param {number} idEtudiantA Identifiant du premier etudiant.
 * @param {number} idEtudiantB Identifiant du second etudiant.
 * @param {Object} [executor=pool] Executeur SQL ou connexion transactionnelle.
 * @returns {Promise<Object>} Session active, etudiants et cours communs tries.
 */
export async function listerCoursCommunsEchangeables(
  idEtudiantA,
  idEtudiantB,
  executor = pool
) {
  await assurerSchemaSchedulerAcademique(executor);

  const session = await recupererSessionActive(executor);

  if (!session) {
    throw creerErreurEchange(
      "Aucune session active n'est disponible pour preparer un echange.",
      409,
      "COURSE_EXCHANGE_NO_ACTIVE_SESSION"
    );
  }

  const [etudiantA, etudiantB] = await Promise.all([
    recupererResumeEtudiant(idEtudiantA, executor),
    recupererResumeEtudiant(idEtudiantB, executor),
  ]);

  if (!etudiantA || !etudiantB) {
    throw creerErreurEchange(
      "Un des etudiants est introuvable.",
      404,
      "COURSE_EXCHANGE_STUDENT_NOT_FOUND"
    );
  }

  if (Number(etudiantA.id_etudiant) === Number(etudiantB.id_etudiant)) {
    throw creerErreurEchange(
      "Un echange de cours doit impliquer deux etudiants differents.",
      409,
      "COURSE_EXCHANGE_SAME_STUDENT"
    );
  }

  const [seancesA, seancesB] = await Promise.all([
    recupererSeancesEffectivesEtudiant(
      etudiantA.id_etudiant,
      {
        idSession: session.id_session,
        inclureReprises: false,
      },
      executor
    ),
    recupererSeancesEffectivesEtudiant(
      etudiantB.id_etudiant,
      {
        idSession: session.id_session,
        inclureReprises: false,
      },
      executor
    ),
  ]);

  return {
    session,
    etudiant_a: etudiantA,
    etudiant_b: etudiantB,
    cours_communs: agregerCoursCommuns(etudiantA, etudiantB, seancesA, seancesB),
  };
}

/**
 * Retourne une simulation complete de l'echange sans modifier la base.
 *
 * @param {Object} payload Charge utile recue depuis l'API.
 * @param {Object} [executor=pool] Executeur SQL ou connexion transactionnelle.
 * @returns {Promise<Object>} Projet d'echange et diagnostic de faisabilite.
 */
export async function previsualiserEchangeCoursEtudiants(payload, executor = pool) {
  await assurerSchemaSchedulerAcademique(executor);
  return construireProjetEchange(payload, executor);
}

/**
 * Cree ou retire l'override individuel d'un cours pour un etudiant.
 *
 * Si le groupe cible correspond au groupe principal, aucune affectation
 * individuelle n'est conservee : l'etudiant retombe alors sur l'horaire
 * de son groupe d'origine.
 *
 * @param {Object} payload Parametres d'affectation cible.
 * @param {Object} [executor=pool] Executeur SQL ou connexion transactionnelle.
 * @returns {Promise<number|null>} Identifiant cree ou `null` si aucun override n'est requis.
 */
async function appliquerAffectationIndividuelleCours(
  { idEtudiant, idCours, idSession, idGroupeCible, idEchangeCours },
  executor = pool
) {
  const etudiant = await recupererResumeEtudiant(idEtudiant, executor);

  if (!etudiant) {
    throw creerErreurEchange(
      "Etudiant introuvable pour l'affectation individuelle.",
      404,
      "COURSE_EXCHANGE_STUDENT_NOT_FOUND"
    );
  }

  // On repart toujours d'un etat propre pour eviter plusieurs overrides
  // individuels concurrents sur le meme couple etudiant/cours/session.
  await executor.query(
    `DELETE FROM affectation_etudiants
     WHERE id_etudiant = ?
       AND id_cours = ?
       AND id_session = ?
       AND source_type = 'individuelle'`,
    [Number(idEtudiant), Number(idCours), Number(idSession)]
  );

  if (
    Number(etudiant.id_groupe_principal || 0) > 0 &&
    Number(idGroupeCible) === Number(etudiant.id_groupe_principal)
  ) {
    return null;
  }

  const [result] = await executor.query(
    `INSERT INTO affectation_etudiants (
       id_etudiant,
       id_groupes_etudiants,
       id_cours,
       id_session,
       source_type,
       id_echange_cours
     )
     VALUES (?, ?, ?, ?, 'individuelle', ?)`,
    [
      Number(idEtudiant),
      Number(idGroupeCible),
      Number(idCours),
      Number(idSession),
      Number(idEchangeCours),
    ]
  );

  return Number(result.insertId || 0) || null;
}

/**
 * Execute l'echange cible de cours entre deux etudiants.
 *
 * L'operation est entierement transactionnelle :
 * - verification finale des conflits ;
 * - creation de la trace dans `echanges_cours_etudiants` ;
 * - mise a jour des affectations individuelles des deux etudiants.
 *
 * @param {Object} payload Charge utile recue depuis l'API.
 * @param {Object} [executor=pool] Executeur SQL ou connexion transactionnelle.
 * @returns {Promise<Object>} Resume metier et identifiants impactes.
 */
export async function executerEchangeCoursEtudiants(payload, executor = pool) {
  return executerDansTransactionSiNecessaire(async (transactionExecutor) => {
    await assurerSchemaSchedulerAcademique(transactionExecutor);

    const projet = await construireProjetEchange(payload, transactionExecutor);

    if (!projet.echange_possible) {
      throw creerErreurEchange(
        "L'echange de cours n'est pas possible dans l'etat actuel des horaires.",
        409,
        "COURSE_EXCHANGE_NOT_ALLOWED",
        projet.blocages
      );
    }

    // La table `echanges_cours_etudiants` joue le role de journal metier :
    // elle conserve l'etat avant/apres de chaque etudiant pour audit futur.
    const [result] = await transactionExecutor.query(
      `INSERT INTO echanges_cours_etudiants (
         id_session,
         id_cours,
         id_etudiant_a,
         id_groupe_a_avant,
         id_groupe_a_apres,
         id_etudiant_b,
         id_groupe_b_avant,
         id_groupe_b_apres
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(projet.session.id_session),
        Number(projet.cours.id_cours),
        Number(projet.etudiant_a.id_etudiant),
        Number(projet.etudiant_a.affectation_actuelle.id_groupe_source),
        Number(projet.etudiant_a.affectation_cible.id_groupe_source),
        Number(projet.etudiant_b.id_etudiant),
        Number(projet.etudiant_b.affectation_actuelle.id_groupe_source),
        Number(projet.etudiant_b.affectation_cible.id_groupe_source),
      ]
    );

    const idEchangeCours = Number(result.insertId || 0);

    await Promise.all([
      appliquerAffectationIndividuelleCours(
        {
          idEtudiant: projet.etudiant_a.id_etudiant,
          idCours: projet.cours.id_cours,
          idSession: projet.session.id_session,
          idGroupeCible: projet.etudiant_a.affectation_cible.id_groupe_source,
          idEchangeCours,
        },
        transactionExecutor
      ),
      appliquerAffectationIndividuelleCours(
        {
          idEtudiant: projet.etudiant_b.id_etudiant,
          idCours: projet.cours.id_cours,
          idSession: projet.session.id_session,
          idGroupeCible: projet.etudiant_b.affectation_cible.id_groupe_source,
          idEchangeCours,
        },
        transactionExecutor
      ),
    ]);

    return {
      message: "Echange de cours effectue avec succes.",
      id_echange_cours: idEchangeCours,
      id_cours: Number(projet.cours.id_cours),
      code_cours: projet.cours.code_cours,
      etudiants_impactes: [
        Number(projet.etudiant_a.id_etudiant),
        Number(projet.etudiant_b.id_etudiant),
      ],
      groupes_impactes: nettoyerIds([
        projet.etudiant_a.affectation_actuelle.id_groupe_source,
        projet.etudiant_a.affectation_cible.id_groupe_source,
        projet.etudiant_b.affectation_actuelle.id_groupe_source,
        projet.etudiant_b.affectation_cible.id_groupe_source,
      ]),
      synchronisation: {
        type: "echange_cours_etudiants",
        etudiants_impactes: [
          Number(projet.etudiant_a.id_etudiant),
          Number(projet.etudiant_b.id_etudiant),
        ],
        groupes_impactes: nettoyerIds([
          projet.etudiant_a.affectation_actuelle.id_groupe_source,
          projet.etudiant_a.affectation_cible.id_groupe_source,
          projet.etudiant_b.affectation_actuelle.id_groupe_source,
          projet.etudiant_b.affectation_cible.id_groupe_source,
        ]),
      },
    };
  }, executor);
}
