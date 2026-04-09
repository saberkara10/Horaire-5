import { recupererSallesCompatiblesPourCours } from "../../utils/groupes.js";
import {
  MAX_WEEKLY_SESSIONS_PER_GROUP_WITH_RECOVERY,
  REQUIRED_WEEKLY_SESSIONS_PER_GROUP,
} from "../scheduler/AcademicCatalog.js";
import { disponibiliteCouvreDate, normaliserDateIso } from "./availability-temporal.js";

const PAS_RECHERCHE_MINUTES = 15;
const HEURE_JOURNEE_DEBUT = 8 * 60;
const HEURE_JOURNEE_FIN = 22 * 60;
const NOMBRE_JOURS_RATTRAPAGE_APRES_SESSION = 28;
const NOMBRE_JOURS_RECHERCHE_SECOURS = 56;
const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;

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

function parseDateLocale(dateString) {
  const [annee = "0", mois = "1", jour = "1"] = String(dateString || "").split("-");
  return new Date(Number(annee), Number(mois) - 1, Number(jour));
}

function formatDateLocale(date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

function convertirDateEnJourSemaine(dateString) {
  const date = parseDateLocale(dateString);
  const jour = date.getDay();
  return jour === 0 ? 7 : jour;
}

function datesChevauchent(dateReference, dateDebut, dateFin) {
  if (!dateDebut || !dateFin) {
    return false;
  }

  return dateReference >= String(dateDebut).slice(0, 10) &&
    dateReference <= String(dateFin).slice(0, 10);
}

function horairesChevauchent(debutA, finA, debutB, finB) {
  return heureVersMinutes(debutA) < heureVersMinutes(finB) &&
    heureVersMinutes(finA) > heureVersMinutes(debutB);
}

function disponibiliteCouvreSeance(disponibilites, date, heureDebut, heureFin) {
  if (!Array.isArray(disponibilites) || disponibilites.length === 0) {
    return true;
  }

  const jourSemaine = convertirDateEnJourSemaine(date);
  const debut = heureVersMinutes(heureDebut);
  const fin = heureVersMinutes(heureFin);

  return disponibilites.some((disponibilite) => {
    if (Number(disponibilite.jour_semaine) !== jourSemaine) {
      return false;
    }

    if (!disponibiliteCouvreDate(disponibilite, date)) {
      return false;
    }

    return (
      heureVersMinutes(disponibilite.heure_debut) <= debut &&
      heureVersMinutes(disponibilite.heure_fin) >= fin
    );
  });
}

function extraireFenetresJour(disponibilites, date) {
  if (!Array.isArray(disponibilites) || disponibilites.length === 0) {
    return [
      {
        debut: HEURE_JOURNEE_DEBUT,
        fin: HEURE_JOURNEE_FIN,
      },
    ];
  }

  const jourSemaine = convertirDateEnJourSemaine(date);

  return disponibilites
    .filter(
      (disponibilite) =>
        Number(disponibilite.jour_semaine) === jourSemaine &&
        disponibiliteCouvreDate(disponibilite, date)
    )
    .map((disponibilite) => ({
      debut: heureVersMinutes(disponibilite.heure_debut),
      fin: heureVersMinutes(disponibilite.heure_fin),
    }))
    .filter((fenetre) => fenetre.fin > fenetre.debut)
    .sort((fenetreA, fenetreB) => fenetreA.debut - fenetreB.debut);
}

function genererDatesRecherche(dateDebut, dateFin) {
  const dates = [];
  const dateCourante = parseDateLocale(dateDebut);
  const borneFin = parseDateLocale(dateFin);

  while (dateCourante.getTime() <= borneFin.getTime()) {
    dates.push(formatDateLocale(dateCourante));
    dateCourante.setDate(dateCourante.getDate() + 1);
  }

  return dates;
}

function genererHeuresCandidates(date, disponibilites, dureeMinutes, heureReference) {
  const reference = heureVersMinutes(heureReference);
  const fenetres = extraireFenetresJour(disponibilites, date);
  const heures = new Set();

  for (const fenetre of fenetres) {
    for (
      let debut = fenetre.debut;
      debut + dureeMinutes <= fenetre.fin;
      debut += PAS_RECHERCHE_MINUTES
    ) {
      heures.add(debut);
    }

    if (
      reference >= fenetre.debut &&
      reference + dureeMinutes <= fenetre.fin
    ) {
      heures.add(reference);
    }
  }

  return [...heures]
    .sort((minuteA, minuteB) => {
      const distanceA = Math.abs(minuteA - reference);
      const distanceB = Math.abs(minuteB - reference);

      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }

      return minuteA - minuteB;
    })
    .map((minutes) => ({
      heure_debut: minutesVersHeure(minutes),
      heure_fin: minutesVersHeure(minutes + dureeMinutes),
    }));
}

