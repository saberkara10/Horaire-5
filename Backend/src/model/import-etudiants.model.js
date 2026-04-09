/**
 * Acces base de donnees pour l'import des etudiants.
 *
 * Cette couche se charge uniquement de la coherence SQL :
 * - anti-doublons par matricule ;
 * - resolution ou creation des programmes de reference ;
 * - resolution ou creation automatique des groupes ;
 * - insertion transactionnelle des etudiants.
 */

import pool from "../../db.js";
import { assurerProgrammeReference } from "./programmes.model.js";
import { devinerNomSession, normaliserNomSession } from "../utils/sessions.js";
import { normaliserTexte } from "../utils/programmes.js";
import { assurerSchemaSchedulerAcademique } from "../services/academic-scheduler-schema.js";
import {
  calculerTaillesGroupesEquilibres,
  calculerTaillesGroupesEquilibresPourNombreGroupes,
  determinerCapaciteMaximaleGroupeCohorte,
  TAILLE_MAX_GROUPE_PAR_DEFAUT,
} from "../utils/groupes.js";

const SURPLUS_ETUDIANTS_REPARTISSABLE = 5;

function determinerAnneeParDefaut() {
  return new Date().getFullYear();
}

function construireNomGroupeImporte(programme, etape, session, numeroGroupe) {
  const programmeNettoye =
    String(programme || "Programme")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "Programme";
  const sessionLibelle =
    String(session || "Session non renseignee")
      .replace(/\s+/g, " ")
      .trim() || "Session non renseignee";
  const suffixe = ` - G${numeroGroupe}`;
  const prefixe = `${programmeNettoye} - E${etape} - ${sessionLibelle}`;

  return `${prefixe.slice(0, Math.max(1, 100 - suffixe.length))}${suffixe}`;
}

function extraireNumeroGroupe(nomGroupe) {
  const correspondance = String(nomGroupe || "").match(/ - G(\d+)$/i);
  return correspondance ? Number(correspondance[1]) : null;
}

function trierEtudiantsPourRepartition(etudiants) {
  return [...etudiants].sort((etudiantA, etudiantB) => {
    const comparaisonMatricule = String(etudiantA.matricule || "").localeCompare(
      String(etudiantB.matricule || ""),
      "fr",
      { numeric: true, sensitivity: "base" }
    );

    if (comparaisonMatricule !== 0) {
      return comparaisonMatricule;
    }

    const comparaisonNom = String(etudiantA.nom || "").localeCompare(
      String(etudiantB.nom || ""),
      "fr"
    );

    if (comparaisonNom !== 0) {
      return comparaisonNom;
    }

    const comparaisonPrenom = String(etudiantA.prenom || "").localeCompare(
      String(etudiantB.prenom || ""),
      "fr"
    );

    if (comparaisonPrenom !== 0) {
      return comparaisonPrenom;
    }

    return Number(etudiantA.numeroLigne || 0) - Number(etudiantB.numeroLigne || 0);
  });
}

function construireCleCohorte(etudiant) {
  return [
    etudiant.programmeCle,
    etudiant.etape,
    etudiant.session,
  ].join("|");
}

function construireCleCohortePersistante(programme, etape, session) {
  return [
    normaliserTexte(programme),
    Number(etape),
    normaliserNomSession(session) || String(session || "").trim(),
  ].join("|");
}

function comparerGroupesParNumeroEtNom(groupeA, groupeB) {
  const numeroA = extraireNumeroGroupe(groupeA.nom_groupe);
  const numeroB = extraireNumeroGroupe(groupeB.nom_groupe);

  if (numeroA !== null && numeroB !== null && numeroA !== numeroB) {
    return numeroA - numeroB;
  }

  if (numeroA !== null && numeroB === null) {
    return -1;
  }

  if (numeroA === null && numeroB !== null) {
    return 1;
  }

  return String(groupeA.nom_groupe || "").localeCompare(
    String(groupeB.nom_groupe || ""),
    "fr"
  );
}

