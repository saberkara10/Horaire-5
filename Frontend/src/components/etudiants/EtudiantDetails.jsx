import {
  construireInitialesEtudiant,
  construireNomCompletEtudiant,
} from "../../utils/etudiants.utils.js";

/**
 * Panneau de detail d'un etudiant.
 *
 * Il combine la fiche de l'etudiant et un apercu de l'horaire retrouve via
 * son groupe. L'horaire reste affiche separement pour rappeler qu'il ne vient
 * pas du fichier d'import, mais du lien groupe -> affectations de cours.
 */
export function EtudiantDetails({
  consultation,
  actionEnCours,
  chargementConsultation,
  onRechargerHoraire,
}) {
  if (!consultation?.etudiant) {
    return (
      <section className="panel panel--stacked">
        <h2>Selectionnez un etudiant</h2>
        <p>
          Le panneau de droite affiche la fiche de l'etudiant selectionne ainsi
          qu'un apercu de l'horaire retrouve via son groupe.
        </p>
      </section>
    );
  }

  const { etudiant, horaire } = consultation;
  const consultationEnCours =
    chargementConsultation || actionEnCours === `consultation-${etudiant.id_etudiant}`;

  return (
    <section className="panel panel--stacked">
      <div className="detail-card">
        <div className="detail-card__header">
          <div className="teacher-avatar teacher-avatar--large" aria-hidden="true">
            {construireInitialesEtudiant(etudiant)}
          </div>
          <div>
            <p className="eyebrow">Fiche etudiant</p>
            <h2>{construireNomCompletEtudiant(etudiant)}</h2>
            <p className="detail-card__subtitle">{etudiant.matricule}</p>
          </div>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Nom</dt>
            <dd>{etudiant.nom}</dd>
          </div>
          <div>
            <dt>Prenom</dt>
            <dd>{etudiant.prenom}</dd>
          </div>
          <div>
            <dt>Groupe</dt>
            <dd>{etudiant.groupe}</dd>
          </div>
          <div>
            <dt>Etape</dt>
            <dd>Etape {etudiant.etape}</dd>
          </div>
          <div>
            <dt>Programme</dt>
            <dd>{etudiant.programme}</dd>
          </div>
          <div>
            <dt>Identifiant</dt>
            <dd>#{etudiant.id_etudiant}</dd>
          </div>
        </dl>

        <div className="detail-card__section">
          <div className="table-header">
            <div>
              <h2>Horaire du groupe</h2>
              <p>
                {horaire === null
                  ? `Chargement de l'horaire du groupe ${etudiant.groupe}...`
                  : `${horaire.length} seance(s) retrouvee(s) pour ${etudiant.groupe}.`}
              </p>
            </div>
            <button
              className="button button--secondary"
              type="button"
              onClick={onRechargerHoraire}
              disabled={consultationEnCours}
            >
              {consultationEnCours ? "Actualisation..." : "Recharger"}
            </button>
          </div>

          {horaire === null ? (
            <div className="schedule-preview schedule-preview--pending">
              <div className="loader" aria-hidden="true" />
            </div>
          ) : horaire.length === 0 ? (
            <p className="detail-card__subtitle">
              Aucun horaire planifie n'est encore associe a ce groupe.
            </p>
          ) : (
            <ul className="schedule-preview">
              {horaire.map((seance) => (
                <li
                  key={`${seance.id_affectation_cours}-${seance.id_plage_horaires}`}
                  className="schedule-preview__item"
                >
                  <strong>{seance.code_cours} - {seance.nom_cours}</strong>
                  <span>
                    {seance.date} | {seance.heure_debut} a {seance.heure_fin}
                  </span>
                  <span>
                    {seance.nom_professeur} {seance.prenom_professeur} | Salle {seance.code_salle}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