export function calculerDateFinRecherche(dateOrigine, dateFinSession) {
  const dateDebut = parseDateLocale(dateOrigine);
  const dateFinValide =
    dateFinSession && !Number.isNaN(parseDateLocale(dateFinSession).getTime())
      ? parseDateLocale(dateFinSession)
      : null;

  if (dateFinValide && dateFinValide.getTime() >= dateDebut.getTime()) {
    const dateFinEtendue = new Date(dateFinValide);
    dateFinEtendue.setDate(
      dateFinEtendue.getDate() + NOMBRE_JOURS_RATTRAPAGE_APRES_SESSION
    );
    return formatDateLocale(dateFinEtendue);
  }

  const dateSecours = new Date(dateDebut);
  dateSecours.setDate(dateSecours.getDate() + NOMBRE_JOURS_RECHERCHE_SECOURS);
  return formatDateLocale(dateSecours);
}

function maximumDate(dateA, dateB) {
  return String(dateA).localeCompare(String(dateB), "fr") >= 0 ? dateA : dateB;
}

function debutDeSemaineLocale(dateString) {
  const date = parseDateLocale(dateString);
  const jour = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - (jour - 1));
  return formatDateLocale(date);
}

function finDeSemaineLocale(dateString) {
  const date = parseDateLocale(debutDeSemaineLocale(dateString));
  date.setDate(date.getDate() + 6);
  return formatDateLocale(date);
}

function differenceJours(dateReference, dateComparaison) {
  return Math.round(
    (parseDateLocale(dateReference).getTime() -
      parseDateLocale(dateComparaison).getTime()) /
      MILLISECONDES_PAR_JOUR
  );
}

function nombreSemainesEntre(dateSemaineOrigine, dateSemaineCandidate) {
  return Math.round(
    differenceJours(dateSemaineCandidate, dateSemaineOrigine) / 7
  );
}

function classerTypeReplanification(dateOrigine, nouvelleDate) {
  return debutDeSemaineLocale(dateOrigine) === debutDeSemaineLocale(nouvelleDate)
    ? "meme_semaine"
    : "semaines_suivantes";
}

export function maximumHebdomadairePourCible(dateOrigine, dateCandidate) {
  return classerTypeReplanification(dateOrigine, dateCandidate) === "meme_semaine"
    ? REQUIRED_WEEKLY_SESSIONS_PER_GROUP
    : MAX_WEEKLY_SESSIONS_PER_GROUP_WITH_RECOVERY;
}

function creneauEstPasse(date, heureFin) {
  const maintenant = new Date();
  const dateAujourdhui = formatDateLocale(maintenant);

  if (String(date).localeCompare(dateAujourdhui, "fr") < 0) {
    return true;
  }

  if (String(date).localeCompare(dateAujourdhui, "fr") > 0) {
    return false;
  }

  const minutesActuelles = maintenant.getHours() * 60 + maintenant.getMinutes();
  return heureVersMinutes(heureFin) <= minutesActuelles;
}

function genererDatesRecherchePriorisees(dateOrigine, dateFin) {
  const dateAujourdhui = formatDateLocale(new Date());
  const dateDepart = maximumDate(debutDeSemaineLocale(dateOrigine), dateAujourdhui);

  if (String(dateDepart).localeCompare(String(dateFin), "fr") > 0) {
    return [];
  }

  const debutSemaineOrigine = debutDeSemaineLocale(dateOrigine);
  const jourOrigine = convertirDateEnJourSemaine(dateOrigine);

  return genererDatesRecherche(dateDepart, dateFin).sort((dateA, dateB) => {
    const semaineA = Math.max(
      0,
      nombreSemainesEntre(debutSemaineOrigine, debutDeSemaineLocale(dateA))
    );
    const semaineB = Math.max(
      0,
      nombreSemainesEntre(debutSemaineOrigine, debutDeSemaineLocale(dateB))
    );

    if (semaineA !== semaineB) {
      return semaineA - semaineB;
    }

    const distanceJourA = Math.abs(convertirDateEnJourSemaine(dateA) - jourOrigine);
    const distanceJourB = Math.abs(convertirDateEnJourSemaine(dateB) - jourOrigine);

    if (distanceJourA !== distanceJourB) {
      return distanceJourA - distanceJourB;
    }

    const directionA = differenceJours(dateA, dateOrigine) < 0 ? 1 : 0;
    const directionB = differenceJours(dateB, dateOrigine) < 0 ? 1 : 0;

    if (directionA !== directionB) {
      return directionA - directionB;
    }

    return String(dateA).localeCompare(String(dateB), "fr");
  });
}

function reservationTransitoireEnConflit(
  reservations,
  date,
  heureDebut,
  heureFin
) {
  return reservations.some((reservation) => {
    if (reservation.date !== date) {
      return false;
    }

    if (
      !horairesChevauchent(
        reservation.heure_debut,
        reservation.heure_fin,
        heureDebut,
        heureFin
      )
    ) {
      return false;
    }

    // Toutes les reservations temporaires de ce service concernent
    // le meme professeur; un chevauchement horaire suffit donc deja
    // a invalider le placement candidat.
    return true;
  });
}

