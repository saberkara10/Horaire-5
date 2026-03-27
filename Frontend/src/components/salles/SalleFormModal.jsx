import { useEffect, useState } from "react";
import { X } from "lucide-react";

const ETAT_INITIAL = {
  code: "",
  type: "",
  capacite: "30",
};

function normaliserValeurs(salle) {
  if (!salle) {
    return ETAT_INITIAL;
  }

  return {
    code: salle.code || "",
    type: salle.type || "",
    capacite: String(salle.capacite || "30"),
  };
}

export function SalleFormModal({
  estOuvert,
  mode,
  salle,
  onFermer,
  onSoumettre,
  actionEnCours,
}) {
  const [valeurs, setValeurs] = useState(ETAT_INITIAL);
  const [erreurLocale, setErreurLocale] = useState("");

  useEffect(() => {
    if (!estOuvert) {
      return;
    }

    setValeurs(normaliserValeurs(salle));
    setErreurLocale("");
  }, [estOuvert, salle]);

  if (!estOuvert) {
    return null;
  }

  function mettreAJourChamp(cle, valeur) {
    setValeurs((etatActuel) => ({
      ...etatActuel,
      [cle]: valeur,
    }));
  }

  async function gererSoumission(event) {
    event.preventDefault();
    setErreurLocale("");

    if (!valeurs.code.trim() || !valeurs.type.trim()) {
      setErreurLocale("Les champs code et type sont obligatoires.");
      return;
    }

    if (Number(valeurs.capacite) <= 0) {
      setErreurLocale("La capacite doit etre superieure a 0.");
      return;
    }

    await onSoumettre({
      code: valeurs.code.trim(),
      type: valeurs.type.trim(),
      capacite: Number(valeurs.capacite),
    }).catch((error) => {
      setErreurLocale(error.message);
    });
  }

  const titre = mode === "edition" ? "Modifier une salle" : "Ajouter une salle";
  const estEnTraitement =
    actionEnCours === "creation" || actionEnCours?.startsWith("modification-");

  return (
    <div className="modal-overlay" role="presentation" onClick={onFermer}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="salle-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="salle-form-title">
            {titre}
          </h2>
          <button type="button" onClick={onFermer} className="modal-close" aria-label="Fermer">
            <X />
          </button>
        </div>

        {erreurLocale ? <div className="modal-error">{erreurLocale}</div> : null}

        <form onSubmit={gererSoumission} className="modal-form">
          <div className="modal-form-row">
            <div className="modal-field">
              <label>Code</label>
              <input
                type="text"
                required
                maxLength={50}
                disabled={mode === "edition"}
                value={valeurs.code}
                onChange={(event) => mettreAJourChamp("code", event.target.value)}
                placeholder="A-101"
              />
            </div>

            <div className="modal-field">
              <label>Capacite</label>
              <input
                type="number"
                required
                min="1"
                value={valeurs.capacite}
                onChange={(event) => mettreAJourChamp("capacite", event.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          <div className="modal-field">
            <label>Type</label>
            <input
              type="text"
              required
              maxLength={50}
              value={valeurs.type}
              onChange={(event) => mettreAJourChamp("type", event.target.value)}
              placeholder="Laboratoire"
            />
          </div>

          <div className="modal-actions">
            <button type="submit" disabled={estEnTraitement} className="modal-submit">
              {estEnTraitement ? "Enregistrement..." : mode === "edition" ? "Modifier" : "Ajouter"}
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
