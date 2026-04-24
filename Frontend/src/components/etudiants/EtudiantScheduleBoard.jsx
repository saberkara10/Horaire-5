import { useEffect, useMemo, useState } from "react";
import {
  JOURS_SEMAINE_COMPLETS,
  creerDateLocale,
  formaterDateCourte,
  getDebutSemaine,
  getIndexJourCalendrier,
} from "../../utils/calendar.js";
import {
  getCourseLocationLabel,
  isOnlineCourseLike,
} from "../../utils/courseDelivery.js";

const HEURES = Array.from({ length: 15 }, (_, index) =>
  `${String(index + 8).padStart(2, "0")}:00`
);

function formaterHeure(heureStr) {
  return String(heureStr || "").slice(0, 5);
}

function heureEnMinutes(heure) {
  const [heures, minutes] = String(heure || "00:00").split(":").map(Number);
  return heures * 60 + minutes;
}

function formaterDateLongue(dateStr) {
  const date = creerDateLocale(dateStr);
  return date.toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formaterNomProfesseur(seance) {
  return `${String(seance?.prenom_professeur || "").trim()} ${String(
    seance?.nom_professeur || ""
  ).trim()}`
    .trim()
    .replace(/\s+/g, " ");
}

function valeurEstVraie(value) {
  return (
    value === true ||
    Number(value || 0) === 1 ||
    String(value || "").toLowerCase() === "true"
  );
}

function estSeanceReprise(seance) {
  const sourceHoraire = String(seance?.source_horaire || "").trim().toLowerCase();

  return (
    valeurEstVraie(seance?.est_reprise) ||
    sourceHoraire === "reprise" ||
    Number(seance?.id_cours_echoue || 0) > 0
  );
}

function getPresentationSource(seance) {
  if (estSeanceReprise(seance)) {
    return {
      badge: "Reprise",
      badgeCourt: "REPRISE",
      pillClass: "status-pill--warning",
      description: `Groupe suivi : ${seance.groupe_source || "non renseigne"}`,
      classeSeance: "etudiant-schedule__seance--reprise",
      classeLigne: "planning-table__row--reprise",
    };
  }

  if (String(seance?.source_horaire || "") === "individuelle") {
    return {
      badge: "Exception",
      badgeCourt: "EXCEPTION",
      pillClass: "status-pill--exception",
      description: `Groupe d'accueil : ${seance.groupe_source || "non renseigne"}`,
      classeSeance: "etudiant-schedule__seance--individuelle",
      classeLigne: "",
    };
  }

  return {
    badge: "Groupe principal",
    badgeCourt: "TRONC COMMUN",
    pillClass: "status-pill--success",
    description: `Groupe principal : ${seance.groupe_source || "non renseigne"}`,
    classeSeance: "",
    classeLigne: "",
  };
}

function getClasseLigneSeance(seance) {
  const presentation = getPresentationSource(seance);

  if (presentation.classeLigne) {
    return presentation.classeLigne;
  }

  return isOnlineCourseLike(seance) ? "planning-table__row--online" : "";
}

function getClasseCarteSeance(seance) {
  const presentation = getPresentationSource(seance);

  if (presentation.classeSeance) {
    return presentation.classeSeance;
  }

  return isOnlineCourseLike(seance) ? "cal-seance--online" : "";
}

function determinerLundiInitial(seances) {
  if (!Array.isArray(seances) || seances.length === 0) {
    return getDebutSemaine(new Date());
  }

  const dates = seances
    .map((seance) => creerDateLocale(seance.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((dateA, dateB) => dateA.getTime() - dateB.getTime());

  return dates.length > 0 ? getDebutSemaine(dates[0]) : getDebutSemaine(new Date());
}

function getSeancesParJourEtHeure(seances, lundiSemaine) {
  const indexParCase = {};

  seances.forEach((seance) => {
    const dateSeance = creerDateLocale(seance.date);
    const jourIndex = getIndexJourCalendrier(dateSeance);
    const lundiSeance = getDebutSemaine(dateSeance);

    if (lundiSeance.getTime() !== lundiSemaine.getTime()) {
      return;
    }

    const debut = formaterHeure(seance.heure_debut);
    const cle = `${jourIndex}-${debut}`;

    if (!indexParCase[cle]) {
      indexParCase[cle] = [];
    }

    indexParCase[cle].push(seance);
  });

  return indexParCase;
}

function getHauteur(heureDebut, heureFin) {
  const debut = heureEnMinutes(formaterHeure(heureDebut));
  const fin = heureEnMinutes(formaterHeure(heureFin));
  return ((fin - debut) / 60) * 60;
}

export function EtudiantScheduleBoard({
  seances = [],
  resume = null,
  consultationEnCours = false,
  onRechargerHoraire,
}) {
  const lundiInitial = useMemo(() => determinerLundiInitial(seances), [seances]);
  const [lundiCourant, setLundiCourant] = useState(() => lundiInitial);

  useEffect(() => {
    setLundiCourant(lundiInitial);
  }, [lundiInitial]);

  const finSemaine = useMemo(() => {
    const date = new Date(lundiCourant);
    date.setDate(date.getDate() + 6);
    return date;
  }, [lundiCourant]);

  const joursAvecDates = useMemo(
    () =>
      JOURS_SEMAINE_COMPLETS.map(({ label }, index) => {
        const date = new Date(lundiCourant);
        date.setDate(date.getDate() + index);
        return { nom: label, date };
      }),
    [lundiCourant]
  );

  const seancesMap = useMemo(
    () => getSeancesParJourEtHeure(seances, lundiCourant),
    [seances, lundiCourant]
  );

  return (
    <div className="detail-card__section">
      <div className="table-header">
        <div>
          <h2>Planning etudiant fusionne</h2>
          <p>
            {resume?.cours_total ?? 0} cours distincts sur {seances.length} seance(s).
          </p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          onClick={onRechargerHoraire}
          disabled={consultationEnCours}
        >
          {consultationEnCours ? "Actualisation..." : "Recharger"}
        </button>
      </div>

      <div className="etudiant-schedule__legend">
        <span className="status-pill status-pill--success">Cours normal</span>
        <span className="status-pill status-pill--warning">Cours repris</span>
        <span className="status-pill status-pill--exception">Exception individuelle</span>
        <span className="status-pill status-pill--online">Cours en ligne</span>
      </div>

      <div className="planning-table-wrapper">
        <table className="planning-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Debut</th>
              <th>Fin</th>
              <th>Cours</th>
              <th>Source</th>
              <th>Professeur</th>
              <th>Salle</th>
            </tr>
          </thead>
          <tbody>
            {seances.map((seance) => {
              const presentation = getPresentationSource(seance);
              const seanceEnLigne = isOnlineCourseLike(seance);

              return (
                <tr
                  key={`${seance.source_horaire}-${seance.id_affectation_cours}-${seance.id_plage_horaires}`}
                  className={getClasseLigneSeance(seance)}
                >
                  <td>{formaterDateLongue(seance.date)}</td>
                  <td>{formaterHeure(seance.heure_debut)}</td>
                  <td>{formaterHeure(seance.heure_fin)}</td>
                  <td>
                    <span className="planning-code">{seance.code_cours}</span>
                    <span className="planning-nom-cours">{seance.nom_cours}</span>
                    {seanceEnLigne ? (
                      <span className="planning-mode-badge planning-mode-badge--online">
                        En ligne
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <span className={`status-pill ${presentation.pillClass}`}>
                      {presentation.badge}
                    </span>
                    <div className="etudiant-schedule__source">
                      {presentation.description}
                    </div>
                  </td>
                  <td>
                    {formaterNomProfesseur(seance) || "A confirmer"}
                  </td>
                  <td>
                    <span
                      className={`planning-salle ${
                        seanceEnLigne ? "planning-salle--online" : ""
                      }`}
                    >
                      {getCourseLocationLabel(seance)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cal-nav">
        <button
          className="cal-nav-btn"
          type="button"
          onClick={() => {
            const date = new Date(lundiCourant);
            date.setDate(date.getDate() - 7);
            setLundiCourant(date);
          }}
        >
          &larr;
        </button>
        <span className="cal-nav-titre">
          {formaterDateCourte(lundiCourant)} - {formaterDateCourte(finSemaine)}
        </span>
        <button
          className="cal-nav-btn"
          type="button"
          onClick={() => {
            const date = new Date(lundiCourant);
            date.setDate(date.getDate() + 7);
            setLundiCourant(date);
          }}
        >
          &rarr;
        </button>
        <button
          className="cal-nav-aujourd-hui"
          type="button"
          onClick={() => setLundiCourant(lundiInitial)}
        >
          Semaine de debut
        </button>
      </div>

      <div className="cal-wrapper">
        <div className="cal-grille etudiant-schedule__grid">
          <div className="cal-col-heures">
            <div className="cal-entete-vide"></div>
            {HEURES.map((heure) => (
              <div key={heure} className="cal-heure-cell">
                {heure}
              </div>
            ))}
          </div>

          {joursAvecDates.map(({ nom, date }, jourIndex) => (
            <div key={jourIndex} className="cal-col-jour">
              <div className="cal-entete-jour">
                <span className="cal-jour-nom">{nom}</span>
                <span className="cal-jour-date">{formaterDateCourte(date)}</span>
              </div>
              <div className="cal-col-body">
                {HEURES.map((heure) => (
                  <div key={heure} className="cal-slot"></div>
                ))}
                {HEURES.map((heure) => {
                  const cle = `${jourIndex}-${heure}`;
                  const seancesHeure = seancesMap[cle] || [];

                  return seancesHeure.map((seance) => {
                    const presentation = getPresentationSource(seance);
                    const hauteur = getHauteur(seance.heure_debut, seance.heure_fin);
                    const debut = heureEnMinutes(formaterHeure(seance.heure_debut));
                    const heureReference = heureEnMinutes(HEURES[0]);
                    const top = ((debut - heureReference) / 60) * 60;

                    return (
                      <div
                        key={`${seance.source_horaire}-${seance.id_affectation_cours}-${seance.id_plage_horaires}-grid`}
                        className={`cal-seance ${getClasseCarteSeance(seance)}`}
                        style={{ top: `${top}px`, height: `${hauteur}px` }}
                      >
                        <span className="cal-seance-code">{seance.code_cours}</span>
                        <span className="etudiant-schedule__seance-badge">
                          {presentation.badgeCourt}
                        </span>
                        <span className="cal-seance-nom">{seance.nom_cours}</span>
                        <span className="cal-seance-salle">
                          {getCourseLocationLabel(seance)}
                        </span>
                        <span className="cal-seance-prof">
                          {formaterNomProfesseur(seance) || "Prof a confirmer"}
                        </span>
                        <span className="etudiant-schedule__source">
                          {presentation.description}
                        </span>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