function compterReservationsTransitoiresSemaine(
  reservations,
  idGroupe,
  dateCandidate
) {
  const debutSemaine = debutDeSemaineLocale(dateCandidate);
  const finSemaine = finDeSemaineLocale(dateCandidate);

  return reservations.filter(
    (reservation) =>
      Array.isArray(reservation.groupes_ids) &&
      reservation.groupes_ids.some(
        (groupeId) => Number(groupeId) === Number(idGroupe)
      ) &&
      String(reservation.date).localeCompare(debutSemaine, "fr") >= 0 &&
      String(reservation.date).localeCompare(finSemaine, "fr") <= 0
  ).length;
}

async function recupererChargesHebdomadairesGroupes(
  groupeIds,
  dateCandidate,
  idsAffectationsImpactees,
  chargeHebdomadaireCache,
  connection
) {
  const idsValides = [...new Set(
    (Array.isArray(groupeIds) ? groupeIds : [])
      .map((idGroupe) => Number(idGroupe))
      .filter((idGroupe) => Number.isInteger(idGroupe) && idGroupe > 0)
  )];

  if (idsValides.length === 0) {
    return new Map();
  }

  const debutSemaine = debutDeSemaineLocale(dateCandidate);
  const finSemaine = finDeSemaineLocale(dateCandidate);
  const cleCache = `${debutSemaine}|${idsValides.join(",")}|${idsAffectationsImpactees
    .map((idAffectation) => Number(idAffectation))
    .sort((idA, idB) => idA - idB)
    .join(",")}`;

  if (chargeHebdomadaireCache.has(cleCache)) {
    return new Map(chargeHebdomadaireCache.get(cleCache));
  }

  const placeholdersGroupes = idsValides.map(() => "?").join(", ");
  const valeurs = [...idsValides, debutSemaine, finSemaine];
  let clauseExclusion = "";

  if (idsAffectationsImpactees.length > 0) {
    const placeholdersAffectations = idsAffectationsImpactees.map(() => "?").join(", ");
    clauseExclusion = ` AND ac.id_affectation_cours NOT IN (${placeholdersAffectations})`;
    valeurs.push(...idsAffectationsImpactees);
  }

  const [rows] = await connection.query(
    `SELECT ag.id_groupes_etudiants,
            COUNT(DISTINCT ac.id_affectation_cours) AS total
     FROM affectation_groupes ag
     JOIN affectation_cours ac
       ON ac.id_affectation_cours = ag.id_affectation_cours
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ag.id_groupes_etudiants IN (${placeholdersGroupes})
       AND ph.date >= ?
       AND ph.date <= ?${clauseExclusion}
     GROUP BY ag.id_groupes_etudiants`,
    valeurs
  );

  const charges = new Map(
    idsValides.map((idGroupe) => [idGroupe, 0])
  );
  rows.forEach((row) => {
    charges.set(
      Number(row.id_groupes_etudiants),
      Number(row.total || 0)
    );
  });
  chargeHebdomadaireCache.set(cleCache, new Map(charges));

  return charges;
}

function calculerScorePlacementCandidat({
  affectation,
  date,
  creneau,
  salle,
  chargesHebdomadaires,
  reservationsTransitoires,
}) {
  let score = 0;
  const typeReplanification = classerTypeReplanification(affectation.date, date);
  const differenceDate = Math.abs(differenceJours(date, affectation.date));
  const differenceHeure =
    Math.abs(heureVersMinutes(creneau.heure_debut) - heureVersMinutes(affectation.heure_debut)) /
    PAS_RECHERCHE_MINUTES;
  const chargeMaxGroupe = Math.max(
    ...affectation.groupes_details.map((groupe) => {
      const base = chargesHebdomadaires.get(Number(groupe.id_groupes_etudiants)) || 0;
      const transitoires = compterReservationsTransitoiresSemaine(
        reservationsTransitoires,
        Number(groupe.id_groupes_etudiants),
        date
      );
      return base + transitoires + 1;
    }),
    1
  );

  if (typeReplanification === "meme_semaine") {
    score += 130;
  } else {
    score += 50;
  }

  if (String(date) === String(affectation.date)) {
    score += 110;
  } else {
    score -= differenceDate * 7;
  }

  if (
    String(creneau.heure_debut) === String(normaliserHeure(affectation.heure_debut)) &&
    String(creneau.heure_fin) === String(normaliserHeure(affectation.heure_fin))
  ) {
    score += 120;
  } else {
    score -= differenceHeure * 10;
  }

  if (Number(salle?.id_salle || 0) === Number(affectation.id_salle || 0)) {
    score += 30;
  }

  score -= Math.max(0, chargeMaxGroupe - REQUIRED_WEEKLY_SESSIONS_PER_GROUP) * 25;
  score -= Math.max(0, Number(salle?.capacite || 0) - 40);

  return score;
}

