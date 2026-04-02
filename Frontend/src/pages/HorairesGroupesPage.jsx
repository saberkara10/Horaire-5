/**
 * PAGE - Horaires Groupes
 *
 * Cette page affiche le planning
 * detaille d'un groupe genere.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "../components/layout/AppShell.jsx";
import {
  recupererGroupes,
  recupererPlanningGroupe,
} from "../services/groupes.api.js";
import {
  JOURS_SEMAINE_COMPLETS,
  creerDateLocale,
  formaterDateCourte,
  getDebutSemaine,
  getIndexJourCalendrier,
} from "../utils/calendar.js";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import { formaterLibelleCohorte } from "../utils/sessions.js";
import "../styles/PlanningEtudiantPage.css";

const HEURES = Array.from({ length: 15 }, (_, index) =>
  `${String(index + 8).padStart(2, "0")}:00`
);

function formaterDateLongue(dateStr) {
  const date = creerDateLocale(dateStr);
  return date.toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formaterHeure(heureStr) {
  return String(heureStr || "").slice(0, 5);
}

function heureEnMinutes(heure) {
  const [heures, minutes] = String(heure || "00:00").split(":").map(Number);
  return heures * 60 + minutes;
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

export function HorairesGroupesPage({ utilisateur, onLogout }) {
  const [groupes, setGroupes] = useState([]);
  const [idGroupeActif, setIdGroupeActif] = useState("");
  const [groupeActif, setGroupeActif] = useState(null);
  const [horaire, setHoraire] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chargementPlanning, setChargementPlanning] = useState(false);
  const { showError } = usePopup();
  const [lundiCourant, setLundiCourant] = useState(() =>
    getDebutSemaine(new Date())
  );

  useEffect(() => {
    async function chargerGroupes() {
      setLoading(true);

      try {
        const groupesData = await recupererGroupes(true);
        const liste = Array.isArray(groupesData) ? groupesData : [];
        setGroupes(liste);

        if (liste.length > 0) {
          setIdGroupeActif(String(liste[0].id_groupes_etudiants));
        } else {
          setGroupeActif(null);
          setHoraire([]);
        }
      } catch (error) {
        showError(error.message || "Impossible de charger les groupes.");
      } finally {
        setLoading(false);
      }
    }

    chargerGroupes();
  }, []);

  useEffect(() => {
    async function chargerPlanning() {
      if (!idGroupeActif) {
        setGroupeActif(null);
        setHoraire([]);
        return;
      }

      setChargementPlanning(true);

      try {
        const resultat = await recupererPlanningGroupe(idGroupeActif);
        setGroupeActif(resultat.groupe || null);
        setHoraire(Array.isArray(resultat.horaire) ? resultat.horaire : []);
      } catch (error) {
        showError(error.message || "Impossible de charger l'horaire du groupe.");
      } finally {
        setChargementPlanning(false);
      }
    }

    chargerPlanning();
  }, [idGroupeActif]);

  const finSemaine = useMemo(() => {
    const date = new Date(lundiCourant);
    date.setDate(date.getDate() + 6);
    return date;
  }, [lundiCourant]);

  const joursAvecDates = useMemo(() => {
    return JOURS_SEMAINE_COMPLETS.map(({ label }, index) => {
      const date = new Date(lundiCourant);
      date.setDate(date.getDate() + index);
      return { nom: label, date };
    });
  }, [lundiCourant]);

  const seancesMap = useMemo(
    () => getSeancesParJourEtHeure(horaire, lundiCourant),
    [horaire, lundiCourant]
  );

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Horaires groupes"
      subtitle="Consultez l'horaire exact de chaque groupe genere."
    >
      <motion.div
        className="planning-container"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="planning-infos" style={{ marginBottom: "24px" }}>
          <div className="planning-info-item">
            <span className="planning-label">Groupe</span>
            <select
              className="crud-page__search"
              value={idGroupeActif}
              onChange={(event) => setIdGroupeActif(event.target.value)}
              disabled={loading || groupes.length === 0}
            >
              <option value="">Choisir un groupe</option>
              {groupes.map((groupe) => (
                <option
                  key={groupe.id_groupes_etudiants}
                  value={groupe.id_groupes_etudiants}
                >
                  {groupe.nom_groupe}
                </option>
              ))}
            </select>
          </div>
          <div className="planning-info-item">
            <span className="planning-label">Programme</span>
            <span className="planning-valeur">
              {groupeActif?.programme || "Non genere"}
            </span>
          </div>
          <div className="planning-info-item">
            <span className="planning-label">Etape</span>
            <span className="planning-valeur">{groupeActif?.etape || "-"}</span>
          </div>
          <div className="planning-info-item">
            <span className="planning-label">Cohorte</span>
            <span className="planning-valeur">
              {formaterLibelleCohorte(groupeActif?.session, groupeActif?.annee)}
            </span>
          </div>
          <div className="planning-info-item">
            <span className="planning-label">Effectif</span>
            <span className="planning-valeur">{groupeActif?.effectif || 0}</span>
          </div>
        </div>

        {loading ? (
          <p className="planning-message">Chargement des groupes...</p>
        ) : groupes.length === 0 ? (
          <p className="planning-message">Aucun groupe genere pour le moment.</p>
        ) : chargementPlanning ? (
          <p className="planning-message">Chargement du planning...</p>
        ) : (
          <>
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
                        <td>{formaterDateLongue(seance.date)}</td>
                        <td>{formaterHeure(seance.heure_debut)}</td>
                        <td>{formaterHeure(seance.heure_fin)}</td>
                        <td>
                          <span className="planning-code">{seance.code_cours}</span>
                          <span className="planning-nom-cours">{seance.nom_cours}</span>
                        </td>
                        <td>
                          {seance.prenom_professeur} {seance.nom_professeur}
                        </td>
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

            <h2 className="planning-sous-titre" style={{ marginTop: "40px" }}>
              Calendrier du groupe
            </h2>

            <div className="cal-nav">
              <motion.button
                className="cal-nav-btn"
                onClick={() => {
                  const date = new Date(lundiCourant);
                  date.setDate(date.getDate() - 7);
                  setLundiCourant(date);
                }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
              >
                &larr;
              </motion.button>
              <span className="cal-nav-titre">
                {formaterDateCourte(lundiCourant)} - {formaterDateCourte(finSemaine)}
              </span>
              <motion.button
                className="cal-nav-btn"
                onClick={() => {
                  const date = new Date(lundiCourant);
                  date.setDate(date.getDate() + 7);
                  setLundiCourant(date);
                }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
              >
                &rarr;
              </motion.button>
              <motion.button
                className="cal-nav-aujourd-hui"
                onClick={() => setLundiCourant(getDebutSemaine(new Date()))}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                Aujourd'hui
              </motion.button>
            </div>

            <div className="cal-wrapper">
              <div className="cal-grille">
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
                        const seances = seancesMap[cle] || [];

                        return seances.map((seance) => {
                          const hauteur = getHauteur(
                            seance.heure_debut,
                            seance.heure_fin
                          );
                          const debut = heureEnMinutes(
                            formaterHeure(seance.heure_debut)
                          );
                          const heureReference = heureEnMinutes(HEURES[0]);
                          const top = ((debut - heureReference) / 60) * 60;

                          return (
                            <motion.div
                              key={seance.id_affectation_cours}
                              className="cal-seance"
                              style={{ top: `${top}px`, height: `${hauteur}px` }}
                              whileHover={{ scale: 1.015 }}
                              transition={{ duration: 0.15 }}
                            >
                              <span className="cal-seance-code">{seance.code_cours}</span>
                              <span className="cal-seance-nom">{seance.nom_cours}</span>
                              <span className="cal-seance-salle">{seance.code_salle}</span>
                              <span className="cal-seance-prof">
                                {seance.nom_professeur}
                              </span>
                            </motion.div>
                          );
                        });
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </AppShell>
  );
}
