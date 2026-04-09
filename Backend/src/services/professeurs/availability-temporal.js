export const DATE_DEBUT_DISPONIBILITE_DEFAUT = "2000-01-01";
export const DATE_FIN_DISPONIBILITE_DEFAUT = "2099-12-31";

export const MODE_APPLICATION_DISPONIBILITES = Object.freeze({
  SEMAINE_UNIQUE: "semaine_unique",
  SEMAINE_ET_SUIVANTES: "semaine_et_suivantes",
});

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

export function parseDateLocale(dateString) {
  const texte = normaliserDateIso(dateString);

  if (!texte) {
    return new Date(Number.NaN);
  }

  const [annee = "0", mois = "1", jour = "1"] = texte.split("-");
  return new Date(Number(annee), Number(mois) - 1, Number(jour));
}

export function formatDateLocale(date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

export function ajouterJours(dateString, nombreJours) {
  const date = parseDateLocale(dateString);
  date.setDate(date.getDate() + Number(nombreJours || 0));
  return formatDateLocale(date);
}

export function maxDateIso(dateA, dateB) {
  return String(dateA).localeCompare(String(dateB), "fr") >= 0 ? dateA : dateB;
}

export function minDateIso(dateA, dateB) {
  return String(dateA).localeCompare(String(dateB), "fr") <= 0 ? dateA : dateB;
}

export function clipDateIso(date, dateMin, dateMax) {
  return minDateIso(maxDateIso(date, dateMin), dateMax);
}

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

export function normaliserModeApplicationDisponibilites(mode) {
  return String(mode || "").trim() === MODE_APPLICATION_DISPONIBILITES.SEMAINE_UNIQUE
    ? MODE_APPLICATION_DISPONIBILITES.SEMAINE_UNIQUE
    : MODE_APPLICATION_DISPONIBILITES.SEMAINE_ET_SUIVANTES;
}

export function calculerFenetreApplicationDisponibilites(
  session,
  semaineCible,
  modeApplication
) {
  const mode = normaliserModeApplicationDisponibilites(modeApplication);
  const fenetreSemaine = calculerFenetreSemaineSession(session, semaineCible);

  return {
    ...fenetreSemaine,
    mode_application: mode,
    date_debut_effet: fenetreSemaine.date_debut,
    date_fin_effet:
      mode === MODE_APPLICATION_DISPONIBILITES.SEMAINE_UNIQUE
        ? fenetreSemaine.date_fin
        : normaliserDateIso(session?.date_fin),
  };
}

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