function construireResumeSeance(affectation, prochainPlacement = null) {
  const groupesIds = Array.isArray(affectation.groupes_details)
    ? affectation.groupes_details
        .map((groupe) => Number(groupe.id_groupes_etudiants))
        .filter((idGroupe) => Number.isFinite(idGroupe))
    : [];
  const resume = {
    id_affectation_cours: Number(affectation.id_affectation_cours),
    id_professeur: Number(affectation.id_professeur) || null,
    code_cours: affectation.code_cours,
    nom_cours: affectation.nom_cours,
    groupes: affectation.groupes || "",
    groupes_ids: groupesIds,
    ancien_creneau: {
      date: affectation.date,
      heure_debut: normaliserHeure(affectation.heure_debut),
      heure_fin: normaliserHeure(affectation.heure_fin),
      id_salle: Number(affectation.id_salle) || null,
      code_salle: affectation.code_salle || "EN LIGNE",
    },
  };

  if (prochainPlacement) {
    resume.type_replanification = classerTypeReplanification(
      affectation.date,
      prochainPlacement.date
    );
    resume.ecart_jours = differenceJours(
      prochainPlacement.date,
      affectation.date
    );
    resume.nouveau_creneau = {
      date: prochainPlacement.date,
      heure_debut: normaliserHeure(prochainPlacement.heure_debut),
      heure_fin: normaliserHeure(prochainPlacement.heure_fin),
      id_salle: Number(prochainPlacement.id_salle) || null,
      code_salle: prochainPlacement.code_salle || "EN LIGNE",
    };
  }

  return resume;
}

function construireResultatReplanification({
  idProfesseur,
  seancesImpactees = [],
  deplacementsPlanifies = [],
  seancesNonReplanifiees = [],
  statutForce = null,
  messageForce = null,
}) {
  const seancesDeplacees = deplacementsPlanifies.map((deplacement) =>
    construireResumeSeance(deplacement.affectation, deplacement.placement)
  );
  const replanifieesMemeSemaine = seancesDeplacees.filter(
    (seance) => seance.type_replanification === "meme_semaine"
  ).length;
  const reporteesSemainesSuivantes =
    seancesDeplacees.length - replanifieesMemeSemaine;
  const groupesImpactes = [
    ...new Set(
      seancesImpactees.flatMap((seance) =>
        Array.isArray(seance.groupes_details)
          ? seance.groupes_details
              .map((groupe) => Number(groupe.id_groupes_etudiants))
              .filter((idGroupe) => Number.isFinite(idGroupe))
          : []
      )
    ),
  ].sort((idA, idB) => idA - idB);
  const sallesImpactees = [
    ...new Set(
      [
        ...seancesImpactees
          .map((seance) => Number(seance.id_salle))
          .filter((idSalle) => Number.isFinite(idSalle) && idSalle > 0),
        ...deplacementsPlanifies
          .map((deplacement) => Number(deplacement.placement.id_salle))
          .filter((idSalle) => Number.isFinite(idSalle) && idSalle > 0),
      ]
    ),
  ].sort((idA, idB) => idA - idB);

  let statut = statutForce;

  if (!statut) {
    if (seancesImpactees.length === 0) {
      statut = "aucun-impact";
    } else if (seancesNonReplanifiees.length > 0) {
      statut = "echec";
    } else {
      statut = "succes";
    }
  }

  let message = messageForce;

  if (!message) {
    if (statut === "aucun-impact") {
      message =
        "Les disponibilites du professeur ont ete mises a jour avec succes. Aucun cours planifie n'a ete impacte.";
    } else if (statut === "echec") {
      message =
        "Certains cours n'ont pas pu etre replanifies automatiquement. Une intervention manuelle est requise pour finaliser l'ajustement de l'horaire.";
    } else if (reporteesSemainesSuivantes > 0) {
      message =
        "La modification des disponibilites a impacte certains cours planifies. Une replanification automatique ciblee a ete effectuee avec succes et certains cours ont ete reportes sur une semaine suivante.";
    } else {
      message =
        "La modification des disponibilites a impacte certains cours planifies. Une replanification automatique ciblee a ete effectuee avec succes sans modifier le reste de l'horaire.";
    }
  }

  return {
    statut,
    message,
    seances_concernees: seancesImpactees.length,
    seances_deplacees: seancesDeplacees,
    seances_non_replanifiees: seancesNonReplanifiees,
    resume: {
      seances_concernees: seancesImpactees.length,
      seances_replanifiees: seancesDeplacees.length,
      seances_replanifiees_meme_semaine: replanifieesMemeSemaine,
      seances_reportees_semaines_suivantes: reporteesSemainesSuivantes,
      seances_non_replanifiees: seancesNonReplanifiees.length,
    },
    professeurs_impactes: [Number(idProfesseur)],
    groupes_impactes: groupesImpactes,
    salles_impactees: sallesImpactees,
  };
}

