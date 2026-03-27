import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import {
  recupererProfesseurs,
  recupererHoraireProfesseur,
} from "../services/professeurs.api.js";
import "../styles/ProfesseursPage.css";
import "../styles/HorairesProfesseursPage.css";

const JOURS_SEMAINE = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
];

const HEURES = Array.from({ length: 15 }, (_, index) =>
  `${String(index + 8).padStart(2, "0")}:00`
);

function normaliserHeure(heure) {
  return String(heure || "").slice(0, 5);
}

function heureEnMinutes(heure) {
  const [heures = "0", minutes = "0"] = normaliserHeure(heure).split(":");
  return Number(heures) * 60 + Number(minutes);
}

function creerDateLocale(dateString) {
  const [annee, mois, jour] = String(dateString || "").split("-").map(Number);
  return new Date(annee || 1970, (mois || 1) - 1, jour || 1);
}

function getDebutSemaine(date) {
  const dateReference = new Date(date);
  const jour = dateReference.getDay();
  const diff = jour === 0 ? -6 : 1 - jour;
  dateReference.setDate(dateReference.getDate() + diff);
  dateReference.setHours(0, 0, 0, 0);
  return dateReference;
}

function formaterDateCourte(date) {
  return date.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

function formaterDateLongue(dateString) {
  return creerDateLocale(dateString).toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getSeancesParJourEtHeure(seances, lundiSemaine) {
  const map = {};

  seances.forEach((seance) => {
    const dateSeance = creerDateLocale(seance.date);
    const jourIndex = dateSeance.getDay() - 1;

    if (jourIndex < 0 || jourIndex > 4) {
      return;
    }

    const lundiSeance = getDebutSemaine(dateSeance);
    if (lundiSeance.getTime() !== lundiSemaine.getTime()) {
      return;
    }

    const debut = normaliserHeure(seance.heure_debut);
    const key = `${jourIndex}-${debut}`;

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(seance);
  });

  return map;
}

function getHauteurBloc(heureDebut, heureFin) {
  const debut = heureEnMinutes(heureDebut);
  const fin = heureEnMinutes(heureFin);
  return ((fin - debut) / 60) * 60;
}

export function HorairesProfesseursPage({ utilisateur, onLogout }) {
  const [professeurs, setProfesseurs] = useState([]);
  const [horaireProfesseur, setHoraireProfesseur] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [chargementHoraire, setChargementHoraire] = useState(false);
  const [erreur, setErreur] = useState("");
  const [recherche, setRecherche] = useState("");
  const [idProfesseurActif, setIdProfesseurActif] = useState(null);
  const [lundiCourant, setLundiCourant] = useState(() =>
    getDebutSemaine(new Date())
  );

  useEffect(() => {
    async function chargerProfesseurs() {
      setChargement(true);
      setErreur("");

      try {
        const data = await recupererProfesseurs();
        const liste = Array.isArray(data) ? data : [];
        setProfesseurs(liste);
        setIdProfesseurActif(liste[0]?.id_professeur || null);
      } catch (error) {
        setErreur(error.message || "Impossible de charger les professeurs.");
      } finally {
        setChargement(false);
      }
    }

    chargerProfesseurs();
  }, []);

  useEffect(() => {
    async function chargerHoraire() {
      if (!idProfesseurActif) {
        setHoraireProfesseur([]);
        return;
      }

      setChargementHoraire(true);
      setErreur("");

      try {
        const data = await recupererHoraireProfesseur(idProfesseurActif);
        setHoraireProfesseur(Array.isArray(data) ? data : []);
      } catch (error) {
        setErreur(error.message || "Impossible de charger l'horaire du professeur.");
      } finally {
        setChargementHoraire(false);
      }
    }

    chargerHoraire();
  }, [idProfesseurActif]);

  const professeursFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();

    if (!terme) {
      return professeurs;
    }

    return professeurs.filter((professeur) => {
      const contenu = [
        professeur.matricule,
        professeur.prenom,
        professeur.nom,
        professeur.specialite,
      ]
        .join(" ")
        .toLowerCase();

      return contenu.includes(terme);
    });
  }, [professeurs, recherche]);

  const professeurActif = useMemo(
    () =>
      professeurs.find((professeur) => professeur.id_professeur === idProfesseurActif) ||
      null,
    [professeurs, idProfesseurActif]
  );

  const vendrediCourant = useMemo(() => {
    const date = new Date(lundiCourant);
    date.setDate(date.getDate() + 4);
    return date;
  }, [lundiCourant]);

  const joursAvecDates = useMemo(
    () =>
      JOURS_SEMAINE.map((jour, index) => {
        const date = new Date(lundiCourant);
        date.setDate(date.getDate() + index);
        return { ...jour, date };
      }),
    [lundiCourant]
  );

  const seancesMap = useMemo(
    () => getSeancesParJourEtHeure(horaireProfesseur, lundiCourant),
    [horaireProfesseur, lundiCourant]
  );

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Horaires professeurs"
      subtitle="Recherchez un enseignant puis consultez son planning de travail."
    >
      <div className="horaires-professeurs-page">
        {erreur ? (
          <div className="crud-page__alert crud-page__alert--error">{erreur}</div>
        ) : null}

        <section className="horaires-professeurs-page__workspace">
          <aside className="horaires-professeurs-page__sidebar">
            <div className="horaires-professeurs-page__sidebar-header">
              <h2>Recherche professeur</h2>
              <p>Filtrez par nom, matricule ou programme.</p>
            </div>

            <input
              type="text"
              className="crud-page__search"
              placeholder="Chercher un professeur..."
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
            />

            <div className="horaires-professeurs-page__list">
              {chargement ? (
                <p className="crud-page__state">Chargement...</p>
              ) : professeursFiltres.length === 0 ? (
                <p className="crud-page__state">Aucun professeur trouve.</p>
              ) : (
                professeursFiltres.map((professeur) => (
                  <button
                    key={professeur.id_professeur}
                    type="button"
                    className={`horaires-professeurs-page__teacher-card ${
                      professeur.id_professeur === idProfesseurActif
                        ? "horaires-professeurs-page__teacher-card--active"
                        : ""
                    }`}
                    onClick={() => setIdProfesseurActif(professeur.id_professeur)}
                  >
                    <strong>
                      {professeur.prenom} {professeur.nom}
                    </strong>
                    <span>{professeur.matricule}</span>
                    <small>{professeur.specialite || "Sans programme"}</small>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="horaires-professeurs-page__content">
            <div className="professeurs-page__panel">
              <div className="professeurs-page__panel-header">
                <div>
                  <h2>Planning enseignant</h2>
                  <p>
                    {professeurActif
                      ? `${professeurActif.prenom} ${professeurActif.nom} - ${professeurActif.specialite || "Programme non defini"}`
                      : "Selectionnez un professeur pour afficher son horaire."}
                  </p>
                </div>
              </div>

              {professeurActif ? (
                <>
                  <div className="professeurs-page__calendar-nav">
                    <button
                      type="button"
                      className="professeurs-page__calendar-btn"
                      onClick={() => {
                        const date = new Date(lundiCourant);
                        date.setDate(date.getDate() - 7);
                        setLundiCourant(date);
                      }}
                    >
                      &larr;
                    </button>
                    <span className="professeurs-page__calendar-title">
                      {formaterDateCourte(lundiCourant)} - {formaterDateCourte(vendrediCourant)}
                    </span>
                    <button
                      type="button"
                      className="professeurs-page__calendar-btn"
                      onClick={() => {
                        const date = new Date(lundiCourant);
                        date.setDate(date.getDate() + 7);
                        setLundiCourant(date);
                      }}
                    >
                      &rarr;
                    </button>
                    <button
                      type="button"
                      className="professeurs-page__calendar-today"
                      onClick={() => setLundiCourant(getDebutSemaine(new Date()))}
                    >
                      Semaine actuelle
                    </button>
                  </div>

                  {chargementHoraire ? (
                    <p className="crud-page__state">Chargement du planning...</p>
                  ) : (
                    <>
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

                          {joursAvecDates.map(({ label, date }, jourIndex) => (
                            <div key={label} className="professeurs-page__day-column">
                              <div className="professeurs-page__calendar-head">
                                <span>{label}</span>
                                <small>{formaterDateCourte(date)}</small>
                              </div>
                              <div className="professeurs-page__calendar-body">
                                {HEURES.map((heure) => (
                                  <div key={heure} className="professeurs-page__slot"></div>
                                ))}
                                {HEURES.map((heure) => {
                                  const key = `${jourIndex}-${heure}`;
                                  const seances = seancesMap[key] || [];

                                  return seances.map((seance) => {
                                    const hauteur = getHauteurBloc(
                                      seance.heure_debut,
                                      seance.heure_fin
                                    );
                                    const debut = heureEnMinutes(seance.heure_debut);
                                    const heureRef = heureEnMinutes(HEURES[0]);
                                    const top = ((debut - heureRef) / 60) * 60;

                                    return (
                                      <div
                                        key={seance.id_affectation_cours}
                                        className="professeurs-page__session"
                                        style={{ top: `${top}px`, height: `${hauteur}px` }}
                                      >
                                        <strong>{seance.code_cours}</strong>
                                        <span>{seance.nom_cours}</span>
                                        <small>{seance.groupes || "Aucun groupe"}</small>
                                        <small>{seance.code_salle}</small>
                                        <small>
                                          {normaliserHeure(seance.heure_debut)} -{" "}
                                          {normaliserHeure(seance.heure_fin)}
                                        </small>
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
                        <h3>Liste detaillee</h3>
                        {horaireProfesseur.length === 0 ? (
                          <p className="crud-page__state">
                            Aucun cours planifie pour ce professeur.
                          </p>
                        ) : (
                          <div className="crud-page__table-card">
                            <table className="crud-page__table">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Horaire</th>
                                  <th>Cours</th>
                                  <th>Groupes</th>
                                  <th>Salle</th>
                                </tr>
                              </thead>
                              <tbody>
                                {horaireProfesseur.map((seance) => (
                                  <tr key={seance.id_affectation_cours}>
                                    <td>{formaterDateLongue(seance.date)}</td>
                                    <td>
                                      {normaliserHeure(seance.heure_debut)} -{" "}
                                      {normaliserHeure(seance.heure_fin)}
                                    </td>
                                    <td>
                                      {seance.code_cours} - {seance.nom_cours}
                                    </td>
                                    <td>{seance.groupes || "-"}</td>
                                    <td>{seance.code_salle}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="crud-page__state">
                  Selectionnez un professeur depuis la colonne de gauche.
                </p>
              )}
            </div>
          </section>
        </section>
      </div>
    </AppShell>
  );
}
