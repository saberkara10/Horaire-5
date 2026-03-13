import { useEffect, useState } from "react";

const ETAT_INITIAL = {
  code: "",
  nom: "",
  duree: "45",
  programme: "",
  etape_etude: "1",
  type_salle: "",
};

function normaliserValeurs(cours) {
  if (!cours) {
    return ETAT_INITIAL;
  }

  return {
    code: cours.code || "",
    nom: cours.nom || "",
    duree: String(cours.duree || "45"),
    programme: cours.programme || "",
    etape_etude: String(cours.etape_etude || "1"),
    type_salle: cours.type_salle || "",
  };
}

export function CoursFormModal({
  estOuvert,
  mode,
  cours,
  typesSalleDisponibles,
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

    setValeurs(normaliserValeurs(cours));
    setErreurLocale("");
  }, [estOuvert, cours]);

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

    if (
      !valeurs.code.trim() ||
      !valeurs.nom.trim() ||
      !valeurs.programme.trim() ||
      !valeurs.type_salle.trim()
    ) {
      setErreurLocale("Les champs code, nom, programme et type de salle sont obligatoires.");
      return;
    }

    if (Number(valeurs.duree) <= 0) {
      setErreurLocale("La duree doit etre superieure a 0.");
      return;
    }

    await onSoumettre({
      code: valeurs.code.trim(),
      nom: valeurs.nom.trim(),
      duree: Number(valeurs.duree),
      programme: valeurs.programme.trim(),
      etape_etude: Number(valeurs.etape_etude),
      type_salle: valeurs.type_salle.trim(),
    }).catch((error) => {
      setErreurLocale(error.message);
    });
  }

  const titre = mode === "creation" ? "Ajouter un cours" : "Modifier le cours";
  const libelleBouton =
    mode === "creation" ? "Creer le cours" : "Enregistrer les modifications";
  const aucunTypeSalleDisponible = typesSalleDisponibles.length === 0;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onFermer}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cours-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-card__header">
          <div>
            <p className="eyebrow">Gestion des horaires</p>
            <h2 id="cours-form-title">{titre}</h2>
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
              onChange={(event) => mettreAJourChamp("code", event.target.value)}
            />
          </label>

          <label className="field">
            <span>Nom</span>
            <input
              type="text"
              value={valeurs.nom}
              maxLength={150}
              onChange={(event) => mettreAJourChamp("nom", event.target.value)}
            />
          </label>

          <label className="field">
            <span>Duree (minutes)</span>
            <input
              type="number"
              min="1"
              value={valeurs.duree}
              onChange={(event) => mettreAJourChamp("duree", event.target.value)}
            />
          </label>

          <label className="field">
            <span>Programme</span>
            <input
              type="text"
              value={valeurs.programme}
              maxLength={150}
              onChange={(event) => mettreAJourChamp("programme", event.target.value)}
            />
          </label>

          <label className="field">
            <span>Etape d'etude</span>
            <select
              value={valeurs.etape_etude}
              onChange={(event) => mettreAJourChamp("etape_etude", event.target.value)}
            >
              {Array.from({ length: 8 }, (_, index) => String(index + 1)).map((etape) => (
                <option key={etape} value={etape}>
                  Etape {etape}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Type de salle</span>
            {typesSalleDisponibles.length > 0 ? (
              <select
                value={valeurs.type_salle}
                onChange={(event) => mettreAJourChamp("type_salle", event.target.value)}
              >
                <option value="">Selectionner un type</option>
                {typesSalleDisponibles.map((typeSalle) => (
                  <option key={typeSalle} value={typeSalle}>
                    {typeSalle}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={valeurs.type_salle}
                maxLength={50}
                onChange={(event) => mettreAJourChamp("type_salle", event.target.value)}
              />
            )}
          </label>

          {aucunTypeSalleDisponible ? (
            <p className="feedback-banner feedback-banner--warning field--full">
              Aucun type de salle n'existe encore dans la base. Cree d'abord une
              salle, puis reutilise ce formulaire.
            </p>
          ) : null}

          {erreurLocale ? (
            <p className="feedback-banner feedback-banner--error field--full">{erreurLocale}</p>
          ) : null}

          <div className="modal-card__footer field--full">
            <button className="button button--ghost" type="button" onClick={onFermer}>
              Annuler
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={aucunTypeSalleDisponible}
            >
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
