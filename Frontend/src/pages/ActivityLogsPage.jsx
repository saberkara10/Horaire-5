import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Download, Eye, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import {
  recupererActivityLog,
  recupererActivityLogs,
  recupererActivityLogsStats,
} from "../services/activityLogs.api.js";
import {
  getLibelleRoleFrontend,
  utilisateurEstAdminResponsable,
} from "../utils/roles.js";
import "../styles/ActivityLogsPage.css";

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "IMPORT",
  "GENERATE",
  "COMPARE",
  "RESTORE",
  "ARCHIVE",
  "DUPLICATE",
  "ERROR",
  "RESET",
];
const MODULES = ["Authentification", "Cours", "Professeurs", "Salles", "Groupes", "Etudiants", "Horaires", "Sessions", "Utilisateurs"];

function formaterDate(date) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(date));
}

function badgeAction(actionType) {
  return `activity-badge activity-badge--${String(actionType || "").toLowerCase()}`;
}

function afficherJson(valeur) {
  if (valeur === null || valeur === undefined) {
    return "Non disponible";
  }

  return JSON.stringify(valeur, null, 2);
}

async function exportExcel(logs) {
  const XLSX = await import("xlsx");
  const lignes = logs.map((log) => ({
    ID: log.id_log ?? "",
    Date: formaterDate(log.created_at),
    Utilisateur: log.user_name || "Systeme",
    Role: getLibelleRoleFrontend(log.user_role),
    Module: log.module || "",
    Action: log.action_type || "",
    Statut: log.status === "ERROR" ? "Echec" : "Succes",
    Description: log.description || "",
    IP: log.ip_address || "",
  }));
  const feuille = XLSX.utils.json_to_sheet(lignes);
  const classeur = XLSX.utils.book_new();

  feuille["!cols"] = [
    { wch: 10 },
    { wch: 22 },
    { wch: 24 },
    { wch: 24 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 60 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(classeur, feuille, "Journal");
  XLSX.writeFile(classeur, "journal-activite.xlsx");
}

export function ActivityLogsPage({ utilisateur }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, total_pages: 1 });
  const [filtres, setFiltres] = useState({
    recherche: "",
    module: "",
    action_type: "",
    status: "",
    date_debut: "",
    date_fin: "",
    page: 1,
    limit: 25,
  });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [detail, setDetail] = useState(null);
  const [chargementDetail, setChargementDetail] = useState(false);

  const estAdminGeneral = utilisateurEstAdminResponsable(utilisateur);

  const filtresApi = useMemo(
    () => ({
      ...filtres,
      sort_by: "created_at",
      sort_order: "desc",
    }),
    [filtres]
  );

  async function chargerJournal() {
    setChargement(true);
    setErreur("");

    try {
      const [resultat, resume] = await Promise.all([
        recupererActivityLogs(filtresApi),
        recupererActivityLogsStats(),
      ]);
      setLogs(resultat?.data || []);
      setPagination(resultat?.pagination || { page: 1, limit: 25, total: 0, total_pages: 1 });
      setStats(resume);
    } catch (error) {
      setErreur(error.message || "Impossible de charger le journal.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (estAdminGeneral) {
      chargerJournal();
    }
  }, [estAdminGeneral, filtresApi]);

  function modifierFiltre(cle, valeur) {
    setFiltres((courants) => ({
      ...courants,
      [cle]: valeur,
      page: cle === "page" ? valeur : 1,
    }));
  }

  async function ouvrirDetail(idLog) {
    setChargementDetail(true);
    try {
      const evenement = await recupererActivityLog(idLog);
      setDetail(evenement);
    } finally {
      setChargementDetail(false);
    }
  }

  if (!estAdminGeneral) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="activity-page">
      <section className="activity-summary">
        <article>
          <ShieldCheck size={22} />
          <span>Aujourd'hui</span>
          <strong>{stats?.actions_aujourdhui ?? 0}</strong>
        </article>
        <article>
          <span>Erreurs</span>
          <strong>{stats?.erreurs ?? 0}</strong>
        </article>
        <article>
          <span>Connexions</span>
          <strong>{stats?.connexions ?? 0}</strong>
        </article>
        <article>
          <span>Modifications</span>
          <strong>{stats?.modifications ?? 0}</strong>
        </article>
      </section>

      <section className="activity-panel">
        <div className="activity-toolbar">
          <label className="activity-field activity-field--search">
            <span>Recherche</span>
            <div>
              <Search size={18} />
              <input
                value={filtres.recherche}
                onChange={(event) => modifierFiltre("recherche", event.target.value)}
                placeholder="Utilisateur, module, description..."
              />
            </div>
          </label>

          <label className="activity-field">
            <span>Module</span>
            <select value={filtres.module} onChange={(event) => modifierFiltre("module", event.target.value)}>
              <option value="">Tous</option>
              {MODULES.map((module) => <option key={module} value={module}>{module}</option>)}
            </select>
          </label>

          <label className="activity-field">
            <span>Action</span>
            <select value={filtres.action_type} onChange={(event) => modifierFiltre("action_type", event.target.value)}>
              <option value="">Toutes</option>
              {ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </label>

          <label className="activity-field">
            <span>Statut</span>
            <select value={filtres.status} onChange={(event) => modifierFiltre("status", event.target.value)}>
              <option value="">Tous</option>
              <option value="SUCCESS">Succes</option>
              <option value="ERROR">Echec</option>
            </select>
          </label>

          <label className="activity-field">
            <span>Du</span>
            <input type="date" value={filtres.date_debut} onChange={(event) => modifierFiltre("date_debut", event.target.value)} />
          </label>

          <label className="activity-field">
            <span>Au</span>
            <input type="date" value={filtres.date_fin} onChange={(event) => modifierFiltre("date_fin", event.target.value)} />
          </label>

          <button type="button" className="activity-icon-button" onClick={chargerJournal} title="Rafraichir">
            <RefreshCw size={18} />
          </button>
          <button
            type="button"
            className="activity-secondary"
            onClick={() => void exportExcel(logs)}
            disabled={!logs.length}
            title="Exporter le rapport vers Excel"
          >
            <Download size={16} />
            Excel
          </button>
        </div>

        {erreur ? <div className="activity-alert">{erreur}</div> : null}

        <div className="activity-table-wrap">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Module</th>
                <th>Action</th>
                <th>Description</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {chargement ? (
                <tr><td colSpan="7" className="activity-empty">Chargement...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="7" className="activity-empty">Aucun evenement trouve.</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id_log}>
                  <td>{formaterDate(log.created_at)}</td>
                  <td>
                    <strong>{log.user_name || "Systeme"}</strong>
                    <span>{getLibelleRoleFrontend(log.user_role)}</span>
                  </td>
                  <td>{log.module}</td>
                  <td><span className={badgeAction(log.action_type)}>{log.action_type}</span></td>
                  <td>{log.description}</td>
                  <td>
                    <span className={`activity-status activity-status--${String(log.status || "").toLowerCase()}`}>
                      {log.status === "ERROR" ? "Echec" : "Succes"}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="activity-icon-button" onClick={() => ouvrirDetail(log.id_log)} title="Voir le detail">
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="activity-pagination">
          <span>{pagination.total} evenement(s)</span>
          <div>
            <button type="button" disabled={pagination.page <= 1} onClick={() => modifierFiltre("page", pagination.page - 1)}>Precedent</button>
            <strong>{pagination.page} / {pagination.total_pages}</strong>
            <button type="button" disabled={pagination.page >= pagination.total_pages} onClick={() => modifierFiltre("page", pagination.page + 1)}>Suivant</button>
          </div>
        </div>
      </section>

      {detail ? (
        <div className="activity-modal-overlay" role="presentation" onClick={() => setDetail(null)}>
          <section className="activity-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className={badgeAction(detail.action_type)}>{detail.action_type}</span>
                <h2>Evenement #{detail.id_log}</h2>
              </div>
              <button type="button" onClick={() => setDetail(null)} title="Fermer"><X size={20} /></button>
            </header>
            {chargementDetail ? <p>Chargement...</p> : (
              <div className="activity-detail-grid">
                <div><span>Date</span><strong>{formaterDate(detail.created_at)}</strong></div>
                <div><span>Utilisateur</span><strong>{detail.user_name || "Systeme"}</strong></div>
                <div><span>Role</span><strong>{getLibelleRoleFrontend(detail.user_role)}</strong></div>
                <div><span>Module</span><strong>{detail.module}</strong></div>
                <div><span>Cible</span><strong>{[detail.target_type, detail.target_id].filter(Boolean).join(" #") || "-"}</strong></div>
                <div><span>IP</span><strong>{detail.ip_address || "-"}</strong></div>
                <div className="activity-detail-grid__wide"><span>Description</span><p>{detail.description}</p></div>
                {detail.error_message ? <div className="activity-detail-grid__wide activity-error-text"><span>Erreur</span><p>{detail.error_message}</p></div> : null}
                <div className="activity-json"><span>Ancienne valeur</span><pre>{afficherJson(detail.old_value)}</pre></div>
                <div className="activity-json"><span>Nouvelle valeur</span><pre>{afficherJson(detail.new_value)}</pre></div>
                <div className="activity-detail-grid__wide"><span>User-agent</span><p>{detail.user_agent || "-"}</p></div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
