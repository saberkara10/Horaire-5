/**
 * En-tete de la page etudiants avec statistiques de synthese.
 *
 * Les indicateurs affiches ici permettent de verifier rapidement l'effet
 * d'un import sans devoir parcourir toute la liste.
 */
export function EtudiantsHero({ statistiques, onImporter, importEnCours, surChargement }) {
  return (
    <section className="hero-panel">
      <div className="hero-panel__copy">
        <p className="hero-panel__section">Gestion des horaires</p>
        <h1>Gestion des etudiants</h1>
        <p className="hero-panel__text">
          Importez un fichier Excel fourni par l'administration, consultez la liste
          des etudiants et retrouvez rapidement leur horaire personnel fusionne :
          tronc commun du groupe principal, reprises et exceptions individuelles.
        </p>
      </div>

      <div className="hero-panel__actions">
        <button
          className="button button--primary"
          type="button"
          onClick={onImporter}
          disabled={surChargement || importEnCours}
        >
          {importEnCours ? "Import en cours..." : "Importer un fichier"}
        </button>
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
