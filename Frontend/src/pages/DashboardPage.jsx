import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { recupererStatistiques } from "../services/dashboard.api.js";

export function DashboardPage({ moduleActif, onChangerModule }) {
  const [stats, setStats] = useState({
    professeurs: 0,
    etudiants: 0,
    cours: 0,
    salles: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function charger() {
      try {
        const data = await recupererStatistiques();
        setStats(data);
      } catch (err) {
        console.error("Erreur chargement stats:", err);
      } finally {
        setLoading(false);
      }
    }

    charger();
  }, []);

  const cards = [
    { label: "Professeurs", value: stats.professeurs, color: "#3b82f6" },
    { label: "Étudiants", value: stats.etudiants, color: "#22c55e" },
    { label: "Cours", value: stats.cours, color: "#a855f7" },
    { label: "Salles", value: stats.salles, color: "#f97316" },
  ];

  return (
    <AppShell moduleActif={moduleActif} onChangerModule={onChangerModule}>
      <div className="dashboard">
        <h1 className="dashboard-title">Tableau de bord</h1>

        <div className="dashboard-cards">
          {cards.map((card) => (
            <div key={card.label} className="dashboard-card">
              <div
                className="dashboard-card-icon"
                style={{ background: card.color }}
              ></div>
              <div className="dashboard-card-info">
                <span className="dashboard-card-value">
                  {loading ? "..." : card.value}
                </span>
                <span className="dashboard-card-label">{card.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-welcome">
          <h2>Bienvenue</h2>
          <p>
            Utilisez le menu de gauche pour naviguer entre les différentes
            sections de l'application.
          </p>
          <ul>
            <li>Gérez les professeurs, étudiants, cours et salles</li>
            <li>Importez des données via Excel</li>
            <li>Générez automatiquement les horaires</li>
            <li>Visualisez et exportez les horaires</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}