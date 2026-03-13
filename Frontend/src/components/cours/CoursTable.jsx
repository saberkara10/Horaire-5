import { construireLibelleCours } from "../../utils/cours.utils.js";

export function CoursTable({
  cours,
  coursSelectionneId,
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
        <p>Chargement des cours...</p>
      </section>
    );
  }

  if (estEnErreur) {
    return (
      <section className="panel panel--centered">
        <h2>Connexion impossible au module cours</h2>
        <p>{messageErreur || "Le serveur n'a pas repondu correctement."}</p>
      </section>
    );
  }

  if (cours.length === 0) {
    return (
      <section className="panel panel--centered">
        <h2>Aucun cours a afficher</h2>
        <p>
          Aucun resultat ne correspond aux criteres actuels. Ajoutez un cours ou
          ajustez vos filtres.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="table-header">
        <div>
          <h2>Liste des cours</h2>
          <p>Vue operationnelle pour la consultation et la gestion pedagogique.</p>
        </div>
        {surRafraichissement ? (
          <span className="status-pill status-pill--busy">Actualisation...</span>
        ) : null}
      </div>

      <div className="table-wrapper">
        <table className="teachers-table">
          <thead>
            <tr>
              <th>Cours</th>
              <th>Programme</th>
              <th>Etape</th>
              <th>Type de salle</th>
              <th>Duree</th>
            </tr>
          </thead>
          <tbody>
            {cours.map((element) => {
              const estSelectionne = element.id_cours === coursSelectionneId;
              const estEnAction =
                actionEnCours === `modification-${element.id_cours}` ||
                actionEnCours === `suppression-${element.id_cours}`;

              return (
                <tr
                  key={element.id_cours}
                  className={estSelectionne ? "is-selected" : ""}
                  onClick={() => onSelectionner(element.id_cours)}
                >
                  <td data-label="Cours">
                    <div className="course-identity">
                      <div>
                        <strong>{construireLibelleCours(element)}</strong>
                        <span>ID #{element.id_cours}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Programme">{element.programme}</td>
                  <td data-label="Etape">Etape {element.etape_etude}</td>
                  <td data-label="Type de salle">{element.type_salle}</td>
                  <td data-label="Duree">
                    <span className={`status-pill ${estEnAction ? "status-pill--busy" : ""}`}>
                      {estEnAction ? "Mise a jour..." : `${element.duree} min`}
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
