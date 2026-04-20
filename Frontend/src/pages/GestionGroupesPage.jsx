/**
 * PAGE - Gestion des Groupes (Production-ready)
 *
 * Module complet de pilotage des groupes d'étudiants :
 * - Affichage réel de tous les groupes (programme, étape, capacité, statut horaire)
 * - Affichage réel des étudiants de chaque groupe
 * - Ajout manuel d'un étudiant avec session/annee auto-détectés
 * - Gestion des cours échoués à l'ajout
 * - Déplacement d'étudiants entre groupes compatibles
 * - Génération ciblée d'horaire par groupe ou par programme/étape
 * - Nettoyage des groupes vides
 */
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import { emettreSynchronisationPlanning } from "../utils/planningSync.js";
import {
  genererHoraireGroupe,
  genererParCriteres,
} from "../services/groupes.api.js";
import {
  OPTIMIZATION_MODE_OPTIONS,
  formaterLibelleModeOptimisation,
  resoudreOptionModeOptimisation,
} from "../utils/optimizationModes.js";
import "../styles/GestionGroupesPage.css";

// ─── helpers HTTP ─────────────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { credentials: "include", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erreur ${res.status}.`);
  return data;
}
const apiGet = (url) => apiFetch(url);
const apiPost = (url, body) =>
  apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const apiPut = (url, body) =>
  apiFetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const apiDel = (url) => apiFetch(url, { method: "DELETE" });

const CAPACITE_MAX = 30;

// ─── Composants utilitaires ───────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="gg-modal-overlay" onClick={onClose}>
      <div className="gg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gg-modal-header">
          <h2>{title}</h2>
          <button className="gg-modal-close" onClick={onClose} type="button">×</button>
        </div>
        <div className="gg-modal-body">{children}</div>
      </div>
    </div>
  );
}

