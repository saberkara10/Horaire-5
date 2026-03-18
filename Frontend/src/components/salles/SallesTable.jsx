import { construireLibelleSalle } from "../../utils/salles.utils.js";

export function SallesTable({
  salles,
  salleSelectionneeId,
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
        <p>Chargement des salles...</p>
      </section>
    );
  }

  if (estEnErreur) {
    return (
      <section className="panel panel--centered">
        <h2>Connexion impossible au module salles</h2>
        <p>{messageErreur || "Le serveur n'a pas repondu correctement."}</p>
      </section>
    );
  }

  if (salles.length === 0) {
    return (
      <section className="panel panel--centered">
        <h2>Aucune salle a afficher</h2>
        <p>
          Aucune salle ne correspond aux criteres actuels. Ajoutez une salle ou
          ajustez vos filtres.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="table-header">
        <div>
          <h2>Liste des salles</h2>
          <p>Vue operationnelle des espaces disponibles pour la planification.</p>
        </div>
        {surRafraichissement ? (
          <span className="status-pill status-pill--busy">Actualisation...</span>
        ) : null}
      </div>

      <div className="table-wrapper">
        <table className="teachers-table">
          <thead>
            <tr>
              <th>Salle</th>
              <th>Type</th>
              <th>Capacite</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {salles.map((salle) => {
              const estSelectionnee = salle.id_salle === salleSelectionneeId;
              const estEnAction =
                actionEnCours === `modification-${salle.id_salle}` ||
                actionEnCours === `suppression-${salle.id_salle}`;

              return (
                <tr
                  key={salle.id_salle}
                  className={estSelectionnee ? "is-selected" : ""}
                  onClick={() => onSelectionner(salle.id_salle)}
                >
                  <td data-label="Salle">
                    <div className="course-identity">
                      <div>
                        <strong>{construireLibelleSalle(salle)}</strong>
                        <span>ID #{salle.id_salle}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Type">{salle.type}</td>
                  <td data-label="Capacite">{salle.capacite} places</td>
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
