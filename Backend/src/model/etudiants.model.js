/**
 * MODEL - Gestion des etudiants
 *
 * Ce module gere la consultation
 * et l'import des etudiants.
 */

import pool from "../../db.js";
import { normaliserNomSession } from "../utils/sessions.js";
import { enregistrerEtudiantsImportes } from "./import-etudiants.model.js";
import { normaliserNomProgramme } from "../utils/programmes.js";
import { assurerSchemaSchedulerAcademique } from "../services/academic-scheduler-schema.js";
import { FailedCourseDebugService } from "../services/scheduler/FailedCourseDebugService.js";
import {
  recupererExceptionsIndividuellesEtudiant,
  recupererSeancesGroupeEffectivesEtudiant,
  recupererSeancesIndividuellesEtudiant,
} from "../services/etudiants/student-course-exchange.service.js";

const SESSION_ACTIVE_SQL = `(
  SELECT id_session
  FROM sessions
  WHERE active = TRUE
  ORDER BY id_session DESC
  LIMIT 1
)`;

const STATUTS_REPRISES_ACTIFS_SQL = `
  'a_reprendre',
  'planifie',
  'en_ligne',
  'groupe_special',
  'resolution_manuelle'
`;

const ETAPE_ETUDIANT_SQL = `CAST(e.etape AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_general_ci`;

function normaliserMetaChargeEtudiant(etudiant) {
  if (!etudiant) {
    return etudiant;
  }

  const nbReprises = Number(etudiant.nb_reprises || 0);
  const nbCoursNormaux = Number(etudiant.nb_cours_normaux || 0);

  return {
    ...etudiant,
    nb_reprises: nbReprises,
    nb_cours_normaux: nbCoursNormaux,
    charge_cible: nbCoursNormaux + nbReprises,
  };
}

function normaliserSeanceEtudiant(seance, overrides = {}) {
  return {
    ...seance,
    est_reprise: Boolean(Number(seance?.est_reprise || 0)),
    est_exception_individuelle:
      Boolean(Number(seance?.est_exception_individuelle || 0)) ||
      String(seance?.source_horaire || overrides.source_horaire || "") === "individuelle",
    source_horaire: String(seance?.source_horaire || overrides.source_horaire || "groupe"),
    groupe_source:
      seance?.groupe_source || overrides.groupe_source || seance?.nom_groupe || null,
    statut_reprise: seance?.statut_reprise || overrides.statut_reprise || null,
    note_echec:
      seance?.note_echec === null || seance?.note_echec === undefined
        ? null
        : Number(seance.note_echec),
    type_exception: seance?.type_exception || overrides.type_exception || null,
    id_echange_cours: Number(seance?.id_echange_cours || 0) || null,
    etudiant_echange: seance?.etudiant_echange || null,
  };
}