function CapaciteBar({ effectif, max = CAPACITE_MAX }) {
  const pct = Math.min(100, Math.round((effectif / max) * 100));
  const cls = pct >= 100 ? "full" : pct >= 80 ? "high" : pct >= 50 ? "mid" : "low";
  return (
    <div className="gg-cap-bar">
      <div className={`gg-cap-fill gg-cap-fill--${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatutBadge({ aHoraire, effectif }) {
  if (effectif === 0) return <span className="gg-badge gg-badge--vide">Vide</span>;
  if (aHoraire) return <span className="gg-badge gg-badge--ok">✓ Horaire</span>;
  return <span className="gg-badge gg-badge--pending">Sans horaire</span>;
}

// ─── Formulaire cours échoués ─────────────────────────────────────────────────
function CoursEchouesInput({ cours, onChange }) {
  const [input, setInput] = useState("");

  function ajouter() {
    const code = input.trim().toUpperCase();
    if (!code) return;
    if (cours.some((c) => c.code === code)) {
      setInput("");
      return;
    }
    onChange([...cours, { code, note_echec: null }]);
    setInput("");
  }

  function supprimer(code) {
    onChange(cours.filter((c) => c.code !== code));
  }

  function updateNote(code, val) {
    onChange(cours.map((c) => c.code === code ? { ...c, note_echec: val === "" ? null : Number(val) } : c));
  }

  return (
    <div className="gg-cours-echoues">
      <div className="gg-ce-input-row">
        <input
          className="gg-input"
          placeholder="Code du cours (ex: INF101)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), ajouter())}
        />
        <button type="button" className="gg-btn-sm gg-btn-sm--add" onClick={ajouter}>+</button>
      </div>
      {cours.length > 0 && (
        <div className="gg-ce-list">
          {cours.map((c) => (
            <div key={c.code} className="gg-ce-item">
              <span className="gg-ce-code">{c.code}</span>
              <input
                className="gg-input gg-input--sm"
                type="number"
                min="0" max="100" step="0.5"
                placeholder="Note /100"
                value={c.note_echec ?? ""}
                onChange={(e) => updateNote(c.code, e.target.value)}
              />
              <button type="button" className="gg-btn-sm gg-btn-sm--danger" onClick={() => supprimer(c.code)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
export function GestionGroupesPage({ utilisateur, onLogout }) {
  const { showSuccess, showError, confirm } = usePopup();

  // ── State données ──
  const [groupes, setGroupes] = useState([]);
  const [etudiants, setEtudiants] = useState([]);           // tous les étudiants (pour ajout)
  const [etudiantsGroupe, setEtudiantsGroupe] = useState([]); // membres du groupe sélectionné
  const [cours, setCours] = useState([]);                   // catalogue cours (pour cours échoués)
  const [loading, setLoading] = useState(true);
  const [loadingEtudiants, setLoadingEtudiants] = useState(false);

  // ── State sélection + filtres ──
  const [selectedId, setSelectedId] = useState(null);
  const [onglet, setOnglet] = useState("membres");
  const [filtreProgr, setFiltreProgr] = useState("");
  const [filtreEtape, setFiltreEtape] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [search, setSearch] = useState("");

  // ── State génération ──
  const [genLoading, setGenLoading] = useState(false);
  const [genCibleLoading, setGenCibleLoading] = useState(false);
  const [genRapport, setGenRapport] = useState(null);
  const [genProgr, setGenProgr] = useState("");
  const [genEtape, setGenEtape] = useState("");
  const [generationMode, setGenerationMode] = useState("legacy");

  // ── State nettoyage ──
  const [nettoyageLoading, setNettoyageLoading] = useState(false);
  const [candidatsNettoyage, setCandidatsNettoyage] = useState(null);

  // ── Modals ──
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showAddEtudiant, setShowAddEtudiant] = useState(false);
  const [showDeplacer, setShowDeplacer] = useState(null); // id_etudiant

  // ── Formulaires ──
  const [newGroupe, setNewGroupe] = useState({ nom_groupe: "", programme: "", etape: "", taille_max: CAPACITE_MAX });
  const [newEtudiant, setNewEtudiant] = useState({
    nom: "", prenom: "", matricule: "", email: "", programme: "", etape: "",
    cours_echoues: [],
    avecCoursEchoues: false,
  });
  const [deplaceVers, setDeplaceVers] = useState("");
  const [addErr, setAddErr] = useState("");

  // ─── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => { charger(); }, []);

  useEffect(() => {
    if (selectedId) {
      chargerMembres(selectedId);
      setOnglet("membres");
      setGenRapport(null);
    } else {
      setEtudiantsGroupe([]);
    }
  }, [selectedId]);

  async function charger() {
    setLoading(true);
    try {
      const [gs, es, cs] = await Promise.all([
        apiGet("/api/groupes?details=1"),
        apiGet("/api/etudiants"),
        apiGet("/api/cours").catch(() => []),
      ]);
      setGroupes(Array.isArray(gs) ? gs : []);
      setEtudiants(Array.isArray(es) ? es : []);
      setCours(Array.isArray(cs) ? cs : []);
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function chargerMembres(id) {
    setLoadingEtudiants(true);
    try {
      const data = await apiGet(`/api/groupes/${id}/etudiants`);
      setEtudiantsGroupe(Array.isArray(data) ? data : []);
    } catch (e) {
      showError(e.message);
      setEtudiantsGroupe([]);
    } finally {
      setLoadingEtudiants(false);
    }
  }

  // ── Données dérivées ────────────────────────────────────────────────────────
  const groupeSelectionne = useMemo(
    () => groupes.find((g) => g.id_groupes_etudiants === selectedId) || null,
    [groupes, selectedId]
  );

  const groupesFiltres = useMemo(() => {
    return groupes.filter((g) => {
      if (filtreProgr && (g.programme || "").toUpperCase() !== filtreProgr.toUpperCase()) return false;
      if (filtreEtape && String(g.etape ?? "") !== filtreEtape) return false;
      if (filtreStatut === "vide" && (g.effectif || 0) > 0) return false;
      if (filtreStatut === "horaire" && !g.a_horaire) return false;
      if (filtreStatut === "pending" && g.a_horaire) return false;
      if (search && !(g.nom_groupe || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [groupes, filtreProgr, filtreEtape, filtreStatut, search]);

  const programmes = useMemo(() => [...new Set(groupes.map((g) => g.programme).filter(Boolean))].sort(), [groupes]);
  const etapes = useMemo(() => [...new Set(groupes.map((g) => String(g.etape ?? "")).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), [groupes]);

  const stats = useMemo(() => ({
    total: groupes.length,
    totalEtudiants: groupes.reduce((s, g) => s + Number(g.effectif || 0), 0),
    avecHoraire: groupes.filter((g) => g.a_horaire).length,
    complets: groupes.filter((g) => Number(g.effectif || 0) >= CAPACITE_MAX).length,
    vides: groupes.filter((g) => Number(g.effectif || 0) === 0).length,
  }), [groupes]);

  const etudiantsHorsGroupe = useMemo(() => {
    const ids = new Set(etudiantsGroupe.map((e) => e.id_etudiant));
    return etudiants.filter((e) => !ids.has(e.id_etudiant));
  }, [etudiants, etudiantsGroupe]);

  const groupesCompatibles = useMemo(() => {
    if (!groupeSelectionne) return [];
    return groupes.filter((g) => {
      if (g.id_groupes_etudiants === selectedId) return false;
      if (Number(g.effectif || 0) >= CAPACITE_MAX) return false;
      if (groupeSelectionne.programme && g.programme && groupeSelectionne.programme.toUpperCase() !== g.programme.toUpperCase()) return false;
      if (groupeSelectionne.etape != null && g.etape != null && String(groupeSelectionne.etape) !== String(g.etape)) return false;
      return true;
    });
  }, [groupes, groupeSelectionne, selectedId]);

  const etudiantADeplacer = showDeplacer
    ? etudiantsGroupe.find((e) => e.id_etudiant === showDeplacer)
    : null;
  const generationModeOption = resoudreOptionModeOptimisation(generationMode);

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function handleCreerGroupe(e) {
    e.preventDefault();
    if (!newGroupe.nom_groupe.trim()) return showError("Le nom du groupe est requis.");
    if (!newGroupe.programme.trim()) return showError("Le programme est requis.");
    try {
      await apiPost("/api/groupes/manuel", {
        ...newGroupe,
        taille_max: Math.min(Number(newGroupe.taille_max) || CAPACITE_MAX, CAPACITE_MAX),
      });
      showSuccess("Groupe créé !");
      setShowCreateGroup(false);
      setNewGroupe({ nom_groupe: "", programme: "", etape: "", taille_max: CAPACITE_MAX });
      charger();
    } catch (e) {
      showError(e.message);
    }
  }

  async function handleSupprimer(id, nom) {
    const ok = await confirm({
      title: "Supprimer ce groupe ?",
      message: `"${nom}" sera supprimé. Les étudiants perdront leur affectation de groupe.`,
      confirmLabel: "Supprimer", tone: "danger",
    });
    if (!ok) return;
    try {
      await apiDel(`/api/groupes/${id}`);
      showSuccess("Groupe supprimé.");
      if (selectedId === id) setSelectedId(null);
      charger();
    } catch (e) {
      showError(e.message);
    }
  }

  async function handleAjouterExistant(idEtudiant) {
    if (!selectedId) return;
    try {
      await apiPost(`/api/groupes/${selectedId}/etudiants`, { etudiantsIds: [idEtudiant] });
      showSuccess("Étudiant ajouté.");
      chargerMembres(selectedId);
      charger();
    } catch (e) {
      showError(e.message);
    }
  }

  async function handleRetirer(idEtudiant, nomEtud) {
    const ok = await confirm({ title: "Retirer cet étudiant ?", message: `${nomEtud} sera retiré de ce groupe.`, confirmLabel: "Retirer", tone: "danger" });
    if (!ok) return;
    try {
      await apiDel(`/api/groupes/${selectedId}/etudiants/${idEtudiant}`);
      showSuccess("Étudiant retiré.");
      chargerMembres(selectedId);
      charger();
    } catch (e) {
      showError(e.message);
    }
  }

  async function handleAjouterNouvelEtudiant(e) {
    e.preventDefault();
    setAddErr("");
    const { nom, prenom, matricule, email, programme, etape, cours_echoues } = newEtudiant;
    if (!nom.trim()) { setAddErr("Le nom est requis."); return; }
    if (!prenom.trim()) { setAddErr("Le prénom est requis."); return; }
    if (!matricule.trim()) { setAddErr("Le matricule est requis."); return; }

    const payload = {
      nom: nom.trim(),
      prenom: prenom.trim(),
      matricule: matricule.trim(),
      email: email.trim() || null,
      programme: programme.trim() || groupeSelectionne?.programme || "",
      etape: etape ? Number(etape) : (Number(groupeSelectionne?.etape) || 1),
      cours_echoues: newEtudiant.avecCoursEchoues ? cours_echoues : [],
    };

    try {
      const res = await apiPost(`/api/groupes/${selectedId}/etudiants/creer-ajouter`, payload);
      showSuccess(res.message || "Étudiant ajouté avec succès.");
      setShowAddEtudiant(false);
      setNewEtudiant({ nom: "", prenom: "", matricule: "", email: "", programme: "", etape: "", cours_echoues: [], avecCoursEchoues: false });
      setAddErr("");
      chargerMembres(selectedId);
      charger();
    } catch (err) {
      setAddErr(err.message);
    }
  }

  async function handleDeplacer(idEtudiant) {
    if (!deplaceVers) { showError("Sélectionnez un groupe cible."); return; }
    try {
      const idGroupeSource = Number(selectedId);
      const idGroupeCible = Number(deplaceVers);
      const res = await apiPut(`/api/groupes/${idGroupeSource}/etudiants/${idEtudiant}/deplacer`, {
        id_groupe_cible: idGroupeCible,
      });
      emettreSynchronisationPlanning({
        type: "deplacement_etudiant_groupe",
        ...(res.synchronisation || {}),
        etudiants_impactes: res.etudiants_impactes || [Number(idEtudiant)],
        groupes_impactes: res.groupes_impactes || [idGroupeSource, idGroupeCible],
      });
      showSuccess(res.message || "Etudiant deplace.");
      setShowDeplacer(null);
      setDeplaceVers("");
      setSelectedId(idGroupeCible);
      chargerMembres(idGroupeCible);
      charger();
    } catch (e) {
      showError(e.message);
    }
  }

  async function handleGenererGroupe() {
    if (!selectedId) return;
    const ok = await confirm({
      title: "Générer l'horaire de ce groupe ?",
      message: `Les séances existantes de "${groupeSelectionne?.nom_groupe}" seront remplacées. Les autres groupes restent intacts.`,
      confirmLabel: "Générer", tone: "primary",
    });
    if (!ok) return;
    setGenLoading(true);
    setGenRapport(null);
    try {
      const res = await genererHoraireGroupe(selectedId, {
        modeOptimisation: generationMode,
      });
      setGenRapport(res.rapport || res);
      showSuccess(res.message || "Horaire généré.");
      charger();
    } catch (e) {
      showError(e.message);
    } finally {
      setGenLoading(false);
    }
  }

  async function handleGenererCible(e) {
    e.preventDefault();
    if (!genProgr && !genEtape) { showError("Indiquez au moins un critère."); return; }
    setGenCibleLoading(true);
    setGenRapport(null);
    try {
      const payload = {};
      if (genProgr) payload.programme = genProgr;
      if (genEtape) payload.etape = genEtape;
      payload.modeOptimisation = generationMode;
      const res = await genererParCriteres(payload);
      setGenRapport(res);
      showSuccess(res.message);
      charger();
    } catch (e) {
      showError(e.message);
    } finally {
      setGenCibleLoading(false);
    }
  }

  async function handleNettoyagePreview() {
    setNettoyageLoading(true);
    setCandidatsNettoyage(null);
    try {
      const res = await apiPost("/api/groupes/nettoyer", { mode: "preview", inclure_vides: true });
      setCandidatsNettoyage(res.candidats || []);
    } catch (e) {
      showError(e.message);
    } finally {
      setNettoyageLoading(false);
    }
  }

  async function handleNettoyer() {
    const suppressibles = (candidatsNettoyage || []).filter((c) => c.nb_affectations === 0);
    if (!suppressibles.length) { showError("Aucun groupe supprimable."); return; }
    const ok = await confirm({ title: "Supprimer les groupes vides ?", message: `${suppressibles.length} groupe(s) sans étudiants ni horaires seront supprimés.`, confirmLabel: "Nettoyer", tone: "danger" });
    if (!ok) return;
    setNettoyageLoading(true);
    try {
      const res = await apiPost("/api/groupes/nettoyer", { mode: "suppression", inclure_vides: true });
      showSuccess(res.message);
      setCandidatsNettoyage(null);
      charger();
    } catch (e) {
      showError(e.message);
    } finally {
      setNettoyageLoading(false);
    }
  }

  // ─── RENDU ────────────────────────────────────────────────────────────────
  return (
    <AppShell utilisateur={utilisateur} onLogout={onLogout}
      title="Gestion des Groupes">
      <div className="gg-page">

        {/* ── Stats ── */}
        <div className="gg-stats-bar">
          <div className="gg-stat"><span className="gg-stat-num">{stats.total}</span><span className="gg-stat-lbl">Groupes</span></div>
          <div className="gg-stat"><span className="gg-stat-num">{stats.totalEtudiants}</span><span className="gg-stat-lbl">Étudiants</span></div>
          <div className="gg-stat gg-stat--green"><span className="gg-stat-num">{stats.avecHoraire}</span><span className="gg-stat-lbl">Avec horaire</span></div>
          <div className="gg-stat gg-stat--orange"><span className="gg-stat-num">{stats.complets}</span><span className="gg-stat-lbl">Complets</span></div>
          <div className="gg-stat gg-stat--red"><span className="gg-stat-num">{stats.vides}</span><span className="gg-stat-lbl">Vides</span></div>
          <div className="gg-stat-actions">
            <button className="gg-btn-primary" onClick={() => setShowCreateGroup(true)}>+ Nouveau groupe</button>
          </div>
        </div>

        <div className="gg-layout">

          {/* ══ COLONNE GAUCHE ══ */}
          <aside className="gg-col-left">
            <div className="gg-filters">
              <input className="gg-search" placeholder="Rechercher un groupe…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="gg-filter-row">
                <select className="gg-select" value={filtreProgr} onChange={(e) => setFiltreProgr(e.target.value)}>
                  <option value="">Tous programmes</option>
                  {programmes.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className="gg-select" value={filtreEtape} onChange={(e) => setFiltreEtape(e.target.value)}>
                  <option value="">Toutes étapes</option>
                  {etapes.map((et) => <option key={et} value={et}>Étape {et}</option>)}
                </select>
                <select className="gg-select" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
                  <option value="">Tous statuts</option>
                  <option value="horaire">Avec horaire</option>
                  <option value="pending">Sans horaire</option>
                  <option value="vide">Vides</option>
                </select>
              </div>
            </div>

            <div className="gg-groupes-list">
              {loading ? (
                <div className="gg-empty"><div className="gg-spinner" />Chargement…</div>
              ) : groupesFiltres.length === 0 ? (
                <div className="gg-empty"><span className="gg-empty-icon">👥</span><p>Aucun groupe.</p></div>
              ) : (
                groupesFiltres.map((g) => {
                  const eff = Number(g.effectif || 0);
                  const sel = selectedId === g.id_groupes_etudiants;
                  return (
                    <div key={g.id_groupes_etudiants}
                      className={`gg-groupe-card ${sel ? "gg-groupe-card--selected" : ""}`}
                      onClick={() => setSelectedId(g.id_groupes_etudiants)}>
                      <div className="gg-groupe-card-top">
                        <span className="gg-groupe-nom">{g.nom_groupe}</span>
                        <button className="gg-btn-icon-danger" title="Supprimer"
                          onClick={(ev) => { ev.stopPropagation(); handleSupprimer(g.id_groupes_etudiants, g.nom_groupe); }}>🗑️</button>
                      </div>
                      <div className="gg-groupe-meta">
                        {g.programme && <span className="gg-tag">{g.programme}</span>}
                        {g.etape != null && <span className="gg-tag gg-tag--etape">Étape {g.etape}</span>}
                        <StatutBadge aHoraire={!!g.a_horaire} effectif={eff} />
                      </div>
                      <div className="gg-groupe-cap">
                        <CapaciteBar effectif={eff} />
                        <span className="gg-cap-label">{eff}/{CAPACITE_MAX}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Nettoyage */}
            <div className="gg-cleanup-zone">
              <div className="gg-cleanup-header">🧹 Nettoyage groupes vides</div>
              {candidatsNettoyage !== null && (
                <div className="gg-cleanup-list">
                  {candidatsNettoyage.length === 0
                    ? <p className="gg-cleanup-ok">✅ Aucun groupe à nettoyer.</p>
                    : (<>
                      <p className="gg-cleanup-count">{candidatsNettoyage.length} groupe(s) vide(s)</p>
                      {candidatsNettoyage.slice(0, 4).map((c) => (
                        <div key={c.id_groupes_etudiants} className="gg-cleanup-item">
                          {c.nom_groupe}
                          {c.nb_affectations > 0 && <span className="gg-cleanup-warn"> (horaires → protégé)</span>}
                        </div>
                      ))}
                      {candidatsNettoyage.some((c) => c.nb_affectations === 0) && (
                        <button className="gg-btn-danger" onClick={handleNettoyer} disabled={nettoyageLoading}>
                          Supprimer les vides
                        </button>
                      )}
                    </>)
                  }
                </div>
              )}
              <button className="gg-btn-outline" onClick={handleNettoyagePreview} disabled={nettoyageLoading}>
                {nettoyageLoading ? "Analyse…" : "Analyser"}
              </button>
            </div>
          </aside>

          {/* ══ COLONNE DROITE ══ */}
          <section className="gg-col-right">
            {!selectedId ? (
              <div className="gg-no-selection">
                <div className="gg-no-sel-icon">👥</div>
                <h3>Sélectionnez un groupe</h3>
              </div>
            ) : (
              <>
                {/* En-tête */}
                <div className="gg-detail-header">
                  <div className="gg-detail-info">
                    <h2 className="gg-detail-nom">{groupeSelectionne?.nom_groupe}</h2>
                    <div className="gg-detail-meta">
                      {groupeSelectionne?.programme && <span className="gg-tag gg-tag--lg">{groupeSelectionne.programme}</span>}
                      {groupeSelectionne?.etape != null && <span className="gg-tag gg-tag--etape gg-tag--lg">Étape {groupeSelectionne.etape}</span>}
                      <span className="gg-detail-cap">{etudiantsGroupe.length}/{CAPACITE_MAX} membres</span>
                    </div>
                    <CapaciteBar effectif={etudiantsGroupe.length} />
                  </div>
                </div>

                {/* Onglets */}
                <div className="gg-detail-tabs">
                  {[
                    { id: "membres", label: `👥 Membres (${etudiantsGroupe.length})` },
                    { id: "ajouter", label: "➕ Ajouter" },
                    { id: "gen", label: "⚡ Générer" },
                  ].map((t) => (
                    <button key={t.id} className={`gg-tab ${onglet === t.id ? "gg-tab--active" : ""}`} onClick={() => setOnglet(t.id)}>{t.label}</button>
                  ))}
                </div>

                {/* ── Onglet MEMBRES ── */}
                {onglet === "membres" && (
                  <div className="gg-tab-content">
                    {loadingEtudiants
                      ? <div className="gg-empty"><div className="gg-spinner" />Chargement des membres…</div>
                      : etudiantsGroupe.length === 0
                        ? <div className="gg-empty"><span className="gg-empty-icon">📭</span><p>Aucun étudiant dans ce groupe.</p><button className="gg-btn-primary" onClick={() => setOnglet("ajouter")}>Ajouter un étudiant</button></div>
                        : (
                          <div className="gg-etudiants-list">
                            {etudiantsGroupe.map((e) => (
                              <div key={e.id_etudiant} className="gg-etudiant-row">
                                <div className="gg-etudiant-avatar">{(e.prenom?.[0] || "?").toUpperCase()}</div>
                                <div className="gg-etudiant-info">
                                  <strong>{e.prenom} {e.nom}</strong>
                                  <span>
                                    {e.matricule || "—"} · {e.programme || "—"} · Ét. {e.etape || "—"}
                                    {Number(e.nb_cours_echoues) > 0 && (
                                      <span className="gg-badge gg-badge--warn" style={{ marginLeft: "0.5rem" }}>
                                        ⚠️ {e.nb_cours_echoues} cours à reprendre
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="gg-etudiant-actions">
                                  <button className="gg-btn-sm gg-btn-sm--move" title="Déplacer" onClick={() => { setShowDeplacer(e.id_etudiant); setDeplaceVers(""); }}>⇄</button>
                                  <button className="gg-btn-sm gg-btn-sm--danger" title="Retirer" onClick={() => handleRetirer(e.id_etudiant, `${e.prenom} ${e.nom}`)}>✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                    }
                  </div>
                )}

                {/* ── Onglet AJOUTER ── */}
                {onglet === "ajouter" && (
                  <div className="gg-tab-content">
                    <div className="gg-ajouter-header">
                      <h4>Ajouter un étudiant</h4>
                      <button className="gg-btn-primary" style={{ fontSize: "0.85rem" }} onClick={() => { setAddErr(""); setShowAddEtudiant(true); }}>
                        + Créer un nouvel étudiant
                      </button>
                    </div>
                    {Number(groupeSelectionne?.effectif || etudiantsGroupe.length) >= CAPACITE_MAX ? (
                      <div className="gg-alert gg-alert--warning">⚠️ Ce groupe est complet ({CAPACITE_MAX}/{CAPACITE_MAX}).</div>
                    ) : (
                      <>
                        <div className="gg-etudiants-list">
                          {etudiantsHorsGroupe.slice(0, 100).map((e) => (
                            <div key={e.id_etudiant} className="gg-etudiant-row gg-etudiant-row--available">
                              <div className="gg-etudiant-avatar gg-etudiant-avatar--muted">{(e.prenom?.[0] || "?").toUpperCase()}</div>
                              <div className="gg-etudiant-info">
                                <strong>{e.prenom} {e.nom}</strong>
                                <span>{e.matricule || "—"} · {e.programme || "—"} · {e.id_groupe_principal ? "Dans un groupe" : "Sans groupe"}</span>
                              </div>
                              <button className="gg-btn-sm gg-btn-sm--add" onClick={() => handleAjouterExistant(e.id_etudiant)}>+</button>
                            </div>
                          ))}
                          {etudiantsHorsGroupe.length > 100 && <p className="gg-muted">{etudiantsHorsGroupe.length - 100} autres</p>}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Onglet GÉNÉRER ── */}
                {onglet === "gen" && (
                  <div className="gg-tab-content gg-gen-section">
                    <div className="gg-gen-card gg-gen-card--mode">
                      <h4>Mode d'optimisation</h4>
                      <div className="gg-form-row">
                        <div className="gg-form-group">
                          <label>Mode</label>
                          <select
                            className="gg-select gg-select--full"
                            value={generationMode}
                            onChange={(e) => setGenerationMode(e.target.value)}
                            disabled={genLoading || genCibleLoading}
                          >
                            {OPTIMIZATION_MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="gg-mode-note">
                        {generationModeOption.description}
                      </div>
                    </div>

                    <div className="gg-gen-card">
                      <h4>⚡ Générer l'horaire de ce groupe</h4>
                      {etudiantsGroupe.length === 0 && (
                        <div className="gg-alert gg-alert--warning">⚠️ Ajoutez des étudiants avant de générer.</div>
                      )}
                      <button className="gg-btn-generate" onClick={handleGenererGroupe} disabled={genLoading || etudiantsGroupe.length === 0}>
                        {genLoading ? <><span className="gg-spinner-sm" /> Génération…</> : "🚀 Générer cet horaire"}
                      </button>
                    </div>

                    <div className="gg-gen-card">
                      <h4>🎯 Génération ciblée (programme / étape)</h4>
                      <form className="gg-gen-form" onSubmit={handleGenererCible}>
                        <div className="gg-form-row">
                          <div className="gg-form-group">
                            <label>Programme</label>
                            <select className="gg-select" value={genProgr} onChange={(e) => setGenProgr(e.target.value)}>
                              <option value="">Tous les programmes</option>
                              {programmes.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                          <div className="gg-form-group">
                            <label>Étape</label>
                            <select className="gg-select" value={genEtape} onChange={(e) => setGenEtape(e.target.value)}>
                              <option value="">Toutes les étapes</option>
                              {etapes.map((et) => <option key={et} value={et}>Étape {et}</option>)}
                            </select>
                          </div>
                        </div>
                        <button type="submit" className="gg-btn-generate" disabled={genCibleLoading || (!genProgr && !genEtape)}>
                          {genCibleLoading ? <><span className="gg-spinner-sm" /> Génération…</> : "🎯 Lancer la génération ciblée"}
                        </button>
                      </form>
                    </div>

                    {genRapport && (
                      <div className="gg-gen-rapport">
                        <h4>📊 Rapport de génération</h4>
                        <div className="gg-rapport-stats">
                          <div className="gg-rstat gg-rstat--green">
                            <span>{genRapport.nb_cours_planifies ?? genRapport.total_planifies ?? 0}</span>
                            <label>Planifiées</label>
                          </div>
                          <div className="gg-rstat gg-rstat--red">
                            <span>{genRapport.nb_cours_non_planifies ?? genRapport.nb_groupes_erreur ?? 0}</span>
                            <label>Non planifiées</label>
                          </div>
                          {genRapport.score_qualite != null && (
                            <div className={`gg-rstat ${genRapport.score_qualite >= 70 ? "gg-rstat--green" : genRapport.score_qualite >= 40 ? "gg-rstat--orange" : "gg-rstat--red"}`}>
                              <span>{genRapport.score_qualite}</span>
                              <label>Score/100</label>
                            </div>
                          )}
                        </div>
                        <p className="gg-rapport-message">{genRapport.message}</p>
                        <div className="gg-mode-note gg-mode-note--report">
                          Mode utilise :{" "}
                          {formaterLibelleModeOptimisation(
                            genRapport?.details?.modeOptimisationUtilise ||
                              genRapport?.mode_optimisation_utilise ||
                              generationMode
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* ══ MODAL Créer groupe ══ */}
      <Modal open={showCreateGroup} onClose={() => setShowCreateGroup(false)} title="Créer un groupe">
        <form onSubmit={handleCreerGroupe} className="gg-form">
          <div className="gg-form-group">
            <label>Nom du groupe *</label>
            <input className="gg-input" required placeholder="ex: GPI-E1-4"
              value={newGroupe.nom_groupe} onChange={(e) => setNewGroupe({ ...newGroupe, nom_groupe: e.target.value })} />
          </div>
          <div className="gg-form-row">
            <div className="gg-form-group">
              <label>Programme *</label>
              <input className="gg-input" required placeholder="ex: Programmation informatique"
                value={newGroupe.programme} onChange={(e) => setNewGroupe({ ...newGroupe, programme: e.target.value })} />
            </div>
            <div className="gg-form-group">
              <label>Étape</label>
              <input className="gg-input" type="number" min="1" max="8" placeholder="ex: 1"
                value={newGroupe.etape} onChange={(e) => setNewGroupe({ ...newGroupe, etape: e.target.value })} />
            </div>
          </div>
          <div className="gg-form-group">
            <label>Capacité max (défaut: {CAPACITE_MAX})</label>
            <input className="gg-input" type="number" min="1" max={CAPACITE_MAX}
              value={newGroupe.taille_max} onChange={(e) => setNewGroupe({ ...newGroupe, taille_max: Math.min(CAPACITE_MAX, Number(e.target.value)) })} />
          </div>
          <div className="gg-form-actions">
            <button type="submit" className="gg-btn-primary">Créer le groupe</button>
            <button type="button" className="gg-btn-outline" onClick={() => setShowCreateGroup(false)}>Annuler</button>
          </div>
        </form>
      </Modal>

      {/* ══ MODAL Ajouter nouvel étudiant ══ */}
      <Modal open={showAddEtudiant} onClose={() => { setShowAddEtudiant(false); setAddErr(""); }} title={`Ajouter un étudiant — ${groupeSelectionne?.nom_groupe || ""}`}>
        <form onSubmit={handleAjouterNouvelEtudiant} className="gg-form">
          <div className="gg-form-row">
            <div className="gg-form-group">
              <label>Prénom *</label>
              <input className="gg-input" required value={newEtudiant.prenom}
                onChange={(e) => setNewEtudiant({ ...newEtudiant, prenom: e.target.value })} />
            </div>
            <div className="gg-form-group">
              <label>Nom *</label>
              <input className="gg-input" required value={newEtudiant.nom}
                onChange={(e) => setNewEtudiant({ ...newEtudiant, nom: e.target.value })} />
            </div>
          </div>
          <div className="gg-form-row">
            <div className="gg-form-group">
              <label>Matricule *</label>
              <input className="gg-input" required placeholder="ex: MAT20001"
                value={newEtudiant.matricule} onChange={(e) => setNewEtudiant({ ...newEtudiant, matricule: e.target.value })} />
            </div>
            <div className="gg-form-group">
              <label>Email</label>
              <input className="gg-input" type="email" placeholder="optionnel"
                value={newEtudiant.email} onChange={(e) => setNewEtudiant({ ...newEtudiant, email: e.target.value })} />
            </div>
          </div>
          <div className="gg-form-row">
            <div className="gg-form-group">
              <label>Programme</label>
              <input className="gg-input" placeholder={groupeSelectionne?.programme || "hérité du groupe"}
                value={newEtudiant.programme} onChange={(e) => setNewEtudiant({ ...newEtudiant, programme: e.target.value })} />
            </div>
            <div className="gg-form-group">
              <label>Étape</label>
              <input className="gg-input" type="number" min="1" max="8"
                placeholder={String(groupeSelectionne?.etape || 1)}
                value={newEtudiant.etape} onChange={(e) => setNewEtudiant({ ...newEtudiant, etape: e.target.value })} />
            </div>
          </div>

          {/* Cours échoués */}
          <div className="gg-form-group">
            <label className="gg-checkbox-label">
              <input type="checkbox" checked={newEtudiant.avecCoursEchoues}
                onChange={(e) => setNewEtudiant({ ...newEtudiant, avecCoursEchoues: e.target.checked, cours_echoues: [] })} />
              &nbsp;Cet étudiant a des cours échoués à reprendre
            </label>
          </div>

          {newEtudiant.avecCoursEchoues && (
            <div className="gg-form-group">
              <label>Cours échoués (saisir le code)</label>
              <CoursEchouesInput
                cours={newEtudiant.cours_echoues}
                onChange={(val) => setNewEtudiant({ ...newEtudiant, cours_echoues: val })}
              />
            </div>
          )}

          {addErr && <div className="gg-alert gg-alert--error">❌ {addErr}</div>}

          <div className="gg-form-actions">
            <button type="submit" className="gg-btn-primary">Ajouter l'étudiant</button>
            <button type="button" className="gg-btn-outline" onClick={() => { setShowAddEtudiant(false); setAddErr(""); }}>Annuler</button>
          </div>
        </form>
      </Modal>

      {/* ══ MODAL Déplacer étudiant ══ */}
      <Modal open={showDeplacer !== null} onClose={() => { setShowDeplacer(null); setDeplaceVers(""); }}
        title={`Déplacer ${etudiantADeplacer?.prenom || ""} ${etudiantADeplacer?.nom || ""}`}>
        <div className="gg-form">
          {groupesCompatibles.length === 0
            ? <div className="gg-alert gg-alert--warning">⚠️ Aucun groupe compatible disponible.</div>
            : (
              <>
                <div className="gg-form-group">
                  <label>Groupe cible *</label>
                  <select className="gg-select gg-select--full" value={deplaceVers} onChange={(e) => setDeplaceVers(e.target.value)}>
                    <option value="">Choisir un groupe…</option>
                    {groupesCompatibles.map((g) => (
                      <option key={g.id_groupes_etudiants} value={g.id_groupes_etudiants}>
                        {g.nom_groupe} ({Number(g.effectif || 0)}/{CAPACITE_MAX})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="gg-form-actions">
                  <button className="gg-btn-primary" disabled={!deplaceVers} onClick={() => handleDeplacer(showDeplacer)}>Déplacer</button>
                  <button className="gg-btn-outline" onClick={() => { setShowDeplacer(null); setDeplaceVers(""); }}>Annuler</button>
                </div>
              </>
            )}
        </div>
      </Modal>
    </AppShell>
  );
}