async function recupererSessionActive(connection) {
  const [rows] = await connection.query(
    `SELECT id_session, nom, date_debut, date_fin
     FROM sessions
     WHERE active = TRUE
     ORDER BY id_session DESC
     LIMIT 1`
  );

  return rows[0] || null;
}

async function recupererSalles(connection) {
  const [rows] = await connection.query(
    `SELECT id_salle, code, type, capacite
     FROM salles
     ORDER BY capacite ASC, code ASC`
  );

  return rows;
}

async function recupererAbsencesProfesseur(idProfesseur, connection) {
  const [rows] = await connection.query(
    `SELECT date_debut, date_fin, type
     FROM absences_professeurs
     WHERE id_professeur = ?
       AND date_fin >= CURDATE()
     ORDER BY date_debut ASC`,
    [idProfesseur]
  );

  return rows;
}

async function recupererSallesIndisponibles(connection) {
  const [rows] = await connection.query(
    `SELECT id_salle, date_debut, date_fin, raison
     FROM salles_indisponibles
     WHERE date_fin >= CURDATE()
     ORDER BY id_salle ASC, date_debut ASC`
  );

  const indisponibilitesParSalle = new Map();

  rows.forEach((row) => {
    const idSalle = Number(row.id_salle);
    if (!indisponibilitesParSalle.has(idSalle)) {
      indisponibilitesParSalle.set(idSalle, []);
    }
    indisponibilitesParSalle.get(idSalle).push(row);
  });

  return indisponibilitesParSalle;
}

async function recupererSeancesAVenirProfesseur(
  idProfesseur,
  idSession,
  connection
) {
  const [rows] = await connection.query(
    `SELECT ac.id_affectation_cours,
            ac.id_cours,
            ac.id_salle,
            ac.id_plage_horaires,
            c.code AS code_cours,
            c.nom AS nom_cours,
            c.duree,
            c.programme,
            c.etape_etude,
            c.type_salle,
            c.id_salle_reference,
            s.code AS code_salle,
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
       AND ge.id_session = ?
       AND (
         ph.date > CURDATE()
         OR (ph.date = CURDATE() AND ph.heure_fin >= CURTIME())
       )
     GROUP BY ac.id_affectation_cours,
              ac.id_cours,
              ac.id_salle,
              ac.id_plage_horaires,
              c.code,
              c.nom,
              c.duree,
              c.programme,
              c.etape_etude,
              c.type_salle,
              c.id_salle_reference,
              s.code,
              ph.date,
              ph.heure_debut,
              ph.heure_fin
     ORDER BY ph.date ASC, ph.heure_debut ASC, ac.id_affectation_cours ASC`,
    [idProfesseur, idSession]
  );

  return rows.map((row) => ({
    ...row,
    id_affectation_cours: Number(row.id_affectation_cours),
    id_cours: Number(row.id_cours),
    id_salle: Number(row.id_salle),
    id_plage_horaires: Number(row.id_plage_horaires),
  }));
}

async function recupererGroupesAffectation(idAffectation, connection) {
  const [rows] = await connection.query(
    `SELECT ge.id_groupes_etudiants,
            ge.nom_groupe,
            ge.taille_max,
            ge.programme,
            ge.etape,
            COUNT(e.id_etudiant) AS effectif
     FROM affectation_groupes ag
     JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
     LEFT JOIN etudiants e
       ON e.id_groupes_etudiants = ge.id_groupes_etudiants
     WHERE ag.id_affectation_cours = ?
     GROUP BY ge.id_groupes_etudiants,
              ge.nom_groupe,
              ge.taille_max,
              ge.programme,
              ge.etape
     ORDER BY ge.nom_groupe ASC`,
    [idAffectation]
  );

  return rows.map((row) => ({
    ...row,
    id_groupes_etudiants: Number(row.id_groupes_etudiants),
    taille_max: Number(row.taille_max) || 0,
    effectif: Number(row.effectif) || 0,
  }));
}

async function verifierConflitProfesseurHorsSeancesImpactees(
  idProfesseur,
  date,
  heureDebut,
  heureFin,
  idsAffectationsImpactees,
  connection
) {
  const valeurs = [
    idProfesseur,
    date,
    normaliserHeure(heureFin),
    normaliserHeure(heureDebut),
  ];
  let clauseExclusion = "";

  if (idsAffectationsImpactees.length > 0) {
    const placeholders = idsAffectationsImpactees.map(() => "?").join(", ");
    clauseExclusion = ` AND ac.id_affectation_cours NOT IN (${placeholders})`;
    valeurs.push(...idsAffectationsImpactees);
  }

  const [rows] = await connection.query(
    `SELECT COUNT(*) AS conflits
     FROM affectation_cours ac
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ac.id_professeur = ?
       AND ph.date = ?
       AND ph.heure_debut < ?
       AND ph.heure_fin > ?${clauseExclusion}`,
    valeurs
  );

  return Number(rows[0]?.conflits || 0) > 0;
}