function extraireAnneeDepuisSession(valeur) {
  const match = String(valeur || "").match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function normaliserCleSessionEtAnnee(session, annee = null) {
  return {
    annee:
      Number.isInteger(Number(annee)) && Number(annee) > 0
        ? Number(annee)
        : extraireAnneeDepuisSession(session),
    session:
      normaliserNomSession(session) ||
      devinerNomSession(session) ||
      "",
  };
}

function cohortesEtudiantsDifferent(etudiantA, etudiantB) {
  const programmeA = normaliserTexte(etudiantA?.programme);
  const programmeB = normaliserTexte(etudiantB?.programme);
  const etapeA = Number(etudiantA?.etape);
  const etapeB = Number(etudiantB?.etape);
  const sessionA = normaliserNomSession(etudiantA?.session);
  const sessionB = normaliserNomSession(etudiantB?.session);

  return programmeA !== programmeB || etapeA !== etapeB || sessionA !== sessionB;
}

function memoriserCohorte(mapCohortes, etudiant) {
  if (!etudiant?.programme || !Number(etudiant?.etape) || !etudiant?.session) {
    return;
  }

  const cle = construireCleCohortePersistante(
    etudiant.programme,
    etudiant.etape,
    etudiant.session
  );

  if (!mapCohortes.has(cle)) {
    mapCohortes.set(cle, {
      programme: etudiant.programme,
      etape: Number(etudiant.etape),
      session: etudiant.session,
      annee: Number(etudiant.annee) || null,
    });
  }
}

function determinerNombreGroupesCible(
  effectifTotal,
  groupesExistants,
  capaciteCible,
  capaciteMaximaleReelle
) {
  const effectif = Number(effectifTotal) || 0;
  const nombreGroupesExistants = Array.isArray(groupesExistants)
    ? groupesExistants.length
    : 0;
  const capaciteSoft = Math.max(1, Number(capaciteCible) || 1);
  const capaciteHard = Math.max(capaciteSoft, Number(capaciteMaximaleReelle) || capaciteSoft);
  const nombreGroupesMinimal = Math.max(1, Math.ceil(effectif / capaciteSoft));

  if (nombreGroupesExistants === 0) {
    return nombreGroupesMinimal;
  }

  if (effectif <= nombreGroupesExistants * capaciteSoft) {
    return nombreGroupesExistants;
  }

  const surplusRepartissable =
    effectif - nombreGroupesExistants * capaciteSoft;

  if (
    surplusRepartissable > 0 &&
    surplusRepartissable <= SURPLUS_ETUDIANTS_REPARTISSABLE &&
    effectif <= nombreGroupesExistants * capaciteHard
  ) {
    return nombreGroupesExistants;
  }

  if (
    nombreGroupesExistants >= nombreGroupesMinimal &&
    effectif <= nombreGroupesExistants * capaciteHard
  ) {
    return nombreGroupesExistants;
  }

  return Math.max(nombreGroupesExistants, nombreGroupesMinimal);
}

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

async function creerGroupeEtudiant(
  connection,
  nomGroupe,
  { tailleMax = TAILLE_MAX_GROUPE_PAR_DEFAUT, programme = null, etape = null, idSession = null } = {}
) {
  const [resultat] = await connection.query(
    `INSERT INTO groupes_etudiants (
       nom_groupe,
       taille_max,
       programme,
       etape,
       id_session
     )
     VALUES (?, ?, ?, ?, ?)`,
    [nomGroupe, tailleMax, programme, etape, idSession]
  );

  return resultat.insertId;
}

async function recupererGroupeParNom(connection, nomGroupe, idSession = null) {
  const [rows] = await connection.query(
    `SELECT
       id_groupes_etudiants,
       nom_groupe,
       taille_max,
       programme,
       etape,
       id_session
     FROM groupes_etudiants
     WHERE nom_groupe = ?
       AND (id_session <=> ?)
     LIMIT 1`,
    [nomGroupe, idSession]
  );

  return rows[0] ?? null;
}

async function mettreAJourGroupeEtudiant(
  connection,
  idGroupe,
  {
    nomGroupe,
    tailleMax = TAILLE_MAX_GROUPE_PAR_DEFAUT,
    programme = null,
    etape = null,
    idSession = null,
  }
) {
  await connection.query(
    `UPDATE groupes_etudiants
     SET nom_groupe = ?,
         taille_max = ?,
         programme = ?,
         etape = ?,
         id_session = ?
     WHERE id_groupes_etudiants = ?`,
    [nomGroupe, tailleMax, programme, etape, idSession, idGroupe]
  );
}

async function recupererEtudiantsCohorte(connection, { programme, etape, session }) {
  const [rows] = await connection.query(
    `SELECT
       id_etudiant,
       matricule,
       nom,
       prenom,
       programme,
       etape,
       session,
       id_groupes_etudiants
     FROM etudiants
     WHERE programme = ?
       AND etape = ?
       AND session = ?
     ORDER BY matricule ASC, nom ASC, prenom ASC, id_etudiant ASC`,
    [programme, etape, session]
  );

  return rows;
}

async function recupererGroupesExistantsPourCohorte(
  connection,
  { programme, etape, session, idSession = null }
) {
  const groupesParId = new Map();
  const paramsMetadonnees = [programme, etape];
  const clauseSession =
    idSession === null ? "ge.id_session IS NULL" : "ge.id_session = ?";

  if (idSession !== null) {
    paramsMetadonnees.push(idSession);
  }

  const [groupesMetadonnees] = await connection.query(
    `SELECT
       ge.id_groupes_etudiants,
       ge.nom_groupe,
       ge.taille_max,
       ge.programme,
       ge.etape,
       ge.id_session
     FROM groupes_etudiants ge
     WHERE ge.programme = ?
       AND ge.etape = ?
       AND ${clauseSession}
     ORDER BY ge.nom_groupe ASC`,
    paramsMetadonnees
  );

  for (const groupe of groupesMetadonnees) {
    groupesParId.set(Number(groupe.id_groupes_etudiants), {
      ...groupe,
      id_groupes_etudiants: Number(groupe.id_groupes_etudiants),
      effectif: 0,
      taille_max: Number(groupe.taille_max || 0),
      id_session:
        groupe.id_session === null ? null : Number(groupe.id_session),
    });
  }

  const [rows] = await connection.query(
    `SELECT
       ge.id_groupes_etudiants,
       ge.nom_groupe,
       ge.taille_max,
       ge.programme,
       ge.etape,
       ge.id_session,
       COUNT(e.id_etudiant) AS effectif
     FROM etudiants e
     JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = e.id_groupes_etudiants
     WHERE e.programme = ?
       AND e.etape = ?
       AND e.session = ?
     GROUP BY
       ge.id_groupes_etudiants,
       ge.nom_groupe,
       ge.taille_max,
       ge.programme,
       ge.etape,
       ge.id_session
     ORDER BY ge.nom_groupe ASC`,
    [programme, etape, session]
  );

  for (const groupe of rows) {
    groupesParId.set(Number(groupe.id_groupes_etudiants), {
      ...groupesParId.get(Number(groupe.id_groupes_etudiants)),
      ...groupe,
      id_groupes_etudiants: Number(groupe.id_groupes_etudiants),
      effectif: Number(groupe.effectif || 0),
      taille_max: Number(groupe.taille_max || 0),
      id_session:
        groupe.id_session === null ? null : Number(groupe.id_session),
    });
  }

  return [...groupesParId.values()].sort(comparerGroupesParNumeroEtNom);
}

async function recupererCoursActifsPourCohorte(connection, programme, etape) {
  const [rows] = await connection.query(
    `SELECT id_cours, type_salle, id_salle_reference
     FROM cours
     WHERE archive = 0
       AND programme = ?
       AND etape_etude = ?
     ORDER BY id_cours ASC`,
    [programme, String(etape)]
  );

  return rows;
}

async function recupererToutesLesSalles(connection) {
  const [rows] = await connection.query(
    `SELECT id_salle, type, capacite
     FROM salles
     ORDER BY id_salle ASC`
  );

  return rows;
}

async function resoudreCohorteParDefaut(connection) {
  const anneeParDefaut = determinerAnneeParDefaut();
  let sessionParDefaut = devinerNomSession("", new Date());

  try {
    const [rows] = await connection.query(
      `SELECT nom, date_debut
       FROM sessions
       WHERE active = TRUE
       ORDER BY id_session DESC
       LIMIT 1`
    );

    const sessionActive = rows[0];

    if (sessionActive) {
      sessionParDefaut =
        devinerNomSession(sessionActive.nom, sessionActive.date_debut) ||
        sessionParDefaut;

      const dateDebut = sessionActive.date_debut
        ? new Date(sessionActive.date_debut)
        : null;

      return {
        session: sessionParDefaut,
        annee:
          dateDebut && !Number.isNaN(dateDebut.getTime())
            ? dateDebut.getFullYear()
            : anneeParDefaut,
      };
    }
  } catch (error) {
    if (error.code !== "ER_NO_SUCH_TABLE") {
      throw error;
    }
  }

  return {
    session: sessionParDefaut || "Automne",
    annee: anneeParDefaut,
  };
}

async function recupererSessionsDisponibles(connection) {
  try {
    const [rows] = await connection.query(
      `SELECT id_session, nom, date_debut, active
       FROM sessions
       ORDER BY active DESC, date_debut DESC, id_session DESC`
    );

    return rows;
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return [];
    }

    throw error;
  }
}

