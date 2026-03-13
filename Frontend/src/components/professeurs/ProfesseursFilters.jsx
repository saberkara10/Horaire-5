export function ProfesseursFilters({
  recherche,
  onRechercheChange,
  specialiteSelectionnee,
  specialites,
  onSpecialiteChange,
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
            placeholder="Nom, prenom, matricule ou specialite"
            value={recherche}
            onChange={(event) => onRechercheChange(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Specialite</span>
          <select
            value={specialiteSelectionnee}
            onChange={(event) => onSpecialiteChange(event.target.value)}
          >
            <option value="toutes">Toutes les specialites</option>
            {specialites.map((specialite) => (
              <option key={specialite} value={specialite}>
                {specialite}
              </option>
            ))}
          </select>
        </label>

        <div className="toolbar__summary">
          <span>
            {totalAffiche} sur {totalGlobal} professeur(s)
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
