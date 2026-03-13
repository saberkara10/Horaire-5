export function CoursHero({ statistiques, onAjouter, surChargement }) {
  return (
    <section className="hero-panel">
      <div className="hero-panel__copy">
        <p className="hero-panel__section">Gestion des horaires</p>
        <h1>Gestion des cours</h1>
        <p className="hero-panel__text">
          Consultez, filtrez et administrez les cours dans une interface serieuse,
          lisible et adaptee a la planification academique.
        </p>
      </div>

      <div className="hero-panel__actions">
        <button
          className="button button--primary"
          type="button"
          onClick={onAjouter}
          disabled={surChargement}
        >
          Ajouter un cours
        </button>
      </div>

      <div className="hero-panel__stats">
        <article className="stat-card">
          <span className="stat-card__label">Cours</span>
          <strong>{statistiques.total}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Programmes</span>
          <strong>{statistiques.programmes}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Types de salle</span>
          <strong>{statistiques.typesSalle}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Duree moyenne</span>
          <strong>{statistiques.dureeMoyenne} min</strong>
        </article>
      </div>
    </section>
  );
}
