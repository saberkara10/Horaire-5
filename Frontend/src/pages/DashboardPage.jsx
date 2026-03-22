import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { recupererCours } from "../services/cours.api.js";
import { recupererProfesseurs } from "../services/professeurs.api.js";
import { recupererSalles } from "../services/salles.api.js";
import { recupererEtudiants } from "../services/etudiantsService.js";
import "../styles/DashboardPage.css";

function DashboardCard({ label, value, accent }) {
  return (
    <div className={`dashboard-card dashboard-card--${accent}`}>
      <div className="dashboard-card__label">{label}</div>
      <div className="dashboard-card__value">{value}</div>
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
  const [erreur, setErreur] = useState("");
  const [cours, setCours] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);

  useEffect(() => {
    async function charger() {
      setChargement(true);
      setErreur("");

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

        setStats({
          cours: (coursData || []).length,
          professeurs: (profsData || []).length,
          salles: (sallesData || []).length,
          etudiants: (etudiantsData || []).length,
        });
      } catch (error) {
        setErreur(error.message || "Impossible de charger le tableau de bord.");
      } finally {
        setChargement(false);
      }
    }

    charger();
  }, []);

  const coursRecents = useMemo(() => cours.slice(0, 4), [cours]);
  const profsRecents = useMemo(() => professeurs.slice(0, 4), [professeurs]);

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Dashboard"
      subtitle="Vue globale de la plateforme et accès rapide aux modules."
    >
      <div className="dashboard-page">
        {erreur ? <div className="dashboard-page__alert">{erreur}</div> : null}

        <section className="dashboard-page__stats">
          <DashboardCard label="Cours" value={stats.cours} accent="blue" />
          <DashboardCard
            label="Professeurs"
            value={stats.professeurs}
            accent="purple"
          />
          <DashboardCard label="Salles" value={stats.salles} accent="teal" />
          <DashboardCard
            label="Étudiants"
            value={stats.etudiants}
            accent="pink"
          />
        </section>

        <section className="dashboard-page__grid">
          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2>Cours récents</h2>
              <span>{chargement ? "..." : `${coursRecents.length} élément(s)`}</span>
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
              <span>{chargement ? "..." : `${profsRecents.length} élément(s)`}</span>
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
                    <span>{item.specialite || "—"}</span>
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