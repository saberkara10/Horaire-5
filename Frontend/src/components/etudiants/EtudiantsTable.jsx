import {
  construireInitialesEtudiant,
  construireNomCompletEtudiant,
} from "../../utils/etudiants.utils.js";

/**
 * Tableau principal de consultation des etudiants.
 *
 * Chaque ligne sert aussi de point d'entree vers la fiche detaillee et
 * l'horaire reconstitue a droite.
 */
export function EtudiantsTable({
  etudiants,
  etudiantSelectionneId,
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
        <p>Chargement des etudiants...</p>
      </section>
    );
  }

  if (estEnErreur) {
    return (
      <section className="panel panel--centered">
        <h2>Connexion impossible au module etudiants</h2>
        <p>{messageErreur || "Le serveur n'a pas repondu correctement."}</p>
      </section>
    );
  }

  if (etudiants.length === 0) {
    return (
      <section className="panel panel--centered">
        <h2>Aucun etudiant a afficher</h2>
        <p>
          Importez un fichier Excel ou ajustez vos filtres pour afficher une liste
          d'etudiants.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="table-header">
        <div>
          <h2>Liste des etudiants</h2>
          <p>Vue de consultation rapide pour preparer la lecture des horaires.</p>
        </div>
        {surRafraichissement ? (
          <span className="status-pill status-pill--busy">Actualisation...</span>
        ) : null}
      </div>

      <div className="table-wrapper">
        <table className="teachers-table">
          <thead>
            <tr>
              <th>Etudiant</th>
              <th>Matricule</th>
              <th>Groupe</th>
              <th>Programme</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {etudiants.map((etudiant) => {
              const estSelectionne = etudiant.id_etudiant === etudiantSelectionneId;
              const estEnConsultation =
                actionEnCours === `consultation-${etudiant.id_etudiant}`;
              const groupeLibelle = etudiant.groupe || "Sans groupe";
              const nbReprises = Number(etudiant.nb_reprises || 0);
              const chargeCible = Number(etudiant.charge_cible || 0);
              const statut = !etudiant.groupe
                ? "Sans groupe"
                : nbReprises > 0
                  ? `${chargeCible} cours (${nbReprises} reprise${nbReprises > 1 ? "s" : ""})`
                  : `${chargeCible || 0} cours`;

              return (
                <tr
                  key={etudiant.id_etudiant}
                  className={estSelectionne ? "is-selected" : ""}
                  // Toute la ligne est cliquable pour accelerer la consultation
                  // dans une liste potentiellement volumineuse.
                  onClick={() => onSelectionner(etudiant.id_etudiant)}
                >
                  <td data-label="Etudiant">
                    <div className="teacher-identity">
                      <div className="teacher-avatar" aria-hidden="true">
                        {construireInitialesEtudiant(etudiant)}
                      </div>
                      <div>
                        <strong>{construireNomCompletEtudiant(etudiant)}</strong>
                        <span>Etape {etudiant.etape}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Matricule">{etudiant.matricule}</td>
                  <td data-label="Groupe">{groupeLibelle}</td>
                  <td data-label="Programme">{etudiant.programme}</td>
                  <td data-label="Statut">
                    <span className={`status-pill ${estEnConsultation ? "status-pill--busy" : ""}`}>
                      {estEnConsultation ? "Chargement..." : statut}
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
