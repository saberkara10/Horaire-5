import { Edit2, Trash2 } from "lucide-react";


export function SallesTable({
  salles,
  salleSelectionneeId,
  onSelectionner,
  onEditer,
  onSupprimer,
  actionEnCours,
  surChargement,
  estEnErreur,
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
        <div className="salles-table-error">Erreur lors du chargement des salles.</div>
      </div>
    );
  }

  if (salles.length === 0) {
    return (
      <div className="salles-table-container">
        <div className="salles-table-empty">Aucune salle trouvée</div>
      </div>
    );
  }

  return (
    <div className="salles-table-container">
      <table className="salles-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Type</th>
            <th>Capacité</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {salles.map((salle) => (
            <tr
              key={salle.id_salle}
              onClick={() => onSelectionner(salle.id_salle)}
              className={salle.id_salle === salleSelectionneeId ? "selected" : ""}
            >
              <td className="code">{salle.code}</td>
              <td>{salle.type}</td>
              <td>{salle.capacite} places</td>
              <td>
                <div className="salles-table-actions">
                  <button
                    className="edit-button"
                    onClick={(e) => { e.stopPropagation(); onEditer(salle); }}
                    disabled={actionEnCours !== ""}
                  >
                    <Edit2 />
                  </button>
                  <button
                    className="delete-button"
                    onClick={(e) => { e.stopPropagation(); onSupprimer(salle); }}
                    disabled={actionEnCours !== ""}
                  >
                    <Trash2 />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}