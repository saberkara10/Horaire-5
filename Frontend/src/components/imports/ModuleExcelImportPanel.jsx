import { useMemo, useRef, useState } from "react";
import { usePopup } from "../feedback/PopupProvider.jsx";
import { FeedbackBanner } from "../ui/FeedbackBanner.jsx";

const STATISTIQUES_IMPORT = [
  { key: "total_lignes_lues", label: "Lignes lues" },
  { key: "lignes_importees", label: "Lignes importees" },
  { key: "lignes_creees", label: "Creees" },
  { key: "lignes_mises_a_jour", label: "Mises a jour" },
  { key: "lignes_ignorees", label: "Ignorees" },
  { key: "lignes_en_erreur", label: "En erreur" },
];

function resoudreTypeFeedback(statut) {
  if (statut === "success") {
    return "success";
  }

  if (statut === "partial" || statut === "warning") {
    return "warning";
  }

  return "info";
}

function obtenirNombre(resultatImport, cle) {
  return Number(resultatImport?.[cle] || 0);
}

function construireMessageNotification(moduleLabel, statut) {
  if (statut === "success") {
    return `${moduleLabel} importes avec succes.`;
  }

  if (statut === "partial") {
    return `Import partiel des ${moduleLabel.toLowerCase()} : consultez le detail affiche sur la page.`;
  }

  if (statut === "warning") {
    return `Import termine pour ${moduleLabel.toLowerCase()} avec des lignes ignorees ou non exploitables.`;
  }

  return `Import termine pour ${moduleLabel.toLowerCase()}.`;
}

function ListeMessagesImport({ titre, messages = [], classeModificateur }) {
  const messagesVisibles = Array.isArray(messages) ? messages.slice(0, 10) : [];

  if (messagesVisibles.length === 0) {
    return null;
  }

  return (
    <section className={`crud-import-panel__details crud-import-panel__details--${classeModificateur}`}>
      <div className="crud-import-panel__details-header">
        <strong>{titre}</strong>
        <span>{messages.length} message(s)</span>
      </div>

      <ul className="crud-import-panel__details-list">
        {messagesVisibles.map((message, index) => (
          <li key={`${classeModificateur}-${index}`}>{message}</li>
        ))}
      </ul>

      {messages.length > messagesVisibles.length ? (
        <p className="crud-import-panel__details-more">
          {messages.length - messagesVisibles.length} autre(s) message(s) non affiches.
        </p>
      ) : null}
    </section>
  );
}

/**
 * Panneau reutilisable d'import Excel integre dans une page CRUD existante.
 *
 * Il gere :
 * - la selection du fichier ;
 * - la confirmation utilisateur ;
 * - le telechargement du modele ;
 * - l'affichage du resume de traitement renvoye par le backend.
 */
