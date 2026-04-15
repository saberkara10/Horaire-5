/**
 * Utilitaires temporels partages par la gestion des disponibilites professeurs.
 *
 * Ce module isole les calculs de dates et de fenetres d'effet utilises par :
 * - la saisie des disponibilites ;
 * - la projection sur une session academique ;
 * - la replanification locale des seances impactees.
 */
export const DATE_DEBUT_DISPONIBILITE_DEFAUT = "2000-01-01";
export const DATE_FIN_DISPONIBILITE_DEFAUT = "2099-12-31";

export const MODE_APPLICATION_DISPONIBILITES = Object.freeze({
  SEMAINE_UNIQUE: "semaine_unique",
  SEMAINE_ET_SUIVANTES: "semaine_et_suivantes",
  A_PARTIR_DATE: "a_partir_date",
  PLAGE_DATES: "plage_dates",
  PERMANENTE: "permanente",
});

/**
 * Normalise une date vers le format ISO `YYYY-MM-DD`.
 *
 * @param {string|Date} date Valeur brute recue depuis l'API ou la base.
 * @returns {string} Date ISO ou chaine vide si la valeur est invalide.
 */
export function normaliserDateIso(date) {
  const valeur = String(date || "").trim();

  if (!valeur) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    return valeur;
  }

  const texte = valeur.includes("T") ? valeur.slice(0, 10) : valeur;
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte);
  let dateLocale = null;

  if (correspondance) {
    const [, annee, mois, jour] = correspondance;
    dateLocale = new Date(Number(annee), Number(mois) - 1, Number(jour));
  } else {
    const fallback = new Date(valeur);
    if (!Number.isNaN(fallback.getTime())) {
      dateLocale = new Date(
        fallback.getFullYear(),
        fallback.getMonth(),
        fallback.getDate()
      );
    }
  }

  if (!dateLocale || Number.isNaN(dateLocale.getTime())) {
    return "";
  }

  return formatDateLocale(dateLocale);
}

/**
 * Convertit une date ISO en objet `Date` local sans decalage horaire.
 *
 * @param {string} dateString Date ISO attendue.
 * @returns {Date} Instance `Date`, possiblement invalide.
 */
export function parseDateLocale(dateString) {
  const texte = normaliserDateIso(dateString);

  if (!texte) {
    return new Date(Number.NaN);
  }

  const [annee = "0", mois = "1", jour = "1"] = texte.split("-");
  return new Date(Number(annee), Number(mois) - 1, Number(jour));
}

/**
 * Formate une date locale au format ISO court.
 *
 * @param {Date} date Date a formatter.
 * @returns {string} Date `YYYY-MM-DD`.
 */
