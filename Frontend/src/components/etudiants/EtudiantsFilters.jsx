/**
 * Barre de recherche et de filtrage de la liste etudiants.
 *
 * Les filtres restent purement declaratifs et travaillent sur la liste deja
 * chargee afin de garder une navigation immediate meme sur des imports larges.
 */
export function EtudiantsFilters({
  recherche,
  onRechercheChange,
  groupeSelectionne,
  groupes,
  onGroupeChange,
  programmeSelectionne,
  programmes,
  onProgrammeChange,
  sessionSelectionnee,
  sessions,
  onSessionChange,
  etapeSelectionnee,
  etapes,
  onEtapeChange,
  totalAffiche,
  totalGlobal,
  onRecharger,
  surChargement,
}) {
  return (
    <section className="panel">
      <div className="toolbar">
        <label className="field">
          <span>Recherche</span>
          <input
            type="search"
            placeholder="Nom, prenom, matricule, groupe ou programme"
            value={recherche}
            onChange={(event) => onRechercheChange(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Programme</span>
          <select
            value={programmeSelectionne}
            onChange={(event) => onProgrammeChange(event.target.value)}
          >
            <option value="tous">Tous les programmes</option>
            {programmes.map((programme) => (
              <option key={programme} value={programme}>
                {programme}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Session</span>
          <select
            value={sessionSelectionnee}
            onChange={(event) => onSessionChange(event.target.value)}
          >
            <option value="toutes">Toutes les sessions</option>
            {sessions.map((session) => (
              <option key={session} value={session}>
                {session || "Session non renseignee"}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Etape</span>
          <select
            value={etapeSelectionnee}
            onChange={(event) => onEtapeChange(event.target.value)}
          >
            <option value="toutes">Toutes les etapes</option>
            {etapes.map((etape) => (
              <option key={etape} value={String(etape)}>
                Etape {etape}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Groupe</span>
          <select
            value={groupeSelectionne}
            onChange={(event) => onGroupeChange(event.target.value)}
          >
            <option value="tous">Tous les groupes</option>
            {groupes.map((groupe) => (
              <option key={groupe} value={groupe}>
                {groupe}
              </option>
            ))}
          </select>
        </label>

        <div className="toolbar__summary">
          <span>
            {totalAffiche} sur {totalGlobal} etudiant(s)
          </span>
          <button
            className="button button--secondary"
            type="button"
            onClick={onRecharger}
            disabled={surChargement}
          >
            Actualiser
          </button>
        </div>
      </div>
    </section>
  );
}
