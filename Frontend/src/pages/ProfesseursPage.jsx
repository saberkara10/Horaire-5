import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import {
  recupererProfesseurs,
  creerProfesseur,
  modifierProfesseur,
  supprimerProfesseur,
} from "../services/professeurs.api.js";
import "../styles/ProfesseursPage.css";

export function ProfesseursPage({ utilisateur, onLogout }) {
  const [professeurs, setProfesseurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [recherche, setRecherche] = useState("");
  const [modalOuvert, setModalOuvert] = useState(false);
  const [edition, setEdition] = useState(null);

  const [formulaire, setFormulaire] = useState({
    matricule: "",
    prenom: "",
    nom: "",
    specialite: "",
  });

  async function chargerProfesseurs() {
    setChargement(true);
    setErreur("");

    try {
      const data = await recupererProfesseurs();
      setProfesseurs(data || []);
    } catch (error) {
      setErreur(error.message || "Impossible de charger les professeurs.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerProfesseurs();
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
        String(professeur.specialite || "").toLowerCase().includes(terme)
      );
    });
  }, [professeurs, recherche]);

  function ouvrirModal(professeur = null) {
    setEdition(professeur);

    if (professeur) {
      setFormulaire({
        matricule: professeur.matricule || "",
        prenom: professeur.prenom || "",
        nom: professeur.nom || "",
        specialite: professeur.specialite || "",
      });
    } else {
      setFormulaire({
        matricule: "",
        prenom: "",
        nom: "",
        specialite: "",
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
      matricule: "",
      prenom: "",
      nom: "",
      specialite: "",
    });
  }

  async function handleSoumettre(event) {
    event.preventDefault();
    setErreur("");
    setMessage("");

    try {
      if (edition) {
        await modifierProfesseur(edition.id_professeur, formulaire);
        setMessage("Professeur modifié avec succès.");
      } else {
        await creerProfesseur(formulaire);
        setMessage("Professeur ajouté avec succès.");
      }

      fermerModal();
      await chargerProfesseurs();
    } catch (error) {
      setErreur(error.message || "Erreur lors de la sauvegarde.");
    }
  }

  async function handleSupprimer(idProfesseur) {
    const confirmation = window.confirm(
      "Voulez-vous vraiment supprimer ce professeur ?"
    );

    if (!confirmation) {
      return;
    }

    setErreur("");
    setMessage("");

    try {
      await supprimerProfesseur(idProfesseur);
      setMessage("Professeur supprimé avec succès.");
      await chargerProfesseurs();
    } catch (error) {
      setErreur(error.message || "Erreur lors de la suppression.");
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Professeurs"
      subtitle="Gérez les enseignants, leurs informations et leurs spécialités."
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
            placeholder="Rechercher un professeur..."
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
                  <th>Matricule</th>
                  <th>Prénom</th>
                  <th>Nom</th>
                  <th>Spécialité</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {professeursFiltres.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="crud-page__empty">
                      Aucun professeur trouvé.
                    </td>
                  </tr>
                ) : (
                  professeursFiltres.map((professeur) => (
                    <tr key={professeur.id_professeur}>
                      <td>{professeur.matricule}</td>
                      <td>{professeur.prenom}</td>
                      <td>{professeur.nom}</td>
                      <td>{professeur.specialite}</td>
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
                  ×
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
                      setFormulaire({
                        ...formulaire,
                        matricule: event.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label className="crud-page__field">
                  <span>Prénom</span>
                  <input
                    type="text"
                    placeholder="ex: Jean"
                    value={formulaire.prenom}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        prenom: event.target.value,
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
                      setFormulaire({
                        ...formulaire,
                        nom: event.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label className="crud-page__field">
                  <span>Spécialité</span>
                  <input
                    type="text"
                    placeholder="ex: Informatique"
                    value={formulaire.specialite}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        specialite: event.target.value,
                      })
                    }
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