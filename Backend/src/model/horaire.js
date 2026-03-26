import pool from "../../db.js";
import { recupererDisponibilitesProfesseurs } from "./professeurs.model.js";

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

function calculerScoreProfesseur(professeur, cours) {
  const specialite = normaliserTexte(professeur.specialite);
  const programme = normaliserTexte(cours.programme);
  const nomCours = normaliserTexte(cours.nom);
  const codeCours = normaliserTexte(cours.code);

  if (!specialite) {
    return 0;
  }

  if (specialite === programme || specialite === nomCours || specialite === codeCours) {
    return 3;
  }

  if (
    (programme && specialite.includes(programme)) ||
    (nomCours && specialite.includes(nomCours))
  ) {
    return 2;
  }

  if (
    (programme && programme.includes(specialite)) ||
    (nomCours && nomCours.includes(specialite))
  ) {
    return 1;
  }

  return 0;
}

export function professeurEstCompatibleAvecCours(professeur, cours) {
  return calculerScoreProfesseur(professeur, cours) > 0;
}

function trierProfesseursPourCours(cours, professeurs, compteurAffectations) {
  return professeurs
    .filter((professeur) => professeurEstCompatibleAvecCours(professeur, cours))
    .sort((professeurA, professeurB) => {
    const scoreA = calculerScoreProfesseur(professeurA, cours);
    const scoreB = calculerScoreProfesseur(professeurB, cours);

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
  return normaliserTexte(salle?.type) === normaliserTexte(cours?.type_salle);
}

function trierSallesCompatibles(cours, salles) {
  const typeSalleCours = normaliserTexte(cours.type_salle);

  return salles
    .filter((salle) => normaliserTexte(salle.type) === typeSalleCours)
    .sort((salleA, salleB) => {
      if (salleA.capacite !== salleB.capacite) {
        return salleA.capacite - salleB.capacite;
      }

      return String(salleA.code).localeCompare(String(salleB.code), "fr");
    });
}

function genererJoursOuvrables(nombreJours) {
  const jours = [];
  const dateCourante = new Date();
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

async function recupererContexteAffectation(idCours, idProfesseur, idSalle, executor = pool) {
  const [[coursRows], [professeurRows], [salleRows]] = await Promise.all([
    executor.query(
      `SELECT id_cours, code, nom, programme, type_salle
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
            ph.heure_fin
     FROM affectation_cours ac
     JOIN cours c ON ac.id_cours = c.id_cours
     JOIN professeurs p ON ac.id_professeur = p.id_professeur
     JOIN salles s ON ac.id_salle = s.id_salle
     JOIN plages_horaires ph ON ac.id_plage_horaires = ph.id_plage_horaires
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
            ph.heure_fin
     FROM affectation_cours ac
     JOIN cours c ON ac.id_cours = c.id_cours
     JOIN professeurs p ON ac.id_professeur = p.id_professeur
     JOIN salles s ON ac.id_salle = s.id_salle
     JOIN plages_horaires ph ON ac.id_plage_horaires = ph.id_plage_horaires
     WHERE ac.id_affectation_cours = ?;`,
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
  executor = pool
) {
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS conflits
     FROM affectation_cours ac
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ac.id_salle = ?
       AND ph.date = ?
       AND ph.heure_debut < ?
       AND ph.heure_fin > ?;`,
    [idSalle, date, normaliserHeure(heureFin), normaliserHeure(heureDebut)]
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
  executor = pool
) {
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS conflits
     FROM affectation_cours ac
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ac.id_professeur = ?
       AND ph.date = ?
       AND ph.heure_debut < ?
       AND ph.heure_fin > ?;`,
    [idProfesseur, date, normaliserHeure(heureFin), normaliserHeure(heureDebut)]
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

  if (!cours) {
    throw creerErreurHoraire("Cours introuvable.", 404);
  }

  if (!professeur) {
    throw creerErreurHoraire("Professeur introuvable.", 404);
  }

  if (!salle) {
    throw creerErreurHoraire("Salle introuvable.", 404);
  }

  if (!professeurEstCompatibleAvecCours(professeur, cours)) {
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

/**
 * Genere automatiquement un horaire en respectant les conflits
 * de professeurs et de salles.
 * @returns {Promise<Object>} Resume de generation.
 */
export async function genererHoraireAutomatiquement() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [cours] = await connection.query(
      `SELECT id_cours, code, nom, duree, programme, type_salle
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

    await deleteAllAffectations(connection);

    const jours = genererJoursOuvrables(NOMBRE_JOURS_GENERATION);
    const compteurAffectations = new Map();
    const affectations = [];
    const nonPlanifies = [];

    const coursTries = [...cours].sort((coursA, coursB) => {
      const sallesCoursA = trierSallesCompatibles(coursA, salles).length;
      const sallesCoursB = trierSallesCompatibles(coursB, salles).length;

      if (sallesCoursA !== sallesCoursB) {
        return sallesCoursA - sallesCoursB;
      }

      return String(coursA.code).localeCompare(String(coursB.code), "fr");
    });

    for (const coursActuel of coursTries) {
      const sallesCompatibles = trierSallesCompatibles(coursActuel, salles);

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
        compteurAffectations
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
