import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { getLibelleRoleFrontend } from "../utils/roles.js";
import "../styles/SchedulerPage.css";

async function apiGet(url) {
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur serveur.");
  return data;
}

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

async function apiPut(url, body) {
  const res = await fetch(url, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur serveur.");
  return data;
}

export function AdminResponsablePage({ utilisateur, onLogout }) {
  const [stats, setStats] = useState(null);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [onglet, setOnglet] = useState("stats");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    email: "",
    motdepasse: "",
    role: "ADMIN",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void charger();
  }, []);

  async function charger() {
    try {
      const [statistiques, comptes] = await Promise.allSettled([
        apiGet("/api/admin/statistiques"),
        apiGet("/api/admin/utilisateurs"),
      ]);

      if (statistiques.status === "fulfilled") {
        setStats(statistiques.value);
      }

      if (comptes.status === "fulfilled") {
        setUtilisateurs(comptes.value);
      }
    } catch {
      // ignore
    }
  }

  async function handleCreer(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await apiPost("/api/admin/utilisateurs", formData);
      setMessage({
        type: "success",
        text: `Compte cree pour ${formData.prenom} ${formData.nom}.`,
      });
      setShowForm(false);
      setFormData({
        nom: "",
        prenom: "",
        email: "",
        motdepasse: "",
        role: "ADMIN",
      });
      await charger();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActif(utilisateurItem) {
    try {
      await apiPut(`/api/admin/utilisateurs/${utilisateurItem.id_utilisateur}`, {
        actif: !utilisateurItem.actif,
      });
      setMessage({
        type: "success",
        text: `Compte ${!utilisateurItem.actif ? "active" : "desactive"} pour ${utilisateurItem.nom}.`,
      });
      await charger();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  }

  function renderRoleBadge(role) {
    if (role === "ADMIN_RESPONSABLE") {
      return <span className="badge-responsable">Administrateur principal</span>;
    }

    if (role === "ADMIN" || role === "RESPONSABLE") {
      return <span className="badge-admin">{getLibelleRoleFrontend(role)}</span>;
    }

    return <span className="badge-user">{getLibelleRoleFrontend(role)}</span>;
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Administration"
    >
      <div className="admin-page">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Administration generale</h1>
            <p className="admin-subtitle">
              Gestion des acces et supervision globale.
            </p>
          </div>
        </div>

        {message.text ? (
          <div
            className={`alert-${message.type}`}
            onClick={() => setMessage({ type: "", text: "" })}
          >
            {message.text}
          </div>
        ) : null}

        <div className="scheduler-tabs">
          {[
            { id: "stats", label: "Statistiques" },
            { id: "utilisateurs", label: "Comptes" },
          ].map((item) => (
            <button
              key={item.id}
              className={`scheduler-tab ${onglet === item.id ? "active" : ""}`}
              onClick={() => setOnglet(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {onglet === "stats" && stats ? (
          <div className="admin-stats-grid">
            <div className="admin-stat-card blue">
              <div className="stat-card-content">
                <h3>Utilisateurs</h3>
                <div className="stat-card-nums">
                  <div>
                    <span className="big-num">{stats.utilisateurs.total}</span>
                    Total
                  </div>
                  <div>
                    <span className="med-num">{stats.utilisateurs.admins}</span>
                    Admins
                  </div>
                  <div>
                    <span className="med-num">{stats.utilisateurs.responsables}</span>
                    Resp.
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-stat-card purple">
              <div className="stat-card-content">
                <h3>Donnees academiques</h3>
                <div className="stat-card-list">
                  <div>{stats.global.nb_cours} cours actifs</div>
                  <div>{stats.global.nb_professeurs} professeurs</div>
                  <div>{stats.global.nb_etudiants} etudiants</div>
                  <div>{stats.global.nb_salles} salles</div>
                  <div>{stats.global.nb_groupes} groupes</div>
                </div>
              </div>
            </div>

            <div className="admin-stat-card green">
              <div className="stat-card-content">
                <h3>Horaires</h3>
                <div>
                  <span className="big-num">{stats.global.nb_affectations}</span>
                  <span className="stat-label"> affectations actives</span>
                </div>
                {stats.dernier_rapport ? (
                  <div className="last-gen">
                    <span>Dernier score : </span>
                    <span
                      className={`score-inline ${
                        stats.dernier_rapport.score_qualite >= 70
                          ? "green"
                          : "orange"
                      }`}
                    >
                      {stats.dernier_rapport.score_qualite}/100
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="admin-stat-card red">
              <div className="stat-card-content">
                <h3>A traiter</h3>
                <div>
                  <span className="big-num">
                    {stats.global.cours_echoues_en_attente}
                  </span>
                  <span className="stat-label"> cours echoues en attente</span>
                </div>
                {stats.global.cours_echoues_en_attente > 0 ? (
                  <div className="alert-hint">
                    Regenerez l'horaire pour les traiter automatiquement.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {onglet === "utilisateurs" ? (
          <div className="admin-content">
            <div className="admin-users-header">
              <h2>Comptes ({utilisateurs.length})</h2>
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                + Nouveau compte
              </button>
            </div>

            {showForm ? (
              <form className="admin-user-form" onSubmit={handleCreer}>
                <h3>Creer un compte</h3>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Nom</label>
                    <input
                      required
                      type="text"
                      className="form-input"
                      value={formData.nom}
                      onChange={(event) =>
                        setFormData({ ...formData, nom: event.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Prenom</label>
                    <input
                      required
                      type="text"
                      className="form-input"
                      value={formData.prenom}
                      onChange={(event) =>
                        setFormData({ ...formData, prenom: event.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Email</label>
                    <input
                      required
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(event) =>
                        setFormData({ ...formData, email: event.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Mot de passe</label>
                    <input
                      required
                      type="password"
                      className="form-input"
                      value={formData.motdepasse}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          motdepasse: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Profil</label>
                    <select
                      className="form-select"
                      value={formData.role}
                      onChange={(event) =>
                        setFormData({ ...formData, role: event.target.value })
                      }
                    >
                      <option value="ADMIN">Administrateur</option>
                      <option value="ADMIN_RESPONSABLE">
                        Administrateur principal
                      </option>
                    </select>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Creation..." : "Creer"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowForm(false)}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            ) : null}

            <div className="admin-users-table">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Profil</th>
                    <th>Statut</th>
                    <th>Cree par</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {utilisateurs.map((utilisateurItem) => (
                    <tr
                      key={utilisateurItem.id_utilisateur}
                      className={!utilisateurItem.actif ? "inactive-row" : ""}
                    >
                      <td>
                        {utilisateurItem.prenom} {utilisateurItem.nom}
                      </td>
                      <td>{utilisateurItem.email}</td>
                      <td>{renderRoleBadge(utilisateurItem.role)}</td>
                      <td>
                        <span
                          className={`badge-statut ${
                            utilisateurItem.actif ? "actif" : "inactif"
                          }`}
                        >
                          {utilisateurItem.actif ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td>
                        {utilisateurItem.cree_par_prenom
                          ? `${utilisateurItem.cree_par_prenom} ${utilisateurItem.cree_par_nom}`
                          : "-"}
                      </td>
                      <td className="action-cell">
                        <button
                          className={`btn-sm ${
                            utilisateurItem.actif ? "btn-warning" : "btn-success"
                          }`}
                          onClick={() => handleToggleActif(utilisateurItem)}
                        >
                          {utilisateurItem.actif ? "Desactiver" : "Activer"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
