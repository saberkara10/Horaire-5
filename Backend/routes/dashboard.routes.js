/**
 * ROUTES - Dashboard
 *
 * Fournit une synthese metier exploitable par le tableau de bord principal.
 */

import { userAuth } from "../middlewares/auth.js";
import pool from "../db.js";
import { assurerSchemaSchedulerAcademique } from "../src/services/academic-scheduler-schema.js";

const EXISTE_HORAIRE_GROUPE_SQL = `EXISTS (
  SELECT 1
  FROM affectation_groupes ag
  JOIN affectation_cours ac
    ON ac.id_affectation_cours = ag.id_affectation_cours
  JOIN plages_horaires ph
    ON ph.id_plage_horaires = ac.id_plage_horaires
  WHERE ag.id_groupes_etudiants = ge.id_groupes_etudiants
)`;

function parseDashboardJson(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function recupererSessionActive(executor = pool) {
  const [rows] = await executor.query(
    `SELECT id_session, nom, date_debut, date_fin
     FROM sessions
     WHERE active = TRUE
     ORDER BY id_session DESC
     LIMIT 1`
  );

  return rows[0] || null;
}

async function recupererCompteursGlobaux(executor = pool) {
  const [[rows]] = await executor.query(
    `SELECT
       (SELECT COUNT(*) FROM cours WHERE archive = 0) AS nb_cours_actifs,
       (SELECT COUNT(*) FROM professeurs) AS nb_professeurs,
       (SELECT COUNT(*) FROM salles) AS nb_salles,
       (SELECT COALESCE(SUM(capacite), 0) FROM salles) AS capacite_totale_salles,
       (SELECT COUNT(*) FROM etudiants) AS nb_etudiants,
       (SELECT COUNT(*) FROM groupes_etudiants) AS nb_groupes,
       (SELECT COUNT(*) FROM etudiants WHERE id_groupes_etudiants IS NULL) AS nb_etudiants_sans_groupe,
       (
         SELECT COUNT(DISTINCT programme)
         FROM cours
         WHERE archive = 0
           AND programme IS NOT NULL
           AND TRIM(programme) <> ''
       ) AS nb_programmes_actifs`
  );

  return {
    nb_cours_actifs: Number(rows.nb_cours_actifs || 0),
    nb_professeurs: Number(rows.nb_professeurs || 0),
    nb_salles: Number(rows.nb_salles || 0),
    capacite_totale_salles: Number(rows.capacite_totale_salles || 0),
    nb_etudiants: Number(rows.nb_etudiants || 0),
    nb_groupes: Number(rows.nb_groupes || 0),
    nb_etudiants_sans_groupe: Number(rows.nb_etudiants_sans_groupe || 0),
    nb_programmes_actifs: Number(rows.nb_programmes_actifs || 0),
  };
}

async function recupererStatistiquesSessionActive(idSession, executor = pool) {
  if (!Number.isInteger(Number(idSession))) {
    return {
      nb_groupes_actifs: 0,
      nb_groupes_avec_horaire: 0,
      nb_groupes_sans_horaire: 0,
      nb_etudiants_session_active: 0,
      nb_etudiants_avec_horaire: 0,
    };
  }

  const [[rows]] = await executor.query(
    `SELECT
       (SELECT COUNT(*)
        FROM groupes_etudiants ge
        WHERE ge.id_session = ?) AS nb_groupes_actifs,
       (SELECT COUNT(*)
        FROM groupes_etudiants ge
        WHERE ge.id_session = ?
          AND ${EXISTE_HORAIRE_GROUPE_SQL}) AS nb_groupes_avec_horaire,
       (SELECT COUNT(*)
        FROM groupes_etudiants ge
        WHERE ge.id_session = ?
          AND NOT ${EXISTE_HORAIRE_GROUPE_SQL}) AS nb_groupes_sans_horaire,
       (SELECT COUNT(*)
        FROM etudiants e
        JOIN groupes_etudiants ge
          ON ge.id_groupes_etudiants = e.id_groupes_etudiants
        WHERE ge.id_session = ?) AS nb_etudiants_session_active,
       (SELECT COUNT(*)
        FROM etudiants e
        JOIN groupes_etudiants ge
          ON ge.id_groupes_etudiants = e.id_groupes_etudiants
        WHERE ge.id_session = ?
          AND ${EXISTE_HORAIRE_GROUPE_SQL}) AS nb_etudiants_avec_horaire`,
    [idSession, idSession, idSession, idSession, idSession]
  );

  return {
    nb_groupes_actifs: Number(rows.nb_groupes_actifs || 0),
    nb_groupes_avec_horaire: Number(rows.nb_groupes_avec_horaire || 0),
    nb_groupes_sans_horaire: Number(rows.nb_groupes_sans_horaire || 0),
    nb_etudiants_session_active: Number(rows.nb_etudiants_session_active || 0),
    nb_etudiants_avec_horaire: Number(rows.nb_etudiants_avec_horaire || 0),
  };
}

async function recupererDernierRapportGeneration(executor = pool) {
  try {
    const [rows] = await executor.query(
      `SELECT
         score_qualite,
         nb_cours_planifies,
         nb_cours_non_planifies,
         date_generation,
         details
       FROM rapports_generation
       ORDER BY date_generation DESC
       LIMIT 1`
    );

    if (!rows[0]) {
      return null;
    }

    return {
      score_qualite: Number(rows[0].score_qualite || 0),
      nb_cours_planifies: Number(rows[0].nb_cours_planifies || 0),
      nb_cours_non_planifies: Number(rows[0].nb_cours_non_planifies || 0),
      date_generation: rows[0].date_generation,
      details_bruts: parseDashboardJson(rows[0].details),
    };
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return null;
    }

    throw error;
  }
}

