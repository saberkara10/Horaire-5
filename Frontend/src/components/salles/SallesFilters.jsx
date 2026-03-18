export function SallesFilters({
  recherche,
  onRechercheChange,
  typeSelectionne,
  typesSalle,
  onTypeChange,
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
            placeholder="Code, type ou capacite"
            value={recherche}
            onChange={(event) => onRechercheChange(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Type</span>
          <select
            value={typeSelectionne}
            onChange={(event) => onTypeChange(event.target.value)}
          >
            <option value="tous">Tous les types</option>
            {typesSalle.map((typeSalle) => (
              <option key={typeSalle} value={typeSalle}>
                {typeSalle}
              </option>
            ))}
          </select>
        </label>

        <div className="toolbar__summary">
          <span>
            {totalAffiche} sur {totalGlobal} salle(s)
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
