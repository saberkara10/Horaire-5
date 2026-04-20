import { useState, useEffect, useRef } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { construireQueryGenerationScheduler } from "../services/scheduler.api.js";
import {
  OPTIMIZATION_MODE_OPTIONS,
  formaterLibelleModeOptimisation,
  resoudreOptionModeOptimisation,
} from "../utils/optimizationModes.js";
import {
  readSchedulerScoringSummary,
  selectSchedulerScoringMode,
} from "../utils/schedulerScoring.js";
import "../styles/SchedulerPage.css";

const API = "/api/scheduler";

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur serveur.");
  return data;
}

async function apiGet(url) {
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur serveur.");
  return data;
}

const PHASES = [
  { id: "PHASE_1", label: "Chargement du contexte", shortLabel: "01", pct: 5 },
  { id: "PHASE_2", label: "Formation des groupes", shortLabel: "02", pct: 15 },
  { id: "PHASE_3", label: "Matrices de contraintes", shortLabel: "03", pct: 25 },
  { id: "PHASE_4", label: "Generation initiale", shortLabel: "04", pct: 35 },
  { id: "PHASE_5", label: "Traitement des cours echoues", shortLabel: "05", pct: 55 },
  { id: "PHASE_6", label: "Optimisation SA", shortLabel: "06", pct: 75 },
  { id: "PHASE_7", label: "Persistance BD", shortLabel: "07", pct: 90 },
  { id: "DONE", label: "Termine", shortLabel: "OK", pct: 100 },
];

const SCORING_SCORE_ITEMS = [
  { key: "scoreGlobal", label: "Score global" },
  { key: "scoreEtudiant", label: "Score etudiant" },
  { key: "scoreProfesseur", label: "Score professeur" },
  { key: "scoreGroupe", label: "Score groupe" },
];

function formaterValeurScoring(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2);
}

function construireEcartsScoring(scoringMode) {
  const scoreGlobal = Number(scoringMode?.scoreGlobal);

  if (!Number.isFinite(scoreGlobal)) {
    return [];
  }

  return [
    {
      key: "etudiant",
      label: "Ecart etudiant vs global",
      value: Number(scoringMode?.scoreEtudiant) - scoreGlobal,
    },
    {
      key: "professeur",
      label: "Ecart professeur vs global",
      value: Number(scoringMode?.scoreProfesseur) - scoreGlobal,
    },
    {
      key: "groupe",
      label: "Ecart groupe vs global",
      value: Number(scoringMode?.scoreGroupe) - scoreGlobal,
    },
  ].filter((item) => Number.isFinite(item.value) && item.value !== 0);
}

