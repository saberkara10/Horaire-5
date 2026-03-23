import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import {
  recupererCours,
  creerCours,
  modifierCours,
  supprimerCours,
} from "../services/cours.api.js";
import "../styles/CrudPages.css";

const ETAPES_DISPONIBLES = ["1", "2", "3", "4"];

export function CoursPage({ utilisateur, onLogout }) {
  const [cours, setCours] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [recherche, setRecherche] = useState("");
  const [modalOuvert, setModalOuvert] = useState(false);
  const [edition, setEdition] = useState(null);

  const [formulaire, setFormulaire] = useState({
    code: "",
    nom: "",
    duree: "1",
    programme: "",
    etape_etude: "1",
    type_salle: "",
  });

  async function chargerCours() {
    setChargement(true);
    setErreur("");

    try {
      const data = await recupererCours();
      setCours(data || []);
    } catch (error) {
      setErreur(error.message || "Impossible de récupérer les cours.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerCours();
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
        String(element.type_salle || "").toLowerCase().includes(terme) ||
        String(element.etape_etude || "").toLowerCase().includes(terme)
      );
    });
  }, [cours, recherche]);

  function ouvrirModal(coursAEditer = null) {
    setEdition(coursAEditer);

    if (coursAEditer) {
      setFormulaire({
        code: coursAEditer.code || "",
        nom: coursAEditer.nom || "",
        duree: String(coursAEditer.duree || "1"),
        programme: coursAEditer.programme || "",
        etape_etude: String(coursAEditer.etape_etude || "1"),
        type_salle: coursAEditer.type_salle || "",
      });
    } else {
      setFormulaire({
        code: "",
        nom: "",
        duree: "1",
        programme: "",
        etape_etude: "1",
        type_salle: "",
      });
    }

    setErreur("");
    setMessage("");
    setModalOuvert(true);
  }

  function fermerModal() {
    setModalOuvert(false);
    setEdition(null);
    setFormulaire({
      code: "",
      nom: "",
      duree: "1",
      programme: "",
      etape_etude: "1",
      type_salle: "",
    });
  }

  async function handleSoumettre(event) {
    event.preventDefault();
    setErreur("");
    setMessage("");

    try {
      const payload = {
        ...formulaire,
        duree: Number(formulaire.duree),
        etape_etude: String(formulaire.etape_etude),
      };

      if (edition) {
        await modifierCours(edition.id_cours, payload);
        setMessage("Cours modifié avec succès.");
      } else {
        await creerCours(payload);
        setMessage("Cours créé avec succès.");
      }

      fermerModal();
      await chargerCours();
    } catch (error) {
      setErreur(error.message || "Erreur lors de la sauvegarde.");
    }
  }

  async function handleSupprimer(idCours) {
    const confirmation = window.confirm(
      "Voulez-vous vraiment supprimer ce cours ?"
    );

    if (!confirmation) {
      return;
    }

    setErreur("");
    setMessage("");

    try {
      await supprimerCours(idCours);
      setMessage("Cours supprimé avec succès.");
      await chargerCours();
    } catch (error) {
      setErreur(error.message || "Erreur lors de la suppression.");
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Cours"
      subtitle="Gérez les cours, programmes, étapes et types de salles."
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
            placeholder="Rechercher un cours..."
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
          />
        </div>

        {erreur ? <div className="crud-page__alert crud-page__alert--error">{erreur}</div> : null}
        {message ? <div className="crud-page__alert crud-page__alert--success">{message}</div> : null}

        <section className="crud-page__table-card">
          {chargement ? (
            <p className="crud-page__state">Chargement...</p>
          ) : (
            <table className="crud-page__table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom</th>
                  <th>Durée</th>
                  <th>Programme</th>
                  <th>Étape</th>
                  <th>Type salle</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {coursFiltres.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="crud-page__empty">
                      Aucun cours trouvé.
                    </td>
                  </tr>
                ) : (
                  coursFiltres.map((element) => (
                    <tr key={element.id_cours}>
                      <td>{element.code}</td>
                      <td>{element.nom}</td>
                      <td>{element.duree}</td>
                      <td>{element.programme}</td>
                      <td>{element.etape_etude}</td>
                      <td>{element.type_salle}</td>
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
                  ×
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
                    placeholder="ex: Développement Web"
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
                  <span>Durée</span>
                  <input
                    type="number"
                    min="1"
                    value={formulaire.duree}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        duree: event.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label className="crud-page__field">
                  <span>Programme</span>
                  <input
                    type="text"
                    placeholder="ex: Informatique"
                    value={formulaire.programme}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        programme: event.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label className="crud-page__field">
                  <span>Étape</span>
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
                        {etape}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="crud-page__field">
                  <span>Type de salle</span>
                  <input
                    type="text"
                    placeholder="ex: Laboratoire"
                    value={formulaire.type_salle}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        type_salle: event.target.value,
                      })
                    }
                    required
                  />
                </label>

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