async function verifierConflitSalleHorsSeancesImpactees(
  idSalle,
  date,
  heureDebut,
  heureFin,
  idsAffectationsImpactees,
  connection
) {
  const valeurs = [
    idSalle,
    date,
    normaliserHeure(heureFin),
    normaliserHeure(heureDebut),
  ];
  let clauseExclusion = "";

  if (idsAffectationsImpactees.length > 0) {
    const placeholders = idsAffectationsImpactees.map(() => "?").join(", ");
    clauseExclusion = ` AND ac.id_affectation_cours NOT IN (${placeholders})`;
    valeurs.push(...idsAffectationsImpactees);
  }

  const [rows] = await connection.query(
    `SELECT COUNT(*) AS conflits
     FROM affectation_cours ac
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ac.id_salle = ?
       AND ph.date = ?
       AND ph.heure_debut < ?
       AND ph.heure_fin > ?${clauseExclusion}`,
    valeurs
  );

  return Number(rows[0]?.conflits || 0) > 0;
}

async function verifierConflitGroupesHorsSeancesImpactees(
  groupeIds,
  date,
  heureDebut,
  heureFin,
  idsAffectationsImpactees,
  connection
) {
  if (!Array.isArray(groupeIds) || groupeIds.length === 0) {
    return false;
  }

  const placeholdersGroupes = groupeIds.map(() => "?").join(", ");
  const valeurs = [
    ...groupeIds,
    date,
    normaliserHeure(heureFin),
    normaliserHeure(heureDebut),
  ];
  let clauseExclusion = "";

  if (idsAffectationsImpactees.length > 0) {
    const placeholdersAffectations = idsAffectationsImpactees.map(() => "?").join(", ");
    clauseExclusion = ` AND ac.id_affectation_cours NOT IN (${placeholdersAffectations})`;
    valeurs.push(...idsAffectationsImpactees);
  }

  const [rows] = await connection.query(
    `SELECT COUNT(DISTINCT ac.id_affectation_cours) AS conflits
     FROM affectation_groupes ag
     JOIN affectation_cours ac
       ON ac.id_affectation_cours = ag.id_affectation_cours
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE ag.id_groupes_etudiants IN (${placeholdersGroupes})
       AND ph.date = ?
       AND ph.heure_debut < ?
       AND ph.heure_fin > ?${clauseExclusion}`,
    valeurs
  );

  return Number(rows[0]?.conflits || 0) > 0;
}

function salleEstIndisponible(idSalle, date, indisponibilitesParSalle) {
  const indisponibilites = indisponibilitesParSalle.get(Number(idSalle)) || [];

  return indisponibilites.some((indisponibilite) =>
    datesChevauchent(date, indisponibilite.date_debut, indisponibilite.date_fin)
  );
}

function professeurEstAbsent(date, absences) {
  return absences.some((absence) =>
    datesChevauchent(date, absence.date_debut, absence.date_fin)
  );
}

function trierSallesCompatiblesPourAffectation(
  affectation,
  salles,
  capaciteRequise
) {
  const sallesCompatibles = recupererSallesCompatiblesPourCours(affectation, salles)
    .filter((salle) => Number(salle.capacite || 0) >= capaciteRequise)
    .sort((salleA, salleB) => {
      const salleCouranteA = Number(salleA.id_salle) === Number(affectation.id_salle) ? 0 : 1;
      const salleCouranteB = Number(salleB.id_salle) === Number(affectation.id_salle) ? 0 : 1;

      if (salleCouranteA !== salleCouranteB) {
        return salleCouranteA - salleCouranteB;
      }

      if (Number(salleA.capacite) !== Number(salleB.capacite)) {
        return Number(salleA.capacite) - Number(salleB.capacite);
      }

      return String(salleA.code).localeCompare(String(salleB.code), "fr");
    });

  return sallesCompatibles;
}