async function recupererCoursRecents(executor = pool) {
  const [rows] = await executor.query(
    `SELECT id_cours, code, nom, programme
     FROM cours
     WHERE archive = 0
     ORDER BY id_cours DESC
     LIMIT 4`
  );

  return rows;
}

async function recupererProfesseursRecents(executor = pool) {
  const [rows] = await executor.query(
    `SELECT
       p.id_professeur,
       p.matricule,
       p.nom,
       p.prenom,
       COALESCE(
         GROUP_CONCAT(DISTINCT c.programme ORDER BY c.programme SEPARATOR ' | '),
         ''
       ) AS programmes_assignes
     FROM professeurs p
     LEFT JOIN professeur_cours pc
       ON pc.id_professeur = p.id_professeur
     LEFT JOIN cours c
       ON c.id_cours = pc.id_cours
      AND c.archive = 0
     GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom
     ORDER BY p.id_professeur DESC
     LIMIT 4`
  );

  return rows.map((professeur) => ({
    ...professeur,
    programmes_assignes: professeur.programmes_assignes
      ? professeur.programmes_assignes.split(" | ").filter(Boolean)
      : [],
  }));
}

async function recupererGroupesSansHoraire(idSession, executor = pool) {
  if (!Number.isInteger(Number(idSession))) {
    return [];
  }

  const [rows] = await executor.query(
    `SELECT
       ge.id_groupes_etudiants,
       ge.nom_groupe,
       ge.programme,
       ge.etape,
       COUNT(e.id_etudiant) AS effectif
     FROM groupes_etudiants ge
     LEFT JOIN etudiants e
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     WHERE ge.id_session = ?
       AND NOT ${EXISTE_HORAIRE_GROUPE_SQL}
     GROUP BY
       ge.id_groupes_etudiants,
       ge.nom_groupe,
       ge.programme,
       ge.etape
     ORDER BY COUNT(e.id_etudiant) DESC, ge.nom_groupe ASC
     LIMIT 8`,
    [idSession]
  );

  const details = [];

  for (const groupe of rows) {
    const [[coursActifs]] = await executor.query(
      `SELECT COUNT(*) AS total
       FROM cours
       WHERE archive = 0
         AND programme = ?
         AND etape_etude = ?`,
      [groupe.programme, String(groupe.etape)]
    );

    details.push({
      id_groupes_etudiants: Number(groupe.id_groupes_etudiants),
      nom_groupe: groupe.nom_groupe,
      programme: groupe.programme,
      etape: Number(groupe.etape || 0),
      effectif: Number(groupe.effectif || 0),
      cours_actifs: Number(coursActifs.total || 0),
      raison:
        Number(coursActifs.total || 0) === 0
          ? "Aucun cours actif pour cette cohorte."
          : "Groupe actif sans horaire planifie.",
    });
  }

  return details;
}

