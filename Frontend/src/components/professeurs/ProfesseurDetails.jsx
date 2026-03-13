import {
  construireInitiales,
  construireNomComplet,
} from "../../utils/professeurs.utils.js";

export function ProfesseurDetails({
  professeur,
  onEditer,
  onSupprimer,
  suppressionDesactivee,
  actionEnCours,
}) {
  if (!professeur) {
    return (
      <section className="panel panel--stacked">
        <h2>Selectionnez un professeur</h2>
        <p>
          Le panneau de droite affiche le detail du professeur selectionne ainsi
          que les actions d'edition et de suppression.
        </p>
      </section>
    );
  }

  return (
    <section className="panel panel--stacked">
      <div className="detail-card">
        <div className="detail-card__header">
          <div className="teacher-avatar teacher-avatar--large" aria-hidden="true">
            {construireInitiales(professeur)}
          </div>
          <div>
            <p className="eyebrow">Fiche professeur</p>
            <h2>{construireNomComplet(professeur)}</h2>
            <p className="detail-card__subtitle">{professeur.matricule}</p>
          </div>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Nom</dt>
            <dd>{professeur.nom}</dd>
          </div>
          <div>
            <dt>Prenom</dt>
            <dd>{professeur.prenom}</dd>
          </div>
          <div>
            <dt>Specialite</dt>
            <dd>{professeur.specialite || "Non renseignee"}</dd>
          </div>
          <div>
            <dt>Identifiant</dt>
            <dd>#{professeur.id_professeur}</dd>
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
            {actionEnCours === `suppression-${professeur.id_professeur}`
              ? "Suppression..."
              : "Supprimer"}
          </button>
        </div>
      </div>
    </section>
  );
}
