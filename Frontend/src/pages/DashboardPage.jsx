/**
 * PAGE - Dashboard
 *
 * Cette page affiche la vue synthese
 * des ressources academiques.
 */
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { recupererCours } from "../services/cours.api.js";
import { recupererProfesseurs } from "../services/professeurs.api.js";
import { recupererSalles } from "../services/salles.api.js";
import { recupererEtudiants } from "../services/etudiantsService.js";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
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

export function DashboardPage({ utilisateur, onLogout }) {
  const [stats, setStats] = useState({
    cours: 0,
    professeurs: 0,
    salles: 0,
    etudiants: 0,
  });
  const [chargement, setChargement] = useState(true);
  const [cours, setCours] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);
  const [salles, setSalles] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const { showError } = usePopup();

  useEffect(() => {
    async function charger() {
      setChargement(true);

      try {
        const [coursData, profsData, sallesData, etudiantsData] =
          await Promise.all([
            recupererCours(),
            recupererProfesseurs(),
            recupererSalles(),
            recupererEtudiants(),
          ]);

        setCours(coursData || []);
        setProfesseurs(profsData || []);
        setSalles(sallesData || []);
        setEtudiants(etudiantsData || []);

        setStats({
          cours: (coursData || []).length,
          professeurs: (profsData || []).length,
          salles: (sallesData || []).length,
          etudiants: (etudiantsData || []).length,
        });
      } catch (error) {
        showError(error.message || "Impossible de charger le tableau de bord.");
      } finally {
        setChargement(false);
      }
    }

    charger();
  }, []);

  const coursRecents = useMemo(() => cours.slice(0, 4), [cours]);
  const profsRecents = useMemo(() => professeurs.slice(0, 4), [professeurs]);
  const programmesRecents = useMemo(() => {
    return [...new Set(cours.map((element) => element.programme).filter(Boolean))]
      .slice(0, 3);
  }, [cours]);

  const programmesActifs = useMemo(() => {
    return new Set(cours.map((element) => element.programme).filter(Boolean)).size;
  }, [cours]);

  const capaciteTotale = useMemo(() => {
    return salles.reduce(
      (total, salle) => total + (Number(salle.capacite) || 0),
      0
    );
  }, [salles]);

  const moyenneEtudiantsParCours = useMemo(() => {
    if (!stats.cours) {
      return 0;
    }

    return Math.round(stats.etudiants / stats.cours);
  }, [stats.cours, stats.etudiants]);

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Dashboard"
      subtitle="Vue de pilotage academique."
    >
      <div className="dashboard-page">
        <section className="dashboard-hero">
          <div className="dashboard-hero__main">
            <span className="dashboard-hero__eyebrow">Pilotage</span>
            <h2>Vision claire des ressources academiques</h2>
            <p>
              Suivez les cours, les professeurs, les salles et les cohortes
              depuis un seul ecran.
            </p>

            <div className="dashboard-hero__chips">
              <span>{programmesActifs} programme(s) actif(s)</span>
              <span>{capaciteTotale} places disponibles</span>
              <span>{moyenneEtudiantsParCours} etudiants / cours</span>
            </div>

            <div className="dashboard-hero__academic-strip">
              <strong>Vie academique</strong>
              <div>
                {programmesRecents.length === 0 ? (
                  <span>Aucun programme charge</span>
                ) : (
                  programmesRecents.map((programme) => (
                    <span key={programme}>{programme}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="dashboard-hero__aside">
            <div className="dashboard-hero__aside-card">
              <strong>{chargement ? "..." : stats.etudiants}</strong>
              <span>Etudiants suivis</span>
            </div>
            <div className="dashboard-hero__aside-card">
              <strong>{chargement ? "..." : stats.professeurs}</strong>
              <span>Professeurs actifs</span>
            </div>
          </div>
        </section>

        <section className="dashboard-page__stats">
          <DashboardCard
            label="Cours"
            value={stats.cours}
            detail="Offre active"
            accent="blue"
          />
          <DashboardCard
            label="Professeurs"
            value={stats.professeurs}
            detail="Programmes couverts"
            accent="purple"
          />
          <DashboardCard
            label="Salles"
            value={stats.salles}
            detail="Capacites disponibles"
            accent="teal"
          />
          <DashboardCard
            label="Etudiants"
            value={stats.etudiants}
            detail="Cohortes suivies"
            accent="pink"
          />
        </section>

        <section className="dashboard-page__grid">
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
                coursRecents.map((item) => (
                  <div className="dashboard-list__item" key={item.id_cours}>
                    <div>
                      <strong>{item.code}</strong>
                      <p>{item.nom}</p>
                    </div>
                    <span>{item.programme}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2>Professeurs</h2>
              <span>{chargement ? "..." : `${profsRecents.length} element(s)`}</span>
            </div>

            <div className="dashboard-list">
              {chargement ? (
                <p className="dashboard-empty">Chargement...</p>
              ) : profsRecents.length === 0 ? (
                <p className="dashboard-empty">Aucun professeur disponible.</p>
              ) : (
                profsRecents.map((item) => (
                  <div
                    className="dashboard-list__item"
                    key={item.id_professeur}
                  >
                    <div>
                      <strong>{item.matricule}</strong>
                      <p>
                        {item.prenom} {item.nom}
                      </p>
                    </div>
                    <span>{item.specialite || "-"}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  );
}
/**
 * PAGE - Dashboard
 *
 * Cette page affiche la vue synthese
 * des ressources academiques.
 */
