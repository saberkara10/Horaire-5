import pool from "../../../db.js";
import { assurerProgrammeReference } from "../../model/programmes.model.js";
import {
  assurerUniciteNomPrenomProfesseurs,
  fusionnerDoublonsProfesseurs,
  nettoyerAffectationsCoursArchivesProfesseurs,
} from "../../model/professeurs.model.js";
import {
  calculerTaillesGroupesEquilibres,
  determinerCapaciteMaximaleGroupeCohorte,
} from "../../utils/groupes.js";
import { devinerNomSession, normaliserNomSession } from "../../utils/sessions.js";
import {
  ACADEMIC_COURSE_CODES,
  ACADEMIC_PROGRAM_NAMES,
  ACADEMIC_ROOM_CATALOG,
  ACADEMIC_PROGRAM_CATALOG,
  MAX_COURSES_PER_PROFESSOR,
  MAX_COURSES_PER_PROGRAM_PER_PROFESSOR,
  MAX_PROGRAMS_PER_PROFESSOR,
  MAX_WEEKLY_SESSIONS_PER_PROFESSOR,
  SESSION_DURATION_MONTHS,
  TARGET_GROUPS_PER_PROGRAM,
  TARGET_GROUP_SIZE,
  buildAcademicCourses,
  buildAcademicProfessors,
  buildAcademicTargetKey,
  createProfessorAvailabilityRows,
  getAcademicBootstrapTargets,
  normalizeAcademicText,
} from "./AcademicCatalog.js";

const ACADEMIC_COURSES = buildAcademicCourses();
const ACADEMIC_TARGETS = getAcademicBootstrapTargets();

const FIRST_NAMES = [
  "Adam",
  "Aya",
  "Bilal",
  "Camille",
  "Emma",
  "Farah",
  "Hamza",
  "Ines",
  "Jade",
  "Karim",
  "Lina",
  "Mia",
  "Nora",
  "Omar",
  "Rayan",
  "Sara",
  "Yasmine",
  "Zoe",
];

const LAST_NAMES = [
  "Ahmed",
  "Ali",
  "Benali",
  "Bouchard",
  "Chen",
  "Cote",
  "Gagnon",
  "Garcia",
  "Lefebvre",
  "Liu",
  "Morin",
  "Nguyen",
  "Parent",
  "Park",
  "Roy",
  "Simard",
  "Traore",
  "Yilmaz",
];

function addMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
  return nextDate;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function deriveSessionMetadata(session) {
  const startDate = session?.date_debut ? new Date(session.date_debut) : null;
  const saison =
    normaliserNomSession(session?.nom) ||
    devinerNomSession(session?.nom, startDate) ||
    devinerNomSession("", startDate) ||
    "Automne";
  const annee =
    startDate && !Number.isNaN(startDate.getTime())
      ? startDate.getUTCFullYear()
      : 2026;

  return { saison, annee };
}

function buildStudentMatricule(programme, index) {
  const code = normalizeAcademicText(programme)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((token) => token[0])
    .join("")
    .toUpperCase() || "GEN";

  return `AUTO-${code}-${String(index).padStart(4, "0")}`;
}

