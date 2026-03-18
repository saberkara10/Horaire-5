import { RefreshCw, Search } from "lucide-react";


export function SallesFilters({
  recherche,
  onRechercheChange,
  typeSelectionne,
  types,
  onTypeChange,
  totalAffiche,
  totalGlobal,
  onRecharger,
  surChargement,
}) {
  return (
    <div className="salles-filters">
      <div className="salles-filters-search">
        <Search />
        <input
          type="text"
          value={recherche}
          onChange={(e) => onRechercheChange(e.target.value)}
          placeholder="Rechercher par code ou type..."
        />
      </div>

      <select
        className="salles-filters-select"
        value={typeSelectionne}
        onChange={(e) => onTypeChange(e.target.value)}
      >
        <option value="tous">Tous les types</option>
        {types.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>

      <button
        onClick={onRecharger}
        disabled={surChargement}
        className={`salles-filters-refresh ${surChargement ? "loading" : ""}`}
      >
        <RefreshCw />
      </button>

      <span className="salles-filters-count">
        {totalAffiche} / {totalGlobal} salles
      </span>
    </div>
  );
}