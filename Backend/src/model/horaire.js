import pool from "../../db.js";
import {
  recupererDisponibilitesProfesseurs,
  recupererIndexCoursProfesseurs,
} from "./professeurs.model.js";

const CRENEAUX_DEBUT = ["08:00:00", "10:00:00", "13:00:00", "15:00:00"];
const NOMBRE_JOURS_GENERATION = 10;

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

  const specialite = normaliserTexte(professeur.specialite);
  const programme = normaliserTexte(cours.programme);

  if (specialite && programme && specialite === programme) {
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
      professeurEstCompatibleAvecCours(professeur, cours, coursParProfesseur)
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
      return nombreA - nombreB;
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
  const programmeCours = normaliserTexte(cours.programme);

  return groupes.filter(
    (groupe) =>
      normaliserTexte(groupe.programme) === programmeCours &&
      etapesCorrespondent(cours.etape_etude, groupe.etape)
  );
}

function totaliserEffectifGroupes(groupes) {
  return groupes.reduce(
    (total, groupe) => total + (Number(groupe.effectif) || 0),
    0
  );
}

function trierSallesCompatibles(cours, salles, capaciteMinimale = 0) {
  const idSalleReference = Number(cours.id_salle_reference);
  const typeSalleCours = normaliserTexte(cours.type_salle);

  return salles
    .filter((salle) => {
      if (Number.isInteger(idSalleReference) && idSalleReference > 0) {
        return Number(salle.id_salle) === idSalleReference;
      }

      return normaliserTexte(salle.type) === typeSalleCours;
    })
    .sort((salleA, salleB) => {
      const salleAAdequate = Number(salleA.capacite) >= capaciteMinimale;
      const salleBAdequate = Number(salleB.capacite) >= capaciteMinimale;

      if (salleAAdequate !== salleBAdequate) {
        return salleAAdequate ? -1 : 1;
      }

      if (salleAAdequate && salleBAdequate) {
        const margeA = Number(salleA.capacite) - capaciteMinimale;
        const margeB = Number(salleB.capacite) - capaciteMinimale;

        if (margeA !== margeB) {
          return margeA - margeB;
        }
      }

      if (salleA.capacite !== salleB.capacite) {
        return salleA.capacite - salleB.capacite;
      }

      return String(salleA.code).localeCompare(String(salleB.code), "fr");
    });
}

function genererJoursOuvrables(nombreJours, dateDebut = null) {
  const jours = [];
  const dateCourante = dateDebut
    ? new Date(`${dateDebut}T00:00:00`)
    : new Date();
  dateCourante.setHours(0, 0, 0, 0);

  while (dateCourante.getDay() === 0 || dateCourante.getDay() === 6) {
    dateCourante.setDate(dateCourante.getDate() + 1);
  }

  while (jours.length < nombreJours) {
    if (dateCourante.getDay() !== 0 && dateCourante.getDay() !== 6) {
      jours.push(dateCourante.toISOString().slice(0, 10));
    }

    dateCourante.setDate(dateCourante.getDate() + 1);
  }

  return jours;
}

