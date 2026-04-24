/**
 * UTILS - Occupation des salles
 *
 * Ces helpers purs reconstituent la semaine visible cote frontend a partir de
 * la liste `occupations` renvoyee par l'API. La vue des salles reutilise ainsi
 * le meme format de base que les horaires groupes/professeurs, tout en
 * enrichissant localement :
 * - les creneaux libres ;
 * - les indicateurs hebdomadaires V2 ;
 * - le resume dynamique V3 calcule a partir de l'heure courante du navigateur.
 */
import {
  JOURS_SEMAINE_COMPLETS,
  getDebutSemaine,
} from "./calendar.js";

const HEURE_DEBUT_JOURNEE = "08:00:00";
const HEURE_FIN_JOURNEE = "23:00:00";
const NB_JOURS_SEMAINE_AFFICHES = 7;

export const HEURES_GRILLE = Array.from({ length: 15 }, (_, index) =>
  `${String(index + 8).padStart(2, "0")}:00`
);

export function normaliserHeure(heure) {
  const valeur = String(heure || "").trim();

  if (!valeur) {
    return "";
  }

  if (valeur.length === 5) {
    return `${valeur}:00`;
  }

  return valeur.slice(0, 8);
}

export function heureEnMinutes(heure) {
  const [heures = "0", minutes = "0"] = normaliserHeure(heure).split(":");
  return Number(heures) * 60 + Number(minutes);
}

function estDateValide(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function parserDateValide(dateSource) {
  if (dateSource instanceof Date) {
    return estDateValide(dateSource) ? new Date(dateSource) : null;
  }

  const texte = String(dateSource || "").trim();

  if (!texte) {
    return null;
  }

  const dateIso = texte.includes("T") ? texte.slice(0, 10) : texte;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);

  if (match) {
    const [, annee, mois, jour] = match;
    const anneeNombre = Number(annee);
    const moisNombre = Number(mois);
    const jourNombre = Number(jour);
    const date = new Date(anneeNombre, moisNombre - 1, jourNombre);
    const dateCorrespond =
      date.getFullYear() === anneeNombre &&
      date.getMonth() === moisNombre - 1 &&
      date.getDate() === jourNombre;

    return estDateValide(date) && dateCorrespond ? date : null;
  }

  const fallback = new Date(texte);
  return estDateValide(fallback) ? fallback : null;
}

function getDebutSemaineValide(dateSource, fallback = new Date()) {
  const dateReference =
    parserDateValide(dateSource) || parserDateValide(fallback) || new Date();
  const debutSemaine = getDebutSemaine(dateReference);

  return estDateValide(debutSemaine) ? debutSemaine : getDebutSemaine(new Date());
}

