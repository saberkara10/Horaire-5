export function ProfesseursHero({ statistiques, onAjouter, surChargement }) {
  return (
    <section className="hero-panel">
      <div className="hero-panel__copy">
        <p className="hero-panel__section">Gestion des horaires</p>
        <h1>Gestion des professeurs</h1>
        <p className="hero-panel__text">
          Consultez et administrez les enseignants dans une interface claire,
          structurée et adaptee a un environnement collegial.
        </p>
      </div>

      <div className="hero-panel__actions">
        <button
          className="button button--primary"
          type="button"
          onClick={onAjouter}
          disabled={surChargement}
        >
          Ajouter un professeur
        </button>
      </div>

      <div className="hero-panel__stats">
        <article className="stat-card">
          <span className="stat-card__label">Professeurs</span>
          <strong>{statistiques.total}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Specialites</span>
          <strong>{statistiques.specialites}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Profils complets</span>
          <strong>{statistiques.avecSpecialite}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">A completer</span>
          <strong>{statistiques.sansSpecialite}</strong>
        </article>
      </div>
    </section>
  );
}