export function ModuleExcelImportPanel({
  definition,
  onImporter,
  onTelechargerModele,
  onImportSuccess,
}) {
  const inputRef = useRef(null);
  const { confirm, showError, showInfo, showSuccess } = usePopup();
  const [importEnCours, setImportEnCours] = useState(false);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [resultatImport, setResultatImport] = useState(null);
  const [erreurImport, setErreurImport] = useState(null);
  const definitionModule = definition || {
    moduleLabel: "Import",
    description: "",
    columns: [],
    notes: [],
  };

  const resumeStatistiques = useMemo(
    () =>
      STATISTIQUES_IMPORT.map((statistique) => ({
        ...statistique,
        valeur: obtenirNombre(resultatImport, statistique.key),
      })),
    [resultatImport]
  );

  function ouvrirSelecteurFichier() {
    if (importEnCours) {
      return;
    }

    inputRef.current?.click();
  }

  async function gererSelectionFichier(event) {
    const fichier = event.target.files?.[0];
    event.target.value = "";

    if (!fichier) {
      return;
    }

    if (typeof onImporter !== "function") {
      showError("Le service d'import n'est pas disponible pour ce module.");
      return;
    }

      const confirmation = await confirm({
      title: `Importer des ${definitionModule.moduleLabel.toLowerCase()}`,
      message: `Le fichier ${fichier.name} va etre analyse. Les lignes valides seront creees ou mises a jour, et les lignes invalides seront rejetees avec detail d'erreur. Continuer ?`,
      confirmLabel: "Importer",
      tone: "primary",
    });

    if (!confirmation) {
      return;
    }

    setImportEnCours(true);
    setErreurImport(null);
    setResultatImport(null);

    try {
      const resultat = await onImporter(fichier);
      const resultatAvecFichier = {
        ...resultat,
        nom_fichier: fichier.name,
      };

      setResultatImport(resultatAvecFichier);

      if (resultat.statut === "success") {
        showSuccess(
          construireMessageNotification(definitionModule.moduleLabel, resultat.statut)
        );
      } else {
        showInfo(
          construireMessageNotification(definitionModule.moduleLabel, resultat.statut)
        );
      }

      if (typeof onImportSuccess === "function") {
        try {
          await onImportSuccess(resultatAvecFichier);
        } catch (error) {
          showError(
            error.message ||
              "L'import est termine, mais le rechargement automatique de la liste a echoue."
          );
        }
      }
    } catch (error) {
      const erreurNormalisee = {
        message: error.message || "Erreur lors de l'import.",
        details: Array.isArray(error.details) ? error.details : [],
      };

      setErreurImport(erreurNormalisee);
      showError(erreurNormalisee.message);
    } finally {
      setImportEnCours(false);
    }
  }

  async function gererTelechargementModele() {
    if (typeof onTelechargerModele !== "function") {
      return;
    }

    setTelechargementEnCours(true);

    try {
      await onTelechargerModele();
      showSuccess(`Modele ${definitionModule.moduleLabel.toLowerCase()} telecharge.`);
    } catch (error) {
      showError(error.message || "Impossible de telecharger le modele.");
    } finally {
      setTelechargementEnCours(false);
    }
  }

  return (
    <section className="crud-import-panel">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        hidden
        onChange={gererSelectionFichier}
      />

      <div className="crud-import-panel__header">
        <div className="crud-import-panel__copy">
          <span className="crud-import-panel__eyebrow">Import Excel</span>
          <h2>{definitionModule.moduleLabel}</h2>
          <p>{definitionModule.description}</p>
        </div>

        <div className="crud-import-panel__actions">
          <button
            type="button"
            className="crud-page__secondary-button"
            onClick={gererTelechargementModele}
            disabled={
              telechargementEnCours ||
              importEnCours ||
              typeof onTelechargerModele !== "function"
            }
          >
            {telechargementEnCours ? "Telechargement..." : "Telecharger le modele"}
          </button>

          <button
            type="button"
            className="crud-page__primary-button"
            onClick={ouvrirSelecteurFichier}
            disabled={importEnCours || typeof onImporter !== "function"}
          >
            {importEnCours ? "Import en cours..." : "Importer un fichier Excel"}
          </button>
        </div>
      </div>

      <div className="crud-import-panel__meta">
        <div className="crud-import-panel__badge">Formats acceptes : .xlsx, .xls, .csv</div>
        <div className="crud-import-panel__badge">
          Strategie : import partiel avec detail des lignes rejetees
        </div>
      </div>

      <div className="crud-import-panel__columns">
        {definitionModule.columns.map((colonne) => (
          <article key={colonne.key} className="crud-import-panel__column-card">
            <div className="crud-import-panel__column-header">
              <strong>{colonne.key}</strong>
              <span>{colonne.required ? "Obligatoire" : "Optionnelle"}</span>
            </div>
            <p>{colonne.description}</p>
          </article>
        ))}
      </div>

      {Array.isArray(definitionModule.notes) && definitionModule.notes.length > 0 ? (
        <ul className="crud-import-panel__notes">
          {definitionModule.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <FeedbackBanner
        type={resoudreTypeFeedback(resultatImport?.statut)}
        message={resultatImport?.message || ""}
      />

      <FeedbackBanner
        type="error"
        message={erreurImport?.message || ""}
        details={erreurImport?.details || []}
        maxDetails={8}
      />

      {resultatImport ? (
        <div className="crud-import-panel__result">
          <div className="crud-import-panel__result-header">
            <strong>Dernier fichier traite : {resultatImport.nom_fichier}</strong>
            <span>Statut : {resultatImport.statut || "inconnu"}</span>
          </div>

          <div className="crud-import-panel__stats">
            {resumeStatistiques.map((statistique) => (
              <div key={statistique.key} className="crud-import-panel__stat">
                <span>{statistique.label}</span>
                <strong>{statistique.valeur}</strong>
              </div>
            ))}
          </div>

          <ListeMessagesImport
            titre="Lignes en erreur"
            messages={resultatImport.erreurs}
            classeModificateur="error"
          />

          <ListeMessagesImport
            titre="Lignes ignorees"
            messages={resultatImport.ignores}
            classeModificateur="info"
          />
        </div>
      ) : null}
    </section>
  );
}
