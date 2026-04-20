/**
 * MODEL - Gestion des professeurs
 *
 * Ce module gere les professeurs, leurs disponibilites,
 * leurs cours assignes et leur horaire.
 */

import pool from "../../db.js";
import {
  MAX_COURSES_PER_PROGRAM_PER_PROFESSOR,
  MAX_COURSES_PER_PROFESSOR,
  MAX_PROGRAMS_PER_PROFESSOR,
} from "../services/scheduler/AcademicCatalog.js";
import { replanifierSeancesImpacteesParDisponibilites } from "../services/professeurs/availability-rescheduler.js";
import {
  enregistrerJournalReplanificationDisponibilites,
  recupererJournalReplanificationDisponibilites,
} from "../services/professeurs/availability-replanning-journal.js";
import {
  ajouterJours,
  calculerFenetreApplicationDisponibilites,
  calculerFenetreSemaineSession,
  calculerNombreSemainesSession,
  comparerDisponibilitesTemporelles,
  datesSeChevauchent,
  determinerSemaineReferenceSession,
  enrichirDisponibilitePourSession,
  MODE_APPLICATION_DISPONIBILITES,
  normaliserDateIso,
} from "../services/professeurs/availability-temporal.js";

export const TYPES_ABSENCE_PROFESSEUR = [
  "maladie",
  "vacances",
  "formation",
  "autre",
];

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

function normaliserTexteOptionnel(valeur) {
  const texte = String(valeur || "").trim();
  return texte || null;
}

function normaliserTexteIdentite(valeur) {
  return String(valeur || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normaliserStatutJournalReplanification(statut) {
  const valeur = String(statut || "").trim().toLowerCase();

  if (valeur === "aucun-impact") {
    return "AUCUN_IMPACT";
  }

  if (valeur === "partiel") {
    return "PARTIEL";
  }

  if (valeur === "echec") {
    return "ECHEC";
  }

  if (valeur === "succes") {
    return "SUCCES";
  }

  return "AUCUN_IMPACT";
}

function creerCleIdentiteProfesseur(professeur) {
  return [
    normaliserTexteIdentite(professeur?.prenom).toLowerCase(),
    normaliserTexteIdentite(professeur?.nom).toLowerCase(),
  ].join("|");
}

function matriculeEstAuto(matricule) {
  return /^AUTO-/i.test(String(matricule || "").trim());
}

async function mettreAJourAbsencesProfesseur(idSource, idCible, executor = pool) {
  try {
    await executor.query(
      `UPDATE absences_professeurs
       SET id_professeur = ?
       WHERE id_professeur = ?`,
      [idCible, idSource]
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();

    if (
      !message.includes("doesn't exist") &&
      !message.includes("unknown table") &&
      !message.includes("no such table")
    ) {
      throw error;
    }
  }
}

async function assurerTableAbsencesProfesseurs(executor = pool) {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS absences_professeurs (
      id INT NOT NULL AUTO_INCREMENT,
      id_professeur INT NOT NULL,
      date_debut DATE NOT NULL,
      date_fin DATE NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'autre',
      commentaire TEXT NULL,
      approuve_par INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_abs_prof
        FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
        ON DELETE CASCADE,
      CONSTRAINT fk_abs_user
        FOREIGN KEY (approuve_par) REFERENCES utilisateurs (id_utilisateur)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function assurerTableDisponibilites(executor = pool) {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS disponibilites_professeurs (
      id_disponibilite_professeur INT NOT NULL AUTO_INCREMENT,
      id_professeur INT NOT NULL,
      jour_semaine TINYINT NOT NULL,
      heure_debut TIME NOT NULL,
      heure_fin TIME NOT NULL,
      date_debut_effet DATE NOT NULL DEFAULT '2000-01-01',
      date_fin_effet DATE NOT NULL DEFAULT '2099-12-31',
      PRIMARY KEY (id_disponibilite_professeur),
      UNIQUE KEY uniq_disponibilite_professeur (
        id_professeur,
        jour_semaine,
        heure_debut,
        heure_fin,
        date_debut_effet,
        date_fin_effet
      ),
      KEY idx_disponibilite_professeur_effet (
        id_professeur,
        date_debut_effet,
        date_fin_effet,
        jour_semaine
      ),
      CONSTRAINT fk_disponibilite_professeur
        FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
        ON DELETE CASCADE,
      CONSTRAINT chk_disponibilite_jour
        CHECK (jour_semaine BETWEEN 1 AND 7),
      CONSTRAINT chk_disponibilite_heure
        CHECK (heure_debut < heure_fin),
      CONSTRAINT chk_disponibilite_effet
        CHECK (date_debut_effet <= date_fin_effet)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       ADD COLUMN date_debut_effet DATE NULL AFTER heure_fin`
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("duplicate") && !message.includes("exists")) {
      throw error;
    }
  }

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       ADD COLUMN date_fin_effet DATE NULL AFTER date_debut_effet`
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("duplicate") && !message.includes("exists")) {
      throw error;
    }
  }

  await executor.query(
    `UPDATE disponibilites_professeurs
     SET date_debut_effet = COALESCE(date_debut_effet, '2000-01-01'),
         date_fin_effet = COALESCE(date_fin_effet, '2099-12-31')
     WHERE date_debut_effet IS NULL
        OR date_fin_effet IS NULL`
  );

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       MODIFY COLUMN date_debut_effet DATE NOT NULL`
    );
  } catch {
    // La colonne peut deja etre conforme.
  }

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       MODIFY COLUMN date_fin_effet DATE NOT NULL`
    );
  } catch {
    // La colonne peut deja etre conforme.
  }

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       DROP INDEX uniq_disponibilite_professeur`
    );
  } catch {
    // L'index peut etre absent ou deja migre.
  }

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       ADD UNIQUE KEY uniq_disponibilite_professeur (
         id_professeur,
         jour_semaine,
         heure_debut,
         heure_fin,
         date_debut_effet,
         date_fin_effet
       )`
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("duplicate") && !message.includes("exists")) {
      throw error;
    }
  }

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       ADD KEY idx_disponibilite_professeur_effet (
         id_professeur,
         date_debut_effet,
         date_fin_effet,
         jour_semaine
       )`
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("duplicate") && !message.includes("exists")) {
      throw error;
    }
  }

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       DROP CHECK chk_disponibilite_jour`
    );
  } catch {
    // Le check peut etre absent ou deja conforme selon l'etat de la base.
  }

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       ADD CONSTRAINT chk_disponibilite_jour
       CHECK (jour_semaine BETWEEN 1 AND 7)`
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();

    if (!message.includes("duplicate") && !message.includes("exists")) {
      throw error;
    }
  }

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       DROP CHECK chk_disponibilite_effet`
    );
  } catch {
    // Le check peut etre absent ou deja conforme selon l'etat de la base.
  }

  try {
    await executor.query(
      `ALTER TABLE disponibilites_professeurs
       ADD CONSTRAINT chk_disponibilite_effet
       CHECK (date_debut_effet <= date_fin_effet)`
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();

    if (!message.includes("duplicate") && !message.includes("exists")) {
      throw error;
    }
  }
}

