import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, GitCompareArrows, History, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import {
  archiverGenerationHoraire,
  comparerGenerationsHoraires,
  dupliquerGenerationHoraire,
  mettreAJourGenerationHoraire,
  recupererGenerationHoraire,
  recupererGenerationsHoraires,
  restaurerGenerationHoraire,
} from "../services/scheduleGenerations.api.js";
import "../styles/ScheduleGenerationsPage.css";

function formaterDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(status, isActive) {
  if (isActive) {
    return "Actif";
  }

  if (status === "restored") {
    return "Restaure";
  }

  if (status === "archived") {
    return "Archive";
  }

  if (status === "draft") {
    return "Brouillon";
  }

  return status || "-";
}

function getMetricValue(metrics, key, fallback = 0) {
  const value = metrics?.[key];
  return value === null || value === undefined ? fallback : value;
}

function formatScore(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(2);
}

function shortUserName(generation) {
  return [generation?.created_by_prenom, generation?.created_by_nom]
    .filter(Boolean)
    .join(" ")
    .trim() || "-";
}

export function ScheduleGenerationsPage() {
  const [generations, setGenerations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [compareId, setCompareId] = useState("");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const { confirm, showError, showSuccess, showInfo } = usePopup();

  async function chargerListe() {
    setLoading(true);
    try {
      const data = await recupererGenerationsHoraires();
      const rows = Array.isArray(data) ? data : [];
      setGenerations(rows);
      setSelectedId((current) => current || rows[0]?.id_generation || null);
    } catch (error) {
      showError(error.message || "Impossible de charger l'historique.");
    } finally {
      setLoading(false);
    }
  }

  async function chargerDetail(idGeneration) {
    if (!idGeneration) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    try {
      const data = await recupererGenerationHoraire(idGeneration);
      setDetail(data);
      setNoteDraft(data?.notes || "");
    } catch (error) {
      setDetail(null);
      showError(error.message || "Impossible de charger la generation.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    chargerListe();
  }, []);

  useEffect(() => {
    if (selectedId) {
      chargerDetail(selectedId);
    }
  }, [selectedId]);

  const selectedSummary = useMemo(
    () => generations.find((item) => Number(item.id_generation) === Number(selectedId)) || null,
    [generations, selectedId]
  );

  async function handleComparer(idGeneration) {
    const rightId = Number(compareId || idGeneration || 0);
    if (!selectedId || !rightId || Number(selectedId) === rightId) {
      showInfo("Selectionnez deux versions differentes a comparer.");
      return;
    }

    setCompareLoading(true);
    try {
      const result = await comparerGenerationsHoraires(selectedId, rightId);
      setComparison(result);
    } catch (error) {
      showError(error.message || "Comparaison impossible.");
    } finally {
      setCompareLoading(false);
    }
  }

  async function handleSauverNote() {
    if (!detail) {
      return;
    }

    setSavingNote(true);
    try {
      const updated = await mettreAJourGenerationHoraire(detail.id_generation, {
        notes: noteDraft,
        generation_name: detail.generation_name,
      });
      setDetail(updated);
      setGenerations((current) =>
        current.map((item) =>
          item.id_generation === updated.id_generation
            ? { ...item, notes: updated.notes, generation_name: updated.generation_name }
            : item
        )
      );
      showSuccess("La note a ete enregistree.");
    } catch (error) {
      showError(error.message || "Impossible d'enregistrer la note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDupliquer(idGeneration) {
    try {
      const duplicated = await dupliquerGenerationHoraire(idGeneration);
      await chargerListe();
      setSelectedId(duplicated?.id_generation || null);
      showSuccess("La generation a ete dupliquee.");
    } catch (error) {
      showError(error.message || "Duplication impossible.");
    }
  }

  async function handleArchiver(idGeneration) {
    const accepted = await confirm({
      title: "Archiver cette version ?",
      message: "La version restera disponible dans l'historique, mais ne pourra plus etre marquee active.",
      confirmLabel: "Archiver",
      cancelLabel: "Annuler",
      tone: "danger",
    });

    if (!accepted) {
      return;
    }

    try {
      await archiverGenerationHoraire(idGeneration);
      await chargerListe();
      if (selectedId === idGeneration) {
        await chargerDetail(idGeneration);
      }
      showSuccess("La generation a ete archivee.");
    } catch (error) {
      showError(error.message || "Archivage impossible.");
    }
  }

  async function handleRestaurer(idGeneration) {
    try {
      const preview = await restaurerGenerationHoraire(idGeneration, {
        confirm: false,
      });
      const differences = preview?.comparison?.changes || {};
      const validation = preview?.validation || {};
      const warningCount = (validation.warningIssues || []).length;
      const blockingCount = (validation.blockingIssues || []).length;

      const accepted = await confirm({
        title: "Restaurer cette version ?",
        message:
          `${differences.movedCourses?.length || 0} cours deplaces, ` +
          `${differences.changedTeachers?.length || 0} changements de professeur, ` +
          `${differences.changedRooms?.length || 0} changements de salle. ` +
          `${warningCount} avertissement(s), ${blockingCount} blocage(s).`,
        confirmLabel: "Restaurer",
        cancelLabel: "Annuler",
        tone: "danger",
      });

      if (!accepted) {
        return;
      }

      const restored = await restaurerGenerationHoraire(idGeneration, {
        confirm: true,
      });

      await chargerListe();
      await chargerDetail(restored?.generation?.id_generation || idGeneration);
      setSelectedId(restored?.generation?.id_generation || idGeneration);
      showSuccess("La version a ete appliquee comme horaire actif.");
    } catch (error) {
      showError(error.message || "Restauration impossible.");
    }
  }

  return (
    <div className="schedule-generations">
      <section className="schedule-generations__hero">
        <div>
          <p className="schedule-generations__eyebrow">Administration</p>
          <h1>Historique des generations</h1>
          <p>
            Chaque generation sauvegardee peut etre relue, comparee, dupliquee
            et restauree sans casser le moteur actuel.
          </p>
        </div>
        <button type="button" className="schedule-generations__refresh" onClick={chargerListe}>
          <RefreshCw size={17} />
          Rafraichir
        </button>
      </section>

      <section className="schedule-generations__stats">
        <article>
          <span>Total versions</span>
          <strong>{generations.length}</strong>
        </article>
        <article>
          <span>Version active</span>
          <strong>{generations.find((item) => item.is_active)?.version_number || "-"}</strong>
        </article>
        <article>
          <span>Score actif</span>
          <strong>{formatScore(generations.find((item) => item.is_active)?.quality_score)}</strong>
        </article>
      </section>

      <div className="schedule-generations__layout">
        <section className="schedule-generations__table-panel">
          <div className="schedule-generations__panel-head">
            <h2>Versions sauvegardees</h2>
            <div className="schedule-generations__compare-inline">
              <select value={compareId} onChange={(event) => setCompareId(event.target.value)}>
                <option value="">Comparer avec...</option>
                {generations
                  .filter((item) => Number(item.id_generation) !== Number(selectedId))
                  .map((item) => (
                    <option key={item.id_generation} value={item.id_generation}>
                      V{item.version_number} - {item.generation_name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="schedule-generations__secondary"
                onClick={() => handleComparer(compareId)}
                disabled={!selectedId || !compareId || compareLoading}
              >
                <GitCompareArrows size={16} />
                Comparer
              </button>
            </div>
          </div>

          <div className="schedule-generations__table-wrap">
            <table className="schedule-generations__table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Nom</th>
                  <th>Creation</th>
                  <th>Utilisateur</th>
                  <th>Statut</th>
                  <th>Score</th>
                  <th>Conflits</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="schedule-generations__empty">Chargement...</td>
                  </tr>
                ) : generations.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="schedule-generations__empty">Aucune generation sauvegardee.</td>
                  </tr>
                ) : (
                  generations.map((generation) => (
                    <tr
                      key={generation.id_generation}
                      className={Number(selectedId) === Number(generation.id_generation) ? "is-selected" : ""}
                    >
                      <td>V{generation.version_number}</td>
                      <td>
                        <strong>{generation.generation_name}</strong>
                        <span>{generation.session_nom}</span>
                      </td>
                      <td>{formaterDate(generation.created_at)}</td>
                      <td>{shortUserName(generation)}</td>
                      <td>
                        <span className={`schedule-generations__status schedule-generations__status--${generation.status}`}>
                          {getStatusLabel(generation.status, generation.is_active)}
                        </span>
                      </td>
                      <td>{formatScore(generation.quality_score)}</td>
                      <td>{generation.conflict_count}</td>
                      <td>
                        <div className="schedule-generations__actions">
                          <button type="button" onClick={() => setSelectedId(generation.id_generation)}>
                            <Eye size={15} />
                            Voir
                          </button>
                          <button type="button" onClick={() => handleComparer(generation.id_generation)}>
                            <GitCompareArrows size={15} />
                            Comparer
                          </button>
                          <button type="button" onClick={() => handleRestaurer(generation.id_generation)}>
                            <History size={15} />
                            Restaurer
                          </button>
                          <button type="button" onClick={() => handleDupliquer(generation.id_generation)}>
                            <Copy size={15} />
                            Dupliquer
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiver(generation.id_generation)}
                            disabled={generation.is_active}
                          >
                            <ShieldAlert size={15} />
                            Archiver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="schedule-generations__detail-panel">
          <div className="schedule-generations__panel-head">
            <h2>Detail de version</h2>
            {selectedSummary ? <span>V{selectedSummary.version_number}</span> : null}
          </div>

          {detailLoading ? (
            <div className="schedule-generations__detail-empty">Chargement du detail...</div>
          ) : !detail ? (
            <div className="schedule-generations__detail-empty">Selectionnez une version.</div>
          ) : (
            <>
              <div className="schedule-generations__detail-card">
                <h3>{detail.generation_name}</h3>
                <p>{formaterDate(detail.created_at)} par {shortUserName(detail)}</p>
                <div className="schedule-generations__metrics-grid">
                  <div><strong>{detail.placement_count}</strong><span>Seances</span></div>
                  <div><strong>{detail.teacher_count}</strong><span>Professeurs</span></div>
                  <div><strong>{detail.room_count}</strong><span>Salles</span></div>
                  <div><strong>{detail.group_count}</strong><span>Groupes</span></div>
                  <div><strong>{detail.student_count}</strong><span>Etudiants</span></div>
                  <div><strong>{detail.conflict_count}</strong><span>Conflits</span></div>
                </div>
              </div>

              <div className="schedule-generations__detail-card">
                <div className="schedule-generations__note-head">
                  <h3>Note interne</h3>
                  <button type="button" onClick={handleSauverNote} disabled={savingNote}>
                    <Save size={15} />
                    Enregistrer
                  </button>
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Ajouter un commentaire administratif sur cette generation..."
                />
              </div>

              <div className="schedule-generations__detail-card">
                <h3>Metriques</h3>
                <ul className="schedule-generations__metric-list">
                  <li>Score actif: <strong>{formatScore(detail.quality_score)}</strong></li>
                  <li>Score global equilibre: <strong>{formatScore(getMetricValue(detail.metrics, "score_global_equilibre", "-"))}</strong></li>
                  <li>Score global mode etudiant: <strong>{formatScore(getMetricValue(detail.metrics, "score_global_etudiant", "-"))}</strong></li>
                  <li>Score global mode professeur: <strong>{formatScore(getMetricValue(detail.metrics, "score_global_professeur", "-"))}</strong></li>
                  <li>Score etudiant reel: <strong>{formatScore(getMetricValue(detail.metrics, "score_etudiant_selectionne", "-"))}</strong></li>
                  <li>Score professeur reel: <strong>{formatScore(getMetricValue(detail.metrics, "score_professeur_selectionne", "-"))}</strong></li>
                  <li>Score groupe reel: <strong>{formatScore(getMetricValue(detail.metrics, "score_groupe_selectionne", "-"))}</strong></li>
                  <li>Cours non planifies: <strong>{getMetricValue(detail.metrics, "nb_cours_non_planifies", 0)}</strong></li>
                  <li>Resolutions manuelles: <strong>{getMetricValue(detail.metrics, "nb_resolutions_manuelles", 0)}</strong></li>
                </ul>
              </div>

              <div className="schedule-generations__detail-card">
                <h3>Conflits et blocages</h3>
                {detail.conflicts.length === 0 ? (
                  <p className="schedule-generations__muted">Aucun conflit sauvegarde.</p>
                ) : (
                  <div className="schedule-generations__issue-list">
                    {detail.conflicts.slice(0, 10).map((conflict) => (
                      <article key={conflict.id_generation_conflict}>
                        <span>{conflict.conflict_code || conflict.conflict_category}</span>
                        <strong>{conflict.label}</strong>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="schedule-generations__detail-card">
                <h3>Apercu des seances</h3>
                <div className="schedule-generations__placement-list">
                  {detail.placements.slice(0, 12).map((placement) => (
                    <article key={placement.id_generation_item}>
                      <strong>{placement.payload?.code_cours || placement.id_cours}</strong>
                      <span>
                        {(placement.payload?.group_names || []).join(", ") || "Groupe non renseigne"}
                      </span>
                      <small>
                        {placement.date_cours} • {String(placement.heure_debut || "").slice(0, 5)}-{String(placement.heure_fin || "").slice(0, 5)}
                      </small>
                    </article>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      <section className="schedule-generations__comparison-panel">
        <div className="schedule-generations__panel-head">
          <h2>Comparaison</h2>
          {comparison ? (
            <span>
              V{comparison.left.version_number} vs V{comparison.right.version_number}
            </span>
          ) : null}
        </div>

        {!comparison ? (
          <div className="schedule-generations__detail-empty">
            Selectionnez deux versions pour obtenir le resume des differences.
          </div>
        ) : (
          <div className="schedule-generations__comparison-grid">
            <article>
              <span>Seances</span>
              <strong>{comparison.comparison.overview.left.placement_count} → {comparison.comparison.overview.right.placement_count}</strong>
            </article>
            <article>
              <span>Conflits</span>
              <strong>{comparison.comparison.overview.left.conflict_count} → {comparison.comparison.overview.right.conflict_count}</strong>
            </article>
            <article>
              <span>Salles</span>
              <strong>{comparison.comparison.overview.left.room_count} → {comparison.comparison.overview.right.room_count}</strong>
            </article>
            <article>
              <span>Professeurs</span>
              <strong>{comparison.comparison.overview.left.teacher_count} → {comparison.comparison.overview.right.teacher_count}</strong>
            </article>

            <div className="schedule-generations__comparison-list">
              <h3>Changements detectes</h3>
              <ul>
                <li>{comparison.comparison.changes.added.length} seance(s) ajoutee(s)</li>
                <li>{comparison.comparison.changes.removed.length} seance(s) retiree(s)</li>
                <li>{comparison.comparison.changes.movedCourses.length} cours deplaces</li>
                <li>{comparison.comparison.changes.changedTeachers.length} changements de professeur</li>
                <li>{comparison.comparison.changes.changedRooms.length} changements de salle</li>
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
