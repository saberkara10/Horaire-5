import { useState, useEffect } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import "../styles/SchedulerPage.css";

async function apiGet(url) {
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur serveur.");
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur serveur.");
  return data;
}

async function apiPut(url, body) {
  const res = await fetch(url, {
    method: "PUT", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur serveur.");
  return data;
}

async function apiDelete(url) {
  const res = await fetch(url, { method: "DELETE", credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur serveur.");
  return data;
}

export function AdminResponsablePage({ utilisateur, onLogout }) {
  const [stats, setStats] = useState(null);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [onglet, setOnglet] = useState("stats");
  const [message, setMessage] = useState({ type: "", text: "" });

  // Formulaire nouvel utilisateur
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ nom: "", prenom: "", email: "", motdepasse: "", role: "ADMIN" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    try {
      const [s, u] = await Promise.allSettled([
        apiGet("/api/admin/statistiques"),
        apiGet("/api/admin/utilisateurs"),
      ]);
      if (s.status === "fulfilled") setStats(s.value);
      if (u.status === "fulfilled") setUtilisateurs(u.value);
    } catch {}
  }

  async function handleCreer(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost("/api/admin/utilisateurs", formData);
      setMessage({ type: "success", text: `Administrateur ${formData.nom} créé avec succès.` });
      setShowForm(false);
      setFormData({ nom: "", prenom: "", email: "", motdepasse: "", role: "ADMIN" });
      await charger();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActif(u) {
    try {
      await apiPut(`/api/admin/utilisateurs/${u.id_utilisateur}`, { actif: !u.actif });
      setMessage({ type: "success", text: `Utilisateur ${u.nom} ${!u.actif ? "activé" : "désactivé"}.` });
      await charger();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  async function handleSupprimer(u) {
    if (!window.confirm(`Désactiver ${u.prenom} ${u.nom} ?`)) return;
    try {
      await apiDelete(`/api/admin/utilisateurs/${u.id_utilisateur}`);
      setMessage({ type: "success", text: "Utilisateur désactivé." });
      await charger();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  const roleBadge = (role) => {
    if (role === "ADMIN_RESPONSABLE") return <span className="badge-responsable">Responsable</span>;
    if (role === "ADMIN") return <span className="badge-admin">Admin</span>;
    return <span className="badge-user">Utilisateur</span>;
  };

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Admin central"
      subtitle="Supervision globale des acces et des indicateurs academiques."
    >
      <div className="admin-page">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">🛡️ Dashboard Admin Responsable</h1>
            <p className="admin-subtitle">Gestion des accès et supervision globale</p>
          </div>
        </div>

        {message.text && (
          <div className={`alert-${message.type}`} onClick={() => setMessage({ type: "", text: "" })}>
            {message.type === "success" ? "✅" : "❌"} {message.text}
          </div>
        )}

        {/* Onglets */}
        <div className="scheduler-tabs">
          {["stats", "utilisateurs"].map((t) => (
            <button
              key={t}
              className={`scheduler-tab ${onglet === t ? "active" : ""}`}
              onClick={() => setOnglet(t)}
            >
              {t === "stats" && "📊 Statistiques"}
              {t === "utilisateurs" && "👥 Administrateurs"}
            </button>
          ))}
        </div>

        {/* ── Statistiques ─────────────────────────────────────────── */}
        {onglet === "stats" && stats && (
          <div className="admin-stats-grid">
            {/* Carte Utilisateurs */}
            <div className="admin-stat-card blue">
              <div className="stat-card-icon">👥</div>
              <div className="stat-card-content">
                <h3>Utilisateurs</h3>
                <div className="stat-card-nums">
                  <div><span className="big-num">{stats.utilisateurs.total}</span> Total</div>
                  <div><span className="med-num">{stats.utilisateurs.admins}</span> Admins</div>
                  <div><span className="med-num">{stats.utilisateurs.responsables}</span> Resp.</div>
                </div>
              </div>
            </div>

            {/* Carte Académique */}
            <div className="admin-stat-card purple">
              <div className="stat-card-icon">🎓</div>
              <div className="stat-card-content">
                <h3>Données académiques</h3>
                <div className="stat-card-list">
                  <div>{stats.global.nb_cours} cours actifs</div>
                  <div>{stats.global.nb_professeurs} professeurs</div>
                  <div>{stats.global.nb_etudiants} étudiants</div>
                  <div>{stats.global.nb_salles} salles</div>
                  <div>{stats.global.nb_groupes} groupes</div>
                </div>
              </div>
            </div>

            {/* Carte Horaires */}
            <div className="admin-stat-card green">
              <div className="stat-card-icon">📅</div>
              <div className="stat-card-content">
                <h3>Horaires</h3>
                <div><span className="big-num">{stats.global.nb_affectations}</span>
                  <span className="stat-label"> affectations actives</span>
                </div>
                {stats.dernier_rapport && (
                  <div className="last-gen">
                    <span>Dernier score : </span>
                    <span className={`score-inline ${stats.dernier_rapport.score_qualite >= 70 ? "green" : "orange"}`}>
                      {stats.dernier_rapport.score_qualite}/100
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Carte Alertes */}
            <div className="admin-stat-card red">
              <div className="stat-card-icon">⚠️</div>
              <div className="stat-card-content">
                <h3>À traiter</h3>
                <div>
                  <span className="big-num">{stats.global.cours_echoues_en_attente}</span>
                  <span className="stat-label"> cours échoués en attente</span>
                </div>
                {stats.global.cours_echoues_en_attente > 0 && (
                  <div className="alert-hint">
                    Régénérez l'horaire pour les traiter automatiquement.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Gestion des administrateurs ─────────────────────────── */}
        {onglet === "utilisateurs" && (
          <div className="admin-content">
            <div className="admin-users-header">
              <h2>Administrateurs ({utilisateurs.length})</h2>
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                + Nouvel administrateur
              </button>
            </div>

            {/* Formulaire de création */}
            {showForm && (
              <form className="admin-user-form" onSubmit={handleCreer}>
                <h3>Créer un administrateur</h3>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Nom</label>
                    <input required type="text" className="form-input"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Prénom</label>
                    <input required type="text" className="form-input"
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input required type="email" className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Mot de passe</label>
                    <input required type="password" className="form-input"
                      value={formData.motdepasse}
                      onChange={(e) => setFormData({ ...formData, motdepasse: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Rôle</label>
                    <select className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                      <option value="ADMIN">Admin</option>
                      <option value="ADMIN_RESPONSABLE">Admin Responsable</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? "Création…" : "Créer"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                    Annuler
                  </button>
                </div>
              </form>
            )}

            {/* Table des utilisateurs */}
            <div className="admin-users-table">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th>Créé par</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {utilisateurs.map((u) => (
                    <tr key={u.id_utilisateur} className={!u.actif ? "inactive-row" : ""}>
                      <td>{u.prenom} {u.nom}</td>
                      <td>{u.email}</td>
                      <td>{roleBadge(u.role)}</td>
                      <td>
                        <span className={`badge-statut ${u.actif ? "actif" : "inactif"}`}>
                          {u.actif ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td>{u.cree_par_prenom ? `${u.cree_par_prenom} ${u.cree_par_nom}` : "—"}</td>
                      <td className="action-cell">
                        <button
                          className={`btn-sm ${u.actif ? "btn-warning" : "btn-success"}`}
                          onClick={() => handleToggleActif(u)}
                        >
                          {u.actif ? "Désactiver" : "Activer"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