async function trouverNouveauPlacement({
  affectation,
  disponibilites,
  absences,
  salles,
  indisponibilitesParSalle,
  reservationsTransitoires,
  idsAffectationsImpactees,
  dateFinSession,
  chargeHebdomadaireCache,
  connection,
}) {
  const groupeIds = affectation.groupes_details.map((groupe) => groupe.id_groupes_etudiants);
  const capaciteRequise = Math.max(
    1,
    affectation.groupes_details.reduce(
      (total, groupe) => total + (Number(groupe.effectif) || 0),
      0
    )
  );
  const sallesCompatibles = trierSallesCompatiblesPourAffectation(
    affectation,
    salles,
    capaciteRequise
  );

  if (sallesCompatibles.length === 0) {
    return {
      ok: false,
      raison:
        "Aucune salle compatible n'est assez grande pour ce groupe sur les seances a deplacer.",
    };
  }

  const dureeMinutes =
    Math.max(heureVersMinutes(affectation.heure_fin) - heureVersMinutes(affectation.heure_debut), 60);
  const datesRecherche = genererDatesRecherchePriorisees(
    affectation.date,
    calculerDateFinRecherche(affectation.date, dateFinSession)
  );
  let meilleurPlacement = null;
  let meilleurScore = Number.NEGATIVE_INFINITY;

  for (const date of datesRecherche) {
    if (professeurEstAbsent(date, absences)) {
      continue;
    }

    const heuresCandidates = genererHeuresCandidates(
      date,
      disponibilites,
      dureeMinutes,
      affectation.heure_debut
    );

    for (const creneau of heuresCandidates) {
      if (creneauEstPasse(date, creneau.heure_fin)) {
        continue;
      }

      if (
        !disponibiliteCouvreSeance(
          disponibilites,
          date,
          creneau.heure_debut,
          creneau.heure_fin
        )
      ) {
        continue;
      }

      if (
        reservationTransitoireEnConflit(
          reservationsTransitoires,
          date,
          creneau.heure_debut,
          creneau.heure_fin
        )
      ) {
        continue;
      }

      const conflitProfesseur = await verifierConflitProfesseurHorsSeancesImpactees(
        affectation.id_professeur,
        date,
        creneau.heure_debut,
        creneau.heure_fin,
        idsAffectationsImpactees,
        connection
      );

      if (conflitProfesseur) {
        continue;
      }

      const conflitGroupes = await verifierConflitGroupesHorsSeancesImpactees(
        groupeIds,
        date,
        creneau.heure_debut,
        creneau.heure_fin,
        idsAffectationsImpactees,
        connection
      );

      if (conflitGroupes) {
        continue;
      }

      const chargesHebdomadaires = await recupererChargesHebdomadairesGroupes(
        groupeIds,
        date,
        idsAffectationsImpactees,
        chargeHebdomadaireCache,
        connection
      );
      const chargeHebdomadaireValide = groupeIds.every((idGroupe) => {
        const base = chargesHebdomadaires.get(Number(idGroupe)) || 0;
        const transitoires = compterReservationsTransitoiresSemaine(
          reservationsTransitoires,
          Number(idGroupe),
          date
        );
        const maximumAutorise = maximumHebdomadairePourCible(
          affectation.date,
          date
        );

        return base + transitoires + 1 <= maximumAutorise;
      });

      if (!chargeHebdomadaireValide) {
        continue;
      }

      for (const salle of sallesCompatibles) {
        if (salleEstIndisponible(salle.id_salle, date, indisponibilitesParSalle)) {
          continue;
        }

        if (
          reservationTransitoireEnConflit(
            reservationsTransitoires,
            date,
            creneau.heure_debut,
            creneau.heure_fin
          )
        ) {
          continue;
        }

        const conflitSalle = await verifierConflitSalleHorsSeancesImpactees(
          salle.id_salle,
          date,
          creneau.heure_debut,
          creneau.heure_fin,
          idsAffectationsImpactees,
          connection
        );

        if (conflitSalle) {
          continue;
        }

        const score = calculerScorePlacementCandidat({
          affectation,
          date,
          creneau,
          salle,
          chargesHebdomadaires,
          reservationsTransitoires,
        });

        if (score > meilleurScore) {
          meilleurScore = score;
          meilleurPlacement = {
            date,
            heure_debut: creneau.heure_debut,
            heure_fin: creneau.heure_fin,
            id_salle: Number(salle.id_salle),
            code_salle: salle.code,
          };
        }
      }
    }
  }

  if (meilleurPlacement) {
    return {
      ok: true,
      placement: meilleurPlacement,
    };
  }

  return {
    ok: false,
    raison:
      "Aucun creneau compatible n'a ete trouve sur la fenetre de rattrapage automatique.",
  };
}

