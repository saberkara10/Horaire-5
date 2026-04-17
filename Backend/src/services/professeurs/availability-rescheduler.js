/**
 * Service de replanification locale des seances impactees par une modification
 * de disponibilites professeur.
 *
 * Le but n'est pas de relancer tout le scheduler, mais de sauver localement
 * les seances a venir du professeur en cherchant un nouveau creneau compatible
 * avec les salles, les groupes et les reprises deja rattachees.
 */
import { recupererSallesCompatiblesPourCours } from "../../utils/groupes.js";
import {
  MAX_WEEKLY_SESSIONS_PER_GROUP_WITH_RECOVERY,
  REQUIRED_WEEKLY_SESSIONS_PER_GROUP,
} from "../scheduler/AcademicCatalog.js";
import { BreakConstraintValidator } from "../scheduler/constraints/BreakConstraintValidator.js";
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

/**
 * Calcule la borne maximale de recherche d'un rattrapage automatique.
 *
 * @param {string} dateOrigine Date initiale de la seance.
 * @param {string} dateFinSession Fin theorique de la session.
 * @returns {string} Date limite de recherche en ISO.
 */
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

/**
 * Retourne la charge hebdomadaire maximale autorisee pour un groupe deplace.
 *
 * @param {string} dateOrigine Date initiale de la seance.
 * @param {string} dateCandidate Date candidate retenue.
 * @returns {number} Plafond hebdomadaire autorise.
 */
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

function extraireIdEtudiantsSeance(affectation) {
  return [
    ...(Array.isArray(affectation?.etudiants_reguliers)
      ? affectation.etudiants_reguliers.map((etudiant) => Number(etudiant?.id_etudiant))
      : []),
    ...(Array.isArray(affectation?.etudiants_reprises)
      ? affectation.etudiants_reprises.map((etudiant) => Number(etudiant?.id_etudiant))
      : []),
  ]
    .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0);
}

function normaliserIdUnique(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  )];
}

function extrairePlacementsJourDepuisSeances(seances, date, idsAffectationsExclues = []) {
  const idsExclus = new Set(normaliserIdUnique(idsAffectationsExclues));

  return (Array.isArray(seances) ? seances : [])
    .filter(
      (seance) =>
        String(seance?.date) === String(date) &&
        !idsExclus.has(Number(seance?.id_affectation_cours))
    )
    .map((seance) => ({
      date: String(seance.date).slice(0, 10),
      heure_debut: normaliserHeure(seance.heure_debut),
      heure_fin: normaliserHeure(seance.heure_fin),
      id_affectation_cours: Number(seance.id_affectation_cours) || null,
    }))
    .filter(
      (seance) =>
        heureVersMinutes(seance.heure_debut) < heureVersMinutes(seance.heure_fin)
    );
}

function resumerViolationPause(violation, fallbackRole) {
  const role = String(violation?.resourceType || fallbackRole || "ressource");
  return `Contrainte de pause invalide pour ${role}: ${violation?.message || "pause insuffisante."}`;
}

function validerPauseRessource({
  resourceType,
  resourceId,
  placements,
  proposedPlacement,
}) {
  return BreakConstraintValidator.validateSequenceBreakConstraint({
    placements,
    proposedPlacement,
    resourceType,
    resourceId,
  });
}

