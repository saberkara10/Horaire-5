import {
  construireInitiales,
  construireNomComplet,
} from "../../utils/professeurs.utils.js";

export function ProfesseursTable({
  professeurs,
  professeurSelectionneId,
  onSelectionner,
  actionEnCours,
  surChargement,
  surRafraichissement,
  estEnErreur,
  messageErreur,
}) {
  if (surChargement) {
    return (
      <section className="panel panel--centered">
        <div className="loader" aria-hidden="true" />
        <p>Chargement des professeurs...</p>
      </section>
    );
  }

  if (estEnErreur) {
    return (
      <section className="panel panel--centered">
        <h2>Connexion impossible au module professeurs</h2>
        <p>{messageErreur || "Le serveur n'a pas repondu correctement."}</p>
      </section>
    );
  }

  if (professeurs.length === 0) {
    return (
      <section className="panel panel--centered">
        <h2>Aucun professeur a afficher</h2>
        <p>
          Aucun resultat ne correspond aux criteres actuels. Ajoutez un professeur
          ou modifiez vos filtres.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="table-header">
        <div>
          <h2>Liste des professeurs</h2>
          <p>Vue operationnelle pour la consultation et la gestion rapide.</p>
        </div>
        {surRafraichissement ? (
          <span className="status-pill status-pill--busy">Actualisation...</span>
        ) : null}
      </div>

      <div className="table-wrapper">
        <table className="teachers-table">
          <thead>
            <tr>
              <th>Professeur</th>
              <th>Matricule</th>
              <th>Specialite</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {professeurs.map((professeur) => {
              const estSelectionne = professeur.id_professeur === professeurSelectionneId;
              const estEnAction =
                actionEnCours === `modification-${professeur.id_professeur}` ||
                actionEnCours === `suppression-${professeur.id_professeur}`;

              return (
                <tr
                  key={professeur.id_professeur}
                  className={estSelectionne ? "is-selected" : ""}
                  onClick={() => onSelectionner(professeur.id_professeur)}
                >
                  <td data-label="Professeur">
                    <div className="teacher-identity">
                      <div className="teacher-avatar" aria-hidden="true">
                        {construireInitiales(professeur)}
                      </div>
                      <div>
                        <strong>{construireNomComplet(professeur)}</strong>
                        <span>ID #{professeur.id_professeur}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Matricule">{professeur.matricule}</td>
                  <td data-label="Specialite">
                    {professeur.specialite || "Non renseignee"}
                  </td>
                  <td data-label="Statut">
                    <span className={`status-pill ${estEnAction ? "status-pill--busy" : ""}`}>
                      {estEnAction ? "Mise a jour..." : "Disponible"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
