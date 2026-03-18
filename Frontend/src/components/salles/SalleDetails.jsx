import { construireLibelleSalle } from "../../utils/salles.utils.js";

export function SalleDetails({
  salle,
  onEditer,
  onSupprimer,
  suppressionDesactivee,
  actionEnCours,
}) {
  if (!salle) {
    return (
      <section className="panel panel--stacked">
        <h2>Selectionnez une salle</h2>
        <p>
          Le panneau de droite affiche la fiche de la salle selectionnee ainsi
          que les actions d'edition et de suppression.
        </p>
      </section>
    );
  }

  return (
    <section className="panel panel--stacked">
      <div className="detail-card">
        <div className="detail-card__header detail-card__header--stacked">
          <div>
            <p className="eyebrow">Fiche salle</p>
            <h2>{construireLibelleSalle(salle)}</h2>
            <p className="detail-card__subtitle">{salle.capacite} places</p>
          </div>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Code</dt>
            <dd>{salle.code}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{salle.type}</dd>
          </div>
          <div>
            <dt>Capacite</dt>
            <dd>{salle.capacite} places</dd>
          </div>
          <div>
            <dt>Identifiant</dt>
            <dd>#{salle.id_salle}</dd>
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
            {actionEnCours === `suppression-${salle.id_salle}`
              ? "Suppression..."
              : "Supprimer"}
          </button>
        </div>
      </div>
    </section>
  );
}
