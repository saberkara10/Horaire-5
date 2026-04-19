/**
 * PAGE - Dashboard
 *
 * Tableau de bord de pilotage academique.
 */
import { useEffect, useMemo, useState } from "react";
import { recupererDashboardOverview } from "../services/dashboard.api.js";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import {
  readSchedulerScoringSummary,
  selectSchedulerScoringMode,
} from "../utils/schedulerScoring.js";
import "../styles/DashboardPage.css";

function DashboardCard({ label, value, accent, detail }) {
  return (
    <div className={`dashboard-card dashboard-card--${accent}`}>
      <div className="dashboard-card__label">{label}</div>
      <div className="dashboard-card__value">{value}</div>
      <div className="dashboard-card__detail">{detail}</div>
    </div>
  );
}

function DashboardNotice({ niveau, titre, valeur, detail }) {
  return (
    <article className={`dashboard-notice dashboard-notice--${niveau}`}>
      <div className="dashboard-notice__head">
        <strong>{titre}</strong>
        <span>{valeur}</span>
      </div>
      <p>{detail}</p>
    </article>
  );
}

function arrondirPourcentage(numerateur, denominateur) {
  if (!denominateur) {
    return 0;
  }

  return Math.round((Number(numerateur || 0) / Number(denominateur || 1)) * 100);
}