export function formatDateLocale(date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/**
 * Ajoute un nombre de jours a une date ISO.
 *
 * @param {string} dateString Date de depart.
 * @param {number} nombreJours Nombre de jours a ajouter.
 * @returns {string} Nouvelle date ISO.
 */
export function ajouterJours(dateString, nombreJours) {
  const date = parseDateLocale(dateString);
  date.setDate(date.getDate() + Number(nombreJours || 0));
  return formatDateLocale(date);
}

/**
 * Retourne la date ISO la plus recente entre deux valeurs.
 *
 * @param {string} dateA Premiere date.
 * @param {string} dateB Deuxieme date.
 * @returns {string} Date maximale.
 */
export function maxDateIso(dateA, dateB) {
  return String(dateA).localeCompare(String(dateB), "fr") >= 0 ? dateA : dateB;
}

/**
 * Retourne la date ISO la plus ancienne entre deux valeurs.
 *
 * @param {string} dateA Premiere date.
 * @param {string} dateB Deuxieme date.
 * @returns {string} Date minimale.
 */
export function minDateIso(dateA, dateB) {
  return String(dateA).localeCompare(String(dateB), "fr") <= 0 ? dateA : dateB;
}

/**
 * Force une date a rester dans une plage minimale / maximale.
 *
 * @param {string} date Date a contraindre.
 * @param {string} dateMin Borne basse.
 * @param {string} dateMax Borne haute.
 * @returns {string} Date ISO tronquee aux bornes fournies.
 */
export function clipDateIso(date, dateMin, dateMax) {
  return minDateIso(maxDateIso(date, dateMin), dateMax);
}

/**
 * Indique si deux intervalles de dates se chevauchent.
 *
 * @param {string} dateDebutA Debut de l'intervalle A.
 * @param {string} dateFinA Fin de l'intervalle A.
 * @param {string} dateDebutB Debut de l'intervalle B.
 * @param {string} dateFinB Fin de l'intervalle B.
 * @returns {boolean} `true` si les intervalles se recouvrent.
 */
export function datesSeChevauchent(
  dateDebutA,
  dateFinA,
  dateDebutB,
  dateFinB
) {
  const debutA = normaliserDateIso(dateDebutA) || DATE_DEBUT_DISPONIBILITE_DEFAUT;
  const finA = normaliserDateIso(dateFinA) || DATE_FIN_DISPONIBILITE_DEFAUT;
  const debutB = normaliserDateIso(dateDebutB) || DATE_DEBUT_DISPONIBILITE_DEFAUT;
  const finB = normaliserDateIso(dateFinB) || DATE_FIN_DISPONIBILITE_DEFAUT;

  return debutA <= finB && finA >= debutB;
}

/**
 * Verifie si une disponibilite couvre une date de seance donnee.
 *
 * @param {Object} disponibilite Disponibilite ou plage d'effet.
 * @param {string} date Date a verifier.
 * @returns {boolean} `true` si la date est couverte.
 */
export function disponibiliteCouvreDate(disponibilite, date) {
  const dateReference = normaliserDateIso(date);
  const dateDebut =
    normaliserDateIso(disponibilite?.date_debut_effet) ||
    DATE_DEBUT_DISPONIBILITE_DEFAUT;
  const dateFin =
    normaliserDateIso(disponibilite?.date_fin_effet) ||
    DATE_FIN_DISPONIBILITE_DEFAUT;

  return Boolean(dateReference) && dateReference >= dateDebut && dateReference <= dateFin;
}

/**
 * Calcule le nombre de semaines couvertes par une session.
 *
 * @param {Object} session Session avec `date_debut` et `date_fin`.
 * @returns {number} Nombre minimal de semaines, jamais inferieur a 1.
 */
export function calculerNombreSemainesSession(session) {
  const dateDebut = normaliserDateIso(session?.date_debut);
  const dateFin = normaliserDateIso(session?.date_fin);

  if (!dateDebut || !dateFin) {
    return 1;
  }

  const difference =
    parseDateLocale(dateFin).getTime() - parseDateLocale(dateDebut).getTime();

  if (Number.isNaN(difference) || difference < 0) {
    return 1;
  }

  return Math.max(1, Math.ceil((difference + 24 * 60 * 60 * 1000) / (7 * 24 * 60 * 60 * 1000)));
}

/**
 * Retourne le numero de semaine d'une date dans la session.
 *
 * @param {string} dateString Date cible.
 * @param {Object} session Session de reference.
 * @returns {number} Numero de semaine base 1.
 */
export function calculerNumeroSemaineSession(dateString, session) {
  const date = normaliserDateIso(dateString);
  const dateDebut = normaliserDateIso(session?.date_debut);

  if (!date || !dateDebut) {
    return 1;
  }

  const difference =
    parseDateLocale(date).getTime() - parseDateLocale(dateDebut).getTime();

  if (Number.isNaN(difference)) {
    return 1;
  }

  return Math.floor(difference / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/**
 * Determine la semaine de reference a utiliser pour une operation.
 *
 * @param {Object} session Session de reference.
 * @param {number} semaineCible Numero de semaine demande par le client.
 * @param {string} [dateReference=formatDateLocale(new Date())] Date fallback.
 * @returns {number} Numero de semaine valide dans la session.
 */
export function determinerSemaineReferenceSession(
  session,
  semaineCible,
  dateReference = formatDateLocale(new Date())
) {
  const nombreSemaines = calculerNombreSemainesSession(session);
  const semaineDemandee = Number(semaineCible);

  if (
    Number.isInteger(semaineDemandee) &&
    semaineDemandee >= 1 &&
    semaineDemandee <= nombreSemaines
  ) {
    return semaineDemandee;
  }

  const dateDebut = normaliserDateIso(session?.date_debut);
  const dateFin = normaliserDateIso(session?.date_fin);
  const dateRef = clipDateIso(
    normaliserDateIso(dateReference) || dateDebut,
    dateDebut,
    dateFin
  );

  return Math.min(
    nombreSemaines,
    Math.max(1, calculerNumeroSemaineSession(dateRef, session))
  );
}

/**
 * Calcule les bornes exactes de la semaine cible dans la session.
 *
 * @param {Object} session Session de reference.
 * @param {number} semaineCible Numero de semaine souhaite.
 * @returns {Object} Numero, bornes et nombre total de semaines.
 */
export function calculerFenetreSemaineSession(session, semaineCible) {
  const numeroSemaine = determinerSemaineReferenceSession(session, semaineCible);
  const dateDebutSession = normaliserDateIso(session?.date_debut);
  const dateFinSession = normaliserDateIso(session?.date_fin);
  const dateDebut = ajouterJours(dateDebutSession, (numeroSemaine - 1) * 7);
  const dateFin = minDateIso(dateFinSession, ajouterJours(dateDebut, 6));

  return {
    numero_semaine: numeroSemaine,
    date_debut: dateDebut,
    date_fin: dateFin,
    nombre_semaines: calculerNombreSemainesSession(session),
  };
}

/**
 * Normalise le mode d'application d'une disponibilite.
 *
 * @param {string} mode Valeur brute recue depuis l'API.
 * @returns {string} Mode supporte par le backend.
 */
export function normaliserModeApplicationDisponibilites(mode) {
  const valeur = String(mode || "").trim().toLowerCase();

  switch (valeur) {
    case MODE_APPLICATION_DISPONIBILITES.SEMAINE_UNIQUE:
      return MODE_APPLICATION_DISPONIBILITES.SEMAINE_UNIQUE;
    case MODE_APPLICATION_DISPONIBILITES.SEMAINE_ET_SUIVANTES:
      return MODE_APPLICATION_DISPONIBILITES.SEMAINE_ET_SUIVANTES;
    case MODE_APPLICATION_DISPONIBILITES.A_PARTIR_DATE:
      return MODE_APPLICATION_DISPONIBILITES.A_PARTIR_DATE;
    case MODE_APPLICATION_DISPONIBILITES.PLAGE_DATES:
      return MODE_APPLICATION_DISPONIBILITES.PLAGE_DATES;
    case MODE_APPLICATION_DISPONIBILITES.PERMANENTE:
    case "standard":
      return MODE_APPLICATION_DISPONIBILITES.PERMANENTE;
    default:
      return MODE_APPLICATION_DISPONIBILITES.SEMAINE_ET_SUIVANTES;
  }
}

/**
 * Calcule la fenetre temporelle d'effet d'une disponibilite sur une session.
 *
 * @param {Object} session Session cible.
 * @param {Object} [options={}] Options d'application recues depuis l'API.
 * @param {string} [legacyModeApplication] Ancien mode encore accepte.
 * @returns {Object} Fenetre de semaine et bornes d'impact.
 */
export function calculerFenetreApplicationDisponibilites(
  session,
  options = {},
  legacyModeApplication
) {
  const optionsNormalisees =
    options && typeof options === "object" && !Array.isArray(options)
      ? options
      : {
          semaine_cible: options,
          mode_application: legacyModeApplication,
        };
  const mode = normaliserModeApplicationDisponibilites(
    optionsNormalisees.mode_application
  );
  const sessionDebut = normaliserDateIso(session?.date_debut);
  const sessionFin = normaliserDateIso(session?.date_fin);
  const fenetreSemaineParDefaut = calculerFenetreSemaineSession(
    session,
    optionsNormalisees.semaine_cible
  );
  const dateDebutDemandee = normaliserDateIso(
    optionsNormalisees.date_debut_effet
  );
  const dateFinDemandee = normaliserDateIso(optionsNormalisees.date_fin_effet);

  const construireFenetreSemaineReference = (dateReference) =>
    calculerFenetreSemaineSession(
      session,
      optionsNormalisees.semaine_cible ??
        calculerNumeroSemaineSession(
          normaliserDateIso(dateReference) || sessionDebut,
          session
        )
    );

  if (mode === MODE_APPLICATION_DISPONIBILITES.PERMANENTE) {
    return {
      ...fenetreSemaineParDefaut,
      mode_application: mode,
      date_debut_effet: DATE_DEBUT_DISPONIBILITE_DEFAUT,
      date_fin_effet: DATE_FIN_DISPONIBILITE_DEFAUT,
      date_debut_impact: sessionDebut,
      date_fin_impact: sessionFin,
    };
  }

  if (mode === MODE_APPLICATION_DISPONIBILITES.PLAGE_DATES) {
    const dateDebutEffet = dateDebutDemandee;
    const dateFinEffet = dateFinDemandee || dateDebutDemandee;
    const dateDebutImpact = maxDateIso(dateDebutEffet, sessionDebut);
    const dateFinImpact = minDateIso(dateFinEffet, sessionFin);
    const fenetreSemaine = construireFenetreSemaineReference(dateDebutImpact);

    return {
      ...fenetreSemaine,
      mode_application: mode,
      date_debut_effet: dateDebutEffet,
      date_fin_effet: dateFinEffet,
      date_debut_impact: dateDebutImpact,
      date_fin_impact: dateFinImpact,
    };
  }

  if (mode === MODE_APPLICATION_DISPONIBILITES.A_PARTIR_DATE) {
    const dateDebutEffet = dateDebutDemandee || fenetreSemaineParDefaut.date_debut;
    const dateDebutImpact = maxDateIso(dateDebutEffet, sessionDebut);
    const fenetreSemaine = construireFenetreSemaineReference(dateDebutImpact);

    return {
      ...fenetreSemaine,
      mode_application: mode,
      date_debut_effet: dateDebutEffet,
      date_fin_effet: sessionFin,
      date_debut_impact: dateDebutImpact,
      date_fin_impact: sessionFin,
    };
  }

  return {
    ...fenetreSemaineParDefaut,
    mode_application: mode,
    date_debut_effet: fenetreSemaineParDefaut.date_debut,
    date_fin_effet:
      mode === MODE_APPLICATION_DISPONIBILITES.SEMAINE_UNIQUE
        ? fenetreSemaineParDefaut.date_fin
        : normaliserDateIso(session?.date_fin),
    date_debut_impact: fenetreSemaineParDefaut.date_debut,
    date_fin_impact:
      mode === MODE_APPLICATION_DISPONIBILITES.SEMAINE_UNIQUE
        ? fenetreSemaineParDefaut.date_fin
        : normaliserDateIso(session?.date_fin),
  };
}

/**
 * Trie deux disponibilites selon leur ordre d'application temporel.
 *
 * @param {Object} disponibiliteA Premiere disponibilite.
 * @param {Object} disponibiliteB Deuxieme disponibilite.
 * @returns {number} Valeur compatible avec `Array.prototype.sort`.
 */
export function comparerDisponibilitesTemporelles(disponibiliteA, disponibiliteB) {
  const debutA =
    normaliserDateIso(disponibiliteA?.date_debut_effet) ||
    DATE_DEBUT_DISPONIBILITE_DEFAUT;
  const debutB =
    normaliserDateIso(disponibiliteB?.date_debut_effet) ||
    DATE_DEBUT_DISPONIBILITE_DEFAUT;

  if (debutA !== debutB) {
    return debutA.localeCompare(debutB, "fr");
  }

  const finA =
    normaliserDateIso(disponibiliteA?.date_fin_effet) ||
    DATE_FIN_DISPONIBILITE_DEFAUT;
  const finB =
    normaliserDateIso(disponibiliteB?.date_fin_effet) ||
    DATE_FIN_DISPONIBILITE_DEFAUT;

  if (finA !== finB) {
    return finA.localeCompare(finB, "fr");
  }

  if (Number(disponibiliteA?.jour_semaine) !== Number(disponibiliteB?.jour_semaine)) {
    return Number(disponibiliteA?.jour_semaine) - Number(disponibiliteB?.jour_semaine);
  }

  if (String(disponibiliteA?.heure_debut || "") !== String(disponibiliteB?.heure_debut || "")) {
    return String(disponibiliteA?.heure_debut || "").localeCompare(
      String(disponibiliteB?.heure_debut || ""),
      "fr"
    );
  }

  return String(disponibiliteA?.heure_fin || "").localeCompare(
    String(disponibiliteB?.heure_fin || ""),
    "fr"
  );
}

/**
 * Tronque une disponibilite aux bornes reelles de la session.
 *
 * @param {Object} disponibilite Disponibilite brute.
 * @param {Object} session Session de reference.
 * @returns {Object} Disponibilite enrichie et bornee a la session.
 */
export function enrichirDisponibilitePourSession(disponibilite, session) {
  const sessionDebut = normaliserDateIso(session?.date_debut);
  const sessionFin = normaliserDateIso(session?.date_fin);
  const dateDebutBrute =
    normaliserDateIso(disponibilite?.date_debut_effet) ||
    DATE_DEBUT_DISPONIBILITE_DEFAUT;
  const dateFinBrute =
    normaliserDateIso(disponibilite?.date_fin_effet) ||
    DATE_FIN_DISPONIBILITE_DEFAUT;
  const dateDebutEffet = maxDateIso(dateDebutBrute, sessionDebut);
  const dateFinEffet = minDateIso(dateFinBrute, sessionFin);

  return {
    ...disponibilite,
    date_debut_effet: dateDebutEffet,
    date_fin_effet: dateFinEffet,
    semaine_debut: Math.max(1, calculerNumeroSemaineSession(dateDebutEffet, session)),
    semaine_fin: Math.min(
      calculerNombreSemainesSession(session),
      Math.max(1, calculerNumeroSemaineSession(dateFinEffet, session))
    ),
  };
}
