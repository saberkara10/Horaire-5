import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { recupererPlanningEtudiant } from "../services/etudiantsService.js";
import "../styles/PlanningEtudiantPage.css";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const HEURES = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

function getDebutSemaine(date) {
  const d = new Date(date);
  const jour = d.getDay();
  const diff = jour === 0 ? -6 : 1 - jour;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formaterDateCourte(date) {
  return date.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

function formaterDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formaterHeure(heureStr) {
  return heureStr.slice(0, 5);
}

function heureEnMinutes(heure) {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}

function getSeancesParJourEtHeure(seances, lundiSemaine) {
  const map = {};
  seances.forEach((seance) => {
    const dateSeance = new Date(seance.date);
    dateSeance.setHours(12);
    const jourIndex = dateSeance.getDay() - 1;
    if (jourIndex < 0 || jourIndex > 4) return;
    const lundiSeance = getDebutSemaine(dateSeance);
    if (lundiSeance.getTime() !== lundiSemaine.getTime()) return;
    const debut = seance.heure_debut.slice(0, 5);
    const key = `${jourIndex}-${debut}`;
    if (!map[key]) map[key] = [];
    map[key].push(seance);
  });
  return map;
}

function getHauteur(heure_debut, heure_fin) {
  const debut = heureEnMinutes(heure_debut.slice(0, 5));
  const fin = heureEnMinutes(heure_fin.slice(0, 5));
  return ((fin - debut) / 60) * 60;
}

export function PlanningEtudiantPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [etudiant, setEtudiant] = useState(null);
  const [horaire, setHoraire] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [lundiCourant, setLundiCourant] = useState(() => getDebutSemaine(new Date()));

  useEffect(() => {
    async function charger() {
      try {
        const data = await recupererPlanningEtudiant(id);
        setEtudiant(data.etudiant);
        setHoraire(data.horaire);
      } catch (error) {
        setErreur("Impossible de charger le planning.");
      } finally {
        setLoading(false);
      }
    }
    charger();
  }, [id]);

  if (loading) return <p className="planning-message">Chargement...</p>;
  if (erreur) return <p className="planning-message planning-erreur">{erreur}</p>;
  if (!etudiant) return <p className="planning-message">Etudiant introuvable</p>;

  const vendredi = new Date(lundiCourant);
  vendredi.setDate(vendredi.getDate() + 4);

  const joursAvecDates = JOURS.map((nom, i) => {
    const d = new Date(lundiCourant);
    d.setDate(d.getDate() + i);
    return { nom, date: d };
  });

  const seancesMap = getSeancesParJourEtHeure(horaire, lundiCourant);

  return (
    <div className="planning-container">
      <button className="planning-retour" onClick={() => navigate(-1)}>
        &larr; Retour
      </button>

      <h1 className="planning-titre">Planning etudiant</h1>

      {/* Infos etudiant */}
      <div className="planning-infos">
        <div className="planning-info-item">
          <span className="planning-label">Matricule</span>
          <span className="planning-valeur">{etudiant.matricule}</span>
        </div>
        <div className="planning-info-item">
          <span className="planning-label">Nom</span>
          <span className="planning-valeur">{etudiant.nom} {etudiant.prenom}</span>
        </div>
        <div className="planning-info-item">
          <span className="planning-label">Groupe</span>
          <span className="planning-valeur">{etudiant.groupe}</span>
        </div>
        <div className="planning-info-item">
          <span className="planning-label">Programme</span>
          <span className="planning-valeur">{etudiant.programme}</span>
        </div>
        <div className="planning-info-item">
          <span className="planning-label">Etape</span>
          <span className="planning-valeur">{etudiant.etape}</span>
        </div>
      </div>

      {/* Tableau liste */}
      <h2 className="planning-sous-titre">Cours planifies</h2>
      {horaire.length === 0 ? (
        <p className="planning-vide">Aucun cours planifie pour ce groupe.</p>
      ) : (
        <div className="planning-table-wrapper">
          <table className="planning-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Debut</th>
                <th>Fin</th>
                <th>Cours</th>
                <th>Professeur</th>
                <th>Salle</th>
              </tr>
            </thead>
            <tbody>
              {horaire.map((seance) => (
                <tr key={seance.id_affectation_cours}>
                  <td>{formaterDate(seance.date)}</td>
                  <td>{formaterHeure(seance.heure_debut)}</td>
                  <td>{formaterHeure(seance.heure_fin)}</td>
                  <td>
                    <span className="planning-code">{seance.code_cours}</span>
                    <span className="planning-nom-cours">{seance.nom_cours}</span>
                  </td>
                  <td>{seance.nom_professeur} {seance.prenom_professeur}</td>
                  <td>
                    <span className="planning-salle">{seance.code_salle}</span>
                    <span className="planning-type-salle">{seance.type_salle}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Calendrier semaine */}
      <h2 className="planning-sous-titre" style={{ marginTop: "40px" }}>Calendrier</h2>

      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => {
          const d = new Date(lundiCourant);
          d.setDate(d.getDate() - 7);
          setLundiCourant(d);
        }}>&larr;</button>
        <span className="cal-nav-titre">
          {formaterDateCourte(lundiCourant)} — {formaterDateCourte(vendredi)}
        </span>
        <button className="cal-nav-btn" onClick={() => {
          const d = new Date(lundiCourant);
          d.setDate(d.getDate() + 7);
          setLundiCourant(d);
        }}>&rarr;</button>
        <button className="cal-nav-aujourd-hui" onClick={() => setLundiCourant(getDebutSemaine(new Date()))}>
          Aujourd'hui
        </button>
      </div>

      <div className="cal-wrapper">
        <div className="cal-grille">
          <div className="cal-col-heures">
            <div className="cal-entete-vide"></div>
            {HEURES.map((h) => (
              <div key={h} className="cal-heure-cell">{h}</div>
            ))}
          </div>

          {joursAvecDates.map(({ nom, date }, jourIndex) => (
            <div key={jourIndex} className="cal-col-jour">
              <div className="cal-entete-jour">
                <span className="cal-jour-nom">{nom}</span>
                <span className="cal-jour-date">{formaterDateCourte(date)}</span>
              </div>
              <div className="cal-col-body">
                {HEURES.map((h) => (
                  <div key={h} className="cal-slot"></div>
                ))}
                {HEURES.map((h) => {
                  const key = `${jourIndex}-${h}`;
                  const seances = seancesMap[key] || [];
                  return seances.map((seance) => {
                    const hauteur = getHauteur(seance.heure_debut, seance.heure_fin);
                    const debut = heureEnMinutes(seance.heure_debut.slice(0, 5));
                    const heureRef = heureEnMinutes(HEURES[0]);
                    const top = ((debut - heureRef) / 60) * 60;
                    return (
                      <div
                        key={seance.id_affectation_cours}
                        className="cal-seance"
                        style={{ top: `${top}px`, height: `${hauteur}px` }}
                      >
                        <span className="cal-seance-code">{seance.code_cours}</span>
                        <span className="cal-seance-nom">{seance.nom_cours}</span>
                        <span className="cal-seance-salle">{seance.code_salle}</span>
                        <span className="cal-seance-prof">{seance.nom_professeur}</span>
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