function ScoringSummaryCard({ scoringSummary, scoringMode, subtitle, className = "" }) {
  if (!scoringSummary || !scoringMode) {
    return null;
  }

  const metrics = scoringSummary.metrics || {};
  const gaps = construireEcartsScoring(scoringMode);
  const metaItems = [
    metrics.pausesEtudiantsRespectees !== null ||
    metrics.pausesEtudiantsManquees !== null
      ? {
          key: "student-breaks",
          label: `Pauses etudiants : ${formaterValeurScoring(
            metrics.pausesEtudiantsRespectees
          )} respectees / ${formaterValeurScoring(
            metrics.pausesEtudiantsManquees
          )} manquees`,
        }
      : null,
    metrics.pausesProfesseursRespectees !== null ||
    metrics.pausesProfesseursManquees !== null
      ? {
          key: "teacher-breaks",
          label: `Pauses professeurs : ${formaterValeurScoring(
            metrics.pausesProfesseursRespectees
          )} respectees / ${formaterValeurScoring(
            metrics.pausesProfesseursManquees
          )} manquees`,
        }
      : null,
    metrics.pausesGroupesRespectees !== null ||
    metrics.pausesGroupesManquees !== null
      ? {
          key: "group-breaks",
          label: `Pauses groupes : ${formaterValeurScoring(
            metrics.pausesGroupesRespectees
          )} respectees / ${formaterValeurScoring(
            metrics.pausesGroupesManquees
          )} manquees`,
        }
      : null,
    metrics.nbCoursNonPlanifies !== null
      ? {
          key: "not-planned",
          label: `Cours non planifies : ${formaterValeurScoring(
            metrics.nbCoursNonPlanifies
          )}`,
        }
      : null,
    metrics.nbConflitsEvites !== null
      ? {
          key: "avoided-conflicts",
          label: `Conflits evites : ${formaterValeurScoring(
            metrics.nbConflitsEvites
          )}`,
        }
      : null,
    ...gaps.map((gap) => ({
      key: gap.key,
      label: `${gap.label} : ${gap.value > 0 ? "+" : ""}${formaterValeurScoring(
        gap.value
      )}`,
    })),
  ].filter(Boolean);

  return (
    <div className={["scoring-summary-card", className].filter(Boolean).join(" ")}>
      <div className="scoring-summary-header">
        <h3>Scoring final</h3>
        <span>{subtitle}</span>
      </div>
      <div className="scoring-summary-grid">
        {SCORING_SCORE_ITEMS.map((item) => (
          <div key={item.key} className="scoring-summary-item">
            <strong>{formaterValeurScoring(scoringMode?.[item.key])}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      {metaItems.length > 0 ? (
        <div className="scoring-summary-meta">
          {metaItems.map((item) => (
            <span key={item.key}>{item.label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SchedulerPage({ utilisateur, onLogout }) {
  const [sessions, setSessions]             = useState([]);
  const [rapports, setRapports]             = useState([]);
  const [selectedSession, setSelectedSession] = useState("");
  const inclureWeekend = false;
  const [optimizationMode, setOptimizationMode] = useState("legacy");
  const [saIterations, setSaIterations]     = useState(50);
  const [generating, setGenerating]         = useState(false);
  const [bootstrapping, setBootstrapping]   = useState(false);
  const [phase, setPhase]                   = useState(null);
  const [pct, setPct]                       = useState(0);
  const [phaseMsg, setPhaseMsg]             = useState("");
  const [rapport, setRapport]               = useState(null);
  const [rapportHistoriqueId, setRapportHistoriqueId] = useState(null);
  const [rapportHistoriqueDetail, setRapportHistoriqueDetail] = useState(null);
  const [rapportHistoriqueLoading, setRapportHistoriqueLoading] = useState(false);
  const [erreur, setErreur]                 = useState("");
  const [onglet, setOnglet]                 = useState("generation");
  const [bootstrapMsg, setBootstrapMsg]     = useState(null);

  // Nouvelles sessions
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [newSession, setNewSession]         = useState({ nom: "", date_debut: "", date_fin: "" });
  const [sessionMsg, setSessionMsg]         = useState("");

  const sseRef = useRef(null);
  const optimizationModeOption = resoudreOptionModeOptimisation(optimizationMode);
  const scoringCourantSummary = readSchedulerScoringSummary(rapport);
  const scoringCourant = selectSchedulerScoringMode(
    scoringCourantSummary,
    rapport?.details?.modeOptimisationUtilise || optimizationMode
  );
  const scoringHistoriqueSummary = readSchedulerScoringSummary(rapportHistoriqueDetail);
  const scoringHistorique = selectSchedulerScoringMode(
    scoringHistoriqueSummary,
    rapportHistoriqueDetail?.details_bruts?.details?.modeOptimisationUtilise || optimizationMode
  );

  useEffect(() => {
    chargerDonnees();
    return () => { if (sseRef.current) sseRef.current.close(); };
  }, []);

  useEffect(() => {
    if (rapports.length === 0) {
      setRapportHistoriqueId(null);
      setRapportHistoriqueDetail(null);
      return;
    }

    const existeEncore = rapports.some((item) => item.id === rapportHistoriqueId);
    if (!rapportHistoriqueId || !existeEncore) {
      handleSelectHistorique(rapports[0].id);
    }
  }, [rapports, rapportHistoriqueId]);

  async function chargerDonnees() {
    try {
      const [s, r] = await Promise.allSettled([
        apiGet(`${API}/sessions`),
        apiGet(`${API}/rapports`),
      ]);
      if (s.status === "fulfilled") setSessions(s.value);
      if (r.status === "fulfilled") setRapports(r.value);
    } catch {}
  }

  async function handleSelectHistorique(idRapport) {
    setRapportHistoriqueId(idRapport);
    setRapportHistoriqueLoading(true);
    try {
      const detail = await apiGet(`${API}/rapports/${idRapport}`);
      setRapportHistoriqueDetail(detail);
    } catch (err) {
      setRapportHistoriqueDetail(null);
      setErreur(err.message);
    } finally {
      setRapportHistoriqueLoading(false);
    }
  }

  async function handleBootstrap() {
    setBootstrapping(true);
    setBootstrapMsg(null);
    try {
      const res = await apiPost(`${API}/bootstrap`, {});
      const created = res.report?.created;
      const details = res.report?.details || [];
      const total = Object.values(created || {}).reduce((a, b) => a + b, 0);
      setBootstrapMsg({
        type: "success",
        text: total > 0
          ? `Bootstrap pret : ${details.join(" | ")}`
          : "Donnees deja operationnelles, aucune creation necessaire.",
      });
    } catch (err) {
      setBootstrapMsg({ type: "error", text: err.message });
    } finally {
      setBootstrapping(false);
    }
  }

  function handleGenererSSE() {
    if (sseRef.current) sseRef.current.close();

    setGenerating(true);
    setErreur("");
    setRapport(null);
    setPhase("PHASE_1");
    setPct(5);
    setPhaseMsg("DÃ©marrageâ€¦");

    const params = construireQueryGenerationScheduler({
      id_session: selectedSession || null,
      mode_optimisation: optimizationMode,
      sa_params: { maxIterParTemp: saIterations },
    });

    const es = new EventSource(`${API}/generer-stream?${params}`, { withCredentials: true });
    sseRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);

        if (data.type === "progress") {
          if (data.phase) setPhase(data.phase);
          if (data.pct != null) setPct(data.pct);
          if (data.message) setPhaseMsg(data.message);
        } else if (data.type === "done") {
          setPct(100);
          setPhase("DONE");
          setPhaseMsg("GÃ©nÃ©ration terminÃ©e avec succÃ¨s !");
          setPhaseMsg(
            `Generation terminee en mode ${formaterLibelleModeOptimisation(
              data?.rapport?.details?.modeOptimisationUtilise || optimizationMode
            )}.`
          );
          setRapport(data.rapport);
          chargerDonnees();
          es.close();
          setGenerating(false);
        } else if (data.type === "error") {
          setErreur(data.message);
          setPhase(null);
          setPct(0);
          es.close();
          setGenerating(false);
        }
      } catch {}
    };

    es.onerror = () => {
      setErreur("Connexion SSE perdue. VÃ©rifiez le serveur.");
      setPhase(null);
      setPct(0);
      es.close();
      setGenerating(false);
    };
  }

  async function handleCreerSession() {
    try {
      await apiPost(`${API}/sessions`, newSession);
      setSessionMsg("Session crÃ©Ã©e et activÃ©e !");
      setShowSessionForm(false);
      setNewSession({ nom: "", date_debut: "", date_fin: "" });
      await chargerDonnees();
    } catch (err) {
      setSessionMsg(err.message);
    }
  }

  async function handleActiverSession(id) {
    try {
      await fetch(`${API}/sessions/${id}/activer`, {
        method: "PUT",
        credentials: "include",
      });
      await chargerDonnees();
    } catch {}
  }

  const sessionActive = sessions.find((s) => s.active);
  const phaseIndex    = PHASES.findIndex((p) => p.id === phase);

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Planification"
    >
      <div className="scheduler-page">
        <div className="scheduler-header">
          <div>
            <h1 className="scheduler-title">Centre de planification</h1>
          </div>
          {sessionActive && (
            <div className="session-badge">
              <span className="session-dot" />
              <span>{sessionActive.nom}</span>
            </div>
          )}
        </div>

        {/* Onglets */}
        <div className="scheduler-tabs">
          {["generation", "sessions", "historique"].map((t) => (
            <button
              key={t}
              className={`scheduler-tab ${onglet === t ? "active" : ""}`}
              onClick={() => setOnglet(t)}
            >
              {t === "generation" && "Generation"}
              {t === "sessions"   && "Sessions"}
              {t === "historique" && "Historique"}
            </button>
          ))}
        </div>

        {/* â”€â”€ Onglet GÃ‰NÃ‰RATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {onglet === "generation" && (
          <div className="scheduler-content">
            <div className="scheduler-grid">
              {/* Panel gauche : paramÃ¨tres */}
              <div className="scheduler-panel">
                <h2 className="panel-title">Parametres</h2>

                {/* Bootstrap */}
                <div className="bootstrap-section">
                  <button
                    className="btn-bootstrap"
                    onClick={handleBootstrap}
                    disabled={bootstrapping || generating}
                  >
                    {bootstrapping ? "Preparation..." : "Preparer les donnees"}
                  </button>
                  {bootstrapMsg && (
                    <div className={`alert-${bootstrapMsg.type === "success" ? "success" : "error"} bootstrap-alert`}>
                      {bootstrapMsg.text}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Session cible</label>
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Session active ({sessionActive?.nom || "Aucune"})</option>
                    {sessions.map((s) => (
                      <option key={s.id_session} value={s.id_session}>
                        {s.nom} {s.active ? "(active)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Mode d'optimisation</label>
                  <select
                    value={optimizationMode}
                    onChange={(e) => setOptimizationMode(e.target.value)}
                    className="form-select"
                    disabled={generating || bootstrapping}
                  >
                    {OPTIMIZATION_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small>{optimizationModeOption.description}</small>
                </div>

                <div className="form-group">
                  <label>Cadre academique</label>
                  <div className="toggle-wrapper">
                    <button
                      className="toggle-btn off"
                      disabled
                    >
                      {inclureWeekend ? "Sam/Dim inclus" : "Lun-Ven seulement"}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>IntensitÃ© optimisation SA</label>
                  <div className="slider-wrapper">
                    <input
                      type="range"
                      min="10"
                      max="200"
                      value={saIterations}
                      onChange={(e) => setSaIterations(Number(e.target.value))}
                      className="form-slider"
                    />
                    <span className="slider-val">{saIterations} iter/TÂ°</span>
                  </div>
                  <small>Plus Ã©levÃ© = meilleure qualitÃ© mais plus lent</small>
                </div>

                <div className="algo-info">
                  <h3>Etapes du moteur</h3>
                  <div className="phases-list">
                    {PHASES.slice(0, -1).map((ph, i) => (
                      <div
                        key={ph.id}
                        className={`phase-item ${
                          phaseIndex > i ? "done" : phaseIndex === i ? "active" : ""
                        }`}
                      >
                        <span className="phase-icon">
                          {phaseIndex > i ? "OK" : phaseIndex === i ? "..." : ph.shortLabel}
                        </span>
                        <span>{ph.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className="btn-generate"
                  onClick={handleGenererSSE}
                  disabled={generating || bootstrapping}
                >
                  {generating ? (
                    <span className="btn-spinner">
                      <span className="spinner" /> GÃ©nÃ©ration en coursâ€¦
                    </span>
                  ) : (
                    "Lancer la generation"
                  )}
                </button>
              </div>

              {/* Panel droit : rÃ©sultats */}
              <div className="scheduler-panel">
                {generating && (
                  <div className="progress-card">
                    <h2>GÃ©nÃ©ration en coursâ€¦</h2>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="progress-pct">{pct}%</p>
                    <p className="progress-phase">{phaseMsg || "Initialisationâ€¦"}</p>
                    <div className="progress-phases-mini">
                      {PHASES.slice(0, -1).map((ph, i) => (
                        <div
                          key={ph.id}
                          className={`mini-phase ${
                            phaseIndex > i ? "done" : phaseIndex === i ? "active" : ""
                          }`}
                          title={ph.label}
                        >
                          {ph.shortLabel}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {erreur && <div className="alert-error">{erreur}</div>}

                {rapport && !generating && (
                  <div className="rapport-card">
                    <div className="rapport-header">
                      <h2>Generation terminee</h2>
                      <div className="score-badge">
                        <span
                          className={`score-num ${
                            rapport.score_qualite >= 70 ? "green" :
                            rapport.score_qualite >= 40 ? "orange" : "red"
                          }`}
                        >
                          {rapport.score_qualite}
                        </span>
                        <span className="score-label">/ 100</span>
                      </div>
                    </div>

                    <div className="rapport-stats">
                      <div className="stat-item green">
                        <span className="stat-num">{rapport.nb_cours_planifies}</span>
                        <span className="stat-lbl">Cours planifiÃ©s</span>
                      </div>
                      <div className="stat-item red">
                        <span className="stat-num">{rapport.nb_cours_non_planifies}</span>
                        <span className="stat-lbl">Non planifiÃ©s</span>
                      </div>
                      <div className="stat-item blue">
                        <span className="stat-num">{rapport.nb_cours_echoues_traites}</span>
                        <span className="stat-lbl">Ã‰checs traitÃ©s</span>
                      </div>
                      <div className="stat-item orange">
                        <span className="stat-num">{rapport.nb_cours_en_ligne_generes}</span>
                        <span className="stat-lbl">Seances en ligne</span>
                      </div>
                      <div className="stat-item purple">
                        <span className="stat-num">
                          {rapport.details?.reprises?.affectations_reussies ?? 0}
                        </span>
                        <span className="stat-lbl">Reprises reussies</span>
                      </div>
                      <div className="stat-item yellow">
                        <span className="stat-num">{rapport.nb_resolutions_manuelles}</span>
                        <span className="stat-lbl">Conflits reprises</span>
                      </div>
                    </div>

                    <div className="rapport-mode">
                      Generation executee en mode{" "}
                      {formaterLibelleModeOptimisation(
                        rapport?.details?.modeOptimisationUtilise || optimizationMode
                      )}
                    </div>

                    <ScoringSummaryCard
                      scoringSummary={scoringCourantSummary}
                      scoringMode={scoringCourant}
                      subtitle={`Lecture ${formaterLibelleModeOptimisation(
                        rapport?.details?.modeOptimisationUtilise || optimizationMode
                      )}`}
                    />

                    <div className="rapport-meta">
                      <span>Iterations SA : {rapport.iterations_sa?.toLocaleString()}</span>
                      <span>Session : {rapport.session?.nom}</span>
                      <span>Score initial : {rapport.score_initial}</span>
                    </div>

                    {rapport.groupes_crees?.length > 0 && (
                      <div className="rapport-section">
                        <h3>Groupes formes ({rapport.groupes_crees.length})</h3>
                        <div className="groupes-list">
                          {rapport.groupes_crees.map((g) => (
                            <span key={g.nom} className="groupe-tag">
                              {g.nom} ({g.taille_reguliere ?? 0} reg. / {g.taille_projete_max ?? g.taille_reguliere ?? 0} proj.)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {rapport.non_planifies?.length > 0 && (
                      <div className="rapport-section warning">
                        <h3>Cours non planifies ({rapport.non_planifies.length})</h3>
                        {rapport.non_planifies.map((c, i) => (
                          <div key={i} className="non-planifie-item">
                            <strong>{c.code}</strong> - {c.raison}
                          </div>
                        ))}
                      </div>
                    )}

                    {rapport.resolutions_manuelles?.length > 0 && (
                      <div className="rapport-section error">
                        <h3>Resolutions manuelles ({rapport.resolutions_manuelles.length})</h3>
                        {rapport.resolutions_manuelles.map((c, i) => (
                          <div key={i} className="non-planifie-item">
                            <strong>{c.code_cours || c.cours?.code || "REPRISE"}</strong> : {c.etudiants?.length || 1} Ã©tudiant(s) - {c.raison}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="rapport-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => window.open("/horaires-groupes", "_blank")}
                      >
                        Voir les horaires groupes
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => window.open("/horaires-professeurs", "_blank")}
                      >
                        Voir les horaires professeurs
                      </button>
                    </div>
                  </div>
                )}

                {!rapport && !generating && !erreur && (
                  <div className="empty-state">
                    <h3>Pret a generer</h3>
                    <p>Configurez les paramÃ¨tres et lancez la gÃ©nÃ©ration optimisÃ©e.</p>
                    <ul className="empty-tips">
                      <li>Assurez-vous d'avoir une session active.</li>
                      <li>Importez vos etudiants avant de generer.</li>
                      <li>Verifiez les disponibilites des professeurs.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ Onglet SESSIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {onglet === "sessions" && (
          <div className="scheduler-content">
            <div className="sessions-header">
              <h2>Gestion des sessions</h2>
              <button className="btn-add" onClick={() => setShowSessionForm(true)}>
                + Nouvelle session
              </button>
            </div>

            {sessionMsg && (
              <div className={`alert-${sessionMsg.includes("!") ? "success" : "error"}`}>
                {sessionMsg}
              </div>
            )}

            {showSessionForm && (
              <div className="session-form">
                <h3>Nouvelle session</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nom</label>
                    <input
                      type="text"
                      placeholder="ex: Automne 2026"
                      value={newSession.nom}
                      onChange={(e) => setNewSession({ ...newSession, nom: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Date dÃ©but</label>
                    <input
                      type="date"
                      value={newSession.date_debut}
                      onChange={(e) => setNewSession({ ...newSession, date_debut: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Date fin</label>
                    <input
                      type="date"
                      value={newSession.date_fin}
                      onChange={(e) => setNewSession({ ...newSession, date_fin: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn-primary" onClick={handleCreerSession}>Creer et activer</button>
                  <button className="btn-secondary" onClick={() => setShowSessionForm(false)}>Annuler</button>
                </div>
              </div>
            )}

            <div className="sessions-list">
              {sessions.map((s) => (
                <div key={s.id_session} className={`session-card ${s.active ? "active" : ""}`}>
                  <div className="session-info">
                    <span className="session-nom">{s.nom}</span>
                    <span className="session-dates">
                      {new Date(s.date_debut).toLocaleDateString("fr-CA")} â†’{" "}
                      {new Date(s.date_fin).toLocaleDateString("fr-CA")}
                    </span>
                  </div>
                  <div className="session-badges">
                    {s.active
                      ? <span className="badge-active">Active</span>
                      : (
                        <button
                          className="btn-activer"
                          onClick={() => handleActiverSession(s.id_session)}
                        >
                          Activer
                        </button>
                      )
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* â”€â”€ Onglet HISTORIQUE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {onglet === "historique" && (
          <div className="scheduler-content">
            <h2>Historique des generations</h2>
            <div className="historique-layout">
              <div className="rapports-list">
                {rapports.length === 0 && (
                  <p className="empty-text">Aucune gÃ©nÃ©ration effectuÃ©e.</p>
                )}
                {rapports.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`rapport-row ${rapportHistoriqueId === r.id ? "active" : ""}`}
                    onClick={() => handleSelectHistorique(r.id)}
                  >
                    <div className="rapport-row-score">
                      <span
                        className={`score-circle ${
                          r.score_qualite >= 70 ? "green" : r.score_qualite >= 40 ? "orange" : "red"
                        }`}
                      >
                        {r.score_qualite}
                      </span>
                    </div>
                    <div className="rapport-row-info">
                      <strong>{r.session_nom || "Session inconnue"}</strong>
                      <span>
                        {r.nb_cours_planifies} planifiÃ©s Â· {r.nb_cours_non_planifies} non planifiÃ©s Â·{" "}
                        {r.nb_resolutions_manuelles} reprises en attente
                      </span>
                      <small>
                        {new Date(r.date_generation).toLocaleString("fr-CA")} par{" "}
                        {r.generateur_prenom} {r.generateur_nom}
                      </small>
                      {r.resume_metier?.raisons_non_planifiees?.length > 0 && (
                        <div className="rapport-row-tags">
                          {r.resume_metier.raisons_non_planifiees.slice(0, 3).map((raison) => (
                            <span key={`${r.id}-${raison.code}`} className="rapport-chip">
                              {raison.code}: {raison.total}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="historique-detail">
                {!rapportHistoriqueDetail && !rapportHistoriqueLoading && (
                  <div className="empty-state">
                    <h3>Selectionnez un rapport</h3>
                  </div>
                )}

                {rapportHistoriqueLoading && (
                  <div className="progress-card">
                    <h2>Chargement du rapportâ€¦</h2>
                    <p className="progress-phase">Analyse mÃ©tier et diagnostics persistants.</p>
                  </div>
                )}

                {rapportHistoriqueDetail && !rapportHistoriqueLoading && (
                  <div className="historique-detail-card">
                    <div className="historique-detail-header">
                      <div>
                        <h3>{rapportHistoriqueDetail.session_nom || "Session inconnue"}</h3>
                        <p>
                          {new Date(rapportHistoriqueDetail.date_generation).toLocaleString("fr-CA")} Â·{" "}
                          {rapportHistoriqueDetail.generateur_prenom} {rapportHistoriqueDetail.generateur_nom}
                        </p>
                      </div>
                      <div className="historique-detail-score">
                        <span
                          className={`score-circle ${
                            rapportHistoriqueDetail.score_qualite >= 70
                              ? "green"
                              : rapportHistoriqueDetail.score_qualite >= 40
                              ? "orange"
                              : "red"
                          }`}
                        >
                          {rapportHistoriqueDetail.score_qualite}
                        </span>
                      </div>
                    </div>

                    <div className="historique-metrics">
                      <div className="historique-metric">
                        <strong>{rapportHistoriqueDetail.nb_cours_planifies}</strong>
                        <span>sÃ©ances planifiÃ©es</span>
                      </div>
                      <div className="historique-metric">
                        <strong>{rapportHistoriqueDetail.nb_cours_non_planifies}</strong>
                        <span>cas non planifiÃ©s</span>
                      </div>
                      <div className="historique-metric">
                        <strong>{rapportHistoriqueDetail.reprises_non_resolues?.length || 0}</strong>
                        <span>reprises non attribuÃ©es</span>
                      </div>
                    </div>

                    <ScoringSummaryCard
                      scoringSummary={scoringHistoriqueSummary}
                      scoringMode={scoringHistorique}
                      className="scoring-summary-card--historique"
                      subtitle={`Lecture ${formaterLibelleModeOptimisation(
                        rapportHistoriqueDetail?.details_bruts?.details?.modeOptimisationUtilise ||
                          optimizationMode
                      )}`}
                    />

                    <div className="historique-summary-grid">
                      <div className="historique-summary-card">
                        <h4>Blocages de planification</h4>
                        {rapportHistoriqueDetail.resume_metier?.raisons_non_planifiees?.length > 0 ? (
                          <div className="historique-summary-tags">
                            {rapportHistoriqueDetail.resume_metier.raisons_non_planifiees.map((raison) => (
                              <span key={`np-${raison.code}`} className="rapport-chip rapport-chip--warning">
                                {raison.code}: {raison.total}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p>Aucun blocage de planification enregistrÃ©.</p>
                        )}
                      </div>

                      <div className="historique-summary-card">
                        <h4>Blocages de reprises</h4>
                        {rapportHistoriqueDetail.resume_metier?.raisons_reprises?.length > 0 ? (
                          <div className="historique-summary-tags">
                            {rapportHistoriqueDetail.resume_metier.raisons_reprises.map((raison) => (
                              <span key={`rp-${raison.code}`} className="rapport-chip rapport-chip--error">
                                {raison.code}: {raison.total}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p>Aucune reprise en attente.</p>
                        )}
                      </div>
                    </div>

                    <div className="historique-section">
                      <div className="historique-section-title">
                        <h4>Reprises non attribuÃ©es</h4>
                        <span>{rapportHistoriqueDetail.reprises_non_resolues?.length || 0}</span>
                      </div>
                      {rapportHistoriqueDetail.reprises_non_resolues?.length > 0 ? (
                        <div className="historique-issues">
                          {rapportHistoriqueDetail.reprises_non_resolues.map((item) => (
                            <details key={`reprise-${item.id_cours_echoue}`} className="historique-issue">
                              <summary>
                                <div>
                                  <strong>
                                    {item.etudiant?.matricule || "Matricule inconnu"} Â· {item.etudiant?.nom || "Nom"} {item.etudiant?.prenom || ""}
                                  </strong>
                                  <span>
                                    {item.code_cours} Â· {item.nom_cours}
                                  </span>
                                </div>
                                <span className="issue-badge issue-badge--error">{item.raison_code}</span>
                              </summary>
                              <div className="historique-issue-body">
                                <p>{item.raison}</p>
                                <div className="issue-meta-grid">
                                  <div>
                                    <small>Groupe principal</small>
                                    <strong>{item.etudiant?.groupe_principal || "Non dÃ©fini"}</strong>
                                  </div>
                                  <div>
                                    <small>Programme / Ã©tape</small>
                                    <strong>
                                      {item.etudiant?.programme || "â€”"} Â· E{item.etudiant?.etape || "â€”"}
                                    </strong>
                                  </div>
                                </div>

                                {item.groupes_candidats?.length > 0 && (
                                  <div className="issue-subsection">
                                    <h5>Groupes candidats Ã©valuÃ©s</h5>
                                    <div className="issue-inline-list">
                                      {item.groupes_candidats.map((groupe) => (
                                        <div key={`${item.id_cours_echoue}-${groupe.id_groupe}`} className="issue-inline-card">
                                          <strong>{groupe.nom_groupe}</strong>
                                          <span>{groupe.decision || groupe.raison_code}</span>
                                          {groupe.raisons?.map((raison) => (
                                            <small key={`${groupe.id_groupe}-${raison.code}`}>{raison.message}</small>
                                          ))}
                                          {groupe.conflits?.[0]?.conflit_avec && (
                                            <small>
                                              Conflit avec {groupe.conflits[0].conflit_avec.code_cours} Â·{" "}
                                              {groupe.conflits[0].conflit_avec.groupe_source} Â·{" "}
                                              {groupe.conflits[0].conflit_avec.date}
                                            </small>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="issue-subsection">
                                  <h5>Actions manuelles proposÃ©es</h5>
                                  <ul className="issue-list">
                                    {(item.solutions_manuelles || []).map((solution, index) => (
                                      <li key={`reprise-solution-${item.id_cours_echoue}-${index}`}>{solution}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </details>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-text">Aucune reprise non attribuÃ©e dans ce rapport.</p>
                      )}
                    </div>

                    <div className="historique-section">
                      <div className="historique-section-title">
                        <h4>Cours non planifiÃ©s</h4>
                        <span>{rapportHistoriqueDetail.cours_non_planifies?.length || 0}</span>
                      </div>
                      {rapportHistoriqueDetail.cours_non_planifies?.length > 0 ? (
                        <div className="historique-issues">
                          {rapportHistoriqueDetail.cours_non_planifies.map((item, index) => (
                            <details
                              key={`np-${item.id_cours}-${item.groupe?.nom_groupe || item.groupe || index}-${index}`}
                              className="historique-issue"
                            >
                              <summary>
                                <div>
                                  <strong>
                                    {item.cours?.code || item.code} Â· {item.cours?.nom || item.nom}
                                  </strong>
                                  <span>
                                    {item.groupe?.nom_groupe || item.groupe || "Sans groupe"} Â·{" "}
                                    {item.cours?.programme || item.groupe?.programme || "Programme inconnu"}
                                  </span>
                                </div>
                                <span className="issue-badge issue-badge--warning">
                                  {item.raison_code || "NON_PLANIFIE"}
                                </span>
                              </summary>
                              <div className="historique-issue-body">
                                <p>{item.raison}</p>
                                <div className="issue-meta-grid">
                                  <div>
                                    <small>Type de salle</small>
                                    <strong>{item.cours?.type_salle || "â€”"}</strong>
                                  </div>
                                  <div>
                                    <small>Ã‰tape / groupe</small>
                                    <strong>
                                      E{item.cours?.etape || item.groupe?.etape || "â€”"} Â· {item.groupe?.nom_groupe || item.groupe || "â€”"}
                                    </strong>
                                  </div>
                                </div>

                                {item.professeurs_compatibles?.length > 0 && (
                                  <div className="issue-subsection">
                                    <h5>Professeurs compatibles</h5>
                                    <div className="issue-inline-list">
                                      {item.professeurs_compatibles.map((professeur) => (
                                        <div key={`prof-${item.id_cours}-${professeur.id_professeur}`} className="issue-inline-card">
                                          <strong>{professeur.nom_complet}</strong>
                                          <span>{professeur.matricule || "Sans matricule"}</span>
                                          <small>{professeur.series_actives} sÃ©ries actives Â· {professeur.groupes_actifs} groupes</small>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {item.salles_compatibles?.length > 0 && (
                                  <div className="issue-subsection">
                                    <h5>Salles compatibles</h5>
                                    <div className="issue-inline-list">
                                      {item.salles_compatibles.map((salle) => (
                                        <div key={`salle-${item.id_cours}-${salle.id_salle}`} className="issue-inline-card">
                                          <strong>{salle.code}</strong>
                                          <small>CapacitÃ© {salle.capacite}</small>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="issue-subsection">
                                  <h5>Actions manuelles proposÃ©es</h5>
                                  <ul className="issue-list">
                                    {(item.solutions_manuelles || []).map((solution, solutionIndex) => (
                                      <li key={`np-solution-${item.id_cours}-${solutionIndex}`}>{solution}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </details>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-text">Aucun cours non planifiÃ© dans ce rapport.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}