function formaterDate(date) {
  if (!date) {
    return "-";
  }

  const valeur = new Date(date);

  if (Number.isNaN(valeur.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(valeur);
}

function formaterPeriodeSession(session) {
  if (!session?.date_debut || !session?.date_fin) {
    return "Periode non renseignee";
  }

  return `${formaterDate(session.date_debut)} au ${formaterDate(session.date_fin)}`;
}

function formaterProgrammesProfesseur(professeur) {
  if (Array.isArray(professeur?.programmes_assignes)) {
    return professeur.programmes_assignes.join(", ");
  }

  return String(professeur?.programmes_assignes || "").trim() || "Sans programme";
}

function formaterValeurScoring(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2);
}

export function DashboardPage({ utilisateur, onLogout }) {
  const [overview, setOverview] = useState(null);
  const [chargement, setChargement] = useState(true);
  const { showError } = usePopup();

  useEffect(() => {
    let actif = true;

    async function charger() {
      setChargement(true);

      try {
        const resultat = await recupererDashboardOverview();

        if (!actif) {
          return;
        }

        setOverview(resultat);
      } catch (error) {
        if (!actif) {
          return;
        }

        showError(error.message || "Impossible de charger le tableau de bord.");
      } finally {
        if (actif) {
          setChargement(false);
        }
      }
    }

    void charger();

    return () => {
      actif = false;
    };
  }, [showError]);

  const compteursGlobaux = overview?.compteurs_globaux || {
    nb_cours_actifs: 0,
    nb_professeurs: 0,
    nb_salles: 0,
    capacite_totale_salles: 0,
    nb_etudiants: 0,
    nb_groupes: 0,
    nb_etudiants_sans_groupe: 0,
    nb_programmes_actifs: 0,
  };
  const sessionActive = overview?.session_active || null;
  const resumeSessionActive = overview?.resume_session_active || {
    nb_groupes_actifs: 0,
    nb_groupes_avec_horaire: 0,
    nb_groupes_sans_horaire: 0,
    nb_etudiants_session_active: 0,
    nb_etudiants_avec_horaire: 0,
    nb_etudiants_sans_horaire: 0,
  };
  const dernierRapport = overview?.dernier_rapport || null;
  const dernierRapportScoring = useMemo(
    () => readSchedulerScoringSummary(dernierRapport),
    [dernierRapport]
  );
  const dernierRapportModeScoring = useMemo(
    () =>
      selectSchedulerScoringMode(
        dernierRapportScoring,
        dernierRapport?.details?.modeOptimisationUtilise || "equilibre"
      ),
    [dernierRapport?.details?.modeOptimisationUtilise, dernierRapportScoring]
  );
  const coursRecents = overview?.cours_recents || [];
  const professeursRecents = overview?.professeurs_recents || [];
  const groupesSansHoraire = overview?.groupes_sans_horaire || [];
  const casParticuliers = overview?.cas_particuliers || [];

  const couvertureEtudiants = useMemo(
    () =>
      arrondirPourcentage(
        resumeSessionActive.nb_etudiants_avec_horaire,
        resumeSessionActive.nb_etudiants_session_active
      ),
    [
      resumeSessionActive.nb_etudiants_avec_horaire,
      resumeSessionActive.nb_etudiants_session_active,
    ]
  );

  const couvertureGroupes = useMemo(
    () =>
      arrondirPourcentage(
        resumeSessionActive.nb_groupes_avec_horaire,
        resumeSessionActive.nb_groupes_actifs
      ),
    [
      resumeSessionActive.nb_groupes_avec_horaire,
      resumeSessionActive.nb_groupes_actifs,
    ]
  );

  const moyenneEtudiantsParGroupeActif = useMemo(() => {
    if (!resumeSessionActive.nb_groupes_actifs) {
      return 0;
    }

    return Math.round(
      resumeSessionActive.nb_etudiants_session_active /
        resumeSessionActive.nb_groupes_actifs
    );
  }, [
    resumeSessionActive.nb_etudiants_session_active,
    resumeSessionActive.nb_groupes_actifs,
  ]);

  const scoreRapport = dernierRapport ? `${dernierRapport.score_qualite}/100` : "-";

  return (
    <div className="dashboard-page">
        <section className="dashboard-hero">
          <div className="dashboard-hero__main">
            <span className="dashboard-hero__eyebrow">Pilotage</span>
            <h2>Tableau de bord clair sur les groupes, les etudiants et les horaires</h2>
            <p>
              Le dashboard distingue les volumes globaux, la couverture reelle de la
              session active et les cas particuliers qui demandent une action metier.
            </p>

            <div className="dashboard-hero__chips">
              <span>
                {sessionActive
                  ? `Session active : ${sessionActive.nom}`
                  : "Aucune session active"}
              </span>
              <span>{compteursGlobaux.nb_groupes} groupes en base</span>
              <span>{compteursGlobaux.nb_etudiants} etudiants inscrits</span>
              <span>{compteursGlobaux.capacite_totale_salles} places de salle au total</span>
            </div>

            <div className="dashboard-hero__academic-strip">
              <strong>Lecture rapide</strong>
              <div>
                <span>{compteursGlobaux.nb_programmes_actifs} programme(s) actifs</span>
                <span>{resumeSessionActive.nb_groupes_actifs} groupes sur la session active</span>
                <span>{couvertureEtudiants}% d'etudiants deja planifies</span>
              </div>
            </div>
          </div>

          <div className="dashboard-hero__aside">
            <div className="dashboard-hero__aside-card">
              <strong>{chargement ? "..." : resumeSessionActive.nb_etudiants_avec_horaire}</strong>
              <span>Etudiants avec horaire sur la session active</span>
            </div>
            <div className="dashboard-hero__aside-card">
              <strong>{chargement ? "..." : resumeSessionActive.nb_groupes_avec_horaire}</strong>
              <span>Groupes deja planifies</span>
            </div>
            <div className="dashboard-hero__aside-card">
              <strong>{chargement ? "..." : scoreRapport}</strong>
              <span>Score du dernier rapport de generation</span>
            </div>
          </div>
        </section>

        <section className="dashboard-page__stats">
          <DashboardCard
            label="Groupes"
            value={compteursGlobaux.nb_groupes}
            detail={`${resumeSessionActive.nb_groupes_actifs} sur la session active`}
            accent="blue"
          />
          <DashboardCard
            label="Etudiants inscrits"
            value={compteursGlobaux.nb_etudiants}
            detail={`${resumeSessionActive.nb_etudiants_session_active} rattaches a la session active`}
            accent="purple"
          />
          <DashboardCard
            label="Etudiants avec horaire"
            value={resumeSessionActive.nb_etudiants_avec_horaire}
            detail={`${resumeSessionActive.nb_etudiants_sans_horaire} encore sans horaire actif`}
            accent="teal"
          />
          <DashboardCard
            label="Couverture etudiante"
            value={`${couvertureEtudiants}%`}
            detail="Part des etudiants de la session active deja planifies"
            accent="pink"
          />
          <DashboardCard
            label="Professeurs"
            value={compteursGlobaux.nb_professeurs}
            detail={`${compteursGlobaux.nb_cours_actifs} cours actifs a couvrir`}
            accent="blue"
          />
          <DashboardCard
            label="Salles"
            value={compteursGlobaux.nb_salles}
            detail={`${compteursGlobaux.capacite_totale_salles} places de capacite totale`}
            accent="teal"
          />
        </section>

        <section className="dashboard-page__grid">
          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2>Pilotage de la planification</h2>
              <span>{sessionActive ? sessionActive.nom : "Aucune session"}</span>
            </div>

            <div className="dashboard-list">
              <div className="dashboard-list__item">
                <div>
                  <strong>Session active</strong>
                  <p>{sessionActive ? formaterPeriodeSession(sessionActive) : "Aucune session active."}</p>
                </div>
                <span>{sessionActive?.nom || "-"}</span>
              </div>

              <div className="dashboard-list__item">
                <div>
                  <strong>Groupes couverts</strong>
                  <p>
                    {resumeSessionActive.nb_groupes_avec_horaire} groupes avec horaire,
                    {" "}
                    {resumeSessionActive.nb_groupes_sans_horaire} sans horaire.
                  </p>
                </div>
                <span>{couvertureGroupes}%</span>
              </div>

              <div className="dashboard-list__item">
                <div>
                  <strong>Etudiants planifies</strong>
                  <p>
                    {resumeSessionActive.nb_etudiants_avec_horaire} avec horaire,
                    {" "}
                    {resumeSessionActive.nb_etudiants_sans_horaire} sans horaire actif.
                  </p>
                </div>
                <span>{couvertureEtudiants}%</span>
              </div>

              <div className="dashboard-list__item">
                <div>
                  <strong>Moyenne par groupe actif</strong>
                  <p>Charge moyenne observee sur les groupes de la session active.</p>
                </div>
                <span>{moyenneEtudiantsParGroupeActif || 0} etu./groupe</span>
              </div>

              <div className="dashboard-list__item">
                <div>
                  <strong>Derniere generation</strong>
                  <p>
                    {dernierRapport
                      ? `${dernierRapport.nb_cours_planifies} cours planifies, ${dernierRapport.nb_cours_non_planifies} non planifies.`
                      : "Aucun rapport de generation disponible."}
                    {dernierRapportModeScoring
                      ? ` Scoring ${formaterValeurScoring(
                          dernierRapportModeScoring.scoreGlobal
                        )} global, ${formaterValeurScoring(
                          dernierRapportModeScoring.scoreEtudiant
                        )} etudiant, ${formaterValeurScoring(
                          dernierRapportModeScoring.scoreProfesseur
                        )} professeur, ${formaterValeurScoring(
                          dernierRapportModeScoring.scoreGroupe
                        )} groupe.`
                      : ""}
                  </p>
                </div>
                <span>{dernierRapport ? formaterDate(dernierRapport.date_generation) : "-"}</span>
              </div>

              <div className="dashboard-list__item">
                <div>
                  <strong>Etudiants sans groupe</strong>
                  <p>Volume global d'etudiants qui ne peuvent pas encore recevoir d'horaire.</p>
                </div>
                <span>{compteursGlobaux.nb_etudiants_sans_groupe}</span>
              </div>
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2>Cas particuliers</h2>
              <span>{chargement ? "..." : `${casParticuliers.length} signalement(s)`}</span>
            </div>

            <div className="dashboard-insights">
              {chargement ? (
                <p className="dashboard-empty">Chargement...</p>
              ) : (
                casParticuliers.map((casParticulier, index) => (
                  <DashboardNotice
                    key={`${casParticulier.titre}-${index}`}
                    niveau={casParticulier.niveau}
                    titre={casParticulier.titre}
                    valeur={casParticulier.valeur}
                    detail={casParticulier.detail}
                  />
                ))
              )}
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2>Groupes a surveiller</h2>
              <span>{chargement ? "..." : `${groupesSansHoraire.length} groupe(s)`}</span>
            </div>

            <div className="dashboard-list">
              {chargement ? (
                <p className="dashboard-empty">Chargement...</p>
              ) : groupesSansHoraire.length === 0 ? (
                <p className="dashboard-empty">Aucun groupe actif sans horaire.</p>
              ) : (
                groupesSansHoraire.map((groupe) => (
                  <div
                    className="dashboard-list__item dashboard-list__item--stacked"
                    key={groupe.id_groupes_etudiants}
                  >
                    <div>
                      <strong>{groupe.nom_groupe}</strong>
                      <p>
                        {groupe.programme} · Etape {groupe.etape} · {groupe.effectif} etudiant(s)
                      </p>
                    </div>
                    <span>{groupe.raison}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2>Cours recents</h2>
              <span>{chargement ? "..." : `${coursRecents.length} element(s)`}</span>
            </div>

            <div className="dashboard-list">
              {chargement ? (
                <p className="dashboard-empty">Chargement...</p>
              ) : coursRecents.length === 0 ? (
                <p className="dashboard-empty">Aucun cours disponible.</p>
              ) : (
                coursRecents.map((cours) => (
                  <div className="dashboard-list__item" key={cours.id_cours}>
                    <div>
                      <strong>{cours.code}</strong>
                      <p>{cours.nom}</p>
                    </div>
                    <span>{cours.programme}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2>Professeurs couverts</h2>
              <span>{chargement ? "..." : `${professeursRecents.length} element(s)`}</span>
            </div>

            <div className="dashboard-list">
              {chargement ? (
                <p className="dashboard-empty">Chargement...</p>
              ) : professeursRecents.length === 0 ? (
                <p className="dashboard-empty">Aucun professeur disponible.</p>
              ) : (
                professeursRecents.map((professeur) => (
                  <div className="dashboard-list__item" key={professeur.id_professeur}>
                    <div>
                      <strong>{professeur.matricule}</strong>
                      <p>
                        {professeur.prenom} {professeur.nom}
                      </p>
                    </div>
                    <span>{formaterProgrammesProfesseur(professeur)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
  );
}
