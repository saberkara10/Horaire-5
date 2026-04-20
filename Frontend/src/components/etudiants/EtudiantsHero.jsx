/**
 * En-tete de la page etudiants avec statistiques de synthese.
 *
 * Les indicateurs affiches ici permettent de verifier rapidement
 * l'etat global des etudiants et de leurs horaires.
 */
export function EtudiantsHero({ statistiques }) {
  return (
    <section className="hero-panel">
      <div className="hero-panel__copy">
        <p className="hero-panel__section">Gestion des horaires</p>
        <h1>Gestion des etudiants</h1>
        <p className="hero-panel__text">
          Consultez la liste des etudiants et retrouvez rapidement leur horaire
          personnel fusionne : groupe principal, reprises et exceptions
          individuelles.
        </p>
      </div>

      <div className="hero-panel__stats">
        <article className="stat-card">
          <span className="stat-card__label">Etudiants</span>
          <strong>{statistiques.total}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Groupes</span>
          <strong>{statistiques.groupes}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Programmes</span>
          <strong>{statistiques.programmes}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Etapes</span>
          <strong>{statistiques.etapes}</strong>
        </article>
      </div>
    </section>
  );
}
