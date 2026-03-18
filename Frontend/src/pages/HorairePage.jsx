import { useState, useEffect } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { genererHoraire, recupererHoraires, resetHoraires } from "../services/horaire.api.js";

export function HorairePage({ moduleActif, onChangerModule }) {
  const [horaires, setHoraires] = useState([]);
  const [cours, setCours] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);
  const [salles, setSalles] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [selectedProgramme, setSelectedProgramme] = useState("");
  const [selectedEtape, setSelectedEtape] = useState("");

  useEffect(() => {
    chargerDonnees();
  }, []);

  async function chargerDonnees() {
    try {
      const options = { credentials: "include" };
      const [coursRes, profsRes, sallesRes, horairesRes] = await Promise.allSettled([
        fetch("http://localhost:3000/api/cours", options),
        fetch("http://localhost:3000/api/professeurs", options),
        fetch("http://localhost:3000/api/salles", options),
        fetch("http://localhost:3000/api/horaires", options),
      ]);

      if (coursRes.status === "fulfilled" && coursRes.value.ok)
        setCours(await coursRes.value.json());
      if (profsRes.status === "fulfilled" && profsRes.value.ok)
        setProfesseurs(await profsRes.value.json());
      if (sallesRes.status === "fulfilled" && sallesRes.value.ok)
        setSalles(await sallesRes.value.json());
      if (horairesRes.status === "fulfilled" && horairesRes.value.ok)
        setHoraires(await horairesRes.value.json());
    } catch (err) {
      setErreur("Erreur de chargement des données");
    }
  }

  async function handleGenerer() {
    setGenerating(true);
    setMessage("");
    setErreur("");

    try {
      const data = await genererHoraire();
      setMessage(data.message);
      const response = await fetch("http://localhost:3000/api/horaires", {
        credentials: "include",
      });
      if (response.ok) {
        setHoraires(await response.json());
      }
    } catch (error) {
      setErreur(error.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("Voulez-vous vraiment supprimer tous les horaires ?")) return;

    try {
      await resetHoraires();
      setHoraires([]);
      setMessage("Horaires réinitialisés");
    } catch (error) {
      setErreur(error.message);
    }
  }

  const programmes = [...new Set(cours.map((c) => c.programme))];
  const etapes = [...new Set(cours.map((c) => c.etape_etude))];

  return (
    <AppShell moduleActif={moduleActif} onChangerModule={onChangerModule}>
      <div className="horaire-page">
        <h1 className="horaire-title">Génération d'Horaire</h1>

        <div className="horaire-card">
          <div className="horaire-card-header">
            <h2>Paramètres de génération</h2>
          </div>
          <p className="horaire-card-desc">
            L'algorithme va générer automatiquement les horaires en tenant compte des
            disponibilités des professeurs, des prérequis des cours, et de la capacité des salles.
          </p>

          <div className="horaire-params">
            <div className="horaire-param">
              <label>Programme (optionnel)</label>
              <select
                value={selectedProgramme}
                onChange={(e) => setSelectedProgramme(e.target.value)}
              >
                <option value="">Tous les programmes</option>
                {programmes.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="horaire-param">
              <label>Étape (optionnel)</label>
              <select
                value={selectedEtape}
                onChange={(e) => setSelectedEtape(e.target.value)}
              >
                <option value="">Toutes les étapes</option>
                {etapes.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="horaire-buttons">
            <button
              onClick={handleGenerer}
              disabled={generating}
              className="horaire-btn-generate"
            >
              {generating ? "Génération en cours..." : "Générer l'horaire"}
            </button>
            {horaires.length > 0 && (
              <button onClick={handleReset} className="horaire-btn-reset">
                Réinitialiser
              </button>
            )}
          </div>

          {message && <div className="horaire-message-success">{message}</div>}
          {erreur && <div className="horaire-message-error">{erreur}</div>}

          <div className="horaire-info">
            <h3>Informations</h3>
            <ul>
              <li>{professeurs.length} professeurs disponibles</li>
              <li>{cours.length} cours à planifier</li>
              <li>{salles.length} salles disponibles</li>
              {horaires.length > 0 && (
                <li>{horaires.length} créneaux générés</li>
              )}
            </ul>
          </div>
        </div>

        {horaires.length > 0 && (
          <div className="horaire-grid-container">
            <h2 className="horaire-grid-title">Emploi du temps</h2>
            <div className="horaire-grid">
              <div className="horaire-grid-header">Heure</div>
              <div className="horaire-grid-header">Lundi</div>
              <div className="horaire-grid-header">Mardi</div>
              <div className="horaire-grid-header">Mercredi</div>
              <div className="horaire-grid-header">Jeudi</div>
              <div className="horaire-grid-header">Vendredi</div>

              {["08:00", "10:00", "13:00", "15:00"].map((heure) => {
                const dates = ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27"];
                const colors = [
                  "horaire-event-blue", "horaire-event-green",
                  "horaire-event-purple", "horaire-event-orange", "horaire-event-pink"
                ];

                return [
                  <div key={`h-${heure}`} className="horaire-grid-heure">{heure}</div>,
                  ...dates.map((date, idx) => {
                    const events = horaires.filter(
                      (h) => h.date === date && h.heure_debut === heure + ":00"
                    );
                    return (
                      <div key={`${heure}-${idx}`} className="horaire-grid-cell">
                        {events.map((event, eventIdx) => (
                          <div
                            key={event.id_affectation_cours}
                            className={`horaire-event ${colors[eventIdx % colors.length]}`}
                          >
                            <div className="horaire-event-cours">
                              {event.cours_code} - {event.cours_nom}
                            </div>
                            <div className="horaire-event-prof">
                              {event.professeur_prenom} {event.professeur_nom}
                            </div>
                            <div className="horaire-event-salle">{event.salle_code}</div>
                            <div className="horaire-event-time">
                              {event.heure_debut} - {event.heure_fin}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }),
                ];
              })}
            </div>

            <div className="horaire-grid-stats">
              <h3>Statistiques</h3>
              <div className="horaire-grid-stats-row">
                <span>Total de cours: {horaires.length}</span>
                <span>Professeurs: {new Set(horaires.map((h) => h.professeur_nom)).size}</span>
                <span>Salles: {new Set(horaires.map((h) => h.salle_code)).size}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}