async function resoudreIdSessionPourNom(
  connection,
  sessionRecherchee,
  cacheSessions = null,
  options = {}
) {
  const sessionRechercheeTexte = String(sessionRecherchee || "").trim();
  const sessionNormalisee =
    normaliserNomSession(sessionRechercheeTexte) ||
    devinerNomSession(sessionRechercheeTexte);
  const anneeRecherchee =
    Number.isInteger(Number(options?.annee)) && Number(options.annee) > 0
      ? Number(options.annee)
      : extraireAnneeDepuisSession(sessionRechercheeTexte);

  if (!sessionNormalisee) {
    return null;
  }

  const sessions = Array.isArray(cacheSessions)
    ? cacheSessions
    : await recupererSessionsDisponibles(connection);

  const sessionExacte = sessions.find(
    (session) => normaliserTexte(session.nom) === normaliserTexte(sessionRechercheeTexte)
  );

  if (sessionExacte) {
    return Number(sessionExacte.id_session);
  }

  const correspondances = sessions.filter((session) => {
    const cleSession = normaliserCleSessionEtAnnee(
      session.nom,
      session.date_debut ? new Date(session.date_debut).getFullYear() : null
    );

    return cleSession.session === sessionNormalisee;
  });

  if (correspondances.length === 0) {
    return null;
  }

  const correspondancesParAnnee =
    anneeRecherchee === null
      ? correspondances
      : correspondances.filter((session) => {
          const anneeSession = session.date_debut
            ? new Date(session.date_debut).getFullYear()
            : extraireAnneeDepuisSession(session.nom);
          return Number(anneeSession) === Number(anneeRecherchee);
        });

  const candidates =
    correspondancesParAnnee.length > 0 ? correspondancesParAnnee : correspondances;

  return Number(candidates[0].id_session);
}

