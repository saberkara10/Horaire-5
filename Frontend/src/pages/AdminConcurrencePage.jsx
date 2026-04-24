import { useEffect, useMemo, useState } from "react";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import { recupererEtatConcurrenceAdmin } from "../services/concurrency.api.js";
import { getLibelleRoleFrontend } from "../utils/roles.js";
import "../styles/AdminConcurrencePage.css";

function formaterDate(valeur) {
  if (!valeur) {
    return "-";
  }

  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valeur));
}

function nomUtilisateur(ligne) {
  return [ligne.user_prenom, ligne.user_nom].filter(Boolean).join(" ").trim() || "-";
}

export function AdminConcurrencePage() {
  const [etat, setEtat] = useState({ users: [], locks: [], wait_queue: [] });
  const [chargement, setChargement] = useState(true);
  const { showError } = usePopup();

  async function chargerEtat() {
    try {
      const data = await recupererEtatConcurrenceAdmin();
      setEtat({
        users: Array.isArray(data?.users) ? data.users : [],
        locks: Array.isArray(data?.locks) ? data.locks : [],
        wait_queue: Array.isArray(data?.wait_queue) ? data.wait_queue : [],
      });
    } catch (error) {
      showError(error.message || "Impossible de charger la supervision.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerEtat();
    const intervalId = window.setInterval(chargerEtat, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const stats = useMemo(
    () => ({
      utilisateurs: etat.users.length,
      verrous: etat.locks.length,
      attentes: etat.wait_queue.filter((item) => item.status === "en_attente")
        .length,
    }),
    [etat]
  );

  return (
    <div className="admin-concurrency">
      <div className="admin-concurrency__toolbar">
        <div className="admin-concurrency__stats">
          <span>{stats.utilisateurs} utilisateurs</span>
          <span>{stats.verrous} verrous actifs</span>
          <span>{stats.attentes} en attente</span>
        </div>
        <button type="button" onClick={chargerEtat}>
          Recharger
        </button>
      </div>

      {chargement ? (
        <p className="admin-concurrency__state">Chargement...</p>
      ) : (
        <>
          <section className="admin-concurrency__section">
            <h2>Utilisateurs connectes</h2>
            <div className="admin-concurrency__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prenom</th>
                    <th>Courriel</th>
                    <th>Role</th>
                    <th>Connexion</th>
                    <th>Derniere activite</th>
                    <th>Module</th>
                    <th>Statut</th>
                    <th>Ressource verrouillee</th>
                  </tr>
                </thead>
                <tbody>
                  {etat.users.length === 0 ? (
                    <tr>
                      <td colSpan="9">Aucun utilisateur connecte.</td>
                    </tr>
                  ) : (
                    etat.users.map((user) => (
                      <tr key={user.id_presence}>
                        <td>{user.user_nom || "-"}</td>
                        <td>{user.user_prenom || "-"}</td>
                        <td>{user.user_email || "-"}</td>
                        <td>{getLibelleRoleFrontend(user.user_role)}</td>
                        <td>{formaterDate(user.connected_at)}</td>
                        <td>{formaterDate(user.last_activity_at)}</td>
                        <td>{user.current_module || user.current_page || "-"}</td>
                        <td>
                          <span className="admin-concurrency__badge">
                            {user.status || "actif"}
                          </span>
                        </td>
                        <td>
                          {user.resource_type
                            ? `${user.resource_type}:${user.resource_id}`
                            : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-concurrency__grid">
            <div className="admin-concurrency__section">
              <h2>Verrous actifs</h2>
              <div className="admin-concurrency__list">
                {etat.locks.length === 0 ? (
                  <p>Aucun verrou actif.</p>
                ) : (
                  etat.locks.map((lock) => (
                    <article key={lock.id_lock} className="admin-concurrency__item">
                      <strong>
                        {lock.resource_type}:{lock.resource_id}
                      </strong>
                      <span>{nomUtilisateur(lock)}</span>
                      <small>Expire le {formaterDate(lock.expires_at)}</small>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="admin-concurrency__section">
              <h2>Files d'attente</h2>
              <div className="admin-concurrency__list">
                {etat.wait_queue.length === 0 ? (
                  <p>Aucune attente active.</p>
                ) : (
                  etat.wait_queue.map((item) => (
                    <article key={item.id_queue} className="admin-concurrency__item">
                      <strong>
                        {item.resource_type}:{item.resource_id}
                      </strong>
                      <span>{nomUtilisateur(item)}</span>
                      <small>
                        {item.status} depuis {formaterDate(item.requested_at)}
                      </small>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
