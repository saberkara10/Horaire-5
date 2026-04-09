/**
 * PAGE - Disponibilites Professeurs
 *
 * Cette page gere les disponibilites
 * hebdomadaires des professeurs.
 */
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import {
  recupererProfesseurs,
  recupererDisponibilitesProfesseur,
  recupererJournalDisponibilitesProfesseur,
  recupererHoraireProfesseur,
  mettreAJourDisponibilitesProfesseur,
} from "../services/professeurs.api.js";
import { recupererSessionsScheduler } from "../services/scheduler.api.js";
import {
  JOURS_SEMAINE_COMPLETS,
  creerDateLocale,
  formaterDateCourte,
  getDebutSemaine,
  getIndexJourCalendrier,
} from "../utils/calendar.js";
import { emettreSynchronisationPlanning } from "../utils/planningSync.js";
import { getLibelleProgrammesProfesseur } from "../utils/professeurs.js";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import "../styles/ProfesseursPage.css";

const HEURES = Array.from({ length: 15 }, (_, index) =>
  `${String(index + 8).padStart(2, "0")}:00`
);

function normaliserHeure(heure) {
  return String(heure || "").slice(0, 5);
}

function heureEnMinutes(heure) {
  const [heures = "0", minutes = "0"] = normaliserHeure(heure).split(":").map(Number);
  return heures * 60 + minutes;
}

function trierDisponibilites(disponibilites) {
  return [...disponibilites].sort((elementA, elementB) => {
    if (Number(elementA.jour_semaine) !== Number(elementB.jour_semaine)) {
      return Number(elementA.jour_semaine) - Number(elementB.jour_semaine);
    }

    return normaliserHeure(elementA.heure_debut).localeCompare(
      normaliserHeure(elementB.heure_debut),
      "fr"
    );
  });
}

function regrouperDisponibilitesParJour(disponibilites) {
  return JOURS_SEMAINE_COMPLETS.map((jour) => ({
    ...jour,
    disponibilites: disponibilites.filter(
      (disponibilite) => Number(disponibilite.jour_semaine) === jour.value
    ),
  }));
}

function getDisponibilitesParJourEtHeure(disponibilites) {
  const map = {};

  disponibilites.forEach((disponibilite) => {
    const jourIndex = Number(disponibilite.jour_semaine) - 1;

    if (jourIndex < 0 || jourIndex > 6) {
      return;
    }

    const debut = normaliserHeure(disponibilite.heure_debut);
    const key = `${jourIndex}-${debut}`;

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(disponibilite);
  });

  return map;
}

function getHauteurBloc(heureDebut, heureFin) {
  const debut = heureEnMinutes(heureDebut);
  const fin = heureEnMinutes(heureFin);
  return ((fin - debut) / 60) * 60;
}

function formaterDateLonguePlanning(dateString) {
  return creerDateLocale(dateString).toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formaterHorodatageJournal(dateString) {
  if (!dateString) {
    return "Horodatage indisponible";
  }

  return creerDateLocale(String(dateString).slice(0, 10)).toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }) + ` • ${String(dateString).slice(11, 16)}`;
}

function calculerNombreSemainesSession(session) {
  if (!session?.date_debut || !session?.date_fin) {
    return 1;
  }

  const debut = creerDateLocale(session.date_debut);
  const fin = creerDateLocale(session.date_fin);
  const difference = fin.getTime() - debut.getTime();

  if (Number.isNaN(difference) || difference < 0) {
    return 1;
  }

  return Math.max(1, Math.ceil((difference + 24 * 60 * 60 * 1000) / (7 * 24 * 60 * 60 * 1000)));
}

function ajouterJours(dateString, nombreJours) {
  const date = creerDateLocale(dateString);
  date.setDate(date.getDate() + Number(nombreJours || 0));
  return date.toISOString().slice(0, 10);
}

function determinerSemaineReference(session) {
  if (!session?.date_debut || !session?.date_fin) {
    return 1;
  }

  const aujourdHui = new Date();
  const debut = creerDateLocale(session.date_debut);
  const fin = creerDateLocale(session.date_fin);
  const reference =
    aujourdHui.getTime() < debut.getTime()
      ? debut
      : aujourdHui.getTime() > fin.getTime()
        ? fin
        : aujourdHui;
  const difference = reference.getTime() - debut.getTime();
  return Math.min(
    calculerNombreSemainesSession(session),
    Math.max(1, Math.floor(difference / (7 * 24 * 60 * 60 * 1000)) + 1)
  );
}

function calculerFenetreSemaineSession(session, semaineCible) {
  if (!session?.date_debut || !session?.date_fin) {
    return null;
  }

  const nombreSemaines = calculerNombreSemainesSession(session);
  const semaine = Math.min(
    nombreSemaines,
    Math.max(1, Number(semaineCible) || 1)
  );
  const dateDebut = ajouterJours(session.date_debut, (semaine - 1) * 7);
  const dateFin = creerDateLocale(dateDebut);
  dateFin.setDate(dateFin.getDate() + 6);
  const borneFinSession = creerDateLocale(session.date_fin);

  return {
    numero_semaine: semaine,
    nombre_semaines: nombreSemaines,
    date_debut: dateDebut,
    date_fin:
      dateFin.getTime() > borneFinSession.getTime()
        ? borneFinSession.toISOString().slice(0, 10)
        : dateFin.toISOString().slice(0, 10),
  };
}

function regrouperVariationsParPeriode(variations) {
  const map = new Map();

  (variations || []).forEach((variation) => {
    const cle = `${variation.semaine_debut}-${variation.semaine_fin}`;
    const groupe = map.get(cle) || {
      cle,
      semaine_debut: variation.semaine_debut,
      semaine_fin: variation.semaine_fin,
      date_debut_effet: variation.date_debut_effet,
      date_fin_effet: variation.date_fin_effet,
      disponibilites: [],
    };

    groupe.disponibilites.push(variation);
    map.set(cle, groupe);
  });

  return [...map.values()].sort(
    (elementA, elementB) => Number(elementA.semaine_debut) - Number(elementB.semaine_debut)
  );
}