function comparerSeancesEtudiant(seanceA, seanceB) {
  const dateA = String(seanceA?.date || "");
  const dateB = String(seanceB?.date || "");
  if (dateA !== dateB) {
    return dateA.localeCompare(dateB, "fr");
  }

  const heureA = String(seanceA?.heure_debut || "");
  const heureB = String(seanceB?.heure_debut || "");
  if (heureA !== heureB) {
    return heureA.localeCompare(heureB, "fr");
  }

  const sourceA = Number(seanceA?.est_reprise || 0);
  const sourceB = Number(seanceB?.est_reprise || 0);
  if (sourceA !== sourceB) {
    return sourceA - sourceB;
  }

  return Number(seanceA?.id_affectation_cours || 0) - Number(seanceB?.id_affectation_cours || 0);
}

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
       ge.id_groupes_etudiants AS id_groupe_principal,
       ge.nom_groupe AS groupe,
       e.programme,
       e.etape,
       e.session,
       COALESCE(reprises.nb_reprises, 0) AS nb_reprises,
       COALESCE(catalogue.nb_cours_normaux, 0) AS nb_cours_normaux
     FROM etudiants e
     LEFT JOIN groupes_etudiants ge
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     LEFT JOIN (
       SELECT ce.id_etudiant, COUNT(*) AS nb_reprises
       FROM cours_echoues ce
       WHERE ce.id_session = ${SESSION_ACTIVE_SQL}
         AND ce.statut IN (${STATUTS_REPRISES_ACTIFS_SQL})
       GROUP BY ce.id_etudiant
     ) reprises
       ON reprises.id_etudiant = e.id_etudiant
     LEFT JOIN (
       SELECT c.programme,
              TRIM(COALESCE(c.etape_etude, '')) AS etape_reference,
              COUNT(DISTINCT c.id_cours) AS nb_cours_normaux
       FROM cours c
       WHERE c.archive = FALSE
       GROUP BY c.programme, TRIM(COALESCE(c.etape_etude, ''))
     ) catalogue
       ON catalogue.programme = e.programme
      AND catalogue.etape_reference = ${ETAPE_ETUDIANT_SQL}
     WHERE e.id_etudiant = ?
     LIMIT 1`,
    [idEtudiant]
  );

  return normaliserMetaChargeEtudiant(etudiants[0] || null);
}

/**
 * Recuperer tous les etudiants avec leur groupe eventuel.
 *
 * @returns {Promise<Array<Object>>} Liste des etudiants.
 */
export async function recupererTousLesEtudiants(options = {}) {
  const { sessionActive = false } = options;
  const clauseSessionActive = sessionActive
    ? `WHERE ge.id_session = ${SESSION_ACTIVE_SQL}`
    : "";
  const [etudiants] = await pool.query(
    `SELECT
       e.id_etudiant,
       e.matricule,
       e.nom,
       e.prenom,
       ge.id_groupes_etudiants AS id_groupe_principal,
       ge.nom_groupe AS groupe,
       e.programme,
       e.etape,
       e.session,
       COALESCE(reprises.nb_reprises, 0) AS nb_reprises,
       COALESCE(catalogue.nb_cours_normaux, 0) AS nb_cours_normaux
     FROM etudiants e
     LEFT JOIN groupes_etudiants ge
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     LEFT JOIN (
       SELECT ce.id_etudiant, COUNT(*) AS nb_reprises
       FROM cours_echoues ce
       WHERE ce.id_session = ${SESSION_ACTIVE_SQL}
         AND ce.statut IN (${STATUTS_REPRISES_ACTIFS_SQL})
       GROUP BY ce.id_etudiant
     ) reprises
       ON reprises.id_etudiant = e.id_etudiant
     LEFT JOIN (
       SELECT c.programme,
              TRIM(COALESCE(c.etape_etude, '')) AS etape_reference,
              COUNT(DISTINCT c.id_cours) AS nb_cours_normaux
       FROM cours c
       WHERE c.archive = FALSE
       GROUP BY c.programme, TRIM(COALESCE(c.etape_etude, ''))
     ) catalogue
       ON catalogue.programme = e.programme
      AND catalogue.etape_reference = ${ETAPE_ETUDIANT_SQL}
     ${clauseSessionActive}
     ORDER BY e.programme ASC,
              FIELD(e.session, 'Automne', 'Hiver', 'Printemps', 'Ete'),
              e.etape ASC,
              e.matricule ASC`
  );

  return etudiants.map((etudiant) => normaliserMetaChargeEtudiant(etudiant));
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

/**
 * Importer une liste d'etudiants avec validation et transaction.
 *
 * @param {Array<Object>} etudiants Liste des etudiants a importer.
 * @returns {Promise<Object>} Resultat de l'import.
 */
export async function importerEtudiants(etudiants) {
  const erreurs = [];
  const matriculesVus = new Set();

  for (let i = 0; i < etudiants.length; i += 1) {
    const ligne = i + 2;
    const etudiant = etudiants[i];
    const session = String(etudiant.session || "").trim();

    if (!etudiant.matricule || !String(etudiant.matricule).trim()) {
      erreurs.push(`Ligne ${ligne} : matricule obligatoire.`);
    } else if (matriculesVus.has(String(etudiant.matricule).trim())) {
      erreurs.push(`Ligne ${ligne} : matricule deja present dans le fichier.`);
    } else {
      matriculesVus.add(String(etudiant.matricule).trim());
    }

    if (!etudiant.nom || !String(etudiant.nom).trim()) {
      erreurs.push(`Ligne ${ligne} : nom obligatoire.`);
    }

    if (!etudiant.prenom || !String(etudiant.prenom).trim()) {
      erreurs.push(`Ligne ${ligne} : prenom obligatoire.`);
    }

    if (!etudiant.programme || !String(etudiant.programme).trim()) {
      erreurs.push(`Ligne ${ligne} : programme obligatoire.`);
    }

    if (
      !Number.isInteger(Number(etudiant.etape)) ||
      Number(etudiant.etape) < 1 ||
      Number(etudiant.etape) > 8
    ) {
      erreurs.push(`Ligne ${ligne} : etape invalide (1 a 8).`);
    }

    if (session && !normaliserNomSession(session)) {
      erreurs.push(
        `Ligne ${ligne} : session invalide (Automne, Hiver, Printemps ou Ete).`
      );
    }

    if (String(etudiant.matricule || "").trim().length > 50) {
      erreurs.push(`Ligne ${ligne} : matricule trop long (max 50 caracteres).`);
    }

    if (String(etudiant.nom || "").trim().length > 100) {
      erreurs.push(`Ligne ${ligne} : nom trop long (max 100 caracteres).`);
    }

    if (String(etudiant.prenom || "").trim().length > 100) {
      erreurs.push(`Ligne ${ligne} : prenom trop long (max 100 caracteres).`);
    }

    if (String(etudiant.programme || "").trim().length > 150) {
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

  const resultat = await enregistrerEtudiantsImportes(
    etudiants.map((etudiant, index) => ({
      ...etudiant,
      numeroLigne: etudiant.numeroLigne || index + 2,
      programme: normaliserNomProgramme(etudiant.programme),
    }))
  );

  if (resultat.erreurs?.length) {
    return {
      succes: false,
      message: "Import impossible.",
      erreurs: resultat.erreurs,
    };
  }

  return {
    succes: true,
    message: "Import termine avec succes.",
    nombreImportes: resultat.nombreImportes,
    ...(resultat.cohorteUtilisee
      ? { cohorteUtilisee: resultat.cohorteUtilisee }
      : {}),
  };
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
    await connexion.query(
      `DELETE FROM groupes_etudiants
       WHERE id_groupes_etudiants NOT IN (
         SELECT id_groupes_etudiants
         FROM (
           SELECT DISTINCT id_groupes_etudiants
           FROM etudiants
           WHERE id_groupes_etudiants IS NOT NULL
         ) AS groupes_utilises
       )`
    );

    await connexion.commit();
  } catch (error) {
    await connexion.rollback();
    throw error;
  } finally {
    connexion.release();
  }
}

export async function recupererHoraireCompletEtudiant(idEtudiant) {
  await assurerSchemaSchedulerAcademique();

  const etudiant = await recupererEtudiantParId(idEtudiant);

  if (!etudiant) {
    return null;
  }

  const [horaireGroupe, horaireIndividuel, reprises, diagnosticReprises, exceptionsIndividuelles] =
    await Promise.all([
      recupererSeancesGroupeEffectivesEtudiant(idEtudiant),
      recupererSeancesIndividuellesEtudiant(idEtudiant, {
        sourceTypes: ["reprise", "individuelle"],
      }),
      pool.query(
        `SELECT
           ce.id,
           ce.statut,
           ce.note_echec,
           c.id_cours,
           c.code AS code_cours,
           c.nom AS nom_cours,
           c.etape_etude,
           ge.id_groupes_etudiants AS id_groupe_reprise,
           ge.nom_groupe AS groupe_reprise
         FROM cours_echoues ce
         JOIN cours c
           ON c.id_cours = ce.id_cours
         LEFT JOIN groupes_etudiants ge
           ON ge.id_groupes_etudiants = ce.id_groupe_reprise
         WHERE ce.id_etudiant = ?
           AND ce.id_session = ${SESSION_ACTIVE_SQL}
           AND ce.statut IN (${STATUTS_REPRISES_ACTIFS_SQL})
         ORDER BY c.etape_etude ASC, c.code ASC`,
        [idEtudiant]
      ),
      FailedCourseDebugService.genererRapport({
        idEtudiant: Number(idEtudiant),
        statut: "resolution_manuelle",
      }),
      recupererExceptionsIndividuellesEtudiant(idEtudiant),
    ]);

  const horaireNormalise = (horaireGroupe || [])
    .map((seance) => normaliserSeanceEtudiant(seance, { source_horaire: "groupe" }));
  const horaireReprisesNormalise = (horaireIndividuel || [])
    .filter((seance) => String(seance?.source_horaire || "") === "reprise")
    .map((seance) => normaliserSeanceEtudiant(seance, { source_horaire: "reprise" }));
  const horaireExceptionsIndividuellesNormalise = (horaireIndividuel || [])
    .filter((seance) => String(seance?.source_horaire || "") === "individuelle")
    .map((seance) => normaliserSeanceEtudiant(seance, { source_horaire: "individuelle" }));
  const horaireFusionne = [
    ...horaireNormalise,
    ...horaireReprisesNormalise,
    ...horaireExceptionsIndividuellesNormalise,
  ].sort(comparerSeancesEtudiant);
  const reprisesNormalisees = (reprises[0] || []).map((reprise) => ({
    ...reprise,
    note_echec:
      reprise.note_echec === null || reprise.note_echec === undefined
        ? null
        : Number(reprise.note_echec),
  }));
  const exceptionsIndividuellesNormalisees = (exceptionsIndividuelles || []).map((exception) => ({
    ...exception,
    occurrences: Array.isArray(exception.occurrences)
      ? exception.occurrences.map((occurrence) => ({
          ...occurrence,
          heure_debut: occurrence.heure_debut || null,
          heure_fin: occurrence.heure_fin || null,
        }))
      : [],
  }));

  const coursGroupe = new Set(horaireNormalise.map((seance) => Number(seance.id_cours)));
  const coursReprises = new Set(
    reprisesNormalisees.map((reprise) => Number(reprise.id_cours)).filter((idCours) => idCours > 0)
  );
  const coursExceptionsIndividuelles = new Set(
    exceptionsIndividuellesNormalisees
      .map((exception) => Number(exception.id_cours))
      .filter((idCours) => idCours > 0)
  );
  const coursFusionnes = new Set(
    horaireFusionne.map((seance) => Number(seance.id_cours)).filter((idCours) => idCours > 0)
  );

  return {
    etudiant,
    horaire: horaireFusionne,
    horaire_groupe: horaireNormalise,
    horaire_reprises: horaireReprisesNormalise,
    horaire_individuel: horaireExceptionsIndividuellesNormalise,
    reprises: reprisesNormalisees,
    exceptions_individuelles: exceptionsIndividuellesNormalisees,
    diagnostic_reprises: diagnosticReprises?.diagnostics || [],
    resume: {
      seances_groupe: horaireNormalise.length,
      seances_reprises: horaireReprisesNormalise.length,
      seances_exceptions_individuelles: horaireExceptionsIndividuellesNormalise.length,
      seances_total: horaireFusionne.length,
      cours_normaux: coursGroupe.size,
      cours_reprises: coursReprises.size,
      cours_exceptions_individuelles: coursExceptionsIndividuelles.size,
      cours_total: coursFusionnes.size,
      nb_reprises: Number(etudiant.nb_reprises || 0),
      nb_reprises_planifiees: reprisesNormalisees.filter(
        (reprise) => reprise.statut === "planifie" && reprise.id_groupe_reprise
      ).length,
      nb_reprises_en_attente: reprisesNormalisees.filter(
        (reprise) => reprise.statut !== "planifie" || !reprise.id_groupe_reprise
      ).length,
      charge_cible: Number(etudiant.charge_cible || 0),
    },
  };
}
