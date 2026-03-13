import { construireLibelleCours } from "../../utils/cours.utils.js";

export function CoursDetails({
  cours,
  onEditer,
  onSupprimer,
  suppressionDesactivee,
  actionEnCours,
}) {
  if (!cours) {
    return (
      <section className="panel panel--stacked">
        <h2>Selectionnez un cours</h2>
        <p>
          Le panneau de droite affiche la fiche du cours selectionne ainsi que
          les actions d'edition et de suppression.
        </p>
      </section>
    );
  }

  return (
    <section className="panel panel--stacked">
      <div className="detail-card">
        <div className="detail-card__header detail-card__header--stacked">
          <div>
            <p className="eyebrow">Fiche cours</p>
            <h2>{construireLibelleCours(cours)}</h2>
            <p className="detail-card__subtitle">{cours.programme}</p>
          </div>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Code</dt>
            <dd>{cours.code}</dd>
          </div>
          <div>
            <dt>Nom</dt>
            <dd>{cours.nom}</dd>
          </div>
          <div>
            <dt>Duree</dt>
            <dd>{cours.duree} minutes</dd>
          </div>
          <div>
            <dt>Etape d'etude</dt>
            <dd>Etape {cours.etape_etude}</dd>
          </div>
          <div>
            <dt>Programme</dt>
            <dd>{cours.programme}</dd>
          </div>
          <div>
            <dt>Type de salle</dt>
            <dd>{cours.type_salle}</dd>
          </div>
        </dl>

        <div className="detail-card__actions">
          <button className="button button--secondary" type="button" onClick={onEditer}>
            Modifier
          </button>
          <button
            className="button button--danger"
            type="button"
            onClick={onSupprimer}
            disabled={suppressionDesactivee}
          >
            {actionEnCours === `suppression-${cours.id_cours}`
              ? "Suppression..."
              : "Supprimer"}
          </button>
        </div>
      </div>
    </section>
  );
}