async function recupererPlacementsEtudiantsJour(
  etudiantIds,
  date,
  idsAffectationsImpactees,
  connection
) {
  const idsValides = normaliserIdUnique(etudiantIds);

  if (idsValides.length === 0) {
    return new Map();
  }

  const placeholders = idsValides.map(() => "?").join(", ");
  let clauseExclusion = "";
  const valeursExclusion = [];

  if (idsAffectationsImpactees.length > 0) {
    const placeholdersAffectations = idsAffectationsImpactees.map(() => "?").join(", ");
    clauseExclusion = ` AND ac.id_affectation_cours NOT IN (${placeholdersAffectations})`;
    valeursExclusion.push(...idsAffectationsImpactees);
  }

  const [rows] = await connection.query(
    `SELECT DISTINCT e.id_etudiant,
            ac.id_affectation_cours,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            ph.heure_debut,
            ph.heure_fin
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
       AND ph.date = ?
       AND NOT EXISTS (
         SELECT 1
         FROM affectation_etudiants ae_override
         WHERE ae_override.id_etudiant = e.id_etudiant
           AND ae_override.id_cours = ac.id_cours
           AND ae_override.id_session = ge.id_session
           AND ae_override.source_type = 'individuelle'
       )${clauseExclusion}
     UNION
     SELECT DISTINCT e.id_etudiant,
            ac.id_affectation_cours,
            DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
            ph.heure_debut,
            ph.heure_fin
     FROM affectation_etudiants ae
     JOIN etudiants e
       ON e.id_etudiant = ae.id_etudiant
     JOIN affectation_groupes ag
       ON ag.id_groupes_etudiants = ae.id_groupes_etudiants
     JOIN affectation_cours ac
       ON ac.id_affectation_cours = ag.id_affectation_cours
      AND ac.id_cours = ae.id_cours
     JOIN plages_horaires ph
       ON ph.id_plage_horaires = ac.id_plage_horaires
     WHERE e.id_etudiant IN (${placeholders})
       AND ae.source_type IN ('reprise', 'individuelle')
       AND ph.date = ?${clauseExclusion}
     ORDER BY id_etudiant ASC, heure_debut ASC, heure_fin ASC, id_affectation_cours ASC`,
    [...idsValides, date, ...valeursExclusion, ...idsValides, date, ...valeursExclusion]
  );

  const placementsParEtudiant = new Map();

  rows.forEach((row) => {
    const idEtudiant = Number(row.id_etudiant);
    if (!placementsParEtudiant.has(idEtudiant)) {
      placementsParEtudiant.set(idEtudiant, []);
    }

    placementsParEtudiant.get(idEtudiant).push({
      id_etudiant: idEtudiant,
      id_affectation_cours: Number(row.id_affectation_cours) || null,
      date: String(row.date || "").slice(0, 10),
      heure_debut: normaliserHeure(row.heure_debut),
      heure_fin: normaliserHeure(row.heure_fin),
    });
  });

  return placementsParEtudiant;
}

