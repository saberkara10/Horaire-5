import { useEffect, useState } from "react";

const ETAT_INITIAL = {
  matricule: "",
  nom: "",
  prenom: "",
  specialite: "",
};

function normaliserValeurs(professeur) {
  if (!professeur) {
    return ETAT_INITIAL;
  }

  return {
    matricule: professeur.matricule || "",
    nom: professeur.nom || "",
    prenom: professeur.prenom || "",
    specialite: professeur.specialite || "",
  };
}

export function ProfesseurFormModal({
  estOuvert,
  mode,
  professeur,
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

    setValeurs(normaliserValeurs(professeur));
    setErreurLocale("");
  }, [estOuvert, professeur]);

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

    if (!valeurs.matricule.trim() || !valeurs.nom.trim() || !valeurs.prenom.trim()) {
      setErreurLocale("Les champs matricule, nom et prenom sont obligatoires.");
      return;
    }

    await onSoumettre({
      matricule: valeurs.matricule.trim(),
      nom: valeurs.nom.trim(),
      prenom: valeurs.prenom.trim(),
      specialite: valeurs.specialite.trim() || null,
    }).catch((error) => {
      setErreurLocale(error.message);
    });
  }

  const titre = mode === "creation" ? "Ajouter un professeur" : "Modifier le professeur";
  const libelleBouton =
    mode === "creation" ? "Creer le professeur" : "Enregistrer les modifications";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onFermer}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="professeur-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-card__header">
          <div>
            <p className="eyebrow">Gestion des horaires</p>
            <h2 id="professeur-form-title">{titre}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onFermer} aria-label="Fermer">
            ×
          </button>
        </header>

        <form className="form-grid" onSubmit={gererSoumission}>
          <label className="field">
            <span>Matricule</span>
            <input
              type="text"
              value={valeurs.matricule}
              maxLength={50}
              onChange={(event) => mettreAJourChamp("matricule", event.target.value)}
            />
          </label>

          <label className="field">
            <span>Nom</span>
            <input
              type="text"
              value={valeurs.nom}
              maxLength={100}
              onChange={(event) => mettreAJourChamp("nom", event.target.value)}
            />
          </label>

          <label className="field">
            <span>Prenom</span>
            <input
              type="text"
              value={valeurs.prenom}
              maxLength={100}
              onChange={(event) => mettreAJourChamp("prenom", event.target.value)}
            />
          </label>

          <label className="field field--full">
            <span>Specialite</span>
            <input
              type="text"
              value={valeurs.specialite}
              maxLength={100}
              onChange={(event) => mettreAJourChamp("specialite", event.target.value)}
              placeholder="Ex. Informatique, Reseaux, Mathematiques"
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
