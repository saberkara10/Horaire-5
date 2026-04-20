/**
 * PAGE - Cours
 *
 * Cette page gere la consultation
 * et la maintenance des cours.
 */
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import {
  recupererCours,
  creerCours,
  modifierCours,
  supprimerCours,
} from "../services/cours.api.js";
import { recupererProgrammes } from "../services/programmes.api.js";
import { recupererSalles } from "../services/salles.api.js";
import { TYPES_SALLES } from "../utils/salles.utils.js";
import "../styles/CrudPages.css";

const ETAPES_DISPONIBLES = ["1", "2", "3", "4", "5", "6", "7", "8"];
const MODES_COURS = ["Presentiel", "En ligne"];
const DUREE_FIXE_COURS = 3;

function formaterDureeHeures(duree) {
  const valeur = Number(duree);

  if (!Number.isFinite(valeur) || valeur <= 0) {
    return "--:--";
  }

  return `${String(valeur).padStart(2, "0")}:00`;
}

function formaterSalle(salle) {
  if (!salle) {
    return "Aucune salle";
  }

  return `${salle.code} - ${salle.type}`;
}

export function CoursPage({ utilisateur, onLogout }) {
  const [cours, setCours] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [salles, setSalles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurFormulaire, setErreurFormulaire] = useState("");
  const [recherche, setRecherche] = useState("");
  const [modalOuvert, setModalOuvert] = useState(false);
  const [edition, setEdition] = useState(null);
  const { confirm, showError, showSuccess } = usePopup();

  const [formulaire, setFormulaire] = useState({
    code: "",
    nom: "",
    mode_cours: "Presentiel",
    programme: "",
    etape_etude: "1",
    type_salle: "",
    id_salle_reference: "",
  });

  async function chargerCours() {
    setChargement(true);

    try {
      const data = await recupererCours();
      setCours(data || []);
    } catch (error) {
      showError(error.message || "Impossible de recuperer les cours.");
    } finally {
      setChargement(false);
    }
  }

  async function chargerProgrammes() {
    try {
      const data = await recupererProgrammes();
      setProgrammes(Array.isArray(data) ? data : []);
    } catch {
      setProgrammes([]);
    }
  }

  async function chargerSalles() {
    try {
      const data = await recupererSalles();
      setSalles(Array.isArray(data) ? data : []);
    } catch {
      setSalles([]);
    }
  }

  useEffect(() => {
    chargerCours();
    chargerProgrammes();
    chargerSalles();
  }, []);

  const coursFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();

    if (!terme) {
      return cours;
    }

    return cours.filter((element) => {
      return (
        String(element.code || "").toLowerCase().includes(terme) ||
        String(element.nom || "").toLowerCase().includes(terme) ||
        String(element.programme || "").toLowerCase().includes(terme) ||
        String(element.mode_cours || "").toLowerCase().includes(terme) ||
        String(element.salle_code || "").toLowerCase().includes(terme) ||
        String(element.type_salle || "").toLowerCase().includes(terme) ||
        String(element.salle_type || "").toLowerCase().includes(terme) ||
        String(element.etape_etude || "").toLowerCase().includes(terme)
      );
    });
  }, [cours, recherche]);

  const programmesDisponibles = useMemo(() => {
    return [...new Set([...programmes, formulaire.programme].filter(Boolean))].sort(
      (programmeA, programmeB) => programmeA.localeCompare(programmeB, "fr")
    );
  }, [programmes, formulaire.programme]);

  const sallesDisponibles = useMemo(() => {
    return [...salles].sort((salleA, salleB) =>
      String(salleA.code || "").localeCompare(String(salleB.code || ""), "fr")
    );
  }, [salles]);

  const sallesReferenceDisponibles = useMemo(() => {
    if (!formulaire.type_salle) {
      return sallesDisponibles;
    }

    return sallesDisponibles.filter(
      (salle) => String(salle.type) === String(formulaire.type_salle)
    );
  }, [formulaire.type_salle, sallesDisponibles]);

  function ouvrirModal(coursAEditer = null) {
    setEdition(coursAEditer);
    setErreurFormulaire("");

    if (coursAEditer) {
      setFormulaire({
        code: coursAEditer.code || "",
        nom: coursAEditer.nom || "",
        mode_cours: coursAEditer.mode_cours || "Presentiel",
        programme: coursAEditer.programme || "",
        etape_etude: String(coursAEditer.etape_etude || "1"),
        type_salle: coursAEditer.type_salle || "",
        id_salle_reference: String(coursAEditer.id_salle_reference || ""),
      });
    } else {
      setFormulaire({
        code: "",
        nom: "",
        mode_cours: "Presentiel",
        programme: "",
        etape_etude: "1",
        type_salle: "",
        id_salle_reference: "",
      });
    }

    setModalOuvert(true);
  }

  function fermerModal() {
    setModalOuvert(false);
    setEdition(null);
    setErreurFormulaire("");
    setFormulaire({
      code: "",
      nom: "",
      mode_cours: "Presentiel",
      programme: "",
      etape_etude: "1",
      type_salle: "",
      id_salle_reference: "",
    });
  }

  async function handleSoumettre(event) {
    event.preventDefault();
    setErreurFormulaire("");

    try {
      const payload = {
        ...formulaire,
        duree: DUREE_FIXE_COURS,
        etape_etude: String(formulaire.etape_etude),
        mode_cours: String(formulaire.mode_cours),
        type_salle:
          formulaire.mode_cours === "En ligne" ? null : String(formulaire.type_salle),
        id_salle_reference:
          formulaire.mode_cours === "En ligne"
            ? null
            : formulaire.id_salle_reference
          ? Number(formulaire.id_salle_reference)
          : null,
      };

      if (edition) {
        await modifierCours(edition.id_cours, payload);
        showSuccess("Cours modifie avec succes.");
      } else {
        await creerCours(payload);
        showSuccess("Cours cree avec succes.");
      }

      fermerModal();
      await Promise.all([chargerCours(), chargerProgrammes(), chargerSalles()]);
    } catch (error) {
      setErreurFormulaire(error.message || "Erreur lors de la sauvegarde.");
    }
  }

  async function handleSupprimer(idCours) {
    const confirmation = await confirm({
      title: "Supprimer le cours",
      message: "Voulez-vous vraiment supprimer ce cours ?",
      confirmLabel: "Supprimer",
      tone: "danger",
    });

    if (!confirmation) {
      return;
    }

    try {
      await supprimerCours(idCours);
      showSuccess("Cours supprime avec succes.");
      await Promise.all([chargerCours(), chargerProgrammes(), chargerSalles()]);
    } catch (error) {
      showError(error.message || "Erreur lors de la suppression.");
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Cours"
    >
      <div className="crud-page">
        <div className="crud-page__header">
          <button
            type="button"
            className="crud-page__add-button"
            onClick={() => ouvrirModal()}
          >
            + Ajouter un cours
          </button>
        </div>

        <div className="crud-page__toolbar">
          <input
            type="text"
            className="crud-page__search"
            placeholder="Rechercher un cours, une salle ou un programme..."
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
          />
        </div>

        <section className="crud-page__table-card">
          {chargement ? (
            <p className="crud-page__state">Chargement...</p>
          ) : (
            <table className="crud-page__table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom</th>
                  <th>Mode</th>
                  <th>Duree</th>
                  <th>Programme</th>
                  <th>Etape</th>
                  <th>Type requis</th>
                  <th>Salle de reference</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {coursFiltres.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="crud-page__empty">
                      Aucun cours trouve.
                    </td>
                  </tr>
                ) : (
                  coursFiltres.map((element) => (
                    <tr key={element.id_cours}>
                      <td>{element.code}</td>
                      <td>{element.nom}</td>
                      <td>{element.mode_cours || "Presentiel"}</td>
                      <td>{formaterDureeHeures(element.duree)}</td>
                      <td>{element.programme}</td>
                      <td>{element.etape_etude}</td>
                      <td>
                        {element.mode_cours === "En ligne" ? "Aucune salle requise" : element.type_salle || "-"}
                      </td>
                      <td>
                        {element.mode_cours === "En ligne" ? (
                          "En ligne"
                        ) : element.salle_code ? (
                          <>
                            <strong>{element.salle_code}</strong>
                            <br />
                            <small>
                              {element.salle_type || element.type_salle || "-"}
                            </small>
                          </>
                        ) : (
                          element.type_salle || "-"
                        )}
                      </td>
                      <td>
                        <div className="crud-page__actions">
                          <button
                            type="button"
                            className="crud-page__action crud-page__action--edit"
                            onClick={() => ouvrirModal(element)}
                          >
                            Modifier
                          </button>

                          <button
                            type="button"
                            className="crud-page__action crud-page__action--delete"
                            onClick={() => handleSupprimer(element.id_cours)}
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

        {modalOuvert ? (
          <div className="crud-page__modal-overlay" onClick={fermerModal}>
            <div
              className="crud-page__modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="crud-page__modal-header">
                <h2>{edition ? "Modifier un cours" : "Ajouter un cours"}</h2>
                <button
                  type="button"
                  className="crud-page__close"
                  onClick={fermerModal}
                >
                  x
                </button>
              </div>

              <form className="crud-page__form" onSubmit={handleSoumettre}>
                <label className="crud-page__field">
                  <span>Code</span>
                  <input
                    type="text"
                    placeholder="ex: INF101"
                    value={formulaire.code}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        code: event.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label className="crud-page__field">
                  <span>Nom</span>
                  <input
                    type="text"
                    placeholder="ex: Developpement Web"
                    value={formulaire.nom}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        nom: event.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label className="crud-page__field">
                  <span>Mode</span>
                  <select
                    value={formulaire.mode_cours}
                    onChange={(event) =>
                      setFormulaire((valeurActuelle) => ({
                        ...valeurActuelle,
                        mode_cours: event.target.value,
                        type_salle:
                          event.target.value === "En ligne"
                            ? ""
                            : valeurActuelle.type_salle,
                        id_salle_reference:
                          event.target.value === "En ligne"
                            ? ""
                            : valeurActuelle.id_salle_reference,
                      }))
                    }
                  >
                    {MODES_COURS.map((modeCours) => (
                      <option key={modeCours} value={modeCours}>
                        {modeCours}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="crud-page__field">
                  <span>Duree</span>
                  <input type="text" value={formaterDureeHeures(DUREE_FIXE_COURS)} disabled />
                </label>

                <label className="crud-page__field">
                  <span>Programme</span>
                  <select
                    value={formulaire.programme}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        programme: event.target.value,
                      })
                    }
                    required
                  >
                    <option value="" disabled hidden>
                      Choisir un programme
                    </option>
                    {programmesDisponibles.map((programme) => (
                      <option key={programme} value={programme}>
                        {programme}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="crud-page__field">
                  <span>Etape</span>
                  <select
                    value={formulaire.etape_etude}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        etape_etude: event.target.value,
                      })
                    }
                  >
                    {ETAPES_DISPONIBLES.map((etape) => (
                      <option key={etape} value={etape}>
                        Etape {etape}
                      </option>
                    ))}
                  </select>
                </label>

                {formulaire.mode_cours === "Presentiel" ? (
                  <>
                    <label className="crud-page__field">
                      <span>Type de salle requis</span>
                      <select
                        value={formulaire.type_salle}
                        onChange={(event) =>
                          setFormulaire({
                            ...formulaire,
                            type_salle: event.target.value,
                            id_salle_reference:
                              formulaire.id_salle_reference &&
                              !salles.some(
                                (salle) =>
                                  String(salle.id_salle) ===
                                    String(formulaire.id_salle_reference) &&
                                  String(salle.type) === String(event.target.value)
                              )
                                ? ""
                                : formulaire.id_salle_reference,
                          })
                        }
                        required
                      >
                        <option value="" disabled hidden>
                          Choisir un type de salle
                        </option>
                        {TYPES_SALLES.map((typeSalle) => (
                          <option key={typeSalle} value={typeSalle}>
                            {typeSalle}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="crud-page__field">
                      <span>Salle de reference optionnelle</span>
                      <select
                        value={formulaire.id_salle_reference}
                        onChange={(event) =>
                          setFormulaire({
                            ...formulaire,
                            id_salle_reference: event.target.value,
                          })
                        }
                        disabled={!formulaire.type_salle}
                      >
                        <option
                          value=""
                          disabled={!formulaire.type_salle || sallesReferenceDisponibles.length === 0}
                          hidden={!formulaire.type_salle || sallesReferenceDisponibles.length === 0}
                        >
                          {!formulaire.type_salle
                            ? "Choisir d'abord le type requis"
                            : sallesReferenceDisponibles.length === 0
                              ? "Aucune salle disponible pour ce type"
                              : "Aucune preference particuliere"}
                        </option>
                        {sallesReferenceDisponibles.map((salle) => (
                          <option key={salle.id_salle} value={salle.id_salle}>
                            {formaterSalle(salle)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <div className="crud-page__alert crud-page__alert--success crud-page__form-feedback">
                    Ce cours sera planifie en ligne, sans salle.
                  </div>
                )}

                {erreurFormulaire ? (
                  <div className="crud-page__alert crud-page__alert--error crud-page__form-feedback">
                    {erreurFormulaire}
                  </div>
                ) : null}

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
        ) : null}
      </div>
    </AppShell>
  );
}