function construireCasParticuliers({
  compteursGlobaux,
  statistiquesSessionActive,
  groupesSansHoraire,
  dernierRapport,
}) {
  const alertes = [];

  if (compteursGlobaux.nb_etudiants_sans_groupe > 0) {
    alertes.push({
      niveau: "critique",
      titre: "Etudiants sans groupe",
      valeur: compteursGlobaux.nb_etudiants_sans_groupe,
      detail:
        "Ces etudiants ne peuvent pas recevoir un horaire tant qu'ils ne sont pas rattaches a un groupe.",
    });
  }

  if (statistiquesSessionActive.nb_groupes_sans_horaire > 0) {
    alertes.push({
      niveau: groupesSansHoraire.some((groupe) => groupe.cours_actifs === 0)
        ? "attention"
        : "info",
      titre: "Groupes actifs sans horaire",
      valeur: statistiquesSessionActive.nb_groupes_sans_horaire,
      detail: groupesSansHoraire.some((groupe) => groupe.cours_actifs === 0)
        ? "Une partie de ces groupes n'a aucun cours actif dans le catalogue."
        : "Ces groupes doivent etre regenes ou replanifies.",
    });
  }

  if (dernierRapport && dernierRapport.nb_cours_non_planifies > 0) {
    alertes.push({
      niveau: "attention",
      titre: "Cours non planifies au dernier calcul",
      valeur: dernierRapport.nb_cours_non_planifies,
      detail:
        "Le dernier rapport de generation signale encore des elements a resoudre.",
    });
  }

  if (alertes.length === 0) {
    alertes.push({
      niveau: "ok",
      titre: "Aucun blocage majeur",
      valeur: "OK",
      detail:
        "Les indicateurs principaux sont coherents pour les donnees actuellement chargees.",
    });
  }

  return alertes;
}

export default function dashboardRoutes(app) {
  app.get("/api/dashboard/overview", userAuth, async (request, response) => {
    try {
      await assurerSchemaSchedulerAcademique();
      const sessionActive = await recupererSessionActive();
      const [
        compteursGlobaux,
        dernierRapport,
        coursRecents,
        professeursRecents,
        statistiquesSessionActive,
      ] = await Promise.all([
        recupererCompteursGlobaux(),
        recupererDernierRapportGeneration(),
        recupererCoursRecents(),
        recupererProfesseursRecents(),
        recupererStatistiquesSessionActive(sessionActive?.id_session || null),
      ]);
      const groupesSansHoraire = await recupererGroupesSansHoraire(
        sessionActive?.id_session || null
      );
      const nbEtudiantsSansHoraire =
        statistiquesSessionActive.nb_etudiants_session_active -
        statistiquesSessionActive.nb_etudiants_avec_horaire;
      const resumeSessionActive = {
        ...statistiquesSessionActive,
        nb_etudiants_sans_horaire: Math.max(0, nbEtudiantsSansHoraire),
      };
      const casParticuliers = construireCasParticuliers({
        compteursGlobaux,
        statistiquesSessionActive: resumeSessionActive,
        groupesSansHoraire,
        dernierRapport,
      });

      return response.status(200).json({
        session_active: sessionActive,
        compteurs_globaux: compteursGlobaux,
        resume_session_active: resumeSessionActive,
        dernier_rapport: dernierRapport,
        cours_recents: coursRecents,
        professeurs_recents: professeursRecents,
        groupes_sans_horaire: groupesSansHoraire,
        cas_particuliers: casParticuliers,
      });
    } catch (error) {
      console.error("Erreur dashboard:", error);
      return response.status(500).json({
        message: "Erreur lors de la recuperation du tableau de bord.",
      });
    }
  });
}