function seanceEstAVenirOuEnCours(seance) {
  const maintenant = new Date();
  const [heures = "0", minutes = "0"] = normaliserHeure(seance.heure_fin)
    .split(":")
    .map(Number);
  const dateFin = creerDateLocale(seance.date);
  dateFin.setHours(heures, minutes, 0, 0);

  return dateFin.getTime() >= maintenant.getTime();
}

function getPlanningParJourEtHeure(seances, lundiSemaine) {
  const map = {};

  seances.forEach((seance) => {
    const dateSeance = creerDateLocale(seance.date);
    const lundiSeance = getDebutSemaine(dateSeance);

    if (lundiSeance.getTime() !== lundiSemaine.getTime()) {
      return;
    }

    const jourIndex = getIndexJourCalendrier(dateSeance);
    const debut = normaliserHeure(seance.heure_debut);
    const key = `${jourIndex}-${debut}`;

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(seance);
  });

  return map;
}

function getDebutPremiereSemainePlanifiee(seances) {
  if (!Array.isArray(seances) || seances.length === 0) {
    return getDebutSemaine(new Date());
  }

  return getDebutSemaine(creerDateLocale(seances[0].date));
}

function seanceEstCouverteParDisponibilites(seance, disponibilites) {
  const jourSemaine = getIndexJourCalendrier(creerDateLocale(seance.date)) + 1;
  const debutSeance = heureEnMinutes(seance.heure_debut);
  const finSeance = heureEnMinutes(seance.heure_fin);

  return disponibilites.some((disponibilite) => {
    if (Number(disponibilite.jour_semaine) !== jourSemaine) {
      return false;
    }

    const debutDisponibilite = heureEnMinutes(disponibilite.heure_debut);
    const finDisponibilite = heureEnMinutes(disponibilite.heure_fin);

    return debutDisponibilite <= debutSeance && finDisponibilite >= finSeance;
  });
}

function modeUtiliseSemaineReference(mode) {
  return mode === "semaine_unique" || mode === "semaine_et_suivantes";
}

function modeUtiliseDateDebut(mode) {
  return mode === "a_partir_date" || mode === "plage_dates";
}

function modeUtiliseDateFin(mode) {
  return mode === "plage_dates";
}

function getLibelleModeApplication(mode) {
  switch (mode) {
    case "semaine_unique":
      return "Semaine unique";
    case "semaine_et_suivantes":
      return "A partir de la semaine de reference";
    case "a_partir_date":
      return "A partir d'une date";
    case "plage_dates":
      return "Sur une plage de dates";
    case "permanente":
      return "Disponibilite standard permanente";
    default:
      return "Portee non definie";
  }
}

function decrirePorteeSauvegarde({
  modeApplication,
  dateDebutApplication,
  dateFinApplication,
  fenetreSemaineAffichee,
  sessionActive,
}) {
  switch (modeApplication) {
    case "semaine_unique":
      return fenetreSemaineAffichee?.date_debut && fenetreSemaineAffichee?.date_fin
        ? `Semaine ${fenetreSemaineAffichee.numero_semaine} uniquement (${fenetreSemaineAffichee.date_debut} - ${fenetreSemaineAffichee.date_fin})`
        : "Semaine de reference uniquement";
    case "semaine_et_suivantes":
      return fenetreSemaineAffichee?.date_debut
        ? `A partir du ${fenetreSemaineAffichee.date_debut} jusqu'a la fin de session`
        : "A partir de la semaine de reference";
    case "a_partir_date":
      return dateDebutApplication
        ? `A partir du ${dateDebutApplication} jusqu'a la fin de session`
        : "Date de debut a definir";
    case "plage_dates":
      return dateDebutApplication && dateFinApplication
        ? `Du ${dateDebutApplication} au ${dateFinApplication}`
        : "Plage de dates a definir";
    case "permanente":
      return sessionActive?.date_debut && sessionActive?.date_fin
        ? `Regle standard permanente, appliquee sur toute la session active (${sessionActive.date_debut} - ${sessionActive.date_fin})`
        : "Regle standard permanente";
    default:
      return "Portee de sauvegarde non definie";
  }
}

function formaterStatutJournal(statut) {
  switch (String(statut || "").trim().toUpperCase()) {
    case "SUCCES":
      return "Succes";
    case "PARTIEL":
      return "Partiel";
    case "ECHEC":
      return "Conflit";
    case "AUCUN_IMPACT":
      return "Aucun impact";
    default:
      return "Statut inconnu";
  }
}