export async function assurerTableDisponibilitesProfesseurs(executor = pool) {
  await assurerTableDisponibilites(executor);
}

async function assurerTableProfesseurCours(executor = pool) {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS professeur_cours (
      id_professeur_cours INT NOT NULL AUTO_INCREMENT,
      id_professeur INT NOT NULL,
      id_cours INT NOT NULL,
      PRIMARY KEY (id_professeur_cours),
      UNIQUE KEY uniq_professeur_cours (id_professeur, id_cours),
      CONSTRAINT fk_professeur_cours_professeur
        FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
        ON DELETE CASCADE,
      CONSTRAINT fk_professeur_cours_cours
        FOREIGN KEY (id_cours) REFERENCES cours (id_cours)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

function normaliserCoursIds(coursIds = []) {
  return [...new Set(
    coursIds
      .map((idCours) => Number(idCours))
      .filter((idCours) => Number.isInteger(idCours) && idCours > 0)
  )];
}

async function recupererCoursParIds(coursIds = [], executor = pool) {
  const coursNormalises = normaliserCoursIds(coursIds);

  if (coursNormalises.length === 0) {
    return [];
  }

  const placeholders = coursNormalises.map(() => "?").join(", ");
  const [cours] = await executor.query(
    `SELECT id_cours, code, nom, programme, archive
     FROM cours
     WHERE id_cours IN (${placeholders})`,
    coursNormalises
  );

  const coursParId = new Map(
    cours.map((coursProfesseur) => [
      Number(coursProfesseur.id_cours),
      coursProfesseur,
    ])
  );

  return coursNormalises.map((idCours) => coursParId.get(idCours)).filter(Boolean);
}

export async function validerContrainteCoursProfesseur(coursIds = [], executor = pool) {
  const coursNormalises = normaliserCoursIds(coursIds);

  if (coursNormalises.length === 0) {
    return "";
  }

  const cours = await recupererCoursParIds(coursNormalises, executor);

  if (cours.length !== coursNormalises.length) {
    return "Un ou plusieurs cours sont introuvables.";
  }

  if (cours.some((coursProfesseur) => Number(coursProfesseur.archive || 0) === 1)) {
    return "Impossible d'assigner un cours archive a un professeur.";
  }

  const coursParProgramme = new Map();

  for (const coursProfesseur of cours) {
    const programme = String(coursProfesseur.programme || "").trim();
    coursParProgramme.set(
      programme,
      (coursParProgramme.get(programme) || 0) + 1
    );
  }

  if (coursParProgramme.size > MAX_PROGRAMS_PER_PROFESSOR) {
    return `Un professeur ne peut pas enseigner plus de ${MAX_PROGRAMS_PER_PROFESSOR} programmes.`;
  }

  for (const nombreCours of coursParProgramme.values()) {
    if (nombreCours > MAX_COURSES_PER_PROGRAM_PER_PROFESSOR) {
      return `Un professeur ne peut pas avoir plus de ${MAX_COURSES_PER_PROGRAM_PER_PROFESSOR} cours dans le meme programme.`;
    }
  }

  if (cours.length > MAX_COURSES_PER_PROFESSOR) {
    return `Un professeur ne peut pas avoir plus de ${MAX_COURSES_PER_PROFESSOR} cours assignes.`;
  }

  return "";
}

async function recupererProfesseurParColonne(colonne, valeur) {
  await assurerTableProfesseurCours();

  const [listeProfesseurs] = await pool.query(
    `SELECT p.id_professeur,
            p.matricule,
            p.nom,
            p.prenom,
            p.specialite,
            COALESCE(
              NULLIF(
                GROUP_CONCAT(
                  DISTINCT c.programme
                  ORDER BY c.programme SEPARATOR ', '
                ),
                ''
              ),
              p.specialite,
              ''
            ) AS programmes_assignes,
            COALESCE(GROUP_CONCAT(DISTINCT c.code ORDER BY c.code SEPARATOR ', '), '') AS cours_assignes,
            COALESCE(GROUP_CONCAT(DISTINCT c.id_cours ORDER BY c.code SEPARATOR ','), '') AS cours_ids,
            COUNT(DISTINCT c.id_cours) AS nombre_cours
     FROM professeurs p
     LEFT JOIN professeur_cours pc
       ON pc.id_professeur = p.id_professeur
     LEFT JOIN cours c
       ON c.id_cours = pc.id_cours
      AND COALESCE(c.archive, 0) = 0
     WHERE p.${colonne} = ?
     GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
     LIMIT 1`,
    [valeur]
  );

  return listeProfesseurs[0] || null;
}

export async function recupererTousLesProfesseurs() {
  await assurerTableProfesseurCours();

  const [listeProfesseurs] = await pool.query(
    `SELECT p.id_professeur,
            p.matricule,
            p.nom,
            p.prenom,
            p.specialite,
            COALESCE(
              NULLIF(
                GROUP_CONCAT(
                  DISTINCT c.programme
                  ORDER BY c.programme SEPARATOR ', '
                ),
                ''
              ),
              p.specialite,
              ''
            ) AS programmes_assignes,
            COALESCE(GROUP_CONCAT(DISTINCT c.code ORDER BY c.code SEPARATOR ', '), '') AS cours_assignes,
            COALESCE(GROUP_CONCAT(DISTINCT c.id_cours ORDER BY c.code SEPARATOR ','), '') AS cours_ids,
            COUNT(DISTINCT c.id_cours) AS nombre_cours
     FROM professeurs p
     LEFT JOIN professeur_cours pc
       ON pc.id_professeur = p.id_professeur
     LEFT JOIN cours c
       ON c.id_cours = pc.id_cours
      AND COALESCE(c.archive, 0) = 0
     GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
     ORDER BY p.matricule ASC`
  );

  return listeProfesseurs;
}

export async function recupererProfesseurParId(idProfesseur) {
  return recupererProfesseurParColonne("id_professeur", idProfesseur);
}

export async function recupererProfesseurParMatricule(matriculeProfesseur) {
  return recupererProfesseurParColonne("matricule", matriculeProfesseur);
}

export async function recupererProfesseurParNomPrenom(nomProfesseur, prenomProfesseur) {
  await assurerTableProfesseurCours();

  const nomNormalise = normaliserTexteIdentite(nomProfesseur);
  const prenomNormalise = normaliserTexteIdentite(prenomProfesseur);

  if (!nomNormalise || !prenomNormalise) {
    return null;
  }

  const [listeProfesseurs] = await pool.query(
    `SELECT p.id_professeur,
            p.matricule,
            p.nom,
            p.prenom,
            p.specialite,
            COALESCE(
              NULLIF(
                GROUP_CONCAT(
                  DISTINCT c.programme
                  ORDER BY c.programme SEPARATOR ', '
                ),
                ''
              ),
              p.specialite,
              ''
            ) AS programmes_assignes,
            COALESCE(GROUP_CONCAT(DISTINCT c.code ORDER BY c.code SEPARATOR ', '), '') AS cours_assignes,
            COALESCE(GROUP_CONCAT(DISTINCT c.id_cours ORDER BY c.code SEPARATOR ','), '') AS cours_ids,
            COUNT(DISTINCT c.id_cours) AS nombre_cours
     FROM professeurs p
     LEFT JOIN professeur_cours pc
       ON pc.id_professeur = p.id_professeur
     LEFT JOIN cours c
       ON c.id_cours = pc.id_cours
      AND COALESCE(c.archive, 0) = 0
     WHERE LOWER(TRIM(p.nom)) = LOWER(TRIM(?))
       AND LOWER(TRIM(p.prenom)) = LOWER(TRIM(?))
     GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
     ORDER BY p.id_professeur ASC
     LIMIT 1`,
    [nomNormalise, prenomNormalise]
  );

  return listeProfesseurs[0] || null;
}

export async function recupererCoursProfesseur(idProfesseur) {
  await assurerTableProfesseurCours();

  const [cours] = await pool.query(
    `SELECT c.id_cours,
            c.code,
            c.nom,
            c.programme,
            c.etape_etude
     FROM professeur_cours pc
     JOIN cours c
       ON c.id_cours = pc.id_cours
      AND COALESCE(c.archive, 0) = 0
     WHERE pc.id_professeur = ?
     ORDER BY c.code ASC`,
    [idProfesseur]
  );

  return cours;
}

export async function recupererIndexCoursProfesseurs(executor = pool) {
  await assurerTableProfesseurCours(executor);

  const [liens] = await executor.query(
    `SELECT pc.id_professeur, pc.id_cours
     FROM professeur_cours pc
     INNER JOIN cours c
       ON c.id_cours = pc.id_cours
      AND COALESCE(c.archive, 0) = 0
     ORDER BY pc.id_professeur ASC, pc.id_cours ASC`
  );

  const coursParProfesseur = new Map();

  liens.forEach((lien) => {
    const coursActuels = coursParProfesseur.get(lien.id_professeur) || new Set();
    coursActuels.add(Number(lien.id_cours));
    coursParProfesseur.set(lien.id_professeur, coursActuels);
  });

  return coursParProfesseur;
}

export async function assurerUniciteNomPrenomProfesseurs(executor = pool) {
  try {
    await executor.query(
      `ALTER TABLE professeurs
       ADD UNIQUE KEY uniq_professeur_nom_prenom (nom, prenom)`
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();

    if (!message.includes("duplicate") && !message.includes("already exists")) {
      throw error;
    }
  }
}

export async function nettoyerAffectationsCoursArchivesProfesseurs(executor = pool) {
  await assurerTableProfesseurCours(executor);

  const [resultatSuppression] = await executor.query(
    `DELETE pc
     FROM professeur_cours pc
     INNER JOIN cours c
       ON c.id_cours = pc.id_cours
     WHERE COALESCE(c.archive, 0) = 1`
  );

  return Number(resultatSuppression.affectedRows || 0);
}

async function recupererSessionActive(executor = pool) {
  const [sessions] = await executor.query(
    `SELECT id_session, nom, date_debut, date_fin
     FROM sessions
     WHERE active = TRUE
     ORDER BY id_session DESC
     LIMIT 1`
  );

  return sessions[0] || null;
}

function normaliserDisponibilitesTemporelles(
  disponibilites = [],
  sessionActive = null
) {
  const lignes = sessionActive
    ? disponibilites
        .filter((disponibilite) =>
          datesSeChevauchent(
            disponibilite.date_debut_effet,
            disponibilite.date_fin_effet,
            sessionActive.date_debut,
            sessionActive.date_fin
          )
        )
        .map((disponibilite) =>
          enrichirDisponibilitePourSession(disponibilite, sessionActive)
        )
    : disponibilites.map((disponibilite) => ({
        ...disponibilite,
        date_debut_effet:
          normaliserDateIso(disponibilite.date_debut_effet) || "2000-01-01",
        date_fin_effet:
          normaliserDateIso(disponibilite.date_fin_effet) || "2099-12-31",
      }));

  return lignes.sort(comparerDisponibilitesTemporelles);
}

async function listerDisponibilitesProfesseurAvecExecutor(
  executor,
  idProfesseur,
  options = {}
) {
  const conditions = ["id_professeur = ?"];
  const parametres = [idProfesseur];

  if (options.date_debut_max) {
    conditions.push("date_fin_effet >= ?");
    parametres.push(normaliserDateIso(options.date_debut_max));
  }

  if (options.date_fin_min) {
    conditions.push("date_debut_effet <= ?");
    parametres.push(normaliserDateIso(options.date_fin_min));
  }

  const [disponibilites] = await executor.query(
    `SELECT id_disponibilite_professeur,
            id_professeur,
            jour_semaine,
            heure_debut,
            heure_fin,
            DATE_FORMAT(date_debut_effet, '%Y-%m-%d') AS date_debut_effet,
            DATE_FORMAT(date_fin_effet, '%Y-%m-%d') AS date_fin_effet
     FROM disponibilites_professeurs
     WHERE ${conditions.join(" AND ")}
     ORDER BY date_debut_effet ASC,
              date_fin_effet ASC,
              jour_semaine ASC,
              heure_debut ASC`,
    parametres
  );

  return disponibilites;
}

function construireContexteDisponibilitesProfesseur(
  disponibilites = [],
  sessionActive = null,
  semaineCible = null
) {
  if (!sessionActive) {
    return normaliserDisponibilitesTemporelles(disponibilites, null);
  }

  const fenetreSemaine = calculerFenetreSemaineSession(
    sessionActive,
    semaineCible
  );
  const timeline = normaliserDisponibilitesTemporelles(
    disponibilites,
    sessionActive
  );
  const disponibilitesEffectives = timeline.filter((disponibilite) =>
    datesSeChevauchent(
      disponibilite.date_debut_effet,
      disponibilite.date_fin_effet,
      fenetreSemaine.date_debut,
      fenetreSemaine.date_fin
    )
  );

  return {
    disponibilites: disponibilitesEffectives,
    session_active: {
      ...sessionActive,
      nombre_semaines: calculerNombreSemainesSession(sessionActive),
    },
    semaine_reference: fenetreSemaine,
    variations: timeline,
  };
}

export async function recupererDisponibilitesProfesseur(
  idProfesseur,
  options = {}
) {
  await assurerTableDisponibilites();

  const sessionActive = await recupererSessionActive();
  const disponibilites = await listerDisponibilitesProfesseurAvecExecutor(
    pool,
    idProfesseur,
    sessionActive
      ? {
          date_debut_max: sessionActive.date_debut,
          date_fin_min: sessionActive.date_fin,
        }
      : {}
  );

  if (options.format === "detail" || options.semaine_cible !== undefined) {
    return construireContexteDisponibilitesProfesseur(
      disponibilites,
      sessionActive,
      options.semaine_cible
    );
  }

  return normaliserDisponibilitesTemporelles(disponibilites, sessionActive);
}

async function recupererDisponibilitesProfesseurAvecExecutor(
  executor,
  idProfesseur,
  options = {}
) {
  const sessionActive =
    options.session_active === undefined
      ? await recupererSessionActive(executor)
      : options.session_active;
  const disponibilites = await listerDisponibilitesProfesseurAvecExecutor(
    executor,
    idProfesseur,
    sessionActive
      ? {
          date_debut_max: sessionActive.date_debut,
          date_fin_min: sessionActive.date_fin,
        }
      : {}
  );

  if (options.format === "detail" || options.semaine_cible !== undefined) {
    return construireContexteDisponibilitesProfesseur(
      disponibilites,
      sessionActive,
      options.semaine_cible
    );
  }

  return normaliserDisponibilitesTemporelles(disponibilites, sessionActive);
}

export async function recupererDisponibilitesProfesseurs(executor = pool) {
  await assurerTableDisponibilites(executor);

  const [disponibilites] = await executor.query(
    `SELECT id_professeur,
            jour_semaine,
            heure_debut,
            heure_fin,
            DATE_FORMAT(date_debut_effet, '%Y-%m-%d') AS date_debut_effet,
            DATE_FORMAT(date_fin_effet, '%Y-%m-%d') AS date_fin_effet
     FROM disponibilites_professeurs
     ORDER BY id_professeur ASC,
              date_debut_effet ASC,
              date_fin_effet ASC,
              jour_semaine ASC,
              heure_debut ASC`
  );

  const disponibilitesParProfesseur = new Map();

  disponibilites.forEach((disponibilite) => {
    const disponibilitesActuelles =
      disponibilitesParProfesseur.get(disponibilite.id_professeur) || [];
    disponibilitesActuelles.push(disponibilite);
    disponibilitesParProfesseur.set(
      disponibilite.id_professeur,
      disponibilitesActuelles
    );
  });

  return disponibilitesParProfesseur;
}

export async function recupererJournalDisponibilitesProfesseur(
  idProfesseur,
  options = {},
  executor = pool
) {
  return recupererJournalReplanificationDisponibilites(
    executor,
    idProfesseur,
    options
  );
}

export async function recupererAbsencesProfesseur(idProfesseur) {
  await assurerTableAbsencesProfesseurs();

  const [rows] = await pool.query(
    `SELECT id,
            id_professeur,
            DATE_FORMAT(date_debut, '%Y-%m-%d') AS date_debut,
            DATE_FORMAT(date_fin, '%Y-%m-%d') AS date_fin,
            type AS type_absence,
            commentaire,
            approuve_par,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM absences_professeurs
     WHERE id_professeur = ?
     ORDER BY date_debut ASC, date_fin ASC, id ASC`,
    [Number(idProfesseur)]
  );

  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    id_professeur: Number(row.id_professeur),
    approuve_par: Number(row.approuve_par) || null,
  }));
}