function trouverViolationPausePourRessource({
  resourceType,
  resourceId,
  placements,
  proposedPlacement,
}) {
  const resultat = validerPauseRessource({
    resourceType,
    resourceId,
    placements,
    proposedPlacement,
  });

  return resultat.valid ? null : resultat.violations[0] || null;
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

function dedupeByNumericKey(items, key) {
  const index = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const valeur = Number(item?.[key]);
    if (!Number.isInteger(valeur) || valeur <= 0 || index.has(valeur)) {
      continue;
    }
    index.set(valeur, item);
  }

  return [...index.values()];
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
    groupes_details: Array.isArray(affectation.groupes_details)
      ? affectation.groupes_details
      : [],
    etudiants_reguliers: Array.isArray(affectation.etudiants_reguliers)
      ? affectation.etudiants_reguliers
      : [],
    etudiants_reprises: Array.isArray(affectation.etudiants_reprises)
      ? affectation.etudiants_reprises
      : [],
    total_etudiants_reguliers: Array.isArray(affectation.etudiants_reguliers)
      ? affectation.etudiants_reguliers.length
      : 0,
    total_etudiants_reprises: Array.isArray(affectation.etudiants_reprises)
      ? affectation.etudiants_reprises.length
      : 0,
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
  fenetreImpact = null,
}) {
  const seancesDeplacees = deplacementsPlanifies.map((deplacement) =>
    construireResumeSeance(deplacement.affectation, deplacement.placement)
  );
  const seancesBloquees = seancesNonReplanifiees.map((seance) => ({
    ...seance,
    action_finale: "retiree_de_l_horaire",
  }));
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
  const groupesImpactesDetails = dedupeByNumericKey(
    seancesImpactees.flatMap((seance) => seance.groupes_details || []),
    "id_groupes_etudiants"
  );
  const etudiantsReguliersImpactes = dedupeByNumericKey(
    seancesImpactees.flatMap((seance) => seance.etudiants_reguliers || []),
    "id_etudiant"
  );
  const etudiantsReprisesImpactes = dedupeByNumericKey(
    seancesImpactees.flatMap((seance) => seance.etudiants_reprises || []),
    "id_etudiant"
  );
  const coursImpactes = dedupeByNumericKey(
    seancesImpactees.map((seance) => ({
      id_cours: Number(seance.id_cours) || null,
      code_cours: seance.code_cours || null,
      nom_cours: seance.nom_cours || null,
    })),
    "id_cours"
  );

  let statut = statutForce;

  if (!statut) {
    if (seancesImpactees.length === 0) {
      statut = "aucun-impact";
    } else if (seancesNonReplanifiees.length > 0) {
      statut = seancesDeplacees.length > 0 ? "partiel" : "echec";
    } else {
      statut = "succes";
    }
  }

  let message = messageForce;

  if (!message) {
    if (statut === "aucun-impact") {
      message =
        "Les disponibilites du professeur ont ete mises a jour avec succes. Aucun cours planifie n'a ete impacte.";
    } else if (statut === "partiel") {
      message =
        "Les disponibilites du professeur ont ete mises a jour. Certaines seances ont ete replanifiees, mais les seances restantes sans creneau compatible ont ete retirees des horaires valides et journalisees pour correction manuelle.";
    } else if (statut === "echec") {
      message =
        "Les disponibilites du professeur ont ete mises a jour, mais aucune solution automatique n'a ete trouvee pour toutes les seances impactees. Les seances bloquees ont ete retirees des horaires valides et doivent etre replanifiees manuellement.";
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
    seances_non_replanifiees: seancesBloquees,
    resume: {
      seances_concernees: seancesImpactees.length,
      seances_replanifiees: seancesDeplacees.length,
      seances_replanifiees_meme_semaine: replanifieesMemeSemaine,
      seances_reportees_semaines_suivantes: reporteesSemainesSuivantes,
      seances_non_replanifiees: seancesNonReplanifiees.length,
      seances_retirees_horaire: seancesNonReplanifiees.length,
      etudiants_reguliers_impactes: etudiantsReguliersImpactes.length,
      etudiants_reprises_impactes: etudiantsReprisesImpactes.length,
    },
    fenetre_impact: fenetreImpact,
    professeurs_impactes: [Number(idProfesseur)],
    groupes_impactes: groupesImpactes,
    groupes_impactes_details: groupesImpactesDetails,
    salles_impactees: sallesImpactees,
    etudiants_reguliers_impactes: etudiantsReguliersImpactes,
    etudiants_reprises_impactes: etudiantsReprisesImpactes,
    etudiants_impactes: dedupeByNumericKey(
      [...etudiantsReguliersImpactes, ...etudiantsReprisesImpactes],
      "id_etudiant"
    ),
    cours_impactes: coursImpactes,
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

async function recupererEtudiantsReguliersImpactes(
  groupeIds,
  connection
) {
  const idsValides = [...new Set(
    (Array.isArray(groupeIds) ? groupeIds : [])
      .map((idGroupe) => Number(idGroupe))
      .filter((idGroupe) => Number.isInteger(idGroupe) && idGroupe > 0)
  )];

  if (idsValides.length === 0) {
    return [];
  }

  const placeholders = idsValides.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT e.id_etudiant,
            e.matricule,
            e.nom,
            e.prenom,
            ge.id_groupes_etudiants AS id_groupe_principal,
            ge.nom_groupe AS groupe_principal
     FROM etudiants e
     LEFT JOIN groupes_etudiants ge
       ON ge.id_groupes_etudiants = e.id_groupes_etudiants
     WHERE e.id_groupes_etudiants IN (${placeholders})
     ORDER BY e.matricule ASC, e.nom ASC, e.prenom ASC`,
    idsValides
  );

  return rows.map((row) => ({
    id_etudiant: Number(row.id_etudiant),
    matricule: row.matricule || null,
    nom: row.nom || null,
    prenom: row.prenom || null,
    id_groupe_principal: Number(row.id_groupe_principal) || null,
    groupe_principal: row.groupe_principal || null,
    type_impact: "regulier",
  }));
}

async function recupererEtudiantsReprisesImpactes(
  groupeIds,
  idCours,
  idSession,
  connection
) {
  const idsValides = [...new Set(
    (Array.isArray(groupeIds) ? groupeIds : [])
      .map((idGroupe) => Number(idGroupe))
      .filter((idGroupe) => Number.isInteger(idGroupe) && idGroupe > 0)
  )];

  if (idsValides.length === 0 || !Number.isInteger(Number(idCours)) || Number(idCours) <= 0) {
    return [];
  }

  const placeholders = idsValides.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT DISTINCT e.id_etudiant,
            e.matricule,
            e.nom,
            e.prenom,
            ge_principal.id_groupes_etudiants AS id_groupe_principal,
            ge_principal.nom_groupe AS groupe_principal,
            ae.id_cours_echoue,
            ae.source_type,
            ae.id_echange_cours
     FROM affectation_etudiants ae
     JOIN etudiants e
       ON e.id_etudiant = ae.id_etudiant
     LEFT JOIN groupes_etudiants ge_principal
       ON ge_principal.id_groupes_etudiants = e.id_groupes_etudiants
     WHERE ae.id_groupes_etudiants IN (${placeholders})
       AND ae.id_cours = ?
       AND (? IS NULL OR ae.id_session = ?)
     ORDER BY e.matricule ASC, e.nom ASC, e.prenom ASC`,
    [...idsValides, Number(idCours), Number(idSession) || null, Number(idSession) || null]
  );

  return rows.map((row) => ({
    id_etudiant: Number(row.id_etudiant),
    matricule: row.matricule || null,
    nom: row.nom || null,
    prenom: row.prenom || null,
    id_groupe_principal: Number(row.id_groupe_principal) || null,
    groupe_principal: row.groupe_principal || null,
    id_cours_echoue: Number(row.id_cours_echoue) || null,
    id_echange_cours: Number(row.id_echange_cours) || null,
    type_impact:
      String(row.source_type || "") === "reprise" ? "reprise" : "individuelle",
  }));
}

async function supprimerAffectationsInvalides(
  seances,
  connection
) {
  const idsAffectations = [...new Set(
    (Array.isArray(seances) ? seances : [])
      .map((seance) => Number(seance?.id_affectation_cours))
      .filter((idAffectation) => Number.isInteger(idAffectation) && idAffectation > 0)
  )];
  const idsPlages = [...new Set(
    (Array.isArray(seances) ? seances : [])
      .map((seance) => Number(seance?.id_plage_horaires))
      .filter((idPlage) => Number.isInteger(idPlage) && idPlage > 0)
  )];

  if (idsAffectations.length === 0) {
    return;
  }

  const placeholdersAffectations = idsAffectations.map(() => "?").join(", ");
  // On retire d'abord les liens de groupe, puis les affectations, puis
  // les plages orphelines qui ne sont plus referencees nulle part.
  await connection.query(
    `DELETE FROM affectation_groupes
     WHERE id_affectation_cours IN (${placeholdersAffectations})`,
    idsAffectations
  );
  await connection.query(
    `DELETE FROM affectation_cours
     WHERE id_affectation_cours IN (${placeholdersAffectations})`,
    idsAffectations
  );

  if (idsPlages.length === 0) {
    return;
  }

  const placeholdersPlages = idsPlages.map(() => "?").join(", ");
  await connection.query(
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

/**
 * Cherche le meilleur creneau de remplacement pour une seance impactee.
 *
 * La recherche privilegie :
 * - les semaines proches de l'origine ;
 * - les heures les plus proches du creneau initial ;
 * - la reutilisation de la salle courante si elle reste viable.
 *
 * @param {Object} payload Contexte complet de la seance a deplacer.
 * @returns {Promise<Object>} Placement retenu ou raison de blocage.
 */
async function trouverNouveauPlacement({
  affectation,
  disponibilites,
  absences,
  salles,
  indisponibilitesParSalle,
  seancesAVenir,
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
  let raisonPauseDetectee = null;

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

        const placementCandidat = {
          id_affectation_cours: Number(affectation.id_affectation_cours),
          date,
          heure_debut: creneau.heure_debut,
          heure_fin: creneau.heure_fin,
        };
        let pauseViolated = false;
        const placementsProfesseurJour = extrairePlacementsJourDepuisSeances(
          [
            ...seancesAVenir,
            ...reservationsTransitoires.filter(
              (reservation) =>
                Number(reservation.id_professeur) === Number(affectation.id_professeur)
            ),
          ],
          date,
          idsAffectationsImpactees
        );
        const violationPauseProfesseur = trouverViolationPausePourRessource({
          resourceType: "professeur",
          resourceId: Number(affectation.id_professeur) || null,
          placements: placementsProfesseurJour,
          proposedPlacement: placementCandidat,
        });

        if (violationPauseProfesseur) {
          raisonPauseDetectee =
            raisonPauseDetectee ||
            resumerViolationPause(violationPauseProfesseur, "professeur");
          continue;
        }

        const etudiantsIds = extraireIdEtudiantsSeance(affectation);

        if (etudiantsIds.length > 0) {
          const placementsEtudiantsParId = await recupererPlacementsEtudiantsJour(
            etudiantsIds,
            date,
            idsAffectationsImpactees,
            connection
          );

          for (const idEtudiant of etudiantsIds) {
            const placementsEtudiantJour = [
              ...(placementsEtudiantsParId.get(Number(idEtudiant)) || []),
              ...reservationsTransitoires
                .filter((reservation) =>
                  Array.isArray(reservation.etudiants_ids) &&
                  reservation.etudiants_ids.some(
                    (idReservation) => Number(idReservation) === Number(idEtudiant)
                  ) &&
                  String(reservation.date) === String(date)
                )
                .map((reservation) => ({
                  id_affectation_cours: Number(reservation.id_affectation_cours) || null,
                  date: String(reservation.date).slice(0, 10),
                  heure_debut: normaliserHeure(reservation.heure_debut),
                  heure_fin: normaliserHeure(reservation.heure_fin),
                })),
            ];

            const violationPauseEtudiant = trouverViolationPausePourRessource({
              resourceType: "etudiant",
              resourceId: Number(idEtudiant) || null,
              placements: placementsEtudiantJour,
              proposedPlacement: placementCandidat,
            });

            if (violationPauseEtudiant) {
              raisonPauseDetectee =
                raisonPauseDetectee ||
                resumerViolationPause(violationPauseEtudiant, "etudiant");
              pauseViolated = true;
              break;
            }
          }
        }

        if (pauseViolated) {
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
      raisonPauseDetectee ||
      "Aucun creneau compatible n'a ete trouve sur la fenetre de rattrapage automatique.",
  };
}

/**
 * Replanifie localement les seances a venir rendues invalides par une nouvelle
 * disponibilite professeur.
 *
 * @param {number} idProfesseur Identifiant du professeur impacte.
 * @param {Array<Object>} disponibilites Nouvelles disponibilites consolidees.
 * @param {Object} connection Connexion SQL transactionnelle.
 * @param {Object} [options={}] Bornes d'impact facultatives.
 * @returns {Promise<Object>} Rapport complet de replanification locale.
 */
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
      const groupeIds = groupesDetails.map((groupe) =>
        Number(groupe.id_groupes_etudiants)
      );
      const [etudiantsReguliers, etudiantsReprises] = await Promise.all([
        recupererEtudiantsReguliersImpactes(groupeIds, connection),
        recupererEtudiantsReprisesImpactes(
          groupeIds,
          Number(seance.id_cours),
          Number(sessionActive.id_session),
          connection
        ),
      ]);

      return {
        ...seance,
        id_professeur: Number(idProfesseur),
        groupes_details: groupesDetails,
        etudiants_reguliers: etudiantsReguliers,
        etudiants_reprises: etudiantsReprises,
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
      seancesAVenir,
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
      id_professeur: Number(affectation.id_professeur) || null,
      etudiants_ids: extraireIdEtudiantsSeance(affectation),
    });

    deplacementsPlanifies.push({
      affectation,
      placement: resultat.placement,
    });
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

  if (seancesNonReplanifiees.length > 0) {
    await supprimerAffectationsInvalides(
      seancesImpactees.filter((seance) =>
        seancesNonReplanifiees.some(
          (bloquee) =>
            Number(bloquee.id_affectation_cours) ===
            Number(seance.id_affectation_cours)
        )
      ),
      connection
    );
  }

  return construireResultatReplanification({
    idProfesseur,
    seancesImpactees,
    deplacementsPlanifies,
    seancesNonReplanifiees,
    statutForce:
      seancesNonReplanifiees.length > 0
        ? deplacementsPlanifies.length > 0
          ? "partiel"
          : "echec"
        : "succes",
    fenetreImpact: {
      date_debut: dateDebutImpact || null,
      date_fin: dateFinImpact || null,
    },
  });
}
