import { useEffect, useState } from "react";

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

  const titre = mode === "creation" ? "Ajouter une salle" : "Modifier la salle";
  const libelleBouton =
    mode === "creation" ? "Creer la salle" : "Enregistrer les modifications";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onFermer}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="salle-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-card__header">
          <div>
            <p className="eyebrow">Gestion des horaires</p>
            <h2 id="salle-form-title">{titre}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onFermer} aria-label="Fermer">
            x
          </button>
        </header>

        <form className="form-grid" onSubmit={gererSoumission}>
          <label className="field">
            <span>Code</span>
            <input
              type="text"
              value={valeurs.code}
              maxLength={50}
              disabled={mode === "edition"}
              onChange={(event) => mettreAJourChamp("code", event.target.value)}
            />
          </label>

          <label className="field">
            <span>Type</span>
            <input
              type="text"
              value={valeurs.type}
              maxLength={50}
              onChange={(event) => mettreAJourChamp("type", event.target.value)}
            />
          </label>

          <label className="field field--full">
            <span>Capacite</span>
            <input
              type="number"
              min="1"
              value={valeurs.capacite}
              onChange={(event) => mettreAJourChamp("capacite", event.target.value)}
            />
          </label>

          {erreurLocale ? (
            <p className="feedback-banner feedback-banner--error field--full">{erreurLocale}</p>
          ) : null}

          <div className="modal-card__footer field--full">
            <button className="button button--ghost" type="button" onClick={onFermer}>
              Annuler
            </button>
            <button className="button button--primary" type="submit">
              {actionEnCours === "creation" || actionEnCours?.startsWith("modification-")
                ? "Enregistrement..."
                : libelleBouton}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