function normaliserEtudiantPourInsertion(etudiant, cohorteParDefaut) {
  const programme = String(etudiant.programme || "").trim();
  const sessionBrute = String(etudiant.session || "").trim();
  const session =
    normaliserNomSession(sessionBrute) ||
    devinerNomSession(sessionBrute) ||
    cohorteParDefaut.session;
  const anneeSessionImportee =
    extraireAnneeDepuisSession(sessionBrute) || Number(etudiant.annee) || null;

  return {
    ...etudiant,
    matricule: String(etudiant.matricule || "").trim(),
    nom: String(etudiant.nom || "").trim(),
    prenom: String(etudiant.prenom || "").trim(),
    programme,
    programmeCle: normaliserTexte(programme),
    etape: Number(etudiant.etape),
    session,
    session_reference: sessionBrute,
    annee: anneeSessionImportee || cohorteParDefaut.annee,
    nom_groupe_systeme: "",
  };
}

async function filtrerEtudiantsImportables(
  connection,
  etudiants,
  {
    sessionsDisponibles = [],
    coursParCohorte = new Map(),
  } = {}
) {
  const verifierSessions = Array.isArray(sessionsDisponibles) && sessionsDisponibles.length > 0;
  const cohortesValides = new Map();
  const cohortesIgnorees = new Map();
  const etudiantsImportables = [];
  const etudiantsIgnores = [];

  for (const etudiant of etudiants) {
    const cleCohorte = construireCleCohortePersistante(
      etudiant.programme,
      etudiant.etape,
      etudiant.session
    );

    if (!cohortesValides.has(cleCohorte) && !cohortesIgnorees.has(cleCohorte)) {
      const idSession = verifierSessions
        ? await resoudreIdSessionPourNom(
            connection,
            etudiant.session_reference || etudiant.session,
            sessionsDisponibles,
            { annee: Number(etudiant.annee) || null }
          )
        : null;

      if (verifierSessions && !idSession) {
        cohortesIgnorees.set(cleCohorte, {
          programme: etudiant.programme,
          etape: Number(etudiant.etape),
          session: etudiant.session,
          raison: "session_introuvable",
        });
      } else {
        const cleCoursCohorte = [
          normaliserTexte(etudiant.programme),
          Number(etudiant.etape),
        ].join("|");
        let coursCohorte = coursParCohorte.get(cleCoursCohorte);

        if (!coursCohorte) {
          coursCohorte = await recupererCoursActifsPourCohorte(
            connection,
            etudiant.programme,
            etudiant.etape
          );
          coursParCohorte.set(cleCoursCohorte, coursCohorte);
        }

        if (!Array.isArray(coursCohorte) || coursCohorte.length === 0) {
          cohortesIgnorees.set(cleCohorte, {
            programme: etudiant.programme,
            etape: Number(etudiant.etape),
            session: etudiant.session,
            raison: "catalogue_absent",
          });
        } else {
          cohortesValides.set(cleCohorte, {
            programme: etudiant.programme,
            etape: Number(etudiant.etape),
            session: etudiant.session,
            id_session: Number(idSession),
          });
        }
      }
    }

    if (cohortesIgnorees.has(cleCohorte)) {
      etudiantsIgnores.push({
        ...etudiant,
        raison: cohortesIgnorees.get(cleCohorte).raison,
      });
      continue;
    }

    etudiantsImportables.push(etudiant);
  }

  return {
    etudiantsImportables,
    etudiantsIgnores,
    cohortesIgnorees: [...cohortesIgnorees.values()],
  };
}

function determinerProchainNumeroGroupe(groupesExistants = []) {
  const plusGrandNumero = groupesExistants.reduce((maximum, groupe) => {
    const numero = extraireNumeroGroupe(groupe.nom_groupe);
    return numero !== null && numero > maximum ? numero : maximum;
  }, 0);

  return plusGrandNumero > 0 ? plusGrandNumero : groupesExistants.length;
}

async function reassignerEtudiantsAuGroupe(connection, idsEtudiants, idGroupe) {
  if (!Array.isArray(idsEtudiants) || idsEtudiants.length === 0) {
    return;
  }

  const placeholders = idsEtudiants.map(() => "?").join(", ");

  await connection.query(
    `UPDATE etudiants
     SET id_groupes_etudiants = ?
     WHERE id_etudiant IN (${placeholders})`,
    [idGroupe, ...idsEtudiants]
  );
}

