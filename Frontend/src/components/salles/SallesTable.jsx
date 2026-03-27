import { Edit2, Trash2 } from "lucide-react";
import { construireLibelleSalle } from "../../utils/salles.utils.js";

export function SallesTable({
  salles,
  salleSelectionneeId,
  onSelectionner,
  onEditer,
  onSupprimer,
  actionEnCours,
  surChargement,
  surRafraichissement,
  estEnErreur,
  messageErreur,
}) {
  if (surChargement) {
    return (
      <div className="salles-table-container">
        <div className="salles-table-loading">Chargement des salles...</div>
      </div>
    );
  }

  if (estEnErreur) {
    return (
      <div className="salles-table-container">
        <div className="salles-table-error">
          {messageErreur || "Erreur lors du chargement des salles."}
        </div>
      </div>
    );
  }

  if (salles.length === 0) {
    return (
      <div className="salles-table-container">
        <div className="salles-table-empty">Aucune salle trouvee</div>
      </div>
    );
  }

  return (
    <div className="salles-table-container">
      {surRafraichissement ? (
        <div className="salles-table-loading">Actualisation...</div>
      ) : null}

      <table className="salles-table">
        <thead>
          <tr>
            <th>Salle</th>
            <th>Type</th>
            <th>Capacite</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {salles.map((salle) => {
            const estSelectionnee = salle.id_salle === salleSelectionneeId;
            const actionsDesactivees = actionEnCours !== "";

            return (
              <tr
                key={salle.id_salle}
                onClick={() => onSelectionner(salle.id_salle)}
                className={estSelectionnee ? "selected" : ""}
              >
                <td className="code">{construireLibelleSalle(salle)}</td>
                <td>{salle.type}</td>
                <td>{salle.capacite} places</td>
                <td>
                  <div className="salles-table-actions">
                    <button
                      type="button"
                      className="edit-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditer?.(salle);
                      }}
                      disabled={actionsDesactivees}
                    >
                      <Edit2 />
                    </button>
                    <button
                      type="button"
                      className="delete-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSupprimer?.(salle);
                      }}
                      disabled={actionsDesactivees}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
