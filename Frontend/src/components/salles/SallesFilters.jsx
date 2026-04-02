/**
 * COMPONENT - Salles Filters
 *
 * Ce composant gere les filtres
 * appliques a la liste des salles.
 */
import { RefreshCw, Search } from "lucide-react";

export function SallesFilters({
  recherche,
  onRechercheChange,
  typeSelectionne,
  typesSalle = [],
  types = [],
  onTypeChange,
  totalAffiche,
  totalGlobal,
  onRecharger,
  surChargement,
}) {
  const listeTypes = typesSalle.length > 0 ? typesSalle : types;

  return (
    <div className="salles-filters">
      <div className="salles-filters-search">
        <Search />
        <input
          type="text"
          value={recherche}
          onChange={(event) => onRechercheChange(event.target.value)}
          placeholder="Rechercher par code ou type..."
        />
      </div>

      <select
        className="salles-filters-select"
        value={typeSelectionne}
        onChange={(event) => onTypeChange(event.target.value)}
      >
        <option value="tous">Tous les types</option>
        {listeTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <button
        type="button"
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