async function reequilibrerCohorteEtudiants(
  connection,
  referenceCohorte,
  contexte = {}
) {
  const etudiantsCohorte = trierEtudiantsPourRepartition(
    await recupererEtudiantsCohorte(connection, referenceCohorte)
  );

  if (etudiantsCohorte.length === 0) {
    return {
      ...referenceCohorte,
      effectif: 0,
      groupes_utilises: 0,
    };
  }

  const sessionsDisponibles = Array.isArray(contexte.sessionsDisponibles)
    ? contexte.sessionsDisponibles
    : await recupererSessionsDisponibles(connection);
  const idSession = await resoudreIdSessionPourNom(
    connection,
    referenceCohorte.session,
    sessionsDisponibles
  );
  const groupesExistants = await recupererGroupesExistantsPourCohorte(connection, {
    ...referenceCohorte,
    idSession,
  });
  const salles = Array.isArray(contexte.salles)
    ? contexte.salles
    : await recupererToutesLesSalles(connection);
  const coursParCohorte = contexte.coursParCohorte || new Map();
  const cleCoursCohorte = [
    normaliserTexte(referenceCohorte.programme),
    Number(referenceCohorte.etape),
  ].join("|");
  let coursCohorte = coursParCohorte.get(cleCoursCohorte);

  if (!coursCohorte) {
    coursCohorte = await recupererCoursActifsPourCohorte(
      connection,
      referenceCohorte.programme,
      referenceCohorte.etape
    );
    coursParCohorte.set(cleCoursCohorte, coursCohorte);
  }

  const capaciteCible = determinerCapaciteMaximaleGroupeCohorte(
    coursCohorte,
    salles,
    TAILLE_MAX_GROUPE_PAR_DEFAUT
  );
  const capaciteMaximaleReelle = determinerCapaciteMaximaleGroupeCohorte(
    coursCohorte,
    salles,
    Number.MAX_SAFE_INTEGER
  );
  const nombreGroupesCible = determinerNombreGroupesCible(
    etudiantsCohorte.length,
    groupesExistants,
    capaciteCible,
    capaciteMaximaleReelle
  );
  let taillesCibles = calculerTaillesGroupesEquilibresPourNombreGroupes(
    etudiantsCohorte.length,
    nombreGroupesCible,
    capaciteMaximaleReelle
  );

  if (taillesCibles.length === 0) {
    taillesCibles = calculerTaillesGroupesEquilibres(
      etudiantsCohorte.length,
      capaciteCible
    );
  }

  const tailleMaxGroupe = Math.max(capaciteCible, ...taillesCibles);
  const groupesCibles = [];
  let prochainNumero = determinerProchainNumeroGroupe(groupesExistants);

  for (let index = 0; index < taillesCibles.length; index += 1) {
    const groupeExistant = groupesExistants[index];

    if (groupeExistant) {
      const nomCanonique = construireNomGroupeImporte(
        referenceCohorte.programme,
        referenceCohorte.etape,
        referenceCohorte.session,
        index + 1
      );
      const nomActuel = String(groupeExistant.nom_groupe || "").trim();
      const doitNormaliserNom =
        groupesExistants.length === 1 &&
        (
          !nomActuel ||
          extraireNumeroGroupe(nomActuel) === null ||
          nomActuel.includes(" -  - ")
        );
      const nomGroupe =
        doitNormaliserNom
          ? nomCanonique
          : nomActuel || nomCanonique;

      await mettreAJourGroupeEtudiant(connection, groupeExistant.id_groupes_etudiants, {
        nomGroupe,
        tailleMax: tailleMaxGroupe,
        programme: referenceCohorte.programme,
        etape: referenceCohorte.etape,
        idSession,
      });

      groupesCibles.push({
        id_groupes_etudiants: groupeExistant.id_groupes_etudiants,
        nom_groupe: nomGroupe,
      });
      continue;
    }

    prochainNumero += 1;
    const nomGroupe = construireNomGroupeImporte(
      referenceCohorte.programme,
      referenceCohorte.etape,
      referenceCohorte.session,
      prochainNumero
    );
    let idGroupe = null;

    try {
      idGroupe = await creerGroupeEtudiant(connection, nomGroupe, {
        tailleMax: tailleMaxGroupe,
        programme: referenceCohorte.programme,
        etape: referenceCohorte.etape,
        idSession,
      });
    } catch (error) {
      if (error.code !== "ER_DUP_ENTRY") {
        throw error;
      }

      const groupeExistant = await recupererGroupeParNom(connection, nomGroupe, idSession);

      if (!groupeExistant) {
        throw error;
      }

      idGroupe = Number(groupeExistant.id_groupes_etudiants);
      await mettreAJourGroupeEtudiant(connection, idGroupe, {
        nomGroupe,
        tailleMax: tailleMaxGroupe,
        programme: referenceCohorte.programme,
        etape: referenceCohorte.etape,
        idSession,
      });
    }

    groupesCibles.push({
      id_groupes_etudiants: idGroupe,
      nom_groupe: nomGroupe,
    });
  }

  let positionCourante = 0;

  for (let index = 0; index < groupesCibles.length; index += 1) {
    const tailleGroupe = taillesCibles[index] || 0;
    const idsEtudiants = etudiantsCohorte
      .slice(positionCourante, positionCourante + tailleGroupe)
      .map((etudiant) => Number(etudiant.id_etudiant))
      .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0);

    await reassignerEtudiantsAuGroupe(
      connection,
      idsEtudiants,
      groupesCibles[index].id_groupes_etudiants
    );
    positionCourante += tailleGroupe;
  }

  return {
    ...referenceCohorte,
    effectif: etudiantsCohorte.length,
    groupes_utilises: groupesCibles.length,
    taille_max: tailleMaxGroupe,
  };
}