export function formaterDateIsoLocal(dateSource) {
  const date = parserDateValide(dateSource) || new Date();

  if (!estDateValide(date)) {
    return formaterDateIsoLocal(new Date());
  }

  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function arrondirHeures(minutes) {
  return Math.round((Number(minutes || 0) / 60) * 100) / 100;
}

function arrondirTaux(valeur) {
  return Math.round(Number(valeur || 0) * 100) / 100;
}

function ajouterJours(dateSource, nbJours) {
  const date = new Date(dateSource);
  date.setDate(date.getDate() + nbJours);
  return date;
}

function normaliserListeValeurs(valeurs) {
  return [...new Set(
    (Array.isArray(valeurs) ? valeurs : [])
      .map((valeur) => String(valeur || "").trim())
      .filter(Boolean)
  )];
}

function construireCreneauLibre(date, jourSemaine, debutMinutes, finMinutes) {
  return {
    id_creneau: `libre-${date}-${debutMinutes}-${finMinutes}`,
    statut: "libre",
    date,
    jour_semaine: jourSemaine,
    debut_minutes: debutMinutes,
    fin_minutes: finMinutes,
    heure_debut: minutesVersHeure(debutMinutes),
    heure_fin: minutesVersHeure(finMinutes),
    duree_minutes: Math.max(0, finMinutes - debutMinutes),
  };
}

function minutesVersHeure(minutes) {
  const heures = Math.floor(minutes / 60);
  const minutesRestantes = minutes % 60;

  return `${String(heures).padStart(2, "0")}:${String(minutesRestantes).padStart(2, "0")}:00`;
}

function comparerOccupations(occupationA, occupationB) {
  if (occupationA.date !== occupationB.date) {
    return String(occupationA.date).localeCompare(String(occupationB.date), "fr");
  }

  if (occupationA.heure_debut !== occupationB.heure_debut) {
    return String(occupationA.heure_debut).localeCompare(
      String(occupationB.heure_debut),
      "fr"
    );
  }

  if (occupationA.heure_fin !== occupationB.heure_fin) {
    return String(occupationA.heure_fin).localeCompare(
      String(occupationB.heure_fin),
      "fr"
    );
  }

  return Number(occupationA.id_affectation_cours || 0) - Number(occupationB.id_affectation_cours || 0);
}

function fusionnerIntervalles(intervalles = [], borneDebut = 0, borneFin = Number.MAX_SAFE_INTEGER) {
  const intervallesFiltres = intervalles
    .map((intervalle) => ({
      debut: Math.max(borneDebut, Number(intervalle.debut || 0)),
      fin: Math.min(borneFin, Number(intervalle.fin || 0)),
    }))
    .filter((intervalle) => intervalle.fin > intervalle.debut)
    .sort((intervalleA, intervalleB) => intervalleA.debut - intervalleB.debut);
  const intervallesFusionnes = [];

  for (const intervalle of intervallesFiltres) {
    const dernier = intervallesFusionnes[intervallesFusionnes.length - 1];

    if (!dernier || intervalle.debut > dernier.fin) {
      intervallesFusionnes.push({ ...intervalle });
      continue;
    }

    dernier.fin = Math.max(dernier.fin, intervalle.fin);
  }

  return intervallesFusionnes;
}

function calculerResumeHebdomadaire(jours = [], occupationsSemaine = [], salle = null) {
  const volumeTotalMinutes = jours.length * (
    heureEnMinutes(HEURE_FIN_JOURNEE) - heureEnMinutes(HEURE_DEBUT_JOURNEE)
  );
  const volumeLibreMinutes = jours.reduce(
    (total, jour) =>
      total +
      (jour.creneaux || [])
        .filter((creneau) => creneau.statut === "libre")
        .reduce(
          (sommeJour, creneau) => sommeJour + Number(creneau.duree_minutes || 0),
          0
        ),
    0
  );
  const volumeOccupeMinutes = Math.max(0, volumeTotalMinutes - volumeLibreMinutes);
  const groupesDistincts = new Set();
  const programmes = new Set();
  const typesCours = new Set();

  for (const occupation of occupationsSemaine) {
    for (const groupe of occupation.groupes_details || []) {
      groupesDistincts.add(Number(groupe.id_groupes_etudiants));
    }

    for (const programme of occupation.programmes || []) {
      programmes.add(programme);
    }

    if (occupation.type_cours) {
      typesCours.add(occupation.type_cours);
    }
  }

  return {
    creneaux_occupes: occupationsSemaine.length,
    creneaux_libres: jours.reduce(
      (total, jour) =>
        total +
        (jour.creneaux || []).filter((creneau) => creneau.statut === "libre").length,
      0
    ),
    volume_horaire_occupe_minutes: volumeOccupeMinutes,
    volume_horaire_occupe_heures: arrondirHeures(volumeOccupeMinutes),
    volume_horaire_libre_minutes: volumeLibreMinutes,
    volume_horaire_libre_heures: arrondirHeures(volumeLibreMinutes),
    taux_occupation: volumeTotalMinutes > 0
      ? arrondirTaux(volumeOccupeMinutes / volumeTotalMinutes)
      : 0,
    taux_occupation_pourcentage: volumeTotalMinutes > 0
      ? Math.round((volumeOccupeMinutes / volumeTotalMinutes) * 100)
      : 0,
    nb_conflits: occupationsSemaine.filter((occupation) => occupation.conflit_detecte).length,
    groupes_distincts: groupesDistincts.size,
    programmes: [...programmes].sort((programmeA, programmeB) =>
      String(programmeA).localeCompare(String(programmeB), "fr")
    ),
    types_cours: [...typesCours].sort((typeA, typeB) =>
      String(typeA).localeCompare(String(typeB), "fr")
    ),
    capacite_salle: Number(salle?.capacite || 0),
  };
}

function construireGroupesConflit(creneaux = []) {
  const occupations = creneaux
    .filter((creneau) => creneau.statut !== "libre")
    .map((creneau) => ({
      ...creneau,
      id_creneau:
        creneau.id_creneau ||
        `occupation-${creneau.id_affectation_cours}-${creneau.date}-${creneau.heure_debut}`,
      debut_minutes: heureEnMinutes(creneau.heure_debut),
      fin_minutes: heureEnMinutes(creneau.heure_fin),
    }))
    .sort((occupationA, occupationB) => {
      if (occupationA.debut_minutes !== occupationB.debut_minutes) {
        return occupationA.debut_minutes - occupationB.debut_minutes;
      }

      return occupationB.fin_minutes - occupationA.fin_minutes;
    });
  const groupes = [];
  let groupeCourant = [];
  let finGroupe = -1;

  for (const occupation of occupations) {
    if (groupeCourant.length === 0) {
      groupeCourant = [occupation];
      finGroupe = occupation.fin_minutes;
      continue;
    }

    if (occupation.debut_minutes < finGroupe) {
      groupeCourant.push(occupation);
      finGroupe = Math.max(finGroupe, occupation.fin_minutes);
      continue;
    }

    groupes.push(groupeCourant);
    groupeCourant = [occupation];
    finGroupe = occupation.fin_minutes;
  }

  if (groupeCourant.length > 0) {
    groupes.push(groupeCourant);
  }

  return groupes;
}

function calculerDispositionJour(creneaux = []) {
  const disposition = new Map();
  const groupesConflit = construireGroupesConflit(creneaux);

  for (const groupe of groupesConflit) {
    const finsParColonne = [];

    for (const occupation of groupe) {
      let indexColonne = finsParColonne.findIndex(
        (fin) => fin <= occupation.debut_minutes
      );

      if (indexColonne === -1) {
        indexColonne = finsParColonne.length;
        finsParColonne.push(occupation.fin_minutes);
      } else {
        finsParColonne[indexColonne] = occupation.fin_minutes;
      }

      disposition.set(occupation.id_creneau, {
        index_colonne: indexColonne,
        nb_colonnes: 0,
      });
    }

    const nbColonnes = Math.max(1, finsParColonne.length);

    for (const occupation of groupe) {
      disposition.set(occupation.id_creneau, {
        ...disposition.get(occupation.id_creneau),
        nb_colonnes: nbColonnes,
      });
    }
  }

  return creneaux.map((creneau) => {
    if (creneau.statut === "libre") {
      return {
        ...creneau,
        index_colonne: 0,
        nb_colonnes: 1,
      };
    }

    const idCreneau =
      creneau.id_creneau ||
      `occupation-${creneau.id_affectation_cours}-${creneau.date}-${creneau.heure_debut}`;
    const metaDisposition = disposition.get(idCreneau) || {
      index_colonne: 0,
      nb_colonnes: 1,
    };

    return {
      ...creneau,
      id_creneau: idCreneau,
      ...metaDisposition,
    };
  });
}

export function formaterNomProfesseur(occupation) {
  return `${String(occupation?.prenom_professeur || "").trim()} ${String(
    occupation?.nom_professeur || ""
  ).trim()}`
    .trim()
    .replace(/\s+/g, " ");
}

export function formaterDureeMinutes(minutes) {
  const minutesNumeriques = Number(minutes || 0);
  const heures = Math.floor(minutesNumeriques / 60);
  const resteMinutes = minutesNumeriques % 60;

  if (heures <= 0) {
    return `${resteMinutes} min`;
  }

  if (resteMinutes === 0) {
    return `${heures} h`;
  }

  return `${heures} h ${String(resteMinutes).padStart(2, "0")}`;
}

export function formaterVolumeHeures(heures) {
  const valeur = Number(heures || 0);

  if (!Number.isFinite(valeur) || valeur <= 0) {
    return "0 h";
  }

  return `${valeur.toLocaleString("fr-CA", {
    minimumFractionDigits: Number.isInteger(valeur) ? 0 : 1,
    maximumFractionDigits: 2,
  })} h`;
}

/**
 * Recompose la semaine visible a partir de la liste d'occupations session.
 *
 * Les autres vues horaires du projet recuperent toutes leurs seances puis
 * filtrent la semaine cote client. On applique la meme approche ici, mais on
 * ajoute des creneaux "Libre" pour que la salle affiche aussi ses trous.
 */
export function construireVueHebdomadaireSalle(
  occupations = [],
  lundiCourant,
  salle = null
) {
  const debutSemaine = getDebutSemaineValide(lundiCourant, new Date());
  const finSemaine = ajouterJours(debutSemaine, 6);
  const debutSemaineIso = formaterDateIsoLocal(debutSemaine);
  const finSemaineIso = formaterDateIsoLocal(finSemaine);
  const debutJourneeMinutes = heureEnMinutes(HEURE_DEBUT_JOURNEE);
  const finJourneeMinutes = heureEnMinutes(HEURE_FIN_JOURNEE);
  const occupationsSemaine = [...(Array.isArray(occupations) ? occupations : [])]
    .filter(
      (occupation) =>
        occupation.date >= debutSemaineIso && occupation.date <= finSemaineIso
    )
    .sort(comparerOccupations);
  const occupationsParDate = new Map();

  for (const occupation of occupationsSemaine) {
    if (!occupationsParDate.has(occupation.date)) {
      occupationsParDate.set(occupation.date, []);
    }

    occupationsParDate.get(occupation.date).push(occupation);
  }

  const jours = JOURS_SEMAINE_COMPLETS
    .slice(0, NB_JOURS_SEMAINE_AFFICHES)
    .map((jour, index) => {
      const date = ajouterJours(debutSemaine, index);
      const dateIso = formaterDateIsoLocal(date);
      const occupationsJour = [...(occupationsParDate.get(dateIso) || [])];
      const creneaux = [];
      let curseurMinutes = debutJourneeMinutes;

      for (const occupation of occupationsJour) {
        const debutOccupation = Math.max(
          debutJourneeMinutes,
          heureEnMinutes(occupation.heure_debut)
        );
        const finOccupation = Math.min(
          finJourneeMinutes,
          heureEnMinutes(occupation.heure_fin)
        );

        if (debutOccupation > curseurMinutes) {
          creneaux.push(
            construireCreneauLibre(dateIso, jour.value, curseurMinutes, debutOccupation)
          );
        }

        creneaux.push({
          ...occupation,
          id_creneau: `occupation-${occupation.id_affectation_cours}-${dateIso}-${occupation.heure_debut}`,
          statut: occupation.conflit_detecte ? "conflit" : occupation.statut || "occupee",
          jour_semaine: jour.value,
          debut_minutes: debutOccupation,
          fin_minutes: finOccupation,
          duree_minutes: Math.max(0, finOccupation - debutOccupation),
        });

        curseurMinutes = Math.max(curseurMinutes, finOccupation);
      }

      if (curseurMinutes < finJourneeMinutes) {
        creneaux.push(
          construireCreneauLibre(dateIso, jour.value, curseurMinutes, finJourneeMinutes)
        );
      }

      return {
        date: dateIso,
        nom: jour.label,
        creneaux: calculerDispositionJour(creneaux),
      };
    });

  return {
    debutSemaine,
    finSemaine,
    debutSemaineIso,
    finSemaineIso,
    jours,
    occupationsSemaine,
    resume: calculerResumeHebdomadaire(jours, occupationsSemaine, salle),
  };
}

export function determinerLundiInitialOccupation(consultation) {
  const candidats = [
    consultation?.vue_hebdomadaire?.debut_semaine,
    consultation?.vue_hebdomadaire?.date_reference,
    consultation?.occupations?.[0]?.date,
    consultation?.session?.date_debut,
    new Date(),
  ];
  const dateReference =
    candidats.find((candidat) => parserDateValide(candidat)) || new Date();

  return getDebutSemaineValide(dateReference);
}

export function extraireBornesNavigation(consultation) {
  const premiereSemaine = consultation?.vue_hebdomadaire?.premiere_semaine
    ? getDebutSemaineValide(consultation.vue_hebdomadaire.premiere_semaine)
    : null;
  const derniereSemaine = consultation?.vue_hebdomadaire?.derniere_semaine
    ? getDebutSemaineValide(consultation.vue_hebdomadaire.derniere_semaine)
    : null;

  return {
    premiereSemaine,
    derniereSemaine,
  };
}

/**
 * Calcule le statut temps reel dans le navigateur.
 *
 * La V3 ne repose pas sur des websockets : on relit simplement les occupations
 * deja chargees a partir de l'heure courante locale du poste client.
 */
export function calculerTempsReelSalle(occupations = [], maintenant = new Date()) {
  const dateActuelleIso = formaterDateIsoLocal(maintenant);
  const minutesActuelles = maintenant.getHours() * 60 + maintenant.getMinutes();
  const debutJourneeMinutes = heureEnMinutes(HEURE_DEBUT_JOURNEE);
  const finJourneeMinutes = heureEnMinutes(HEURE_FIN_JOURNEE);
  const occupationsTriees = [...(Array.isArray(occupations) ? occupations : [])].sort(
    comparerOccupations
  );
  const occupationsActuelles = occupationsTriees.filter((occupation) => {
    if (occupation.date !== dateActuelleIso) {
      return false;
    }

    const debut = heureEnMinutes(occupation.heure_debut);
    const fin = heureEnMinutes(occupation.heure_fin);
    return minutesActuelles >= debut && minutesActuelles < fin;
  });
  const prochainCreneau =
    occupationsTriees.find((occupation) => {
      if (occupation.date > dateActuelleIso) {
        return true;
      }

      if (occupation.date < dateActuelleIso) {
        return false;
      }

      return heureEnMinutes(occupation.heure_debut) > minutesActuelles;
    }) || null;
  const occupationsRestantesJour = occupationsTriees
    .filter((occupation) => occupation.date === dateActuelleIso)
    .map((occupation) => ({
      debut: heureEnMinutes(occupation.heure_debut),
      fin: heureEnMinutes(occupation.heure_fin),
    }));
  const borneDebutDisponibilite = Math.max(minutesActuelles, debutJourneeMinutes);
  const intervallesOccupes = fusionnerIntervalles(
    occupationsRestantesJour,
    borneDebutDisponibilite,
    finJourneeMinutes
  );
  const minutesOccupeesRestantes = intervallesOccupes.reduce(
    (total, intervalle) => total + Math.max(0, intervalle.fin - intervalle.debut),
    0
  );
  const disponibiliteRestante = Math.max(
    0,
    finJourneeMinutes - borneDebutDisponibilite - minutesOccupeesRestantes
  );
  const statut = occupationsActuelles.length > 1
    ? "conflit"
    : occupationsActuelles.length === 1
    ? "occupee"
    : "libre";

  return {
    horodatage: maintenant.toISOString(),
    statut,
    occupee_maintenant: occupationsActuelles.length > 0,
    conflit_maintenant: occupationsActuelles.length > 1,
    occupation_actuelle: occupationsActuelles[0] || null,
    occupations_actuelles: occupationsActuelles,
    prochain_creneau: prochainCreneau,
    disponibilite_restante_aujourdhui_minutes: disponibiliteRestante,
    disponibilite_restante_aujourdhui_heures: arrondirHeures(disponibiliteRestante),
  };
}

export function formaterProgrammeSemaine(programmes = []) {
  const programmesFiltres = normaliserListeValeurs(programmes);

  if (programmesFiltres.length === 0) {
    return "Aucun programme cette semaine";
  }

  if (programmesFiltres.length === 1) {
    return programmesFiltres[0];
  }

  return `${programmesFiltres.slice(0, 2).join(", ")}${
    programmesFiltres.length > 2 ? ` +${programmesFiltres.length - 2}` : ""
  }`;
}