async function insererDisponibilitesProfesseurDansFenetre(
  executor,
  idProfesseur,
  disponibilites,
  dateDebutEffet,
  dateFinEffet
) {
  const clesVues = new Set();

  for (const disponibilite of disponibilites) {
    const cle = [
      Number(idProfesseur),
      Number(disponibilite.jour_semaine),
      normaliserHeure(disponibilite.heure_debut),
      normaliserHeure(disponibilite.heure_fin),
      normaliserDateIso(dateDebutEffet),
      normaliserDateIso(dateFinEffet),
    ].join("|");

    if (clesVues.has(cle)) {
      continue;
    }

    clesVues.add(cle);

    await executor.query(
      `INSERT INTO disponibilites_professeurs (
        id_professeur,
        jour_semaine,
        heure_debut,
        heure_fin,
        date_debut_effet,
        date_fin_effet
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        idProfesseur,
        Number(disponibilite.jour_semaine),
        normaliserHeure(disponibilite.heure_debut),
        normaliserHeure(disponibilite.heure_fin),
        normaliserDateIso(dateDebutEffet),
        normaliserDateIso(dateFinEffet),
      ]
    );
  }
}

export async function remplacerDisponibilitesProfesseur(
  idProfesseur,
  disponibilites,
  options = {}
) {
  const connection = await pool.getConnection();
  const disponibilitesNormalisees = disponibilites.map((disponibilite) => ({
    jour_semaine: Number(disponibilite.jour_semaine),
    heure_debut: normaliserHeure(disponibilite.heure_debut),
    heure_fin: normaliserHeure(disponibilite.heure_fin),
  }));
  let disponibilitesAvant = [];
  let disponibilitesApres = [];

  try {
    await connection.beginTransaction();
    await assurerTableDisponibilites(connection);
    const sessionActive = await recupererSessionActive(connection);

    if (!sessionActive) {
      const erreur = new Error(
        "Aucune session active n'est disponible pour appliquer des disponibilites datees."
      );
      erreur.statusCode = 400;
      throw erreur;
    }

    const fenetreApplication = calculerFenetreApplicationDisponibilites(
      sessionActive,
      options
    );
    const modeApplication = String(fenetreApplication.mode_application || "");

    if (
      !fenetreApplication.date_debut_effet ||
      !fenetreApplication.date_fin_effet
    ) {
      const erreur = new Error(
        "La portee temporelle de la disponibilite est incomplete."
      );
      erreur.statusCode = 400;
      throw erreur;
    }

    if (
      String(fenetreApplication.date_debut_effet).localeCompare(
        String(fenetreApplication.date_fin_effet),
        "fr"
      ) > 0
    ) {
      const erreur = new Error(
        "La date de fin doit etre posterieure ou egale a la date de debut."
      );
      erreur.statusCode = 400;
      throw erreur;
    }

    if (
      modeApplication !== MODE_APPLICATION_DISPONIBILITES.PERMANENTE &&
      !datesSeChevauchent(
        fenetreApplication.date_debut_effet,
        fenetreApplication.date_fin_effet,
        sessionActive.date_debut,
        sessionActive.date_fin
      )
    ) {
      const erreur = new Error(
        "La portee choisie ne chevauche pas la session active. Aucune replanification academique ne pourrait etre appliquee."
      );
      erreur.statusCode = 400;
      throw erreur;
    }

    const semaineReference =
      Number(fenetreApplication.numero_semaine) ||
      determinerSemaineReferenceSession(sessionActive, options.semaine_cible);

    disponibilitesAvant = await recupererDisponibilitesProfesseurAvecExecutor(
      connection,
      idProfesseur,
      {
        format: "detail",
        semaine_cible: semaineReference,
        session_active: sessionActive,
      }
    );
    const disponibilitesChevauchantes =
      await listerDisponibilitesProfesseurAvecExecutor(connection, idProfesseur, {
        date_debut_max: fenetreApplication.date_debut_effet,
        date_fin_min: fenetreApplication.date_fin_effet,
      });

    await connection.query(
      `DELETE FROM disponibilites_professeurs
       WHERE id_professeur = ?
         AND date_fin_effet >= ?
         AND date_debut_effet <= ?`,
      [
        idProfesseur,
        fenetreApplication.date_debut_effet,
        fenetreApplication.date_fin_effet,
      ]
    );

    for (const disponibilite of disponibilitesChevauchantes) {
      if (
        normaliserDateIso(disponibilite.date_debut_effet) <
        fenetreApplication.date_debut_effet
      ) {
        await insererDisponibilitesProfesseurDansFenetre(
          connection,
          idProfesseur,
          [disponibilite],
          disponibilite.date_debut_effet,
          ajouterJours(fenetreApplication.date_debut_effet, -1)
        );
      }

      if (
        normaliserDateIso(disponibilite.date_fin_effet) >
        fenetreApplication.date_fin_effet
      ) {
        await insererDisponibilitesProfesseurDansFenetre(
          connection,
          idProfesseur,
          [disponibilite],
          ajouterJours(fenetreApplication.date_fin_effet, 1),
          disponibilite.date_fin_effet
        );
      }
    }

    await insererDisponibilitesProfesseurDansFenetre(
      connection,
      idProfesseur,
      disponibilitesNormalisees,
      fenetreApplication.date_debut_effet,
      fenetreApplication.date_fin_effet
    );

    disponibilitesApres = await recupererDisponibilitesProfesseurAvecExecutor(
      connection,
      idProfesseur,
      {
        format: "detail",
        semaine_cible: semaineReference,
        session_active: sessionActive,
      }
    );

    const disponibilitesSession = await recupererDisponibilitesProfesseurAvecExecutor(
      connection,
      idProfesseur,
      {
        session_active: sessionActive,
      }
    );

    const replanification =
      await replanifierSeancesImpacteesParDisponibilites(
        idProfesseur,
        disponibilitesSession,
        connection,
        {
          dateDebutImpact: fenetreApplication.date_debut_impact,
          dateFinImpact: fenetreApplication.date_fin_impact,
          modeApplication: fenetreApplication.mode_application,
        }
      );

    await enregistrerJournalReplanificationDisponibilites(connection, {
      id_professeur: idProfesseur,
      statut: normaliserStatutJournalReplanification(replanification?.statut),
      disponibilites_avant: disponibilitesAvant,
      disponibilites_apres: disponibilitesApres,
      replanification: {
        ...replanification,
        fenetre_application: fenetreApplication,
      },
      details:
        replanification?.seances_deplacees?.length > 0
          ? replanification.seances_deplacees
          : [],
    });

    await connection.commit();

    return {
      ...await recupererDisponibilitesProfesseur(idProfesseur, {
        format: "detail",
        semaine_cible: semaineReference,
      }),
      replanification,
      synchronisation: {
        id_professeur: Number(idProfesseur),
        professeurs_impactes: replanification?.professeurs_impactes || [
          Number(idProfesseur),
        ],
        groupes_impactes: replanification?.groupes_impactes || [],
        salles_impactees: replanification?.salles_impactees || [],
        etudiants_impactes: (replanification?.etudiants_impactes || []).map(
          (etudiant) => Number(etudiant?.id_etudiant)
        ),
        etudiants_reprises_impactes: (
          replanification?.etudiants_reprises_impactes || []
        ).map((etudiant) => Number(etudiant?.id_etudiant)),
        horodatage: new Date().toISOString(),
      },
    };
  } catch (error) {
    await connection.rollback();

    try {
      await enregistrerJournalReplanificationDisponibilites(pool, {
        id_professeur: idProfesseur,
        statut: "ECHEC",
        disponibilites_avant: disponibilitesAvant,
        disponibilites_apres: disponibilitesApres,
        replanification: error?.replanification || null,
        details: Array.isArray(error?.details) ? error.details : [],
      });
    } catch {
      // Le journal ne doit jamais masquer l'erreur metier principale.
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function remplacerAbsencesProfesseur(idProfesseur, absences = []) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await assurerTableAbsencesProfesseurs(connection);

    await connection.query(
      `DELETE FROM absences_professeurs
       WHERE id_professeur = ?`,
      [Number(idProfesseur)]
    );

    for (const absence of Array.isArray(absences) ? absences : []) {
      const typeAbsence =
        String(absence?.type_absence || "").trim().toLowerCase() || "autre";
      const typeNormalise = TYPES_ABSENCE_PROFESSEUR.includes(typeAbsence)
        ? typeAbsence
        : "autre";

      await connection.query(
        `INSERT INTO absences_professeurs (
           id_professeur,
           date_debut,
           date_fin,
           type,
           commentaire
         )
         VALUES (?, ?, ?, ?, ?)`,
        [
          Number(idProfesseur),
          String(absence?.date_debut || "").trim(),
          String(absence?.date_fin || "").trim(),
          typeNormalise,
          normaliserTexteOptionnel(absence?.commentaire),
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return recupererAbsencesProfesseur(idProfesseur);
}

export async function remplacerCoursProfesseur(idProfesseur, coursIds) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await assurerTableProfesseurCours(connection);

    await connection.query(
      `DELETE FROM professeur_cours
       WHERE id_professeur = ?`,
      [idProfesseur]
    );

    const coursNormalises = normaliserCoursIds(coursIds);

    for (const idCours of coursNormalises) {
      await connection.query(
        `INSERT INTO professeur_cours (id_professeur, id_cours)
         VALUES (?, ?)`,
        [idProfesseur, idCours]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return recupererCoursProfesseur(idProfesseur);
}

export async function ajouterProfesseur(nouveauProfesseur) {
  const { matricule, nom, prenom, specialite, cours_ids = [] } = nouveauProfesseur;
  const matriculeNormalise = String(matricule || "").trim();
  const nomNormalise = normaliserTexteIdentite(nom);
  const prenomNormalise = normaliserTexteIdentite(prenom);

  const [resultatInsertion] = await pool.query(
    `INSERT INTO professeurs (matricule, nom, prenom, specialite)
     VALUES (?, ?, ?, ?)`,
    [
      matriculeNormalise,
      nomNormalise,
      prenomNormalise,
      normaliserTexteOptionnel(specialite),
    ]
  );

  const professeurAjoute = await recupererProfesseurParId(resultatInsertion.insertId);

  if (cours_ids !== undefined) {
    await remplacerCoursProfesseur(resultatInsertion.insertId, cours_ids);
  }

  return recupererProfesseurParId(professeurAjoute.id_professeur);
}

export async function modifierProfesseur(idProfesseur, donneesModification) {
  const champsAModifier = [];
  const valeurs = [];

  if (donneesModification.matricule !== undefined) {
    champsAModifier.push("matricule = ?");
    valeurs.push(String(donneesModification.matricule || "").trim());
  }

  if (donneesModification.nom !== undefined) {
    champsAModifier.push("nom = ?");
    valeurs.push(normaliserTexteIdentite(donneesModification.nom));
  }

  if (donneesModification.prenom !== undefined) {
    champsAModifier.push("prenom = ?");
    valeurs.push(normaliserTexteIdentite(donneesModification.prenom));
  }

  if (donneesModification.specialite !== undefined) {
    champsAModifier.push("specialite = ?");
    valeurs.push(normaliserTexteOptionnel(donneesModification.specialite));
  }

  if (champsAModifier.length > 0) {
    valeurs.push(idProfesseur);

    const [resultatModification] = await pool.query(
      `UPDATE professeurs
       SET ${champsAModifier.join(", ")}
       WHERE id_professeur = ?
       LIMIT 1`,
      valeurs
    );

    if (resultatModification.affectedRows === 0) {
      return null;
    }
  }

  if (donneesModification.cours_ids !== undefined) {
    await remplacerCoursProfesseur(idProfesseur, donneesModification.cours_ids);
  }

  return recupererProfesseurParId(idProfesseur);
}

export async function fusionnerDoublonsProfesseurs(executor = pool) {
  await assurerTableDisponibilites(executor);
  await assurerTableProfesseurCours(executor);

  const [professeurs] = await executor.query(
    `SELECT p.id_professeur,
            p.matricule,
            p.nom,
            p.prenom,
            p.specialite,
            COUNT(DISTINCT ac.id_affectation_cours) AS nombre_affectations,
            COUNT(DISTINCT pc.id_cours) AS nombre_cours
     FROM professeurs p
     LEFT JOIN affectation_cours ac
       ON ac.id_professeur = p.id_professeur
     LEFT JOIN professeur_cours pc
       ON pc.id_professeur = p.id_professeur
     GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
     ORDER BY p.id_professeur ASC`
  );

  const professeursParCle = new Map();

  for (const professeur of professeurs) {
    const cle = creerCleIdentiteProfesseur(professeur);

    if (!cle || cle === "|") {
      continue;
    }

    const groupe = professeursParCle.get(cle) || [];
    groupe.push(professeur);
    professeursParCle.set(cle, groupe);
  }

  const fusion = {
    groupesFusionnes: 0,
    professeursFusionnes: 0,
    details: [],
  };

  for (const groupe of professeursParCle.values()) {
    if (groupe.length <= 1) {
      continue;
    }

    const [professeurConserve, ...doublons] = [...groupe].sort((professeurA, professeurB) => {
      const autoA = matriculeEstAuto(professeurA.matricule) ? 1 : 0;
      const autoB = matriculeEstAuto(professeurB.matricule) ? 1 : 0;

      if (autoA !== autoB) {
        return autoA - autoB;
      }

      if (
        Number(professeurA.nombre_affectations || 0) !==
        Number(professeurB.nombre_affectations || 0)
      ) {
        return (
          Number(professeurB.nombre_affectations || 0) -
          Number(professeurA.nombre_affectations || 0)
        );
      }

      if (Number(professeurA.nombre_cours || 0) !== Number(professeurB.nombre_cours || 0)) {
        return Number(professeurB.nombre_cours || 0) - Number(professeurA.nombre_cours || 0);
      }

      return Number(professeurA.id_professeur) - Number(professeurB.id_professeur);
    });

    for (const doublon of doublons) {
      await executor.query(
        `INSERT IGNORE INTO professeur_cours (id_professeur, id_cours)
         SELECT ?, id_cours
         FROM professeur_cours
         WHERE id_professeur = ?`,
        [professeurConserve.id_professeur, doublon.id_professeur]
      );

      await executor.query(
        `INSERT IGNORE INTO disponibilites_professeurs (
           id_professeur,
           jour_semaine,
           heure_debut,
           heure_fin,
           date_debut_effet,
           date_fin_effet
         )
         SELECT ?, jour_semaine, heure_debut, heure_fin, date_debut_effet, date_fin_effet
         FROM disponibilites_professeurs
         WHERE id_professeur = ?`,
        [professeurConserve.id_professeur, doublon.id_professeur]
      );

      await executor.query(
        `UPDATE affectation_cours
         SET id_professeur = ?
         WHERE id_professeur = ?`,
        [professeurConserve.id_professeur, doublon.id_professeur]
      );

      await mettreAJourAbsencesProfesseur(
        doublon.id_professeur,
        professeurConserve.id_professeur,
        executor
      );

      if (!professeurConserve.specialite && doublon.specialite) {
        await executor.query(
          `UPDATE professeurs
           SET specialite = ?
           WHERE id_professeur = ?`,
          [doublon.specialite, professeurConserve.id_professeur]
        );
        professeurConserve.specialite = doublon.specialite;
      }

      await executor.query(
        `DELETE FROM disponibilites_professeurs
         WHERE id_professeur = ?`,
        [doublon.id_professeur]
      );
      await executor.query(
        `DELETE FROM professeur_cours
         WHERE id_professeur = ?`,
        [doublon.id_professeur]
      );
      await executor.query(
        `DELETE FROM professeurs
         WHERE id_professeur = ?
         LIMIT 1`,
        [doublon.id_professeur]
      );

      fusion.professeursFusionnes += 1;
    }

    fusion.groupesFusionnes += 1;
    fusion.details.push(
      `${professeurConserve.prenom} ${professeurConserve.nom} conserve (${groupe.length - 1} doublon(s) fusionne(s)).`
    );
  }

  return fusion;
}

export async function professeurEstDejaAffecte(idProfesseur) {
  const [affectations] = await pool.query(
    `SELECT 1
     FROM affectation_cours
     WHERE id_professeur = ?
     LIMIT 1`,
    [idProfesseur]
  );

  return affectations.length > 0;
}

export async function supprimerProfesseur(idProfesseur) {
  await assurerTableDisponibilites();
  await assurerTableProfesseurCours();

  await pool.query(
    `DELETE FROM disponibilites_professeurs
     WHERE id_professeur = ?`,
    [idProfesseur]
  );
  await pool.query(
    `DELETE FROM professeur_cours
     WHERE id_professeur = ?`,
    [idProfesseur]
  );

  const [resultatSuppression] = await pool.query(
    `DELETE FROM professeurs
     WHERE id_professeur = ?
     LIMIT 1`,
    [idProfesseur]
  );

  return resultatSuppression.affectedRows > 0;
}

export async function recupererHoraireProfesseur(idProfesseur) {
  const [horaireProfesseur] = await pool.query(
    `SELECT
        ac.id_affectation_cours,
        c.id_cours,
        c.code AS code_cours,
        c.nom AS nom_cours,
        c.programme,
        c.etape_etude,
        c.duree,
        s.id_salle,
        s.code AS code_salle,
        s.type AS type_salle,
        ph.id_plage_horaires,
        DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
        ph.heure_debut,
        ph.heure_fin,
        COALESCE(
          GROUP_CONCAT(DISTINCT ge.nom_groupe ORDER BY ge.nom_groupe SEPARATOR ', '),
          ''
        ) AS groupes
     FROM affectation_cours ac
     JOIN cours c
       ON c.id_cours = ac.id_cours
     LEFT JOIN salles s
       ON s.id_salle = ac.id_salle
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     JOIN affectation_groupes ag
       ON ag.id_affectation_cours = ac.id_affectation_cours
     JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     WHERE ac.id_professeur = ?
       AND ge.id_session = (
         SELECT id_session
         FROM sessions
         WHERE active = TRUE
         ORDER BY id_session DESC
         LIMIT 1
       )
     GROUP BY ac.id_affectation_cours,
              c.id_cours,
              c.code,
              c.nom,
              c.programme,
              c.etape_etude,
              c.duree,
              s.id_salle,
              s.code,
              s.type,
              ph.id_plage_horaires,
              ph.date,
              ph.heure_debut,
              ph.heure_fin
     ORDER BY ph.date ASC, ph.heure_debut ASC`,
    [idProfesseur]
  );

  return horaireProfesseur;
}