async function ajouterEtudiant(connection, etudiant) {
  const [resultat] = await connection.query(
    `INSERT INTO etudiants (
       matricule,
       nom,
       prenom,
       id_groupes_etudiants,
       programme,
       etape,
       session,
       annee
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      etudiant.matricule,
      etudiant.nom,
      etudiant.prenom,
      etudiant.id_groupes_etudiants,
      etudiant.programme,
      etudiant.etape,
      etudiant.session,
      etudiant.annee,
    ]
  );

  return resultat.insertId;
}

async function mettreAJourEtudiantImporte(
  connection,
  idEtudiant,
  etudiant,
  { reinitialiserGroupe = false } = {}
) {
  const fragments = [
    "nom = ?",
    "prenom = ?",
    "programme = ?",
    "etape = ?",
    "session = ?",
    "annee = ?",
  ];
  const params = [
    etudiant.nom,
    etudiant.prenom,
    etudiant.programme,
    etudiant.etape,
    etudiant.session,
    etudiant.annee,
  ];

  if (reinitialiserGroupe) {
    fragments.push("id_groupes_etudiants = NULL");
  }

  params.push(Number(idEtudiant));

  await connection.query(
    `UPDATE etudiants
     SET ${fragments.join(", ")}
     WHERE id_etudiant = ?`,
    params
  );
}

function normaliserCoursEchouePourInsertion(coursEchoue, sessionParDefaut = "") {
  const sessionBrute =
    coursEchoue?.session ??
    coursEchoue?.session_cible ??
    coursEchoue?.sessionCible ??
    "";
  const noteBrute = coursEchoue?.note_echec ?? coursEchoue?.noteEchec ?? "";
  const noteNormalisee =
    noteBrute === "" || noteBrute === null || noteBrute === undefined
      ? null
      : Number(String(noteBrute).replace(",", "."));
  const sessionNormalisee =
    normaliserNomSession(sessionBrute) ||
    devinerNomSession(sessionBrute) ||
    sessionParDefaut;

  return {
    ...coursEchoue,
    matricule: String(coursEchoue?.matricule || "").trim(),
    code_cours: String(
      coursEchoue?.code_cours ?? coursEchoue?.codeCours ?? ""
    )
      .trim()
      .toUpperCase(),
    session_reference: String(sessionBrute || "").trim(),
    session: sessionNormalisee,
    statut: String(coursEchoue?.statut || "a_reprendre").trim() || "a_reprendre",
    note_echec:
      Number.isFinite(noteNormalisee) && noteNormalisee >= 0
        ? noteNormalisee
        : null,
  };
}

async function recupererEtudiantsParMatricules(connection, matricules) {
  if (!Array.isArray(matricules) || matricules.length === 0) {
    return [];
  }

  const placeholders = matricules.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT id_etudiant, matricule, nom, prenom, programme, etape, session, annee,
            id_groupes_etudiants
     FROM etudiants
     WHERE matricule IN (${placeholders})`,
    matricules
  );

  return rows;
}

