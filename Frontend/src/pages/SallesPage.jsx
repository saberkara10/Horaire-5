/**
 * PAGE - Salles
 *
 * Cette page gere la consultation et la maintenance des salles.
 *
 * Le champ "Type" utilise un selecteur hybride :
 *  - liste deroulante des types existants recuperes dynamiquement ;
 *  - possibilite d'ajouter un nouveau type via un champ texte dedie.
 */
import { useEffect, useMemo, useState } from "react";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import { ModuleExcelImportPanel } from "../components/imports/ModuleExcelImportPanel.jsx";
import { recupererConfigurationImportExcel } from "../config/importExcelModules.js";
import {
  recupererSalles,
  recupererTypesSalles,
  creerSalle,
  modifierSalle,
  supprimerSalle,
  importerSalles,
  telechargerModeleImportSalles,
} from "../services/salles.api.js";
import "../styles/CrudPages.css";

const IMPORT_SALLES = recupererConfigurationImportExcel("salles");


/* ─────────────────────────────────────────────────────────────
   Sous-composant : sélecteur hybride de type de salle
   Isolé pour garder SallesPage lisible.
───────────────────────────────────────────────────────────── */
function SelecteurTypeSalle({
  typesDisponibles,
  chargementTypes,
  erreurTypes,
  valeur,
  modeNouveauType,
  nouveauType,
  onChangerSelection,
  onChangerNouveauType,
  onToggleNouveauType,
  disabled,
}) {
  return (
    <div className="crud-page__field">
      <span>Type</span>

      {/* ── Selecteur des types existants ── */}
      {chargementTypes ? (
        <div className="salle-type-chargement">Chargement des types…</div>
      ) : erreurTypes ? (
        <div className="crud-page__alert crud-page__alert--error crud-page__form-feedback">
          Impossible de charger les types. Saisissez-le manuellement.
        </div>
      ) : (
        !modeNouveauType && (
          <select
            id="salle-type-select"
            value={valeur}
            onChange={(e) => onChangerSelection(e.target.value)}
            disabled={disabled}
            required={!modeNouveauType}
          >
            <option value="" disabled>
              Sélectionner un type…
            </option>
            {typesDisponibles.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )
      )}

      {/* ── Champ texte pour un nouveau type ── */}
      {modeNouveauType && (
        <input
          id="salle-type-nouveau"
          type="text"
          placeholder="ex : Salle informatique"
          value={nouveauType}
          onChange={(e) => onChangerNouveauType(e.target.value)}
          autoFocus
          required
          disabled={disabled}
        />
      )}

      {/* ── Bouton bascule ── */}
      {!erreurTypes && (
        <button
          type="button"
          className="salle-type-toggle"
          onClick={onToggleNouveauType}
          disabled={disabled}
        >
          {modeNouveauType
            ? "← Choisir un type existant"
            : "+ Ajouter un nouveau type"}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page principale
───────────────────────────────────────────────────────────── */
export function SallesPage({ utilisateur, onLogout }) {
  /* ── Données de la liste ── */
  const [salles, setSalles] = useState([]);
  const [chargement, setChargement] = useState(true);

  /* ── Types disponibles ── */
  const [typesDisponibles, setTypesDisponibles] = useState([]);
  const [chargementTypes, setChargementTypes] = useState(false);
  const [erreurTypes, setErreurTypes] = useState(false);

  /* ── UI ── */
  const [recherche, setRecherche] = useState("");
  const [modalOuvert, setModalOuvert] = useState(false);
  const [edition, setEdition] = useState(null);
  const [erreurFormulaire, setErreurFormulaire] = useState("");

  /* ── Formulaire ── */
  const [formulaire, setFormulaire] = useState({
    code: "",
    capacite: "",
  });

  /*
   * Sélecteur hybride de type :
   *  - typeSelectionne : valeur choisie dans le <select> (type existant)
   *  - modeNouveauType : true = l'utilisateur veut saisir un nouveau type
   *  - nouveauTypeSaisi : texte libre pour un nouveau type
   */
  const [typeSelectionne, setTypeSelectionne] = useState("");
  const [modeNouveauType, setModeNouveauType] = useState(false);
  const [nouveauTypeSaisi, setNouveauTypeSaisi] = useState("");

  const { confirm, showError, showSuccess } = usePopup();

  /* ─────────────── Chargement des salles ─────────────── */
  async function chargerSalles() {
    setChargement(true);
    try {
      const data = await recupererSalles();
      setSalles(data || []);
    } catch (error) {
      showError(error.message || "Impossible de charger les salles.");
    } finally {
      setChargement(false);
    }
  }

  /* ─────────────── Chargement des types ─────────────── */
  async function chargerTypes() {
    setChargementTypes(true);
    setErreurTypes(false);
    try {
      const types = await recupererTypesSalles();
      setTypesDisponibles(Array.isArray(types) ? types : []);
    } catch (_error) {
      setErreurTypes(true);
    } finally {
      setChargementTypes(false);
    }
  }

  useEffect(() => {
    chargerSalles();
  }, []);

  /* ─────────────── Filtrage ─────────────── */
  const sallesFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return salles;
    return salles.filter(
      (salle) =>
        String(salle.code || "").toLowerCase().includes(terme) ||
        String(salle.type || "").toLowerCase().includes(terme) ||
        String(salle.capacite || "").toLowerCase().includes(terme)
    );
  }, [salles, recherche]);

  /* ─────────────── Helpers du sélecteur hybride ─────────────── */

  /**
   * Détermine le type final à envoyer au backend :
   * - si mode nouveau type : le texte libre (trimé) ;
   * - sinon : la valeur sélectionnée dans le select.
   * Retourne null si aucun type valide n'est fourni.
   */
  function resoudreType() {
    if (modeNouveauType) {
      const trimmed = nouveauTypeSaisi.trim();
      return trimmed || null;
    }
    return typeSelectionne || null;
  }

  function basculerModeType() {
    setModeNouveauType((prev) => {
      if (prev) {
        /* Retour vers la sélection : réinitialiser le texte libre */
        setNouveauTypeSaisi("");
      } else {
        /* Vers saisie libre : vider la sélection */
        setTypeSelectionne("");
      }
      return !prev;
    });
  }

  /* ─────────────── Ouverture / fermeture du modal ─────────────── */
  function ouvrirModal(salle = null) {
    setEdition(salle);
    setErreurFormulaire("");

    if (salle) {
      setFormulaire({
        code: salle.code || "",
        capacite: String(salle.capacite || ""),
      });

      /*
       * En modification : tenter de pré-sélectionner le type
       * dans la liste existante. Si le type n'y figure pas,
       * basculer automatiquement en mode "nouveau type".
       * La décision définitive est prise après le chargement
       * de la liste (voir useEffect ci-dessous).
       */
      setTypeSelectionne(salle.type || "");
      setModeNouveauType(false);
      setNouveauTypeSaisi("");
    } else {
      setFormulaire({ code: "", capacite: "" });
      setTypeSelectionne("");
      setModeNouveauType(false);
      setNouveauTypeSaisi("");
    }

    /* Charger les types à chaque ouverture pour être toujours à jour */
    chargerTypes();
    setModalOuvert(true);
  }

  /*
   * Après le chargement des types en mode édition :
   * si le type de la salle n'est pas dans la liste, on bascule
   * automatiquement en mode saisie libre pour ne pas perdre la valeur.
   */
  useEffect(() => {
    if (!modalOuvert || !edition || chargementTypes || erreurTypes) return;
    if (typeSelectionne && !typesDisponibles.includes(typeSelectionne)) {
      setModeNouveauType(true);
      setNouveauTypeSaisi(typeSelectionne);
      setTypeSelectionne("");
    }
  }, [chargementTypes, typesDisponibles]);

  function fermerModal() {
    setModalOuvert(false);
    setEdition(null);
    setErreurFormulaire("");
    setFormulaire({ code: "", capacite: "" });
    setTypeSelectionne("");
    setModeNouveauType(false);
    setNouveauTypeSaisi("");
  }

  /* ─────────────── Soumission du formulaire ─────────────── */
  async function handleSoumettre(event) {
    event.preventDefault();
    setErreurFormulaire("");

    /* Résolution et validation frontale du type */
    const typeResolu = resoudreType();
    if (!typeResolu) {
      setErreurFormulaire("Le type de salle est obligatoire.");
      return;
    }

    try {
      if (edition) {
        await modifierSalle(edition.id_salle, {
          type: typeResolu,
          capacite: Number(formulaire.capacite),
        });
        showSuccess("Salle modifiée avec succès.");
      } else {
        await creerSalle({
          code: formulaire.code,
          type: typeResolu,
          capacite: Number(formulaire.capacite),
        });
        showSuccess("Salle ajoutée avec succès.");
      }

      fermerModal();
      await chargerSalles();
    } catch (error) {
      setErreurFormulaire(error.message || "Erreur lors de l'enregistrement.");
    }
  }

  /* ─────────────── Suppression ─────────────── */
  async function handleSupprimer(idSalle) {
    const confirmation = await confirm({
      title: "Supprimer la salle",
      message: "Voulez-vous vraiment supprimer cette salle ?",
      confirmLabel: "Supprimer",
      tone: "danger",
    });

    if (!confirmation) return;

    try {
      await supprimerSalle(idSalle);
      showSuccess("Salle supprimée avec succès.");
      await chargerSalles();
    } catch (error) {
      showError(error.message || "Erreur lors de la suppression.");
    }
  }

  /* ─────────────── Rendu ─────────────── */
  return (
    <div className="crud-page">
        {/* En-tête */}
        <div className="crud-page__header">
          <button
            type="button"
            className="crud-page__add-button"
            onClick={() => ouvrirModal()}
          >
            + Ajouter une salle
          </button>
        </div>

        <ModuleExcelImportPanel
          definition={IMPORT_SALLES}
          onImporter={importerSalles}
          onTelechargerModele={telechargerModeleImportSalles}
          onImportSuccess={chargerSalles}
        />

        {/* Barre de recherche */}
        <div className="crud-page__toolbar">
          <input
            type="text"
            className="crud-page__search"
            placeholder="Rechercher une salle…"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
          />
        </div>

        {/* Tableau */}
        <section className="crud-page__table-card">
          {chargement ? (
            <p className="crud-page__state">Chargement…</p>
          ) : (
            <table className="crud-page__table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Capacité</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sallesFiltrees.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="crud-page__empty">
                      Aucune salle trouvée.
                    </td>
                  </tr>
                ) : (
                  sallesFiltrees.map((salle) => (
                    <tr key={salle.id_salle}>
                      <td>{salle.code}</td>
                      <td>{salle.type}</td>
                      <td>{salle.capacite}</td>
                      <td>
                        <div className="crud-page__actions">
                          <button
                            type="button"
                            className="crud-page__action crud-page__action--edit"
                            onClick={() => ouvrirModal(salle)}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="crud-page__action crud-page__action--delete"
                            onClick={() => handleSupprimer(salle.id_salle)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </section>

        {/* Modal ajout / modification */}
        {modalOuvert && (
          <div className="crud-page__modal-overlay" onClick={fermerModal}>
            <div
              className="crud-page__modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="crud-page__modal-header">
                <h2>{edition ? "Modifier une salle" : "Ajouter une salle"}</h2>
                <button
                  type="button"
                  className="crud-page__close"
                  onClick={fermerModal}
                >
                  ×
                </button>
              </div>

              <form className="crud-page__form" onSubmit={handleSoumettre}>
                {/* Champ Code (création uniquement) */}
                {!edition && (
                  <label className="crud-page__field">
                    <span>Code</span>
                    <input
                      id="salle-code"
                      type="text"
                      placeholder="ex : B204"
                      value={formulaire.code}
                      onChange={(event) =>
                        setFormulaire({ ...formulaire, code: event.target.value })
                      }
                      required
                    />
                  </label>
                )}

                {/* Sélecteur hybride de type */}
                <SelecteurTypeSalle
                  typesDisponibles={typesDisponibles}
                  chargementTypes={chargementTypes}
                  erreurTypes={erreurTypes}
                  valeur={typeSelectionne}
                  modeNouveauType={modeNouveauType}
                  nouveauType={nouveauTypeSaisi}
                  onChangerSelection={setTypeSelectionne}
                  onChangerNouveauType={setNouveauTypeSaisi}
                  onToggleNouveauType={basculerModeType}
                />

                {/* Champ Capacité */}
                <label className="crud-page__field">
                  <span>Capacité</span>
                  <input
                    id="salle-capacite"
                    type="number"
                    min="1"
                    placeholder="ex : 30"
                    value={formulaire.capacite}
                    onChange={(event) =>
                      setFormulaire({ ...formulaire, capacite: event.target.value })
                    }
                    required
                  />
                </label>

                {/* Feedback d'erreur formulaire */}
                {erreurFormulaire && (
                  <div className="crud-page__alert crud-page__alert--error crud-page__form-feedback">
                    {erreurFormulaire}
                  </div>
                )}

                {/* Actions */}
                <div className="crud-page__modal-actions">
                  <button
                    type="button"
                    className="crud-page__secondary-button"
                    onClick={fermerModal}
                  >
                    Annuler
                  </button>
                  <button type="submit" className="crud-page__primary-button">
                    {edition ? "Enregistrer" : "Ajouter"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
}