export function DisponibilitesProfesseursPage({ utilisateur, onLogout }) {
  const [professeurs, setProfesseurs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [idProfesseurActif, setIdProfesseurActif] = useState(null);
  const [chargementDisponibilites, setChargementDisponibilites] = useState(false);
  const [erreurDisponibilites, setErreurDisponibilites] = useState("");
  const [messageDisponibilites, setMessageDisponibilites] = useState("");
  const [disponibilites, setDisponibilites] = useState([]);
  const [variationsDisponibilites, setVariationsDisponibilites] = useState([]);
  const [horaireProfesseur, setHoraireProfesseur] = useState([]);
  const [resumeReplanification, setResumeReplanification] = useState(null);
  const [journalReplanifications, setJournalReplanifications] = useState([]);
  const [contexteDisponibilites, setContexteDisponibilites] = useState(null);
  const [indexEditionDisponibilite, setIndexEditionDisponibilite] = useState(null);
  const [semaineCible, setSemaineCible] = useState(null);
  const [modeApplication, setModeApplication] = useState("semaine_et_suivantes");
  const [dateDebutApplication, setDateDebutApplication] = useState("");
  const [dateFinApplication, setDateFinApplication] = useState("");
  const [formulaireDisponibilite, setFormulaireDisponibilite] = useState({
    jour_semaine: "1",
    heure_debut: "08:00",
    heure_fin: "10:00",
  });
  const { showError, showSuccess } = usePopup();

  const sessionActive = useMemo(
    () => sessions.find((session) => session.active) || null,
    [sessions]
  );

  async function chargerEtatProfesseur(idProfesseur, options = {}) {
    const {
      effacerResumeReplanification = true,
      semaine = semaineCible,
      mettreAJourSemaine = true,
    } = options;

    const [disponibilitesData, horaireData, journalData] = await Promise.all([
      recupererDisponibilitesProfesseur(idProfesseur, {
        semaine_cible: semaine,
      }),
      recupererHoraireProfesseur(idProfesseur),
      recupererJournalDisponibilitesProfesseur(idProfesseur, {
        limit: 8,
      }),
    ]);

    setDisponibilites(trierDisponibilites(disponibilitesData?.disponibilites || []));
    setVariationsDisponibilites(disponibilitesData?.variations || []);
    setContexteDisponibilites(disponibilitesData || null);
    setHoraireProfesseur(Array.isArray(horaireData) ? horaireData : []);
    setJournalReplanifications(Array.isArray(journalData) ? journalData : []);

    if (
      mettreAJourSemaine &&
      disponibilitesData?.semaine_reference?.numero_semaine &&
      disponibilitesData.semaine_reference.numero_semaine !== semaineCible
    ) {
      setSemaineCible(disponibilitesData.semaine_reference.numero_semaine);
    }

    if (effacerResumeReplanification) {
      setResumeReplanification(null);
    }
  }

  useEffect(() => {
    async function chargerProfesseurs() {
      setChargement(true);

      try {
        const [data, sessionsData] = await Promise.all([
          recupererProfesseurs(),
          recupererSessionsScheduler(),
        ]);
        const liste = data || [];
        setProfesseurs(liste);
        setSessions(Array.isArray(sessionsData) ? sessionsData : []);
        setIdProfesseurActif((valeurActuelle) => {
          if (
            valeurActuelle &&
            liste.some((professeur) => professeur.id_professeur === valeurActuelle)
          ) {
            return valeurActuelle;
          }

          return liste[0]?.id_professeur || null;
        });
      } catch (error) {
        showError(error.message || "Impossible de charger les professeurs.");
      } finally {
        setChargement(false);
      }
    }

    chargerProfesseurs();
  }, []);

  useEffect(() => {
    if (!sessionActive || semaineCible) {
      return;
    }

    setSemaineCible(determinerSemaineReference(sessionActive));
  }, [sessionActive, semaineCible]);

  useEffect(() => {
    async function chargerDisponibilites() {
      if (sessionActive && !semaineCible) {
        return;
      }

      if (!idProfesseurActif) {
        setDisponibilites([]);
        setVariationsDisponibilites([]);
        setHoraireProfesseur([]);
        setContexteDisponibilites(null);
        setResumeReplanification(null);
        return;
      }

      setChargementDisponibilites(true);
      setErreurDisponibilites("");
      setMessageDisponibilites("");

      try {
        await chargerEtatProfesseur(idProfesseurActif, {
          semaine: semaineCible,
        });
      } catch (error) {
        showError(
          error.message || "Impossible de charger les disponibilites du professeur."
        );
      } finally {
        setChargementDisponibilites(false);
      }
    }

    chargerDisponibilites();
  }, [idProfesseurActif, semaineCible, sessionActive]);

  const professeurActif = useMemo(
    () =>
      professeurs.find((professeur) => professeur.id_professeur === idProfesseurActif) ||
      null,
    [professeurs, idProfesseurActif]
  );

  const disponibilitesParJour = useMemo(
    () => regrouperDisponibilitesParJour(disponibilites),
    [disponibilites]
  );

  const disponibilitesMap = useMemo(
    () => getDisponibilitesParJourEtHeure(disponibilites),
    [disponibilites]
  );

  const variationsParPeriode = useMemo(
    () => regrouperVariationsParPeriode(variationsDisponibilites),
    [variationsDisponibilites]
  );

  const fenetreSemaineAffichee = useMemo(
    () =>
      contexteDisponibilites?.semaine_reference ||
      calculerFenetreSemaineSession(sessionActive, semaineCible),
    [contexteDisponibilites, sessionActive, semaineCible]
  );

  useEffect(() => {
    if (!fenetreSemaineAffichee?.date_debut) {
      return;
    }

    if (modeUtiliseSemaineReference(modeApplication)) {
      setDateDebutApplication(fenetreSemaineAffichee.date_debut);
      setDateFinApplication(fenetreSemaineAffichee.date_fin);
      return;
    }

    setDateDebutApplication((valeurActuelle) =>
      valeurActuelle || fenetreSemaineAffichee.date_debut
    );
    setDateFinApplication((valeurActuelle) =>
      valeurActuelle || fenetreSemaineAffichee.date_fin
    );
  }, [fenetreSemaineAffichee, modeApplication]);

  const lundiPlanningActif = useMemo(
    () =>
      fenetreSemaineAffichee?.date_debut
        ? getDebutSemaine(creerDateLocale(fenetreSemaineAffichee.date_debut))
        : getDebutPremiereSemainePlanifiee(horaireProfesseur),
    [fenetreSemaineAffichee, horaireProfesseur]
  );

  const planningMap = useMemo(
    () => getPlanningParJourEtHeure(horaireProfesseur, lundiPlanningActif),
    [horaireProfesseur, lundiPlanningActif]
  );

  const seancesSemaineType = useMemo(() => {
    if (!fenetreSemaineAffichee?.date_debut || !fenetreSemaineAffichee?.date_fin) {
      return horaireProfesseur.filter((seance) => {
        const dateSeance = creerDateLocale(seance.date);
        return getDebutSemaine(dateSeance).getTime() === lundiPlanningActif.getTime();
      });
    }

    return horaireProfesseur.filter(
      (seance) =>
        String(seance.date) >= fenetreSemaineAffichee.date_debut &&
        String(seance.date) <= fenetreSemaineAffichee.date_fin
    );
  }, [horaireProfesseur, lundiPlanningActif, fenetreSemaineAffichee]);

  const seancesHorsDisponibilites = useMemo(
    () =>
      seancesSemaineType.filter(
        (seance) => !seanceEstCouverteParDisponibilites(seance, disponibilites)
      ),
    [disponibilites, seancesSemaineType]
  );

  const seancesAVenirHorsDisponibilites = useMemo(
    () =>
      seancesSemaineType
        .filter((seance) => seanceEstAVenirOuEnCours(seance))
        .filter((seance) => !seanceEstCouverteParDisponibilites(seance, disponibilites)),
    [disponibilites, seancesSemaineType]
  );

  function reinitialiserFormulaireDisponibilite() {
    setFormulaireDisponibilite({
      jour_semaine: "1",
      heure_debut: "08:00",
      heure_fin: "10:00",
    });
    setIndexEditionDisponibilite(null);
  }

  function handleChangerDisponibilite(event) {
    const { name, value } = event.target;
    setFormulaireDisponibilite((valeurActuelle) => ({
      ...valeurActuelle,
      [name]: value,
    }));
  }

  function handleEditerDisponibilite(index) {
    const disponibilite = disponibilites[index];

    setIndexEditionDisponibilite(index);
    setFormulaireDisponibilite({
      jour_semaine: String(disponibilite.jour_semaine),
      heure_debut: normaliserHeure(disponibilite.heure_debut),
      heure_fin: normaliserHeure(disponibilite.heure_fin),
    });
    setErreurDisponibilites("");
    setMessageDisponibilites("");
    setResumeReplanification(null);
  }

  async function persisterDisponibilites(prochainesDisponibilites) {
    if (!idProfesseurActif || !sessionActive) {
      return false;
    }

    if (modeUtiliseSemaineReference(modeApplication) && !semaineCible) {
      setErreurDisponibilites(
        "Une semaine de reference est obligatoire pour cette portee de modification."
      );
      return false;
    }

    if (modeUtiliseDateDebut(modeApplication) && !dateDebutApplication) {
      setErreurDisponibilites("La date de debut d'application est obligatoire.");
      return false;
    }

    if (
      modeUtiliseDateFin(modeApplication) &&
      (!dateFinApplication || dateFinApplication < dateDebutApplication)
    ) {
      setErreurDisponibilites(
        "La date de fin doit etre posterieure ou egale a la date de debut."
      );
      return false;
    }

    setChargementDisponibilites(true);
    setErreurDisponibilites("");
    setMessageDisponibilites("");
    setResumeReplanification(null);

    let resultat = null;

    try {
      const optionsSauvegarde = {
        semaine_cible: semaineCible,
        mode_application: modeApplication,
      };

      if (modeUtiliseDateDebut(modeApplication)) {
        optionsSauvegarde.date_debut_effet = dateDebutApplication;
      }

      if (modeUtiliseDateFin(modeApplication)) {
        optionsSauvegarde.date_fin_effet = dateFinApplication;
      }

      resultat = await mettreAJourDisponibilitesProfesseur(
        idProfesseurActif,
        prochainesDisponibilites.map((disponibilite) => ({
          jour_semaine: Number(disponibilite.jour_semaine),
          heure_debut: normaliserHeure(disponibilite.heure_debut),
          heure_fin: normaliserHeure(disponibilite.heure_fin),
        })),
        optionsSauvegarde
      );
    } catch (error) {
      setErreurDisponibilites(error.message || "Erreur lors de l'enregistrement.");
      setResumeReplanification(error.replanification || null);
      showError(error.message || "Erreur lors de l'enregistrement.");
      setChargementDisponibilites(false);
      return false;
    }

    const replanification = resultat?.replanification || null;
    const synchronisation = resultat?.synchronisation || {
      id_professeur: idProfesseurActif,
      professeurs_impactes: [idProfesseurActif],
      groupes_impactes: replanification?.groupes_impactes || [],
      salles_impactees: replanification?.salles_impactees || [],
      etudiants_impactes: replanification?.etudiants_impactes || [],
      etudiants_reprises_impactes: replanification?.etudiants_reprises_impactes || [],
    };

    emettreSynchronisationPlanning(synchronisation);

    try {
      await chargerEtatProfesseur(idProfesseurActif, {
        effacerResumeReplanification: false,
        semaine: semaineCible,
      });

      setResumeReplanification(replanification);
      const statutReplanification = String(replanification?.statut || "")
        .trim()
        .toLowerCase();
      const messageReplanification =
        replanification?.message || "Disponibilites enregistrees avec succes.";

      if (
        statutReplanification === "partiel" ||
        statutReplanification === "echec"
      ) {
        const messageAlerte = `${messageReplanification} Les seances impossibles a replacer ont ete retirees des horaires valides et restent tracees dans le journal de replanification.`;
        setErreurDisponibilites(messageAlerte);
        showError(messageAlerte);
      } else {
        setMessageDisponibilites(messageReplanification);
        showSuccess(messageReplanification);
      }

      return true;
    } catch (error) {
      const messageErreur =
        "Disponibilites enregistrees, mais impossible de recharger l'horaire mis a jour. Rechargez la page pour recuperer l'etat courant.";

      setErreurDisponibilites(messageErreur);
      setResumeReplanification(resultat?.replanification || null);
      showError(messageErreur);
      return false;
    } finally {
      setChargementDisponibilites(false);
    }
  }

  async function handleSupprimerDisponibilite(index) {
    const prochainesDisponibilites = disponibilites.filter(
      (_, indexDisponibilite) => indexDisponibilite !== index
    );
    const sauvegardeReussie = await persisterDisponibilites(prochainesDisponibilites);

    if (sauvegardeReussie && indexEditionDisponibilite === index) {
      reinitialiserFormulaireDisponibilite();
    }
  }

  async function handleAjouterDisponibilite(event) {
    event.preventDefault();
    setErreurDisponibilites("");
    setMessageDisponibilites("");

    const jourSemaine = Number(formulaireDisponibilite.jour_semaine);
    const heureDebut = normaliserHeure(formulaireDisponibilite.heure_debut);
    const heureFin = normaliserHeure(formulaireDisponibilite.heure_fin);

    if (!jourSemaine || !heureDebut || !heureFin) {
      setErreurDisponibilites("Tous les champs de disponibilite sont obligatoires.");
      return;
    }

    if (heureDebut >= heureFin) {
      setErreurDisponibilites("L'heure de fin doit etre apres l'heure de debut.");
      return;
    }

    if (heureDebut < "08:00" || heureFin > "22:00") {
      setErreurDisponibilites("Les disponibilites doivent rester entre 08:00 et 22:00.");
      return;
    }

    const disponibilitesMisesAJour = disponibilites.filter(
      (_, index) => index !== indexEditionDisponibilite
    );

    const doublon = disponibilitesMisesAJour.some(
      (disponibilite) =>
        Number(disponibilite.jour_semaine) === jourSemaine &&
        normaliserHeure(disponibilite.heure_debut) === heureDebut &&
        normaliserHeure(disponibilite.heure_fin) === heureFin
    );

    if (doublon) {
      setErreurDisponibilites("Cette disponibilite existe deja pour ce professeur.");
      return;
    }

    const prochainesDisponibilites = trierDisponibilites([
      ...disponibilitesMisesAJour,
      {
        jour_semaine: jourSemaine,
        heure_debut: heureDebut,
        heure_fin: heureFin,
      },
    ]);

    const sauvegardeReussie = await persisterDisponibilites(prochainesDisponibilites);

    if (sauvegardeReussie) {
      reinitialiserFormulaireDisponibilite();
    }
  }

  async function handleRechargerDepuisBase() {
    if (!idProfesseurActif) {
      return;
    }

    setChargementDisponibilites(true);
    setErreurDisponibilites("");
    setMessageDisponibilites("");

    try {
      await chargerEtatProfesseur(idProfesseurActif, {
        semaine: semaineCible,
      });
      setMessageDisponibilites(
        "Disponibilites et horaire recharges depuis la base de donnees."
      );
    } catch (error) {
      setErreurDisponibilites(
        error.message ||
          "Impossible de recharger les disponibilites enregistrees du professeur."
      );
    } finally {
      setChargementDisponibilites(false);
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Disponibilites professeurs"
      subtitle="Appliquez une disponibilite standard ou temporaire, replanifiez localement les seances impactees et conservez un historique metier complet."
    >
      <div className="crud-page">
        <section className="professeurs-page__workspace professeurs-page__workspace--full">
          <div className="professeurs-page__panel">
            <div className="professeurs-page__panel-header">
              <div>
                <h2>Disponibilites du professeur</h2>
                <p>
                  Chaque ajout, modification ou suppression est enregistre
                  immediatement avec sa portee temporelle puis recharge depuis la base.
                </p>
              </div>

              <select
                className="professeurs-page__select"
                value={idProfesseurActif || ""}
                onChange={(event) =>
                  setIdProfesseurActif(Number(event.target.value) || null)
                }
                disabled={chargement}
              >
                <option value="">Choisir un professeur</option>
                {professeurs.map((professeur) => (
                  <option
                    key={professeur.id_professeur}
                    value={professeur.id_professeur}
                  >
                    {professeur.matricule} - {professeur.prenom} {professeur.nom}
                  </option>
                ))}
              </select>
            </div>

            {chargement ? (
              <p className="crud-page__state">Chargement...</p>
            ) : professeurActif ? (
              <>
                <div className="professeurs-page__prof-card">
                  <strong>
                    {professeurActif.prenom} {professeurActif.nom}
                  </strong>
                  <span>{professeurActif.matricule}</span>
                  <span>{getLibelleProgrammesProfesseur(professeurActif)}</span>
                </div>

                {sessionActive ? (
                  <div className="professeurs-page__prof-card">
                    <strong>
                      {sessionActive.nom} • semaine {fenetreSemaineAffichee?.numero_semaine || semaineCible}
                    </strong>
                    <span>
                      {fenetreSemaineAffichee?.date_debut
                        ? `${formaterDateCourte(creerDateLocale(fenetreSemaineAffichee.date_debut))} - ${formaterDateCourte(creerDateLocale(fenetreSemaineAffichee.date_fin))}`
                        : "Aucune semaine chargee"}
                    </span>
                    <span>Portee de sauvegarde : {decrirePorteeSauvegarde({
                      modeApplication,
                      dateDebutApplication,
                      dateFinApplication,
                      fenetreSemaineAffichee,
                      sessionActive,
                    })}</span>
                  </div>
                ) : (
                  <div className="crud-page__alert crud-page__alert--error">
                    Aucune session active n'est disponible. Les disponibilites datees ne peuvent
                    pas etre modifiees sans session active.
                  </div>
                )}

                {erreurDisponibilites ? (
                  <div className="crud-page__alert crud-page__alert--error">
                    {erreurDisponibilites}
                  </div>
                ) : null}
                {messageDisponibilites ? (
                  <div className="crud-page__alert crud-page__alert--success">
                    {messageDisponibilites}
                  </div>
                ) : null}
                {seancesAVenirHorsDisponibilites.length > 0 ? (
                  <div className="crud-page__alert crud-page__alert--error">
                    La sauvegarde devra replanifier {seancesAVenirHorsDisponibilites.length}{" "}
                    seance(s) de la semaine {fenetreSemaineAffichee?.numero_semaine || semaineCible}{" "}
                    qui ne rentrent plus dans les disponibilites affichees.
                  </div>
                ) : null}

                <form
                  className="professeurs-page__availability-form"
                  onSubmit={handleAjouterDisponibilite}
                >
                  <label className="crud-page__field">
                    <span>Semaine de reference</span>
                    <select
                      value={semaineCible || ""}
                      onChange={(event) =>
                        setSemaineCible(Number(event.target.value) || null)
                      }
                      disabled={chargementDisponibilites || !sessionActive}
                    >
                      {!sessionActive ? (
                        <option value="">Aucune session active</option>
                      ) : (
                        Array.from(
                          { length: calculerNombreSemainesSession(sessionActive) },
                          (_, index) => index + 1
                        ).map((numeroSemaine) => {
                          const fenetre = calculerFenetreSemaineSession(
                            sessionActive,
                            numeroSemaine
                          );

                          return (
                            <option key={numeroSemaine} value={numeroSemaine}>
                              Semaine {numeroSemaine} • {formaterDateCourte(creerDateLocale(fenetre.date_debut))} -{" "}
                              {formaterDateCourte(creerDateLocale(fenetre.date_fin))}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </label>

                  <label className="crud-page__field">
                    <span>Type d'application</span>
                    <select
                      value={modeApplication}
                      onChange={(event) => setModeApplication(event.target.value)}
                      disabled={chargementDisponibilites || !sessionActive}
                    >
                      <option value="permanente">
                        Disponibilite standard permanente
                      </option>
                      <option value="semaine_unique">Cette semaine uniquement</option>
                      <option value="semaine_et_suivantes">
                        Cette semaine et toutes les suivantes
                      </option>
                      <option value="a_partir_date">
                        A partir d'une date precise
                      </option>
                      <option value="plage_dates">Entre deux dates precises</option>
                    </select>
                  </label>

                  {modeUtiliseDateDebut(modeApplication) ? (
                    <label className="crud-page__field">
                      <span>Date de debut</span>
                      <input
                        type="date"
                        value={dateDebutApplication}
                        min={sessionActive?.date_debut || undefined}
                        max={sessionActive?.date_fin || undefined}
                        onChange={(event) => setDateDebutApplication(event.target.value)}
                        disabled={chargementDisponibilites || !sessionActive}
                      />
                    </label>
                  ) : null}

                  {modeUtiliseDateFin(modeApplication) ? (
                    <label className="crud-page__field">
                      <span>Date de fin</span>
                      <input
                        type="date"
                        value={dateFinApplication}
                        min={dateDebutApplication || sessionActive?.date_debut || undefined}
                        max={sessionActive?.date_fin || undefined}
                        onChange={(event) => setDateFinApplication(event.target.value)}
                        disabled={chargementDisponibilites || !sessionActive}
                      />
                    </label>
                  ) : null}

                  <label className="crud-page__field">
                    <span>Jour</span>
                    <select
                      name="jour_semaine"
                      value={formulaireDisponibilite.jour_semaine}
                      onChange={handleChangerDisponibilite}
                    >
                      {JOURS_SEMAINE_COMPLETS.map((jour) => (
                        <option key={jour.value} value={jour.value}>
                          {jour.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="crud-page__field">
                    <span>Debut</span>
                    <input
                      type="time"
                      min="08:00"
                      max="22:00"
                      name="heure_debut"
                      value={formulaireDisponibilite.heure_debut}
                      onChange={handleChangerDisponibilite}
                    />
                  </label>

                  <label className="crud-page__field">
                    <span>Fin</span>
                    <input
                      type="time"
                      min="08:00"
                      max="22:00"
                      name="heure_fin"
                      value={formulaireDisponibilite.heure_fin}
                      onChange={handleChangerDisponibilite}
                    />
                  </label>

                  <div className="professeurs-page__availability-actions">
                    <button
                      type="submit"
                      className="crud-page__primary-button"
                      disabled={
                        chargementDisponibilites ||
                        !sessionActive ||
                        (modeUtiliseSemaineReference(modeApplication) && !semaineCible)
                      }
                    >
                      {indexEditionDisponibilite !== null ? "Mettre a jour" : "Ajouter"}
                    </button>
                    <button
                      type="button"
                      className="crud-page__secondary-button"
                      onClick={reinitialiserFormulaireDisponibilite}
                      disabled={chargementDisponibilites}
                    >
                      Reinitialiser
                    </button>
                    <button
                      type="button"
                      className="crud-page__secondary-button"
                      onClick={handleRechargerDepuisBase}
                      disabled={chargementDisponibilites}
                    >
                      {chargementDisponibilites ? "Chargement..." : "Recharger la base"}
                    </button>
                  </div>
                </form>

                <div className="professeurs-page__availability-layout">
                  <div className="professeurs-page__availability-sidebar">
                    {journalReplanifications.length > 0 ? (
                      <div className="professeurs-page__day-card">
                        <div className="professeurs-page__day-title">
                          Historique des recalculs
                        </div>
                        <ul className="professeurs-page__availability-list">
                          {journalReplanifications.map((entree) => {
                            const fenetreApplication =
                              entree.resume?.fenetre_application || null;
                            return (
                              <li
                                key={entree.id_journal_replanification}
                                className="professeurs-page__availability-item"
                              >
                                <div>
                                  <strong>
                                    {formaterStatutJournal(entree.statut)} -{" "}
                                    {formaterHorodatageJournal(entree.cree_le)}
                                  </strong>
                                  <div>
                                    {getLibelleModeApplication(
                                      fenetreApplication?.mode_application
                                    )}
                                  </div>
                                  <small>
                                    {fenetreApplication?.date_debut_effet &&
                                    fenetreApplication?.date_fin_effet
                                      ? `Portee: ${fenetreApplication.date_debut_effet} - ${fenetreApplication.date_fin_effet}`
                                      : "Portee temporelle non detaillee"}
                                  </small>
                                </div>
                                <div>
                                  <strong>
                                    {Number(entree.seances_concernees || 0)} seance(s)
                                  </strong>
                                  <div>
                                    {Number(entree.seances_replanifiees || 0)} deplacee(s)
                                  </div>
                                  <small>
                                    {Number(entree.seances_non_replanifiees || 0)} bloquee(s)
                                  </small>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                    {variationsParPeriode.length > 0 ? (
                      <div className="professeurs-page__day-card">
                        <div className="professeurs-page__day-title">Variantes en session</div>
                        <ul className="professeurs-page__availability-list">
                          {variationsParPeriode.map((periode) => (
                            <li
                              key={periode.cle}
                              className="professeurs-page__availability-item"
                            >
                              <span>
                                Semaines {periode.semaine_debut}
                                {periode.semaine_fin !== periode.semaine_debut
                                  ? ` a ${periode.semaine_fin}`
                                  : ""}{" "}
                                • {periode.disponibilites.length} plage(s)
                              </span>
                              <small>
                                {periode.date_debut_effet} - {periode.date_fin_effet}
                              </small>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="professeurs-page__days">
                      {disponibilitesParJour.map((jour) => (
                        <div className="professeurs-page__day-card" key={jour.value}>
                          <div className="professeurs-page__day-title">{jour.label}</div>
                          {jour.disponibilites.length === 0 ? (
                            <p className="professeurs-page__empty-day">Aucune disponibilite</p>
                          ) : (
                            <ul className="professeurs-page__availability-list">
                              {jour.disponibilites.map((disponibilite) => {
                                const indexDisponibilite = disponibilites.findIndex(
                                  (element) =>
                                    Number(element.jour_semaine) === Number(disponibilite.jour_semaine) &&
                                    normaliserHeure(element.heure_debut) ===
                                      normaliserHeure(disponibilite.heure_debut) &&
                                    normaliserHeure(element.heure_fin) ===
                                      normaliserHeure(disponibilite.heure_fin)
                                );

                                return (
                                  <li
                                    key={`${jour.value}-${normaliserHeure(disponibilite.heure_debut)}-${normaliserHeure(disponibilite.heure_fin)}`}
                                    className="professeurs-page__availability-item"
                                  >
                                    <span>
                                      {normaliserHeure(disponibilite.heure_debut)} -{" "}
                                      {normaliserHeure(disponibilite.heure_fin)}
                                    </span>
                                    <div className="professeurs-page__availability-item-actions">
                                      <button
                                        type="button"
                                        className="crud-page__action crud-page__action--edit"
                                        onClick={() => handleEditerDisponibilite(indexDisponibilite)}
                                        disabled={chargementDisponibilites}
                                      >
                                        Modifier
                                      </button>
                                      <button
                                        type="button"
                                        className="crud-page__action crud-page__action--delete"
                                        onClick={() =>
                                          handleSupprimerDisponibilite(indexDisponibilite)
                                        }
                                        disabled={chargementDisponibilites}
                                      >
                                        Supprimer
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="professeurs-page__schedule-list">
                    <h3>Calendrier unifie</h3>
                    <p className="professeurs-page__schedule-note">
                      Vert = disponibilites effectives sur la semaine cible. Bleu = cours
                      planifies sur cette meme semaine.
                    </p>

                    <div className="professeurs-page__calendar-wrapper">
                      <div className="professeurs-page__calendar-grid">
                        <div className="professeurs-page__hours-column">
                          <div className="professeurs-page__calendar-head-empty"></div>
                          {HEURES.map((heure) => (
                            <div key={heure} className="professeurs-page__hour-cell">
                              {heure}
                            </div>
                          ))}
                        </div>

                        {JOURS_SEMAINE_COMPLETS.map((jour, jourIndex) => (
                          <div key={jour.value} className="professeurs-page__day-column">
                            <div className="professeurs-page__calendar-head">
                              <span>{jour.label}</span>
                              <small>Disponibilites + cours</small>
                            </div>
                            <div className="professeurs-page__calendar-body">
                              {HEURES.map((heure) => (
                                <div key={heure} className="professeurs-page__slot"></div>
                              ))}

                              {HEURES.map((heure) => {
                                const key = `${jourIndex}-${heure}`;
                                const blocs = disponibilitesMap[key] || [];

                                return blocs.map((disponibilite) => {
                                  const hauteur = getHauteurBloc(
                                    disponibilite.heure_debut,
                                    disponibilite.heure_fin
                                  );
                                  const top =
                                    ((heureEnMinutes(disponibilite.heure_debut) -
                                      heureEnMinutes(HEURES[0])) /
                                      60) *
                                    60;

                                  return (
                                    <div
                                      key={`${jour.value}-${normaliserHeure(disponibilite.heure_debut)}-${normaliserHeure(disponibilite.heure_fin)}`}
                                      className="professeurs-page__availability-session"
                                      style={{ top: `${top}px`, height: `${hauteur}px` }}
                                    >
                                      <strong>Disponible</strong>
                                      <span>
                                        {normaliserHeure(disponibilite.heure_debut)} -{" "}
                                        {normaliserHeure(disponibilite.heure_fin)}
                                      </span>
                                      <small>{professeurActif.prenom} {professeurActif.nom}</small>
                                    </div>
                                  );
                                });
                              })}

                              {HEURES.map((heure) => {
                                const key = `${jourIndex}-${heure}`;
                                const seances = planningMap[key] || [];

                                return seances.map((seance) => {
                                  const hauteur = getHauteurBloc(
                                    seance.heure_debut,
                                    seance.heure_fin
                                  );
                                  const top =
                                    ((heureEnMinutes(seance.heure_debut) -
                                      heureEnMinutes(HEURES[0])) /
                                      60) *
                                    60;

                                  return (
                                    <div
                                      key={`planning-${seance.id_affectation_cours}`}
                                      className="professeurs-page__session"
                                      style={{ top: `${top}px`, height: `${hauteur}px` }}
                                    >
                                      <strong>{seance.code_cours}</strong>
                                      <span>{seance.nom_cours}</span>
                                      <small>{seance.code_salle || "EN LIGNE"}</small>
                                    </div>
                                  );
                                });
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="professeurs-page__schedule-list">
                      <h3>
                        Semaine cible planifiee{" "}
                        {horaireProfesseur.length > 0
                          ? `(S${fenetreSemaineAffichee?.numero_semaine || semaineCible} • ${formaterDateCourte(lundiPlanningActif)})`
                          : ""}
                      </h3>
                      {seancesSemaineType.length === 0 ? (
                        <p className="crud-page__state">
                          Aucun cours planifie pour ce professeur sur la semaine cible.
                        </p>
                      ) : (
                        <ul className="professeurs-page__availability-list">
                          {seancesSemaineType.map((seance) => (
                            <li
                              key={`resume-${seance.id_affectation_cours}`}
                              className="professeurs-page__availability-item"
                            >
                              <span>
                                <strong>{seance.code_cours}</strong> -{" "}
                                {formaterDateLonguePlanning(seance.date)} -{" "}
                                {normaliserHeure(seance.heure_debut)} /{" "}
                                {normaliserHeure(seance.heure_fin)}
                              </span>
                              <span>{seance.groupes || seance.code_salle || "EN LIGNE"}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                    {seancesSemaineType.length > 0 ? (
                        seancesHorsDisponibilites.length > 0 ? (
                          <div className="crud-page__alert crud-page__alert--error">
                            {seancesHorsDisponibilites.length} seance(s) planifiee(s) ne sont
                            pas couvertes par les disponibilites enregistrees.
                          </div>
                        ) : (
                          <div className="crud-page__alert crud-page__alert--success">
                            Toutes les seances planifiees de la semaine cible sont couvertes par
                            les disponibilites du professeur.
                          </div>
                        )
                      ) : null}

                      {resumeReplanification ? (
                        <>
                          {resumeReplanification.message ? (
                            <div
                              className={`crud-page__alert ${
                                resumeReplanification.seances_non_replanifiees?.length > 0
                                  ? "crud-page__alert--error"
                                  : "crud-page__alert--success"
                              }`}
                            >
                              {resumeReplanification.message}
                            </div>
                          ) : null}

                          {resumeReplanification.seances_non_replanifiees?.length > 0 ? (
                            <div className="crud-page__alert crud-page__alert--error">
                              Impossible de replacer{" "}
                              {resumeReplanification.seances_non_replanifiees.length}{" "}
                              seance(s). Elargissez les disponibilites ou corrigez
                              manuellement l'horaire.
                            </div>
                          ) : null}

                          {Number(
                            resumeReplanification.resume
                              ?.seances_reportees_semaines_suivantes || 0
                          ) > 0 ? (
                            <div className="crud-page__alert crud-page__alert--success">
                              {
                                resumeReplanification.resume
                                  .seances_reportees_semaines_suivantes
                              }{" "}
                              seance(s) ont ete reportee(s) sur une semaine suivante pour
                              respecter les disponibilites, les groupes et les salles.
                            </div>
                          ) : null}

                          {resumeReplanification.fenetre_impact?.date_debut &&
                          resumeReplanification.fenetre_impact?.date_fin ? (
                            <div className="crud-page__alert crud-page__alert--success">
                              Fenetre d'impact analysee :{" "}
                              {resumeReplanification.fenetre_impact.date_debut} -{" "}
                              {resumeReplanification.fenetre_impact.date_fin}
                            </div>
                          ) : null}

                          {resumeReplanification.seances_deplacees?.length > 0 ? (
                            <>
                              <h3>Seances replanifiees</h3>
                              <ul className="professeurs-page__availability-list">
                                {resumeReplanification.seances_deplacees.map((seance) => (
                                  <li
                                    key={`replanifiee-${seance.id_affectation_cours}`}
                                    className="professeurs-page__availability-item"
                                  >
                                    <span>
                                      <strong>{seance.code_cours}</strong> - {seance.groupes}
                                    </span>
                                    <span>
                                      {formaterDateLonguePlanning(seance.ancien_creneau.date)} -{" "}
                                      {normaliserHeure(seance.ancien_creneau.heure_debut)} /{" "}
                                      {normaliserHeure(seance.ancien_creneau.heure_fin)}
                                    </span>
                                    <span>
                                      Nouveau:{" "}
                                      {formaterDateLonguePlanning(seance.nouveau_creneau.date)} -{" "}
                                      {normaliserHeure(seance.nouveau_creneau.heure_debut)} /{" "}
                                      {normaliserHeure(seance.nouveau_creneau.heure_fin)} -{" "}
                                      {seance.nouveau_creneau.code_salle}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : null}

                          {resumeReplanification.seances_non_replanifiees?.length > 0 ? (
                            <>
                              <h3>Seances encore bloquees</h3>
                              <ul className="professeurs-page__availability-list">
                                {resumeReplanification.seances_non_replanifiees.map((seance) => (
                                  <li
                                    key={`bloquee-${seance.id_affectation_cours}`}
                                    className="professeurs-page__availability-item"
                                  >
                                    <span>
                                      <strong>{seance.code_cours}</strong> - {seance.groupes}
                                    </span>
                                    <span>
                                      {formaterDateLonguePlanning(seance.ancien_creneau.date)} -{" "}
                                      {normaliserHeure(seance.ancien_creneau.heure_debut)} /{" "}
                                      {normaliserHeure(seance.ancien_creneau.heure_fin)}
                                    </span>
                                    <span>
                                      {seance.action_finale === "retiree_de_l_horaire"
                                        ? "Retiree de l'horaire valide"
                                        : "Toujours en attente de resolution"}
                                    </span>
                                    <span>{seance.raison}</span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="crud-page__state">Aucun professeur selectionne.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
