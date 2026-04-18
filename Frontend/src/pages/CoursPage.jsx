/**
 * PAGE - Cours
 *
 * Cette page gere la consultation
 * et la maintenance des cours.
 */
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import { ModuleExcelImportPanel } from "../components/imports/ModuleExcelImportPanel.jsx";
import { recupererConfigurationImportExcel } from "../config/importExcelModules.js";
import {
  recupererCours,
  creerCours,
  modifierCours,
  supprimerCours,
  importerCours,
  telechargerModeleImportCours,
} from "../services/cours.api.js";
import { recupererProgrammes } from "../services/programmes.api.js";
import { recupererSalles } from "../services/salles.api.js";
import "../styles/CrudPages.css";

const ETAPES_DISPONIBLES = ["1", "2", "3", "4", "5", "6", "7", "8"];
const DUREES_DISPONIBLES = ["1", "2", "3", "4"];
const IMPORT_COURS = recupererConfigurationImportExcel("cours");

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
    duree: "1",
    programme: "",
    etape_etude: "1",
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
        String(element.salle_code || "").toLowerCase().includes(terme) ||
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

  function ouvrirModal(coursAEditer = null) {
    setEdition(coursAEditer);
    setErreurFormulaire("");

    if (coursAEditer) {
      setFormulaire({
        code: coursAEditer.code || "",
        nom: coursAEditer.nom || "",
        duree: String(coursAEditer.duree || "1"),
        programme: coursAEditer.programme || "",
        etape_etude: String(coursAEditer.etape_etude || "1"),
        id_salle_reference: String(coursAEditer.id_salle_reference || ""),
      });
    } else {
      setFormulaire({
        code: "",
        nom: "",
        duree: "1",
        programme: "",
        etape_etude: "1",
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
      duree: "1",
      programme: "",
      etape_etude: "1",
      id_salle_reference: "",
    });
  }

  async function handleSoumettre(event) {
    event.preventDefault();
    setErreurFormulaire("");

    try {
      const payload = {
        ...formulaire,
        duree: Number(formulaire.duree),
        etape_etude: String(formulaire.etape_etude),
        id_salle_reference: Number(formulaire.id_salle_reference),
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
      subtitle="Gerez les cours, les etapes et la salle de reference par code."
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

        <ModuleExcelImportPanel
          definition={IMPORT_COURS}
          onImporter={importerCours}
          onTelechargerModele={telechargerModeleImportCours}
          onImportSuccess={() =>
            Promise.all([chargerCours(), chargerProgrammes(), chargerSalles()])
          }
        />

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
                  <th>Duree</th>
                  <th>Programme</th>
                  <th>Etape</th>
                  <th>Salle de reference</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {coursFiltres.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="crud-page__empty">
                      Aucun cours trouve.
                    </td>
                  </tr>
                ) : (
                  coursFiltres.map((element) => (
                    <tr key={element.id_cours}>
                      <td>{element.code}</td>
                      <td>{element.nom}</td>
                      <td>{formaterDureeHeures(element.duree)}</td>
                      <td>{element.programme}</td>
                      <td>{element.etape_etude}</td>
                      <td>
                        {element.salle_code ? (
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
                  <span>Duree</span>
                  <select
                    value={formulaire.duree}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        duree: event.target.value,
                      })
                    }
                  >
                    {DUREES_DISPONIBLES.map((duree) => (
                      <option key={duree} value={duree}>
                        {formaterDureeHeures(duree)}
                      </option>
                    ))}
                  </select>
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
                    <option value="">Choisir un programme</option>
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

                <label className="crud-page__field">
                  <span>Salle de reference</span>
                  <select
                    value={formulaire.id_salle_reference}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        id_salle_reference: event.target.value,
                      })
                    }
                    required
                    disabled={sallesDisponibles.length === 0}
                  >
                    <option value="">
                      {sallesDisponibles.length === 0
                        ? "Ajoutez d'abord une salle"
                        : "Choisir une salle"}
                    </option>
                    {sallesDisponibles.map((salle) => (
                      <option key={salle.id_salle} value={salle.id_salle}>
                        {formaterSalle(salle)}
                      </option>
                    ))}
                  </select>
                </label>

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
