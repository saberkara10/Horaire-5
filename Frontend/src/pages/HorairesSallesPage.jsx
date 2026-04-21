/**
 * PAGE - Horaires Salles
 *
 * Cette page complete les modules d'horaires existants avec une lecture
 * dediee aux salles. Elle reutilise :
 * - le hook `useSalles` pour la liste et la recherche de salles ;
 * - l'API des sessions du scheduler pour la selection de session ;
 * - les classes de calendrier `cal-*` deja utilisees ailleurs ;
 * - la logique de synchronisation `planningSync` pour rester coherente avec
 *   les autres ecrans d'horaires apres une replanification.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FeedbackBanner } from "../components/ui/FeedbackBanner.jsx";
import { SalleOccupationBoard } from "../components/salles/SalleOccupationBoard.jsx";
import { useSalles } from "../hooks/useSalles.js";
import { recupererOccupationSalle } from "../services/salles.api.js";
import { recupererSessionsScheduler } from "../services/scheduler.api.js";
import { ecouterSynchronisationPlanning } from "../utils/planningSync.js";
import {
  construireLibelleSalle,
  extraireTypesSalle,
  filtrerSalles,
} from "../utils/salles.utils.js";
import {
  calculerTempsReelSalle,
  construireVueHebdomadaireSalle,
  determinerLundiInitialOccupation,
  extraireBornesNavigation,
  formaterProgrammeSemaine,
  formaterVolumeHeures,
} from "../utils/salleOccupation.js";
import "../styles/CrudPages.css";
import "../styles/EtudiantsPage.css";
import "../styles/PlanningEtudiantPage.css";
import "../styles/HorairesProfesseursPage.css";
import "../styles/HorairesSallesPage.css";

export function HorairesSallesPage({ utilisateur, onLogout }) {
  const {
    salles,
    etatChargement: etatChargementSalles,
    messageErreur: messageErreurSalles,
    recharger: rechargerSalles,
  } = useSalles();
  const [sessions, setSessions] = useState([]);
  const [chargementSessions, setChargementSessions] = useState(true);
  const [messageErreurSessions, setMessageErreurSessions] = useState("");
  const [recherche, setRecherche] = useState("");
  const [typeSelectionne, setTypeSelectionne] = useState("tous");
  const [idSalleActive, setIdSalleActive] = useState("");
  const [idSessionSelectionnee, setIdSessionSelectionnee] = useState("");
  const [occupationSalle, setOccupationSalle] = useState(null);
  const [etatOccupation, setEtatOccupation] = useState("idle");
  const [messageErreurOccupation, setMessageErreurOccupation] = useState("");
  const [lundiCourant, setLundiCourant] = useState(() => new Date());
  const [horloge, setHorloge] = useState(() => new Date());
  const requeteOccupationRef = useRef(0);

  useEffect(() => {
    let actif = true;

    async function chargerSessions() {
      setChargementSessions(true);
      setMessageErreurSessions("");

      try {
        const data = await recupererSessionsScheduler();

        if (!actif) {
          return;
        }

        const sessionsChargees = Array.isArray(data) ? data : [];
        setSessions(sessionsChargees);

        setIdSessionSelectionnee((sessionActuelle) => {
          if (sessionActuelle) {
            return sessionActuelle;
          }

          const sessionActive =
            sessionsChargees.find((session) => session.active) || sessionsChargees[0];

          return sessionActive ? String(sessionActive.id_session) : "";
        });
      } catch (error) {
        if (!actif) {
          return;
        }

        setMessageErreurSessions(
          error.message || "Impossible de charger les sessions academiques."
        );
      } finally {
        if (actif) {
          setChargementSessions(false);
        }
      }
    }

    void chargerSessions();

    return () => {
      actif = false;
    };
  }, []);

  useEffect(() => {
    if (idSalleActive || salles.length === 0) {
      return;
    }

    setIdSalleActive(String(salles[0].id_salle));
  }, [idSalleActive, salles]);

  async function chargerOccupation({ reinitialiserSemaine = false } = {}) {
    if (!idSalleActive || !idSessionSelectionnee) {
      setOccupationSalle(null);
      setEtatOccupation("idle");
      setMessageErreurOccupation("");
      return;
    }

    setEtatOccupation((etatActuel) =>
      etatActuel === "success" ? "refreshing" : "loading"
    );
    setMessageErreurOccupation("");
    const requeteCourante = ++requeteOccupationRef.current;

    try {
      const consultation = await recupererOccupationSalle(Number(idSalleActive), {
        id_session: Number(idSessionSelectionnee),
      });

      if (requeteCourante !== requeteOccupationRef.current) {
        return;
      }

      setOccupationSalle(consultation);
      setEtatOccupation("success");

      if (reinitialiserSemaine) {
        setLundiCourant(determinerLundiInitialOccupation(consultation));
      }
    } catch (error) {
      if (requeteCourante !== requeteOccupationRef.current) {
        return;
      }

      setEtatOccupation("error");
      setMessageErreurOccupation(
        error.message || "Impossible de charger l'occupation de la salle."
      );
    }
  }

  useEffect(() => {
    void chargerOccupation({ reinitialiserSemaine: true });
  }, [idSalleActive, idSessionSelectionnee]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHorloge(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    return ecouterSynchronisationPlanning((payload) => {
      if (!idSalleActive || !idSessionSelectionnee) {
        return;
      }

      const sallesImpactees = Array.isArray(payload?.salles_impactees)
        ? payload.salles_impactees.map((idSalle) => Number(idSalle))
        : [];
      const idActif = Number(idSalleActive);

      if (sallesImpactees.length > 0 && !sallesImpactees.includes(idActif)) {
        return;
      }

      const requeteCourante = ++requeteOccupationRef.current;

      recupererOccupationSalle(idActif, {
        id_session: Number(idSessionSelectionnee),
      })
        .then((consultation) => {
          if (requeteCourante !== requeteOccupationRef.current) {
            return;
          }

          setOccupationSalle(consultation);
          setEtatOccupation("success");
          setMessageErreurOccupation("");
        })
        .catch(() => {});
    });
  }, [idSalleActive, idSessionSelectionnee]);

  const salleActive = useMemo(
    () => salles.find((salle) => String(salle.id_salle) === String(idSalleActive)) || null,
    [salles, idSalleActive]
  );

  const sessionSelectionnee = useMemo(
    () =>
      sessions.find((session) => String(session.id_session) === String(idSessionSelectionnee)) ||
      null,
    [sessions, idSessionSelectionnee]
  );

  const typesSalle = useMemo(() => extraireTypesSalle(salles), [salles]);

  const sallesFiltrees = useMemo(
    () => filtrerSalles(salles, recherche, typeSelectionne),
    [salles, recherche, typeSelectionne]
  );

  const vueHebdomadaire = useMemo(() => {
    if (!occupationSalle) {
      return null;
    }

    return construireVueHebdomadaireSalle(
      occupationSalle.occupations,
      lundiCourant,
      occupationSalle.salle
    );
  }, [occupationSalle, lundiCourant]);

  const tempsReel = useMemo(() => {
    if (!occupationSalle) {
      return null;
    }

    return calculerTempsReelSalle(occupationSalle.occupations, horloge);
  }, [occupationSalle, horloge]);

  const { premiereSemaine, derniereSemaine } = useMemo(
    () => extraireBornesNavigation(occupationSalle),
    [occupationSalle]
  );

  const peutNaviguerPrecedent = useMemo(() => {
    if (!premiereSemaine || !vueHebdomadaire) {
      return true;
    }

    const semainePrecedente = new Date(vueHebdomadaire.debutSemaine);
    semainePrecedente.setDate(semainePrecedente.getDate() - 7);

    return semainePrecedente.getTime() >= premiereSemaine.getTime();
  }, [premiereSemaine, vueHebdomadaire]);

  const peutNaviguerSuivant = useMemo(() => {
    if (!derniereSemaine || !vueHebdomadaire) {
      return true;
    }

    const semaineSuivante = new Date(vueHebdomadaire.debutSemaine);
    semaineSuivante.setDate(semaineSuivante.getDate() + 7);

    return semaineSuivante.getTime() <= derniereSemaine.getTime();
  }, [derniereSemaine, vueHebdomadaire]);

  const resumeHebdomadaire = vueHebdomadaire?.resume || occupationSalle?.resume || null;
  const chargementSalles = etatChargementSalles === "loading";
  const consultationEnCours =
    etatOccupation === "loading" || etatOccupation === "refreshing";

  return (
    <motion.div
        className="horaires-salles-page"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <section className="horaires-professeurs-page__workspace">
          <motion.aside
            className="horaires-professeurs-page__sidebar"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          >
            <div className="horaires-professeurs-page__sidebar-header">
              <h2>Recherche salle</h2>
              <p>Filtrez la liste par code, type ou capacite.</p>
            </div>

            <input
              type="text"
              className="crud-page__search"
              placeholder="Chercher une salle..."
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
            />

            <select
              className="crud-page__search horaires-salles-page__type-select"
              value={typeSelectionne}
              onChange={(event) => setTypeSelectionne(event.target.value)}
            >
              <option value="tous">Tous les types</option>
              {typesSalle.map((typeSalle) => (
                <option key={typeSalle} value={typeSalle}>
                  {typeSalle}
                </option>
              ))}
            </select>

            {messageErreurSalles ? (
              <FeedbackBanner type="error" message={messageErreurSalles} />
            ) : null}

            <div className="horaires-professeurs-page__list">
              {chargementSalles ? (
                <p className="crud-page__state">Chargement des salles...</p>
              ) : sallesFiltrees.length === 0 ? (
                <p className="crud-page__state">Aucune salle ne correspond au filtre.</p>
              ) : (
                sallesFiltrees.map((salle) => (
                  <motion.button
                    key={salle.id_salle}
                    type="button"
                    className={`horaires-salles-page__room-card ${
                      String(salle.id_salle) === String(idSalleActive)
                        ? "horaires-salles-page__room-card--active"
                        : ""
                    }`}
                    onClick={() => setIdSalleActive(String(salle.id_salle))}
                    whileHover={{ y: -3, scale: 1.01 }}
                    whileTap={{ scale: 0.985 }}
                  >
                    <strong>{construireLibelleSalle(salle)}</strong>
                    <span>{salle.type}</span>
                    <small>{salle.capacite} places</small>
                  </motion.button>
                ))
              )}
            </div>
          </motion.aside>

          <motion.section
            className="horaires-professeurs-page__content"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
          >
            <section className="panel panel--stacked detail-panel">
              {!salleActive ? (
                <div className="detail-card">
                  <h2>Selectionnez une salle</h2>
                  <p className="detail-card__subtitle">
                    Le panneau de droite affichera l'occupation de la salle,
                    les creneaux libres, la synthese hebdomadaire et le statut
                    dynamique "maintenant / prochain cours".
                  </p>
                </div>
              ) : (
                <div className="detail-card">
                  <div className="detail-card__header horaires-salles-page__header">
                    <div>
                      <p className="eyebrow">Consultation salle</p>
                      <h2>{construireLibelleSalle(salleActive)}</h2>
                      <p className="detail-card__subtitle">
                        {salleActive.capacite} places disponibles au maximum.
                      </p>
                    </div>

                    <label className="field horaires-salles-page__session-field">
                      <span>Session academique</span>
                      <select
                        value={idSessionSelectionnee}
                        onChange={(event) => setIdSessionSelectionnee(event.target.value)}
                        disabled={chargementSessions || sessions.length === 0}
                      >
                        {sessions.length === 0 ? (
                          <option value="">
                            {chargementSessions ? "Chargement..." : "Aucune session"}
                          </option>
                        ) : (
                          sessions.map((session) => (
                            <option key={session.id_session} value={session.id_session}>
                              {session.nom}
                              {session.active ? " (active)" : ""}
                            </option>
                          ))
                        )}
                      </select>
                    </label>
                  </div>

                  {messageErreurSessions ? (
                    <FeedbackBanner type="error" message={messageErreurSessions} />
                  ) : null}

                  {messageErreurOccupation ? (
                    <FeedbackBanner type="error" message={messageErreurOccupation} />
                  ) : null}

                  {resumeHebdomadaire ? (
                    <>
                      <dl className="detail-grid">
                        <div>
                          <dt>Type de salle</dt>
                          <dd>{salleActive.type}</dd>
                        </div>
                        <div>
                          <dt>Capacite</dt>
                          <dd>{salleActive.capacite} places</dd>
                        </div>
                        <div>
                          <dt>Session</dt>
                          <dd>{sessionSelectionnee?.nom || "Session active"}</dd>
                        </div>
                        <div>
                          <dt>Taux d'occupation</dt>
                          <dd>{resumeHebdomadaire.taux_occupation_pourcentage}%</dd>
                        </div>
                        <div>
                          <dt>Blocs occupes</dt>
                          <dd>{resumeHebdomadaire.creneaux_occupes}</dd>
                        </div>
                        <div>
                          <dt>Blocs libres</dt>
                          <dd>{resumeHebdomadaire.creneaux_libres}</dd>
                        </div>
                        <div>
                          <dt>Volume occupe</dt>
                          <dd>
                            {formaterVolumeHeures(
                              resumeHebdomadaire.volume_horaire_occupe_heures
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Groupes distincts</dt>
                          <dd>{resumeHebdomadaire.groupes_distincts}</dd>
                        </div>
                        <div>
                          <dt>Types de cours</dt>
                          <dd>
                            {Array.isArray(resumeHebdomadaire.types_cours) &&
                            resumeHebdomadaire.types_cours.length > 0
                              ? resumeHebdomadaire.types_cours.join(", ")
                              : "Non renseignes"}
                          </dd>
                        </div>
                      </dl>

                      <div className="detail-card__callout">
                        Programmes observes cette semaine :{" "}
                        <strong>
                          {formaterProgrammeSemaine(resumeHebdomadaire.programmes)}
                        </strong>
                      </div>

                      {resumeHebdomadaire.nb_conflits > 0 ? (
                        <div className="detail-card__callout detail-card__callout--warning">
                          {resumeHebdomadaire.nb_conflits} conflit(s) potentiel(s) detecte(s)
                          pour cette salle sur la semaine affichee.
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {!idSessionSelectionnee && !chargementSessions ? (
                    <p className="detail-card__subtitle">
                      Selectionnez une session pour consulter l'occupation de la salle.
                    </p>
                  ) : occupationSalle && vueHebdomadaire ? (
                    <SalleOccupationBoard
                      vueHebdomadaire={vueHebdomadaire}
                      tempsReel={tempsReel || occupationSalle.temps_reel}
                      consultationEnCours={consultationEnCours}
                      onRecharger={() => chargerOccupation({ reinitialiserSemaine: false })}
                      onSemainePrecedente={() => {
                        const date = new Date(lundiCourant);
                        date.setDate(date.getDate() - 7);
                        setLundiCourant(date);
                      }}
                      onSemaineSuivante={() => {
                        const date = new Date(lundiCourant);
                        date.setDate(date.getDate() + 7);
                        setLundiCourant(date);
                      }}
                      onRevenirSemaineReference={() =>
                        setLundiCourant(determinerLundiInitialOccupation(occupationSalle))
                      }
                      peutNaviguerPrecedent={peutNaviguerPrecedent}
                      peutNaviguerSuivant={peutNaviguerSuivant}
                    />
                  ) : consultationEnCours ? (
                    <p className="planning-message">Chargement de l'occupation...</p>
                  ) : (
                    <p className="detail-card__subtitle">
                      Aucune occupation chargee pour cette salle et cette session.
                    </p>
                  )}

                  <div className="horaires-salles-page__actions">
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => {
                        void rechargerSalles();
                        void chargerOccupation({ reinitialiserSemaine: false });
                      }}
                    >
                      Actualiser les salles
                    </button>
                  </div>
                </div>
              )}
            </section>
          </motion.section>
        </section>
      </motion.div>
  );
}
