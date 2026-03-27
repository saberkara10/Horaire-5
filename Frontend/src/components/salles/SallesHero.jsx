import { Plus } from "lucide-react";

export function SallesHero({ statistiques, onAjouter, surChargement }) {
  return (
    <div className="salles-hero">
      <div>
        <h1 className="salles-hero-title">Gestion des salles</h1>
        <p className="salles-hero-subtitle">
          Administrez les espaces et leurs capacites
        </p>
        <div className="salles-hero-stats">
          <div className="salles-hero-stat">
            <span className="salles-hero-stat-value">
              {surChargement ? "..." : statistiques.total}
            </span>{" "}
            salles
          </div>
          <div className="salles-hero-stat">
            <span className="salles-hero-stat-value">
              {surChargement ? "..." : statistiques.types}
            </span>{" "}
            types
          </div>
          <div className="salles-hero-stat">
            <span className="salles-hero-stat-value">
              {surChargement ? "..." : statistiques.capaciteTotale}
            </span>{" "}
            places totales
          </div>
          <div className="salles-hero-stat">
            <span className="salles-hero-stat-value">
              {surChargement ? "..." : statistiques.capaciteMoyenne}
            </span>{" "}
            places en moyenne
          </div>
        </div>
      </div>
      <button onClick={onAjouter} className="salles-hero-button" disabled={surChargement}>
        <Plus />
        Ajouter une salle
      </button>
    </div>
  );
}