async function recupererCoursParCodes(connection, codesCours) {
  if (!Array.isArray(codesCours) || codesCours.length === 0) {
    return [];
  }

  const placeholders = codesCours.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT id_cours, code, programme, etape_etude, archive
     FROM cours
     WHERE code IN (${placeholders})`,
    codesCours
  );

  return rows;
}

function validerProgrammeCoursEchoue(etudiant, cours) {
  return (
    normaliserTexte(etudiant?.programme) === normaliserTexte(cours?.programme)
  );
}

function extraireEtapeCours(cours) {
  const etape = Number(cours?.etape_etude);
  return Number.isInteger(etape) && etape > 0 ? etape : null;
}

async function enregistrerCoursEchouesImportes(
  connection,
  coursEchoues,
  {
    sessionParDefaut = "",
    sessionsDisponibles = [],
  } = {}
) {
  if (!Array.isArray(coursEchoues) || coursEchoues.length === 0) {
    return { nombreImportes: 0 };
  }

  const coursEchouesNormalises = coursEchoues.map((coursEchoue) =>
    normaliserCoursEchouePourInsertion(coursEchoue, sessionParDefaut)
  );
  const etudiantsParMatricule = new Map(
    (
      await recupererEtudiantsParMatricules(
        connection,
        [...new Set(coursEchouesNormalises.map((coursEchoue) => coursEchoue.matricule))]
      )
    ).map((etudiant) => [String(etudiant.matricule || "").trim(), etudiant])
  );
  const coursParCode = new Map(
    (
      await recupererCoursParCodes(
        connection,
        [...new Set(coursEchouesNormalises.map((coursEchoue) => coursEchoue.code_cours))]
      )
    ).map((cours) => [String(cours.code || "").trim().toUpperCase(), cours])
  );
  const erreurs = [];
  const lignesValides = [];

  for (const coursEchoue of coursEchouesNormalises) {
    const etudiant = etudiantsParMatricule.get(coursEchoue.matricule);
    const cours = coursParCode.get(coursEchoue.code_cours);

    if (!etudiant) {
      erreurs.push(
        `Ligne ${coursEchoue.numeroLigne} : aucun etudiant ne correspond au matricule ${coursEchoue.matricule}.`
      );
      continue;
    }

    if (!cours || Number(cours.archive || 0) === 1) {
      erreurs.push(
        `Ligne ${coursEchoue.numeroLigne} : le cours ${coursEchoue.code_cours} est introuvable ou archive.`
      );
      continue;
    }

    if (Number(etudiant.etape) <= 1) {
      erreurs.push(
        `Ligne ${coursEchoue.numeroLigne} : un etudiant de l'etape 1 ne peut pas reprendre de cours echoue.`
      );
      continue;
    }

    if (!validerProgrammeCoursEchoue(etudiant, cours)) {
      erreurs.push(
        `Ligne ${coursEchoue.numeroLigne} : le cours ${coursEchoue.code_cours} n'appartient pas au meme programme que l'etudiant ${coursEchoue.matricule}.`
      );
      continue;
    }

    const etapeCours = extraireEtapeCours(cours);

    if (!etapeCours || etapeCours >= Number(etudiant.etape)) {
      erreurs.push(
        `Ligne ${coursEchoue.numeroLigne} : le cours ${coursEchoue.code_cours} doit provenir d'une etape anterieure a l'etape actuelle ${etudiant.etape}.`
      );
      continue;
    }

    if (
      coursEchoue.note_echec !== null &&
      (coursEchoue.note_echec < 0 || coursEchoue.note_echec >= 60)
    ) {
      erreurs.push(
        `Ligne ${coursEchoue.numeroLigne} : la note d'echec doit etre comprise entre 0 et 59.99.`
      );
      continue;
    }

    const sessionEtudiant = normaliserNomSession(etudiant.session);

    if (
      coursEchoue.session &&
      sessionEtudiant &&
      normaliserNomSession(coursEchoue.session) !== sessionEtudiant
    ) {
      erreurs.push(
        `Ligne ${coursEchoue.numeroLigne} : la session cible ${coursEchoue.session} ne correspond pas a la session actuelle ${etudiant.session} de l'etudiant ${coursEchoue.matricule}.`
      );
      continue;
    }

    const sessionCible = coursEchoue.session || etudiant.session || sessionParDefaut;
    const idSession = await resoudreIdSessionPourNom(
      connection,
      coursEchoue.session_reference || sessionCible,
      sessionsDisponibles,
      {
        annee: extraireAnneeDepuisSession(coursEchoue.session_reference),
      }
    );

    if (!idSession) {
      erreurs.push(
        `Ligne ${coursEchoue.numeroLigne} : aucune session cible n'existe en base pour ${sessionCible || "la reprise demandee"}.`
      );
      continue;
    }

    lignesValides.push({
      id_etudiant: Number(etudiant.id_etudiant),
      id_cours: Number(cours.id_cours),
      id_session: idSession,
      note_echec: coursEchoue.note_echec,
      statut: coursEchoue.statut || "a_reprendre",
    });
  }

  if (erreurs.length > 0) {
    return { erreurs };
  }

  for (const ligne of lignesValides) {
    await connection.query(
      `INSERT INTO cours_echoues (
         id_etudiant,
         id_cours,
         id_session,
         note_echec,
         statut
       )
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         note_echec = VALUES(note_echec),
         statut = VALUES(statut),
         updated_at = CURRENT_TIMESTAMP`,
      [
        ligne.id_etudiant,
        ligne.id_cours,
        ligne.id_session,
        ligne.note_echec,
        ligne.statut,
      ]
    );
  }

  return { nombreImportes: lignesValides.length };
}

/**
 * Enregistrer un lot d'etudiants deja valides par le service d'import.
 *
 * @param {Array<Object>} etudiants Liste des etudiants pre-valides.
 * @returns {Promise<{nombreImportes?: number, erreurs?: string[], cohorteUtilisee?: Object}>}
 */
