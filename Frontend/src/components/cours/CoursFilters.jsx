export function CoursFilters({
  recherche,
  onRechercheChange,
  programmeSelectionne,
  programmes,
  onProgrammeChange,
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
      <div className="toolbar toolbar--courses">
        <label className="field">
          <span>Recherche</span>
          <input
            type="search"
            placeholder="Code, nom, programme, etape ou type de salle"
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
          <span>Etape</span>
          <select
            value={etapeSelectionnee}
            onChange={(event) => onEtapeChange(event.target.value)}
          >
            <option value="toutes">Toutes les etapes</option>
            {etapes.map((etape) => (
              <option key={etape} value={etape}>
                Etape {etape}
              </option>
            ))}
          </select>
        </label>

        <div className="toolbar__summary">
          <span>
            {totalAffiche} sur {totalGlobal} cours
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