function convertirDateEnJourSemaine(date) {
  const dateReference = new Date(`${date}T00:00:00`);
  const jour = dateReference.getDay();

  if (jour === 0 || jour === 6) {
    return 0;
  }

  return jour;
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
      `SELECT id_cours, code, nom, programme, type_salle, id_salle_reference
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

/**
 * Retourne toutes les affectations de cours avec les details.
 * @returns {Promise<Array<Object>>} La liste de toutes les affectations.
 */
export async function getAllAffectations() {
  const [rows] = await pool.query(
    `SELECT ac.id_affectation_cours,
            c.code AS cours_code,
            c.nom AS cours_nom,
            c.duree AS cours_duree,
            p.nom AS professeur_nom,
            p.prenom AS professeur_prenom,
            s.code AS salle_code,
            s.capacite AS salle_capacite,
            ph.date,
            ph.heure_debut,
            ph.heure_fin,
            COALESCE(
              GROUP_CONCAT(DISTINCT ge.nom_groupe ORDER BY ge.nom_groupe SEPARATOR ', '),
              ''
            ) AS groupes
     FROM affectation_cours ac
     JOIN cours c ON ac.id_cours = c.id_cours
     JOIN professeurs p ON ac.id_professeur = p.id_professeur
     JOIN salles s ON ac.id_salle = s.id_salle
     JOIN plages_horaires ph ON ac.id_plage_horaires = ph.id_plage_horaires
     LEFT JOIN affectation_groupes ag ON ag.id_affectation_cours = ac.id_affectation_cours
     LEFT JOIN groupes_etudiants ge ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     GROUP BY ac.id_affectation_cours,
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
export async function getAffectationById(idAffectation) {
  const [rows] = await pool.query(
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
            ph.date,
            ph.heure_debut,
            ph.heure_fin,
            COALESCE(
              GROUP_CONCAT(DISTINCT ge.nom_groupe ORDER BY ge.nom_groupe SEPARATOR ', '),
              ''
            ) AS groupes
     FROM affectation_cours ac
     JOIN cours c ON ac.id_cours = c.id_cours
     JOIN professeurs p ON ac.id_professeur = p.id_professeur
     JOIN salles s ON ac.id_salle = s.id_salle
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
export async function deleteAllAffectations(executor = pool) {
  await executor.query(`DELETE FROM affectation_groupes;`);
  await executor.query(`DELETE FROM affectation_cours;`);
  await executor.query(`DELETE FROM plages_horaires;`);
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
  const {
    idCours,
    idProfesseur,
    idSalle,
    date,
    heureDebut,
    heureFin,
  } = affectation;

  const { cours, professeur, salle } = await recupererContexteAffectation(
    idCours,
    idProfesseur,
    idSalle,
    executor
  );

  const coursParProfesseur = await recupererIndexCoursProfesseurs(executor);

  if (!cours) {
    throw creerErreurHoraire("Cours introuvable.", 404);
  }

  if (!professeur) {
    throw creerErreurHoraire("Professeur introuvable.", 404);
  }

  if (!salle) {
    throw creerErreurHoraire("Salle introuvable.", 404);
  }

  if (!professeurEstCompatibleAvecCours(professeur, cours, coursParProfesseur)) {
    throw creerErreurHoraire(
      "Professeur non compatible avec ce cours.",
      409
    );
  }

  if (!salleEstCompatibleAvecCours(salle, cours)) {
    throw creerErreurHoraire("Salle non compatible avec ce cours.", 409);
  }

  const professeurDisponible = await verifierDisponibiliteProfesseur(
    idProfesseur,
    date,
    heureDebut,
    heureFin,
    executor
  );

  if (!professeurDisponible) {
    throw creerErreurHoraire(
      "Professeur indisponible sur ce creneau.",
      409
    );
  }

  const conflitSalle = await verifierConflitSalle(
    idSalle,
    date,
    heureDebut,
    heureFin,
    null,
    executor
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
    executor
  );

  if (conflitProfesseur > 0) {
    throw creerErreurHoraire("Professeur deja assigne sur ce creneau.", 409);
  }

  const plageResultat = await addPlageHoraire(date, heureDebut, heureFin, executor);
  const affectationResultat = await addAffectation(
    idCours,
    idProfesseur,
    idSalle,
    plageResultat.insertId,
    executor
  );

  return {
    id_affectation_cours: affectationResultat.insertId,
    id_plage_horaires: plageResultat.insertId,
  };
}

export async function updateAffectationValidee(
  idAffectation,
  affectation,
  executor = pool
) {
  const idAffectationNumerique = Number(idAffectation);

  if (!Number.isInteger(idAffectationNumerique) || idAffectationNumerique <= 0) {
    throw creerErreurHoraire("Affectation introuvable.", 404);
  }

  const affectationExistante = await getAffectationById(idAffectationNumerique);

  if (!affectationExistante) {
    throw creerErreurHoraire("Affectation introuvable.", 404);
  }

  const {
    idCours,
    idProfesseur,
    idSalle,
    date,
    heureDebut,
    heureFin,
  } = affectation;

  const { cours, professeur, salle } = await recupererContexteAffectation(
    idCours,
    idProfesseur,
    idSalle,
    executor
  );
  const coursParProfesseur = await recupererIndexCoursProfesseurs(executor);

  if (!cours) {
    throw creerErreurHoraire("Cours introuvable.", 404);
  }

  if (!professeur) {
    throw creerErreurHoraire("Professeur introuvable.", 404);
  }

  if (!salle) {
    throw creerErreurHoraire("Salle introuvable.", 404);
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
    executor
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
    executor
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
    executor
  );

  if (conflitProfesseur > 0) {
    throw creerErreurHoraire("Professeur deja assigne sur ce creneau.", 409);
  }

  await executor.query(
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

  await executor.query(
    `UPDATE affectation_cours
     SET id_cours = ?, id_professeur = ?, id_salle = ?
     WHERE id_affectation_cours = ?`,
    [idCours, idProfesseur, idSalle, idAffectationNumerique]
  );

  return getAffectationById(idAffectationNumerique);
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

    const programmeCible = normaliserTexte(options.programme);
    const etapeCible = normaliserEtape(options.etape);
    const idGroupeCible =
      Number.isInteger(Number(options.idGroupe)) && Number(options.idGroupe) > 0
        ? Number(options.idGroupe)
        : null;
    const dateDebut = String(options.dateDebut || "").trim() || null;

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
    const [groupes] = await connection.query(
      `SELECT ge.id_groupes_etudiants,
              ge.nom_groupe,
              e.programme,
              e.etape,
              COUNT(e.id_etudiant) AS effectif
       FROM groupes_etudiants ge
       JOIN etudiants e
         ON e.id_groupes_etudiants = ge.id_groupes_etudiants
       GROUP BY ge.id_groupes_etudiants, ge.nom_groupe, e.programme, e.etape
       ORDER BY ge.nom_groupe ASC;`
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
    const groupesSelectionnes = groupes.filter((groupe) => {
      if (
        programmeCible &&
        normaliserTexte(groupe.programme) !== programmeCible
      ) {
        return false;
      }

      if (etapeCible && !etapesCorrespondent(etapeCible, groupe.etape)) {
        return false;
      }

      if (idGroupeCible && Number(groupe.id_groupes_etudiants) !== idGroupeCible) {
        return false;
      }

      return true;
    });

    if (programmeCible && etapeCible && groupesSelectionnes.length === 0) {
      throw creerErreurHoraire(
        "Aucun groupe ne correspond a ce programme et cette etape.",
        400
      );
    }

    const coursSelectionnes = cours.filter((coursActuel) => {
      if (
        programmeCible &&
        normaliserTexte(coursActuel.programme) !== programmeCible
      ) {
        return false;
      }

      if (etapeCible && !etapesCorrespondent(coursActuel.etape_etude, etapeCible)) {
        return false;
      }

      return true;
    });

    if (programmeCible && etapeCible && coursSelectionnes.length === 0) {
      throw creerErreurHoraire(
        "Aucun cours ne correspond a ce programme et cette etape.",
        400
      );
    }

    if (!programmeCible && !etapeCible && !idGroupeCible) {
      await deleteAllAffectations(connection);
    } else if (groupesSelectionnes.length > 0) {
      await deleteAffectationsPourGroupes(
        groupesSelectionnes.map((groupe) => groupe.id_groupes_etudiants),
        connection
      );
    } else {
      await deleteAllAffectations(connection);
    }

    const jours = genererJoursOuvrables(NOMBRE_JOURS_GENERATION, dateDebut);
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
        groupesSelectionnes.length > 0 ? groupesSelectionnes : groupes
      );

      if (groupesCompatibles.length === 0) {
        nonPlanifies.push({
          id_cours: coursActuel.id_cours,
          code_cours: coursActuel.code,
          raison: "Aucun groupe correspondant au programme et a l'etape du cours.",
        });
        continue;
      }

      const effectifTotal = totaliserEffectifGroupes(groupesCompatibles);
      const sallesCompatibles = trierSallesCompatibles(
        coursActuel,
        salles,
        effectifTotal
      );

      if (sallesCompatibles.length === 0) {
        nonPlanifies.push({
          id_cours: coursActuel.id_cours,
          code_cours: coursActuel.code,
          raison: `Aucune salle compatible pour le type ${coursActuel.type_salle}.`,
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

      let affectationCreee = null;

      for (const date of jours) {
        for (const heureDebut of CRENEAUX_DEBUT) {
          const heureFin = heureFinParCreneau.get(heureDebut);

          for (const professeur of professeursCompatibles) {
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

              for (const groupe of groupesCompatibles) {
                await addAffectationGroupe(
                  groupe.id_groupes_etudiants,
                  resultat.id_affectation_cours,
                  connection
                );
              }

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
                groupes: groupesCompatibles.map((groupe) => groupe.nom_groupe).join(", "),
                effectif: effectifTotal,
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
          raison: "Aucun creneau disponible avec un professeur et une salle libres.",
        });
      }
    }

    await connection.commit();

    return {
      message: `${affectations.length} affectation(s) generee(s).`,
      selection: {
        programme: options.programme || "",
        etape: options.etape || "",
        id_groupe: idGroupeCible,
      },
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
