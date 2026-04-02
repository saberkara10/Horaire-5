/**
 * PAGE - Professeurs
 *
 * Cette page gere la consultation
 * et la maintenance des professeurs.
 */
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import {
  recupererProfesseurs,
  creerProfesseur,
  modifierProfesseur,
  supprimerProfesseur,
} from "../services/professeurs.api.js";
import { recupererProgrammes } from "../services/programmes.api.js";
import { recupererCours } from "../services/cours.api.js";
import "../styles/CrudPages.css";
import "../styles/ProfesseursPage.css";
import { programmesCorrespondent } from "../utils/programmes.js";

function extraireCoursIds(valeur) {
  if (Array.isArray(valeur)) {
    return valeur
      .map((idCours) => Number(idCours))
      .filter((idCours) => Number.isInteger(idCours) && idCours > 0);
  }

  return String(valeur || "")
    .split(",")
    .map((idCours) => Number(idCours.trim()))
    .filter((idCours) => Number.isInteger(idCours) && idCours > 0);
}

export function ProfesseursPage({ utilisateur, onLogout }) {
  const [professeurs, setProfesseurs] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [cours, setCours] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurFormulaire, setErreurFormulaire] = useState("");
  const [recherche, setRecherche] = useState("");
  const [modalOuvert, setModalOuvert] = useState(false);
  const [edition, setEdition] = useState(null);
  const { confirm, showError, showSuccess } = usePopup();
  const [formulaire, setFormulaire] = useState({
    matricule: "",
    prenom: "",
    nom: "",
    specialite: "",
    cours_ids: [],
  });

  async function chargerProfesseurs() {
    setChargement(true);

    try {
      const data = await recupererProfesseurs();
      setProfesseurs(data || []);
    } catch (error) {
      showError(error.message || "Impossible de charger les professeurs.");
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

  async function chargerCours() {
    try {
      const data = await recupererCours();
      setCours(Array.isArray(data) ? data : []);
    } catch {
      setCours([]);
    }
  }

  useEffect(() => {
    chargerProfesseurs();
    chargerProgrammes();
    chargerCours();
  }, []);

  const professeursFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();

    if (!terme) {
      return professeurs;
    }

    return professeurs.filter((professeur) => {
      return (
        String(professeur.matricule || "").toLowerCase().includes(terme) ||
        String(professeur.prenom || "").toLowerCase().includes(terme) ||
        String(professeur.nom || "").toLowerCase().includes(terme) ||
        String(professeur.specialite || "").toLowerCase().includes(terme) ||
        String(professeur.cours_assignes || "").toLowerCase().includes(terme)
      );
    });
  }, [professeurs, recherche]);

  const programmesDisponibles = useMemo(() => {
    return [...new Set([...programmes, formulaire.specialite].filter(Boolean))].sort(
      (programmeA, programmeB) => programmeA.localeCompare(programmeB, "fr")
    );
  }, [programmes, formulaire.specialite]);

  const coursCompatibles = useMemo(() => {
    if (!formulaire.specialite) {
      return [];
    }

    return [...cours]
      .filter((coursItem) =>
        programmesCorrespondent(coursItem.programme, formulaire.specialite)
      )
      .sort((coursA, coursB) =>
        String(coursA.code || "").localeCompare(String(coursB.code || ""), "fr")
      );
  }, [cours, formulaire.specialite]);

  function ouvrirModal(professeur = null) {
    setEdition(professeur);
    setErreurFormulaire("");

    if (professeur) {
      setFormulaire({
        matricule: professeur.matricule || "",
        prenom: professeur.prenom || "",
        nom: professeur.nom || "",
        specialite: professeur.specialite || "",
        cours_ids: extraireCoursIds(professeur.cours_ids),
      });
    } else {
      setFormulaire({
        matricule: "",
        prenom: "",
        nom: "",
        specialite: "",
        cours_ids: [],
      });
    }

    setModalOuvert(true);
  }

  function fermerModal() {
    setModalOuvert(false);
    setEdition(null);
    setErreurFormulaire("");
    setFormulaire({
      matricule: "",
      prenom: "",
      nom: "",
      specialite: "",
      cours_ids: [],
    });
  }

  function handleChangerChamp(event) {
    const { name, value } = event.target;

    setFormulaire((valeurActuelle) => {
      if (name === "specialite") {
        const coursCompatiblesProgramme = cours
          .filter((coursItem) =>
            programmesCorrespondent(coursItem.programme, value)
          )
          .map((coursItem) => Number(coursItem.id_cours));

        return {
          ...valeurActuelle,
          specialite: value,
          cours_ids: valeurActuelle.cours_ids.filter((idCours) =>
            coursCompatiblesProgramme.includes(Number(idCours))
          ),
        };
      }

      return {
        ...valeurActuelle,
        [name]: value,
      };
    });
  }

  function handleBasculerCours(idCours) {
    setFormulaire((valeurActuelle) => {
      const idCoursNumerique = Number(idCours);
      const dejaPresent = valeurActuelle.cours_ids.includes(idCoursNumerique);

      return {
        ...valeurActuelle,
        cours_ids: dejaPresent
          ? valeurActuelle.cours_ids.filter((element) => element !== idCoursNumerique)
          : [...valeurActuelle.cours_ids, idCoursNumerique],
      };
    });
  }

  async function handleSoumettre(event) {
    event.preventDefault();
    setErreurFormulaire("");

    try {
      if (edition) {
        await modifierProfesseur(edition.id_professeur, formulaire);
        showSuccess("Professeur modifie avec succes.");
      } else {
        await creerProfesseur(formulaire);
        showSuccess("Professeur ajoute avec succes.");
      }

      fermerModal();
      await Promise.all([chargerProfesseurs(), chargerProgrammes(), chargerCours()]);
    } catch (error) {
      setErreurFormulaire(error.message || "Erreur lors de la sauvegarde.");
    }
  }

  async function handleSupprimer(idProfesseur) {
    const confirmation = await confirm({
      title: "Supprimer le professeur",
      message: "Voulez-vous vraiment supprimer ce professeur ?",
      confirmLabel: "Supprimer",
      tone: "danger",
    });

    if (!confirmation) {
      return;
    }

    try {
      await supprimerProfesseur(idProfesseur);
      showSuccess("Professeur supprime avec succes.");
      await Promise.all([chargerProfesseurs(), chargerProgrammes(), chargerCours()]);
    } catch (error) {
      showError(error.message || "Erreur lors de la suppression.");
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Professeurs"
      subtitle="Rattachez chaque enseignant a un programme puis a ses cours autorises."
    >
      <div className="crud-page">
        <div className="crud-page__header">
          <button
            type="button"
            className="crud-page__add-button"
            onClick={() => ouvrirModal()}
          >
            + Ajouter un professeur
          </button>
        </div>

        <div className="crud-page__toolbar">
          <input
            type="text"
            className="crud-page__search"
            placeholder="Rechercher un professeur, un programme ou un cours..."
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
                  <th>Matricule</th>
                  <th>Prenom</th>
                  <th>Nom</th>
                  <th>Programme</th>
                  <th>Cours assignes</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {professeursFiltres.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="crud-page__empty">
                      Aucun professeur trouve.
                    </td>
                  </tr>
                ) : (
                  professeursFiltres.map((professeur) => (
                    <tr key={professeur.id_professeur}>
                      <td>{professeur.matricule}</td>
                      <td>{professeur.prenom}</td>
                      <td>{professeur.nom}</td>
                      <td>{professeur.specialite || "-"}</td>
                      <td>{professeur.cours_assignes || "Aucun cours assigne"}</td>
                      <td>
                        <div className="crud-page__actions">
                          <button
                            type="button"
                            className="crud-page__action crud-page__action--edit"
                            onClick={() => ouvrirModal(professeur)}
                          >
                            Modifier
                          </button>

                          <button
                            type="button"
                            className="crud-page__action crud-page__action--delete"
                            onClick={() =>
                              handleSupprimer(professeur.id_professeur)
                            }
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
                <h2>{edition ? "Modifier un professeur" : "Ajouter un professeur"}</h2>
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
                  <span>Matricule</span>
                  <input
                    type="text"
                    placeholder="ex: INF01"
                    value={formulaire.matricule}
                    onChange={(event) =>
                      handleChangerChamp({
                        target: { name: "matricule", value: event.target.value },
                      })
                    }
                    required
                  />
                </label>

                <label className="crud-page__field">
                  <span>Prenom</span>
                  <input
                    type="text"
                    placeholder="ex: Jean"
                    value={formulaire.prenom}
                    onChange={(event) =>
                      handleChangerChamp({
                        target: { name: "prenom", value: event.target.value },
                      })
                    }
                    required
                  />
                </label>

                <label className="crud-page__field">
                  <span>Nom</span>
                  <input
                    type="text"
                    placeholder="ex: Martin"
                    value={formulaire.nom}
                    onChange={(event) =>
                      handleChangerChamp({
                        target: { name: "nom", value: event.target.value },
                      })
                    }
                    required
                  />
                </label>

                <label className="crud-page__field">
                  <span>Programme</span>
                  <select
                    value={formulaire.specialite}
                    onChange={(event) =>
                      handleChangerChamp({
                        target: { name: "specialite", value: event.target.value },
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

                <div className="crud-page__field">
                  <span>Cours autorises</span>
                  <div className="professeurs-page__course-picker">
                    {formulaire.specialite ? (
                      coursCompatibles.length > 0 ? (
                        coursCompatibles.map((coursItem) => {
                          const estSelectionne = formulaire.cours_ids.includes(
                            Number(coursItem.id_cours)
                          );

                          return (
                            <label
                              key={coursItem.id_cours}
                              className={`professeurs-page__course-option ${
                                estSelectionne
                                  ? "professeurs-page__course-option--active"
                                  : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={estSelectionne}
                                onChange={() => handleBasculerCours(coursItem.id_cours)}
                              />
                              <div>
                                <strong>{coursItem.code}</strong>
                                <span>
                                  {coursItem.nom} - Etape {coursItem.etape_etude}
                                </span>
                              </div>
                            </label>
                          );
                        })
                      ) : (
                        <p className="professeurs-page__course-empty">
                          Aucun cours disponible pour ce programme.
                        </p>
                      )
                    ) : (
                      <p className="professeurs-page__course-empty">
                        Choisissez d'abord un programme.
                      </p>
                    )}
                  </div>
                </div>

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