export async function enregistrerEtudiantsImportes(etudiants, options = {}) {
  const connection = await pool.getConnection();

  try {
    await assurerSchemaSchedulerAcademique(connection);
    await connection.beginTransaction();

    const cohorteParDefaut = await resoudreCohorteParDefaut(connection);
    const coursEchouesImportes = Array.isArray(options?.coursEchoues)
      ? options.coursEchoues
      : [];
    const etudiantsNormalises = etudiants.map((etudiant) =>
      normaliserEtudiantPourInsertion(etudiant, cohorteParDefaut)
    );

    const programmesParCle = new Map();

    for (const etudiant of etudiantsNormalises) {
      if (!programmesParCle.has(etudiant.programmeCle)) {
        const programmeReference = await assurerProgrammeReference(
          etudiant.programme,
          connection
        );
        programmesParCle.set(etudiant.programmeCle, programmeReference);
      }

      etudiant.programme = programmesParCle.get(etudiant.programmeCle);
    }

    const contexteReequilibrage = {
      sessionsDisponibles: await recupererSessionsDisponibles(connection),
      salles: await recupererToutesLesSalles(connection),
      coursParCohorte: new Map(),
    };
    const {
      etudiantsImportables,
      etudiantsIgnores,
      cohortesIgnorees,
    } = await filtrerEtudiantsImportables(connection, etudiantsNormalises, {
      sessionsDisponibles: contexteReequilibrage.sessionsDisponibles,
      coursParCohorte: contexteReequilibrage.coursParCohorte,
    });
    const matricules = etudiantsImportables.map((etudiant) => etudiant.matricule);
    const etudiantsExistants = await recupererEtudiantsParMatricules(
      connection,
      matricules
    );
    const etudiantsExistantsParMatricule = new Map(
      etudiantsExistants.map((etudiantExistant) => [
        String(etudiantExistant.matricule || "").trim(),
        etudiantExistant,
      ])
    );
    const cohortesAReequilibrer = new Map();
    let nombreImportes = 0;
    let nombreMisAJour = 0;

    for (const etudiant of etudiantsImportables) {
      const etudiantExistant = etudiantsExistantsParMatricule.get(etudiant.matricule);

      if (etudiantExistant) {
        const cohorteModifiee = cohortesEtudiantsDifferent(etudiantExistant, etudiant);
        const groupeManquant = !Number(etudiantExistant.id_groupes_etudiants);

        memoriserCohorte(cohortesAReequilibrer, etudiant);

        if (cohorteModifiee) {
          memoriserCohorte(cohortesAReequilibrer, etudiantExistant);
        }

        await mettreAJourEtudiantImporte(
          connection,
          etudiantExistant.id_etudiant,
          etudiant,
          { reinitialiserGroupe: cohorteModifiee || groupeManquant }
        );
        nombreMisAJour += 1;
        continue;
      }

      memoriserCohorte(cohortesAReequilibrer, etudiant);

      await ajouterEtudiant(connection, {
        ...etudiant,
        id_groupes_etudiants: null,
      });
      nombreImportes += 1;
    }

    for (const cohorte of cohortesAReequilibrer.values()) {
      await reequilibrerCohorteEtudiants(connection, cohorte, contexteReequilibrage);
    }

    const resultatCoursEchoues = await enregistrerCoursEchouesImportes(
      connection,
      coursEchouesImportes.filter((coursEchoue) =>
        matricules.includes(String(coursEchoue?.matricule || "").trim())
      ),
      {
        sessionParDefaut: cohorteParDefaut.session,
        sessionsDisponibles: contexteReequilibrage.sessionsDisponibles,
      }
    );

    if (resultatCoursEchoues.erreurs?.length) {
      await connection.rollback();
      return { erreurs: resultatCoursEchoues.erreurs };
    }

    await connection.commit();

    return {
      nombreImportes,
      nombreMisAJour,
      nombreCoursEchouesImportes: resultatCoursEchoues.nombreImportes || 0,
      nombreEtudiantsIgnores: etudiantsIgnores.length,
      nombreCohortesIgnorees: cohortesIgnorees.length,
      cohortesIgnorees,
      cohorteUtilisee: {
        session: cohorteParDefaut.session,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function reequilibrerCohortesEtudiants(cohortes = []) {
  const connection = await pool.getConnection();

  try {
    await assurerSchemaSchedulerAcademique(connection);
    await connection.beginTransaction();

    const contexteReequilibrage = {
      sessionsDisponibles: await recupererSessionsDisponibles(connection),
      salles: await recupererToutesLesSalles(connection),
      coursParCohorte: new Map(),
    };
    const resultats = [];

    for (const cohorte of cohortes) {
      resultats.push(
        await reequilibrerCohorteEtudiants(connection, cohorte, contexteReequilibrage)
      );
    }

    await connection.commit();

    return {
      cohortes: resultats.length,
      effectif_total: resultats.reduce(
        (total, cohorte) => total + Number(cohorte.effectif || 0),
        0
      ),
      details: resultats,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function reequilibrerToutesLesCohortesEtudiants() {
  const [rows] = await pool.query(
    `SELECT DISTINCT programme, etape, session
     FROM etudiants
     ORDER BY programme ASC, etape ASC, session ASC`
  );

  return reequilibrerCohortesEtudiants(
    rows.map((cohorte) => ({
      programme: cohorte.programme,
      etape: Number(cohorte.etape),
      session: String(cohorte.session || "").trim(),
    }))
  );
}
