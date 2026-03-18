export function SallesHero({ statistiques, onAjouter, surChargement }) {
  return (
    <section className="hero-panel">
      <div className="hero-panel__copy">
        <p className="hero-panel__section">Gestion des horaires</p>
        <h1>Gestion des salles</h1>
        <p className="hero-panel__text">
          Consultez, organisez et mettez a jour les salles disponibles pour la
          planification des cours.
        </p>
      </div>

      <div className="hero-panel__actions">
        <button
          className="button button--primary"
          type="button"
          onClick={onAjouter}
          disabled={surChargement}
        >
          Ajouter une salle
        </button>
      </div>

      <div className="hero-panel__stats">
        <article className="stat-card">
          <span className="stat-card__label">Salles</span>
          <strong>{statistiques.total}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Types</span>
          <strong>{statistiques.types}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Capacite totale</span>
          <strong>{statistiques.capaciteTotale}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Capacite moyenne</span>
          <strong>{statistiques.capaciteMoyenne}</strong>
        </article>
      </div>
    </section>
  );
}
