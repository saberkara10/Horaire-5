/**
 * COMPONENT - Salle Form Modal
 *
 * Ce composant affiche le formulaire modal
 * de creation et modification des salles.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";


export function SalleFormModal({
  estOuvert,
  mode,
  salle,
  onFermer,
  onSoumettre,
  actionEnCours,
}) {
  const [formData, setFormData] = useState({
    code: "",
    type: "",
    capacite: "",
  });
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (mode === "edition" && salle) {
      setFormData({
        code: salle.code,
        type: salle.type,
        capacite: salle.capacite.toString(),
      });
    } else {
      setFormData({ code: "", type: "", capacite: "" });
    }
    setErreur("");
  }, [estOuvert, mode, salle]);

  if (!estOuvert) {
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur("");

    try {
      await onSoumettre({
        code: formData.code,
        type: formData.type,
        capacite: parseInt(formData.capacite),
      });
    } catch (error) {
      setErreur(error.message);
    }
  }

  const estEnTraitement = actionEnCours === "creation" || actionEnCours.startsWith("modification");

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === "edition" ? "Modifier" : "Ajouter"} une salle
          </h2>
          <button onClick={onFermer} className="modal-close">
            <X />
          </button>
        </div>

        {erreur && <div className="modal-error">{erreur}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-form-row">
            <div className="modal-field">
              <label>Code</label>
              <input
                type="text"
                required
                disabled={mode === "edition"}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="A-101"
              />
            </div>
            <div className="modal-field">
              <label>Capacité</label>
              <input
                type="number"
                required
                min="1"
                value={formData.capacite}
                onChange={(e) => setFormData({ ...formData, capacite: e.target.value })}
                placeholder="30"
              />
            </div>
          </div>

          <div className="modal-field">
            <label>Type</label>
            <select
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="">Sélectionner un type</option>
              <option value="Amphithéâtre">Amphithéâtre</option>
              <option value="Salle de cours">Salle de cours</option>
              <option value="Laboratoire">Laboratoire</option>
              <option value="Salle informatique">Salle informatique</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="submit" disabled={estEnTraitement} className="modal-submit">
              {estEnTraitement ? "En cours..." : mode === "edition" ? "Modifier" : "Ajouter"}
            </button>
            <button type="button" onClick={onFermer} className="modal-cancel">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
/**
 * COMPONENT - Salle Form Modal
 *
 * Ce composant affiche le formulaire modal
 * de creation et modification des salles.
 */