export async function replanifierSeancesImpacteesParDisponibilites(
  idProfesseur,
  disponibilites,
  connection,
  options = {}
) {
  const sessionActive = await recupererSessionActive(connection);

  if (!sessionActive) {
    return construireResultatReplanification({
      idProfesseur,
      seancesImpactees: [],
      deplacementsPlanifies: [],
      seancesNonReplanifiees: [],
    });
  }

  const [salles, absences, indisponibilitesParSalle, seancesAVenir] = await Promise.all([
    recupererSalles(connection),
    recupererAbsencesProfesseur(idProfesseur, connection),
    recupererSallesIndisponibles(connection),
    recupererSeancesAVenirProfesseur(idProfesseur, sessionActive.id_session, connection),
  ]);

  const dateDebutImpact = normaliserDateIso(options.dateDebutImpact || "");
  const dateFinImpact = normaliserDateIso(options.dateFinImpact || "");

  const seancesImpacteesBrutes = seancesAVenir.filter(
    (seance) =>
      (!dateDebutImpact || String(seance.date) >= dateDebutImpact) &&
      (!dateFinImpact || String(seance.date) <= dateFinImpact) &&
      !disponibiliteCouvreSeance(
        disponibilites,
        seance.date,
        seance.heure_debut,
        seance.heure_fin
      )
  );

  if (seancesImpacteesBrutes.length === 0) {
    return construireResultatReplanification({
      idProfesseur,
      seancesImpactees: [],
      deplacementsPlanifies: [],
      seancesNonReplanifiees: [],
    });
  }

  const seancesImpactees = await Promise.all(
    seancesImpacteesBrutes.map(async (seance) => {
      const groupesDetails = await recupererGroupesAffectation(
        seance.id_affectation_cours,
        connection
      );

      return {
        ...seance,
        id_professeur: Number(idProfesseur),
        groupes_details: groupesDetails,
      };
    })
  );

  seancesImpactees.sort((seanceA, seanceB) => {
    const sallesA = trierSallesCompatiblesPourAffectation(
      seanceA,
      salles,
      Math.max(
        1,
        seanceA.groupes_details.reduce(
          (total, groupe) => total + (Number(groupe.effectif) || 0),
          0
        )
      )
    ).length;
    const sallesB = trierSallesCompatiblesPourAffectation(
      seanceB,
      salles,
      Math.max(
        1,
        seanceB.groupes_details.reduce(
          (total, groupe) => total + (Number(groupe.effectif) || 0),
          0
        )
      )
    ).length;

    if (sallesA !== sallesB) {
      return sallesA - sallesB;
    }

    if (seanceA.date !== seanceB.date) {
      return String(seanceA.date).localeCompare(String(seanceB.date), "fr");
    }

    return normaliserHeure(seanceA.heure_debut).localeCompare(
      normaliserHeure(seanceB.heure_debut),
      "fr"
    );
  });

  const idsAffectationsImpactees = seancesImpactees.map(
    (seance) => Number(seance.id_affectation_cours)
  );
  const reservationsTransitoires = [];
  const chargeHebdomadaireCache = new Map();
  const deplacementsPlanifies = [];
  const seancesNonReplanifiees = [];

  for (const affectation of seancesImpactees) {
    const resultat = await trouverNouveauPlacement({
      affectation,
      disponibilites,
      absences,
      salles,
      indisponibilitesParSalle,
      reservationsTransitoires,
      idsAffectationsImpactees,
      dateFinSession: sessionActive.date_fin,
      chargeHebdomadaireCache,
      connection,
    });

    if (!resultat.ok) {
      seancesNonReplanifiees.push({
        ...construireResumeSeance(affectation),
        raison: resultat.raison,
      });
      continue;
    }

    reservationsTransitoires.push({
      id_affectation_cours: affectation.id_affectation_cours,
      date: resultat.placement.date,
      heure_debut: resultat.placement.heure_debut,
      heure_fin: resultat.placement.heure_fin,
      id_salle: resultat.placement.id_salle,
      groupes_ids: affectation.groupes_details.map((groupe) =>
        Number(groupe.id_groupes_etudiants)
      ),
    });

    deplacementsPlanifies.push({
      affectation,
      placement: resultat.placement,
    });
  }

  if (seancesNonReplanifiees.length > 0) {
    const replanification = construireResultatReplanification({
      idProfesseur,
      seancesImpactees,
      deplacementsPlanifies,
      seancesNonReplanifiees,
      statutForce: "echec",
    });
    const erreur = new Error(
      `Impossible de finaliser automatiquement la mise a jour des disponibilites: ${seancesNonReplanifiees.length} seance(s) reste(nt) sans creneau compatible dans la fenetre de rattrapage automatique.`
    );
    erreur.statusCode = 409;
    erreur.details = replanification.seances_non_replanifiees;
    erreur.replanification = replanification;
    throw erreur;
  }

  for (const deplacement of deplacementsPlanifies) {
    await connection.query(
      `UPDATE plages_horaires
       SET date = ?, heure_debut = ?, heure_fin = ?
       WHERE id_plage_horaires = ?`,
      [
        deplacement.placement.date,
        normaliserHeure(deplacement.placement.heure_debut),
        normaliserHeure(deplacement.placement.heure_fin),
        deplacement.affectation.id_plage_horaires,
      ]
    );

    await connection.query(
      `UPDATE affectation_cours
       SET id_salle = ?
       WHERE id_affectation_cours = ?`,
      [
        deplacement.placement.id_salle,
        deplacement.affectation.id_affectation_cours,
      ]
    );
  }

  return construireResultatReplanification({
    idProfesseur,
    seancesImpactees,
    deplacementsPlanifies,
    seancesNonReplanifiees: [],
    statutForce: "succes",
  });
}
