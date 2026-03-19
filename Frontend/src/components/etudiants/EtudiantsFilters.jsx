/**
 * Barre de recherche et de filtrage de la liste etudiants.
 *
 * Le filtre groupe reste volontairement simple pour couvrir le besoin actuel
 * sans alourdir l'interface avec une recherche avancee.
 */
export function EtudiantsFilters({
  recherche,
  onRechercheChange,
  groupeSelectionne,
  groupes,
  onGroupeChange,
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