function uniqueBy(items, getKey) {
  const map = new Map();

  for (const item of items) {
    const key = getKey(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

function buildProfessorIdentityKey(professeur) {
  return [
    normalizeAcademicText(professeur?.prenom),
    normalizeAcademicText(professeur?.nom),
  ].join("|");
}

function parseJson(value, fallback = {}) {
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

function filtrerEtudiantsSessionParProgramme(etudiants, sessionMetadata, programme, etape) {
  return etudiants.filter(
    (etudiant) =>
      normalizeAcademicText(etudiant.programme) ===
        normalizeAcademicText(programme) &&
      String(Number(etudiant.etape)) === String(Number(etape)) &&
      normaliserNomSession(etudiant.session) === sessionMetadata.saison
  );
}

export class SchedulerDataBootstrap {
  static async ensureOperationalDataset(options = {}) {
    const { executor = pool, session = null } = options;

    const report = {
      created: {
        sessions: 0,
        programmes_reference: 0,
        salles: 0,
        cours: 0,
        professeurs: 0,
        professeur_cours: 0,
        disponibilites: 0,
        groupes_sources: 0,
        etudiants: 0,
      },
      updated: {
        sessions: 0,
        salles: 0,
        cours: 0,
        professeurs: 0,
      },
      cleaned: {
        professeurs: 0,
        professeur_cours: 0,
        programmes_reference: 0,
        cours_archives: 0,
      },
      details: [],
    };

    const activeSession =
      session || (await SchedulerDataBootstrap._ensureSession(executor, report));
    const sessionMetadata = deriveSessionMetadata(activeSession);

    await SchedulerDataBootstrap._ensureProfessorCourseTable(executor);
    await SchedulerDataBootstrap._ensureProfessorAvailabilityTable(executor);
    await SchedulerDataBootstrap._ensureProgramReferences(executor, report);
    await SchedulerDataBootstrap._ensureRooms(executor, report);

    let salles = await SchedulerDataBootstrap._loadSalles(executor);
    await SchedulerDataBootstrap._ensureCourses(executor, salles, report);
    salles = await SchedulerDataBootstrap._loadSalles(executor);
    const etudiantsAvantBootstrap =
      await SchedulerDataBootstrap._loadEtudiants(executor);
    const groupesAvantBootstrap = await SchedulerDataBootstrap._loadGroupes(executor);
    const autoriserInjectionEtudiantsBootstrap =
      SchedulerDataBootstrap._peutInjecterEtudiantsBootstrap(
        etudiantsAvantBootstrap
      );
    const requiredGroupsByProgram =
      SchedulerDataBootstrap._buildRequiredGroupsByProgram(
        etudiantsAvantBootstrap,
        groupesAvantBootstrap,
        salles,
        sessionMetadata,
        activeSession,
        {
          useAcademicTargets: autoriserInjectionEtudiantsBootstrap,
        }
      );

    if (!autoriserInjectionEtudiantsBootstrap) {
      report.details.push(
        [
          "Jeu d'etudiants existant detecte:",
          "l'injection automatique des etudiants bootstrap est desactivee",
          "et le dimensionnement suit les donnees reelles.",
        ].join(" ")
      );
    }

    await SchedulerDataBootstrap._mergeDuplicateProfesseurs(executor, report);
    const professeursExistantsAvantBootstrap =
      await SchedulerDataBootstrap._loadProfesseurs(executor);
    const reserveCourseDemands =
      await SchedulerDataBootstrap._loadReserveCourseDemands(
        executor,
        activeSession
      );
    const academicProfessors = buildAcademicProfessors({
      requiredGroupsByProgram,
      existingProfessors: professeursExistantsAvantBootstrap,
      reserveCourseDemands,
    });
    await SchedulerDataBootstrap._cleanupBootstrapProfesseurs(
      executor,
      academicProfessors,
      report
    );
    await SchedulerDataBootstrap._ensureProfesseurs(
      executor,
      academicProfessors,
      report
    );
    await assurerUniciteNomPrenomProfesseurs(executor);
    const cours = await SchedulerDataBootstrap._loadCours(executor);
    const professeurs = await SchedulerDataBootstrap._loadProfesseurs(executor);
    await SchedulerDataBootstrap._ensureProfessorAssignments(
      executor,
      cours,
      professeurs,
      academicProfessors,
      report
    );
    await SchedulerDataBootstrap._ensureProfessorAvailability(
      executor,
      professeurs,
      academicProfessors,
      activeSession,
      report
    );

    const etudiants = await SchedulerDataBootstrap._loadEtudiants(executor);
    const groupes = await SchedulerDataBootstrap._loadGroupes(executor);
    await SchedulerDataBootstrap._ensureStudentsForTargets(
      executor,
      etudiants,
      groupes,
      activeSession,
      sessionMetadata,
      report,
      {
        allowSyntheticStudents: autoriserInjectionEtudiantsBootstrap,
      }
    );
    await SchedulerDataBootstrap._archiveSurplusCourses(executor, report);
    await SchedulerDataBootstrap._cleanupArchivedProfessorCourses(executor, report);
    await SchedulerDataBootstrap._cleanupUnusedProgramReferences(executor, report);

    report.details.push(
      `${ACADEMIC_TARGETS.length} cohortes programme-etape cibles, ${ACADEMIC_COURSES.length} cours de 3h et ${academicProfessors.length} professeurs bootstrap assures.`
    );
    report.details.push(
      `${TARGET_GROUP_SIZE} etudiants vises par groupe, ${MAX_PROGRAMS_PER_PROFESSOR} programmes max et ${MAX_COURSES_PER_PROGRAM_PER_PROFESSOR} cours par programme pour chaque professeur (${MAX_COURSES_PER_PROFESSOR} cours distincts max, ${MAX_WEEKLY_SESSIONS_PER_PROFESSOR} seances hebdomadaires max).`
    );
    if (reserveCourseDemands.length > 0) {
      report.details.push(
        `Reserve professeurs derivee du dernier rapport: ${reserveCourseDemands.length} cours critiques sous surveillance.`
      );
    }
    const programmesEnDebordement = ACADEMIC_TARGETS.map((target) => ({
      programme: target.programme,
      etape: target.etape,
      groupesRequis:
        requiredGroupsByProgram.get(
          buildAcademicTargetKey(target.programme, target.etape)
        ) ||
        0,
    })).filter(
      (programmeInfo) =>
        programmeInfo.groupesRequis > TARGET_GROUPS_PER_PROGRAM
    );

    if (programmesEnDebordement.length > 0) {
      report.details.push(
      `Couverture professeurs etendue pour les debordements: ${programmesEnDebordement
          .map(
            (programmeInfo) =>
              `${programmeInfo.programme} E${programmeInfo.etape} (${programmeInfo.groupesRequis} groupes)`
          )
          .join(", ")}.`
      );
    }

    return report;
  }

  static async _ensureSession(executor, report) {
    const [rows] = await executor.query(
      `SELECT id_session, nom, date_debut, date_fin
       FROM sessions
       WHERE active = TRUE
       ORDER BY id_session ASC
       LIMIT 1`
    );

    if (rows.length > 0) {
      return rows[0];
    }

    const dateDebut = new Date("2026-09-01T00:00:00Z");
    const dateFinExclusive = addMonths(dateDebut, SESSION_DURATION_MONTHS);
    dateFinExclusive.setUTCDate(dateFinExclusive.getUTCDate() - 1);
    const nom = "Automne 2026";
    const date_debut = formatDate(dateDebut);
    const date_fin = formatDate(dateFinExclusive);

    const [result] = await executor.query(
      `INSERT INTO sessions (nom, date_debut, date_fin, active)
       VALUES (?, ?, ?, TRUE)`,
      [nom, date_debut, date_fin]
    );

    report.created.sessions += 1;
    report.details.push("Session active de 4 mois creee par defaut.");

    return {
      id_session: result.insertId,
      nom,
      date_debut,
      date_fin,
    };
  }

  static async _ensureProgramReferences(executor, report) {
    for (const programme of uniqueBy(
      ACADEMIC_PROGRAM_CATALOG.map((item) => item.programme),
      (item) => normalizeAcademicText(item)
    )) {
      const [before] = await executor.query(
        `SELECT id_programme_reference
         FROM programmes_reference
         WHERE nom_programme = ?
         LIMIT 1`,
        [programme]
      );

      await assurerProgrammeReference(programme, executor);

      if (before.length === 0) {
        report.created.programmes_reference += 1;
      }
    }

    if (report.created.programmes_reference > 0) {
      report.details.push(
        `${report.created.programmes_reference} programme(s) de reference ajoute(s).`
      );
    }
  }

  static async _ensureRooms(executor, report) {
    for (const room of ACADEMIC_ROOM_CATALOG) {
      const [existing] = await executor.query(
        `SELECT id_salle, type, capacite
         FROM salles
         WHERE code = ?
         LIMIT 1`,
        [room.code]
      );

      if (existing.length === 0) {
        await executor.query(
          `INSERT INTO salles (code, type, capacite)
           VALUES (?, ?, ?)`,
          [room.code, room.type, room.capacite]
        );
        report.created.salles += 1;
        continue;
      }

      await executor.query(
        `UPDATE salles
         SET type = ?, capacite = ?
         WHERE id_salle = ?`,
        [room.type, room.capacite, existing[0].id_salle]
      );
      report.updated.salles += 1;
    }
  }

  static async _ensureCourses(executor, salles, report) {
    const roomsByType = new Map();

    for (const salle of salles) {
      const key = normalizeAcademicText(salle.type);
      const current = roomsByType.get(key) || [];
      current.push(salle);
      current.sort((roomA, roomB) =>
        String(roomA.code).localeCompare(String(roomB.code), "fr")
      );
      roomsByType.set(key, current);
    }

    for (const course of ACADEMIC_COURSES) {
      const roomCandidates = roomsByType.get(normalizeAcademicText(course.type_salle)) || [];
      const roomReference = roomCandidates[0] || null;
      const [existing] = await executor.query(
        `SELECT id_cours
         FROM cours
         WHERE code = ?
         LIMIT 1`,
        [course.code]
      );

      if (existing.length === 0) {
        await executor.query(
          `INSERT INTO cours (
             code,
             nom,
             duree,
             programme,
             etape_etude,
             type_salle,
             id_salle_reference,
             archive,
             est_cours_cle,
             est_en_ligne,
             max_etudiants_par_groupe,
             min_etudiants_par_groupe,
             sessions_par_semaine
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
          [
            course.code,
            course.nom,
            course.duree,
            course.programme,
            course.etape_etude,
            course.type_salle,
            roomReference?.id_salle || null,
            course.est_cours_cle,
            course.est_en_ligne,
            course.max_etudiants_par_groupe,
            course.min_etudiants_par_groupe,
            course.sessions_par_semaine,
          ]
        );
        report.created.cours += 1;
        continue;
      }

      await executor.query(
        `UPDATE cours
         SET nom = ?,
             duree = ?,
             programme = ?,
             etape_etude = ?,
             type_salle = ?,
             id_salle_reference = ?,
             archive = 0,
             est_cours_cle = ?,
             est_en_ligne = ?,
             max_etudiants_par_groupe = ?,
             min_etudiants_par_groupe = ?,
             sessions_par_semaine = ?
         WHERE id_cours = ?`,
        [
          course.nom,
          course.duree,
          course.programme,
          course.etape_etude,
          course.type_salle,
          roomReference?.id_salle || null,
          course.est_cours_cle,
          course.est_en_ligne,
          course.max_etudiants_par_groupe,
          course.min_etudiants_par_groupe,
          course.sessions_par_semaine,
          existing[0].id_cours,
        ]
      );
      report.updated.cours += 1;
    }
  }

  static async _mergeDuplicateProfesseurs(executor, report) {
    const fusion = await fusionnerDoublonsProfesseurs(executor);

    if (fusion.professeursFusionnes > 0) {
      report.cleaned.professeurs += fusion.professeursFusionnes;
      report.details.push(
        `${fusion.professeursFusionnes} professeur(s) dupliques fusionne(s) sur ${fusion.groupesFusionnes} identite(s).`
      );
    }
  }

  static _buildRequiredGroupsByProgram(
    etudiants,
    groupes,
    salles,
    sessionMetadata,
    activeSession = null,
    options = {}
  ) {
    const { useAcademicTargets = true } = options;
    const requiredGroupsByProgram = new Map();
    const groupesOperationnelsParProgramme = new Map();
    const activeSessionId = Number(activeSession?.id_session);

    for (const groupe of Array.isArray(groupes) ? groupes : []) {
      const nomGroupe = String(groupe?.nom_groupe || "").trim();
      const programme = String(groupe?.programme || "").trim();
      const etape = groupe?.etape;
      const idSession = Number(groupe?.id_session);

      if (!nomGroupe || !programme || etape == null) {
        continue;
      }

      if (/^SRC-/i.test(nomGroupe)) {
        continue;
      }

      if (Number(groupe?.est_groupe_special || 0) === 1) {
        continue;
      }

      if (
        Number.isInteger(activeSessionId) &&
        activeSessionId > 0 &&
        (!Number.isInteger(idSession) || idSession !== activeSessionId)
      ) {
        continue;
      }

      const cleProgramme = buildAcademicTargetKey(programme, etape);
      groupesOperationnelsParProgramme.set(
        cleProgramme,
        (groupesOperationnelsParProgramme.get(cleProgramme) || 0) + 1
      );
    }

    for (const target of ACADEMIC_TARGETS) {
      const etudiantsProgramme = filtrerEtudiantsSessionParProgramme(
        etudiants,
        sessionMetadata,
        target.programme,
        target.etape
      );
      const coursProgramme = ACADEMIC_COURSES.filter(
        (coursItem) =>
          normalizeAcademicText(coursItem.programme) ===
            normalizeAcademicText(target.programme) &&
          String(coursItem.etape_etude) === String(target.etape)
      );
      const capaciteMaximale = determinerCapaciteMaximaleGroupeCohorte(
        coursProgramme,
        salles,
        TARGET_GROUP_SIZE
      );
      const effectifVise = useAcademicTargets
        ? Math.max(etudiantsProgramme.length, Number(target.targetStudentCount || 0))
        : etudiantsProgramme.length;
      const taillesGroupes = calculerTaillesGroupesEquilibres(
        effectifVise,
        capaciteMaximale
      );
      const groupesOperationnels =
        groupesOperationnelsParProgramme.get(
          buildAcademicTargetKey(target.programme, target.etape)
        ) || 0;

      if (!useAcademicTargets && effectifVise <= 0 && groupesOperationnels <= 0) {
        requiredGroupsByProgram.set(
          buildAcademicTargetKey(target.programme, target.etape),
          0
        );
        continue;
      }

      requiredGroupsByProgram.set(
        buildAcademicTargetKey(target.programme, target.etape),
        Math.max(1, taillesGroupes.length, groupesOperationnels)
      );
    }

    return requiredGroupsByProgram;
  }

  static async _cleanupBootstrapProfesseurs(executor, academicProfessors, report) {
    const expectedMatricules = new Set(
      academicProfessors.map((professeur) => String(professeur.matricule))
    );
    const [bootstrapProfesseurs] = await executor.query(
      `SELECT id_professeur, matricule
       FROM professeurs
       WHERE matricule LIKE 'AUTO-%'
       ORDER BY id_professeur ASC`
    );

    for (const professeur of bootstrapProfesseurs) {
      if (expectedMatricules.has(String(professeur.matricule))) {
        continue;
      }

      const [affectations] = await executor.query(
        `SELECT id_affectation_cours, id_plage_horaires
         FROM affectation_cours
         WHERE id_professeur = ?`,
        [professeur.id_professeur]
      );

      if (affectations.length > 0) {
        const idsAffectations = affectations.map(
          (affectation) => Number(affectation.id_affectation_cours)
        );
        const idsPlages = affectations
          .map((affectation) => Number(affectation.id_plage_horaires))
          .filter((idPlage) => Number.isInteger(idPlage) && idPlage > 0);
        const placeholdersAffectations = idsAffectations.map(() => "?").join(", ");

        await executor.query(
          `DELETE FROM affectation_groupes
           WHERE id_affectation_cours IN (${placeholdersAffectations})`,
          idsAffectations
        );
        await executor.query(
          `DELETE FROM affectation_cours
           WHERE id_affectation_cours IN (${placeholdersAffectations})`,
          idsAffectations
        );

        if (idsPlages.length > 0) {
          const placeholdersPlages = idsPlages.map(() => "?").join(", ");

          await executor.query(
            `DELETE FROM plages_horaires
             WHERE id_plage_horaires IN (${placeholdersPlages})
               AND id_plage_horaires NOT IN (
                 SELECT DISTINCT ac.id_plage_horaires
                 FROM affectation_cours ac
                 WHERE ac.id_plage_horaires IS NOT NULL
               )`,
            idsPlages
          );
        }
      }

      await executor.query(
        `DELETE FROM disponibilites_professeurs
         WHERE id_professeur = ?`,
        [professeur.id_professeur]
      );
      await executor.query(
        `DELETE FROM professeur_cours
         WHERE id_professeur = ?`,
        [professeur.id_professeur]
      );
      await executor.query(
        `DELETE FROM professeurs
         WHERE id_professeur = ?`,
        [professeur.id_professeur]
      );
      report.cleaned.professeurs += 1;
    }

    if (report.cleaned.professeurs > 0) {
      report.details.push(
        `${report.cleaned.professeurs} professeur(s) bootstrap obsoletes nettoye(s).`
      );
    }
  }

  static async _ensureProfesseurs(executor, academicProfessors, report) {
    for (const professeur of academicProfessors) {
      const [existing] = await executor.query(
        `SELECT id_professeur
         FROM professeurs
         WHERE matricule = ?
         LIMIT 1`,
        [professeur.matricule]
      );

      let professeurExistant = existing[0] || null;

      if (!professeurExistant) {
        const [existingByIdentity] = await executor.query(
          `SELECT id_professeur, matricule
           FROM professeurs
           WHERE LOWER(TRIM(nom)) = LOWER(TRIM(?))
             AND LOWER(TRIM(prenom)) = LOWER(TRIM(?))
           LIMIT 1`,
          [professeur.nom, professeur.prenom]
        );
        professeurExistant = existingByIdentity[0] || null;
      }

      if (!professeurExistant) {
        await executor.query(
          `INSERT INTO professeurs (matricule, nom, prenom, specialite)
           VALUES (?, ?, ?, ?)`,
          [
            professeur.matricule,
            professeur.nom,
            professeur.prenom,
            professeur.specialite,
          ]
        );
        report.created.professeurs += 1;
        continue;
      }

      await executor.query(
        `UPDATE professeurs
         SET nom = ?, prenom = ?, specialite = ?
         WHERE id_professeur = ?`,
        [
          professeur.nom,
          professeur.prenom,
          professeur.specialite,
          professeurExistant.id_professeur,
        ]
      );
      report.updated.professeurs += 1;
    }
  }

  static async _ensureProfessorAssignments(
    executor,
    cours,
    professeurs,
    academicProfessors,
    report
  ) {
    const courseIdsByCode = new Map(
      cours.map((course) => [String(course.code), Number(course.id_cours)])
    );
    const professeursByIdentity = new Map(
      professeurs.map((professeur) => [
        buildProfessorIdentityKey(professeur),
        Number(professeur.id_professeur),
      ])
    );

    for (const professeur of academicProfessors) {
      const idProfesseur = professeursByIdentity.get(
        buildProfessorIdentityKey(professeur)
      );

      if (!idProfesseur) {
        continue;
      }

      await executor.query(
        `DELETE FROM professeur_cours
         WHERE id_professeur = ?`,
        [idProfesseur]
      );

      for (const courseCode of professeur.assignedCourseCodes) {
        const idCours = courseIdsByCode.get(courseCode);

        if (!idCours) {
          continue;
        }

        await executor.query(
          `INSERT IGNORE INTO professeur_cours (id_professeur, id_cours)
           VALUES (?, ?)`,
          [idProfesseur, idCours]
        );
        report.created.professeur_cours += 1;
      }
    }
  }

  static async _ensureProfessorAvailability(
    executor,
    professeurs,
    academicProfessors,
    activeSession,
    report
  ) {
    const professeursByIdentity = new Map(
      professeurs.map((professeur) => [
        buildProfessorIdentityKey(professeur),
        Number(professeur.id_professeur),
      ])
    );

    for (const professeur of academicProfessors) {
      const idProfesseur = professeursByIdentity.get(
        buildProfessorIdentityKey(professeur)
      );

      if (!idProfesseur) {
        continue;
      }

      const [disponibilitesExistantes] = await executor.query(
        `SELECT COUNT(*) AS total
         FROM disponibilites_professeurs
         WHERE id_professeur = ?
           AND date_fin_effet >= ?
           AND date_debut_effet <= ?`,
        [idProfesseur, activeSession.date_debut, activeSession.date_fin]
      );

      if (Number(disponibilitesExistantes?.[0]?.total || 0) > 0) {
        continue;
      }

      for (const disponibilite of createProfessorAvailabilityRows(idProfesseur)) {
        await executor.query(
          `INSERT INTO disponibilites_professeurs (
             id_professeur,
             jour_semaine,
             heure_debut,
             heure_fin,
             date_debut_effet,
             date_fin_effet
           ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            disponibilite.id_professeur,
            disponibilite.jour_semaine,
            disponibilite.heure_debut,
            disponibilite.heure_fin,
            activeSession.date_debut,
            activeSession.date_fin,
          ]
        );
        report.created.disponibilites += 1;
      }
    }
  }

  static async _ensureStudentsForTargets(
    executor,
    etudiants,
    groupes,
    session,
    sessionMetadata,
    report,
    options = {}
  ) {
    const { allowSyntheticStudents = true } = options;

    if (!allowSyntheticStudents) {
      return;
    }

    const existingStudents = [...etudiants];
    const existingMatricules = new Set(
      existingStudents.map((student) => String(student.matricule))
    );
    const existingGroups = [...groupes];

    for (const target of ACADEMIC_TARGETS) {
      const currentCount = existingStudents.filter(
        (student) =>
          normalizeAcademicText(student.programme) ===
            normalizeAcademicText(target.programme) &&
          String(student.etape) === String(Number(target.etape)) &&
          normaliserNomSession(student.session) === sessionMetadata.saison
      ).length;

      const missingCount = Math.max(0, target.targetStudentCount - currentCount);

      if (missingCount === 0) {
        continue;
      }

      const groupId = await SchedulerDataBootstrap._ensureBootstrapGroup(
        executor,
        existingGroups,
        session,
        target,
        report
      );

      let createdForTarget = 0;
      let sequence = 1;

      while (createdForTarget < missingCount) {
        const matricule = buildStudentMatricule(
          target.programme,
          currentCount + createdForTarget + sequence
        );
        sequence += 1;

        if (existingMatricules.has(matricule)) {
          continue;
        }

        const globalIndex = existingStudents.length + 1;
        const prenom = FIRST_NAMES[(globalIndex - 1) % FIRST_NAMES.length];
        const nom = LAST_NAMES[(globalIndex - 1) % LAST_NAMES.length];

        await executor.query(
          `INSERT INTO etudiants (
             matricule,
             nom,
             prenom,
             id_groupes_etudiants,
             programme,
             etape,
             session,
             annee
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            matricule,
            nom,
            prenom,
            groupId,
            target.programme,
            Number(target.etape),
            sessionMetadata.saison,
            sessionMetadata.annee,
          ]
        );

        existingMatricules.add(matricule);
        existingStudents.push({
          matricule,
          programme: target.programme,
          etape: Number(target.etape),
          session: sessionMetadata.saison,
        });
        report.created.etudiants += 1;
        createdForTarget += 1;
      }

      report.details.push(
        `${createdForTarget} etudiant(s) assures pour ${target.programme} etape ${target.etape}.`
      );
    }
  }

  static _peutInjecterEtudiantsBootstrap(etudiants = []) {
    return !Array.isArray(etudiants) || etudiants.length === 0;
  }

  static async _ensureBootstrapGroup(
    executor,
    existingGroups,
    session,
    target,
    report
  ) {
    const expectedName = `SRC-${target.programme.slice(0, 24)}-E${target.etape}`;
    const existing = existingGroups.find(
      (group) =>
        String(group.nom_groupe) === expectedName &&
        Number(group.id_session) === Number(session.id_session)
    );

    if (existing) {
      return existing.id_groupes_etudiants;
    }

    const [result] = await executor.query(
      `INSERT INTO groupes_etudiants (
         nom_groupe,
         taille_max,
         est_groupe_special,
         id_session,
         programme,
         etape
       ) VALUES (?, ?, 0, ?, ?, ?)`,
      [
        expectedName,
        TARGET_GROUP_SIZE,
        session.id_session,
        target.programme,
        Number(target.etape),
      ]
    );

    existingGroups.push({
      id_groupes_etudiants: result.insertId,
      nom_groupe: expectedName,
      programme: target.programme,
      etape: Number(target.etape),
      id_session: session.id_session,
    });
    report.created.groupes_sources += 1;

    return result.insertId;
  }

  static async _cleanupUnusedProgramReferences(executor, report) {
    const [references] = await executor.query(
      `SELECT id_programme_reference, nom_programme
       FROM programmes_reference`
    );

    for (const reference of references) {
      if (ACADEMIC_PROGRAM_NAMES.has(reference.nom_programme)) {
        continue;
      }

      const [[usageCours]] = await executor.query(
        `SELECT COUNT(*) AS total
         FROM cours
         WHERE programme = ?
           AND archive = FALSE`,
        [reference.nom_programme]
      );
      const [[usageEtudiants]] = await executor.query(
        `SELECT COUNT(*) AS total
         FROM etudiants
         WHERE programme = ?`,
        [reference.nom_programme]
      );
      const [[usageGroupes]] = await executor.query(
        `SELECT COUNT(*) AS total
         FROM groupes_etudiants
         WHERE programme = ?`,
        [reference.nom_programme]
      );

      if (
        Number(usageCours.total) > 0 ||
        Number(usageEtudiants.total) > 0 ||
        Number(usageGroupes.total) > 0
      ) {
        continue;
      }

      await executor.query(
        `DELETE FROM programmes_reference
         WHERE id_programme_reference = ?`,
        [reference.id_programme_reference]
      );
      report.cleaned.programmes_reference += 1;
    }

    if (report.cleaned.programmes_reference > 0) {
      report.details.push(
        `${report.cleaned.programmes_reference} programme(s) de reference inutilise(s) retire(s).`
      );
    }
  }

  static async _archiveSurplusCourses(executor, report) {
    const [cours] = await executor.query(
      `SELECT id_cours, code
       FROM cours
       WHERE archive = FALSE`
    );

    for (const coursItem of cours) {
      if (ACADEMIC_COURSE_CODES.has(String(coursItem.code))) {
        continue;
      }

      await executor.query(
        `UPDATE cours
         SET archive = TRUE
         WHERE id_cours = ?`,
        [coursItem.id_cours]
      );
      report.cleaned.cours_archives += 1;
    }

    if (report.cleaned.cours_archives > 0) {
      report.details.push(
        `${report.cleaned.cours_archives} cours hors catalogue ont ete archives.`
      );
    }
  }

  static async _cleanupArchivedProfessorCourses(executor, report) {
    const nombreSuppressions =
      await nettoyerAffectationsCoursArchivesProfesseurs(executor);

    if (nombreSuppressions > 0) {
      report.cleaned.professeur_cours += nombreSuppressions;
      report.details.push(
        `${nombreSuppressions} affectation(s) professeur vers des cours archives ont ete retirees.`
      );
    }
  }

  static async _loadSalles(executor) {
    const [rows] = await executor.query(
      `SELECT id_salle, code, type, capacite
       FROM salles
       ORDER BY code ASC`
    );
    return rows;
  }

  static async _loadCours(executor) {
    const [rows] = await executor.query(
      `SELECT id_cours,
              code,
              nom,
              duree,
              programme,
              etape_etude,
              type_salle,
              archive,
              est_cours_cle,
              est_en_ligne,
              max_etudiants_par_groupe,
              min_etudiants_par_groupe,
              sessions_par_semaine
       FROM cours
       WHERE archive = FALSE
       ORDER BY code ASC`
    );
    return rows;
  }

  static async _loadProfesseurs(executor) {
    const [rows] = await executor.query(
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
       ORDER BY p.matricule ASC`
    );
    return rows;
  }

  static async _loadEtudiants(executor) {
    const [rows] = await executor.query(
      `SELECT id_etudiant,
              matricule,
              programme,
              etape,
              session,
              id_groupes_etudiants
       FROM etudiants
       ORDER BY id_etudiant ASC`
    );
    return rows;
  }

  static async _loadGroupes(executor) {
    const [rows] = await executor.query(
      `SELECT id_groupes_etudiants,
              nom_groupe,
              programme,
              etape,
              id_session,
              est_groupe_special
       FROM groupes_etudiants
       ORDER BY id_groupes_etudiants ASC`
    );
    return rows;
  }

  static async _loadReserveCourseDemands(executor, activeSession) {
    const activeSessionId = Number(activeSession?.id_session);

    if (!Number.isInteger(activeSessionId) || activeSessionId <= 0) {
      return [];
    }

    const [rows] = await executor.query(
      `SELECT details
       FROM rapports_generation
       WHERE id_session = ?
       ORDER BY date_generation DESC, id DESC
       LIMIT 1`,
      [activeSessionId]
    );

    if (rows.length === 0) {
      return [];
    }

    const payload = parseJson(rows[0].details, {});
    const nonPlanifies = Array.isArray(payload?.non_planifies)
      ? payload.non_planifies
      : [];
    const reserveByCourse = new Map();
    const seenCourseGroupReason = new Set();
    const programmeByCourseCode = new Map(
      ACADEMIC_COURSES.map((course) => [String(course.code).trim().toUpperCase(), course.programme])
    );

    for (const item of nonPlanifies) {
      const reasonCode = String(item?.raison_code || "")
        .replace(/^GARANTIE_/, "")
        .trim()
        .toUpperCase();

      if (
        reasonCode !== "PROFESSEURS_SATURES" &&
        reasonCode !== "GROUPE_SATURE"
      ) {
        continue;
      }

      const code = String(item?.code || "").trim().toUpperCase();
      const programme = String(
        item?.programme || programmeByCourseCode.get(code) || ""
      ).trim();
      const groupe = String(item?.groupe || "").trim();

      if (!code || !programme || !groupe) {
        continue;
      }

      const uniqueKey = `${code}|${groupe}|${reasonCode}`;
      if (seenCourseGroupReason.has(uniqueKey)) {
        continue;
      }
      seenCourseGroupReason.add(uniqueKey);

      const current = reserveByCourse.get(code) || {
        code,
        programme,
        load: 0,
      };
      current.load += 1;
      reserveByCourse.set(code, current);
    }

    return [...reserveByCourse.values()].sort((itemA, itemB) => {
      if (itemB.load !== itemA.load) {
        return itemB.load - itemA.load;
      }

      const programmeCompare = itemA.programme.localeCompare(itemB.programme, "fr");
      if (programmeCompare !== 0) {
        return programmeCompare;
      }

      return itemA.code.localeCompare(itemB.code, "fr");
    });
  }

  static async _ensureProfessorCourseTable(executor) {
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

  static async _ensureProfessorAvailabilityTable(executor) {
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
        CONSTRAINT fk_disponibilite_professeur
          FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }
}
