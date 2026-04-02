/**
 * PAGE - Salles
 *
 * Cette page gere la consultation
 * et la maintenance des salles.
 */
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import {
  recupererSalles,
  creerSalle,
  modifierSalle,
  supprimerSalle,
} from "../services/salles.api.js";
import "../styles/CrudPages.css";

export function SallesPage({ utilisateur, onLogout }) {
  const [salles, setSalles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurFormulaire, setErreurFormulaire] = useState("");
  const [recherche, setRecherche] = useState("");
  const [modalOuvert, setModalOuvert] = useState(false);
  const [edition, setEdition] = useState(null);
  const { confirm, showError, showSuccess } = usePopup();

  const [formulaire, setFormulaire] = useState({
    code: "",
    type: "",
    capacite: "",
  });

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

  useEffect(() => {
    chargerSalles();
  }, []);

  const sallesFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();

    if (!terme) {
      return salles;
    }

    return salles.filter((salle) => {
      return (
        String(salle.code || "").toLowerCase().includes(terme) ||
        String(salle.type || "").toLowerCase().includes(terme) ||
        String(salle.capacite || "").toLowerCase().includes(terme)
      );
    });
  }, [salles, recherche]);

  function ouvrirModal(salle = null) {
    setEdition(salle);
    setErreurFormulaire("");

    if (salle) {
      setFormulaire({
        code: salle.code || "",
        type: salle.type || "",
        capacite: String(salle.capacite || ""),
      });
    } else {
      setFormulaire({
        code: "",
        type: "",
        capacite: "",
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
      type: "",
      capacite: "",
    });
  }

  async function handleSoumettre(event) {
    event.preventDefault();
    setErreurFormulaire("");

    try {
      if (edition) {
        await modifierSalle(edition.id_salle, {
          type: formulaire.type,
          capacite: Number(formulaire.capacite),
        });
        showSuccess("Salle modifiee avec succes.");
      } else {
        await creerSalle({
          code: formulaire.code,
          type: formulaire.type,
          capacite: Number(formulaire.capacite),
        });
        showSuccess("Salle ajoutee avec succes.");
      }

      fermerModal();
      await chargerSalles();
    } catch (error) {
      setErreurFormulaire(error.message || "Erreur lors de l'enregistrement.");
    }
  }

  async function handleSupprimer(idSalle) {
    const confirmation = await confirm({
      title: "Supprimer la salle",
      message: "Voulez-vous vraiment supprimer cette salle ?",
      confirmLabel: "Supprimer",
      tone: "danger",
    });

    if (!confirmation) {
      return;
    }

    try {
      await supprimerSalle(idSalle);
      showSuccess("Salle supprimee avec succes.");
      await chargerSalles();
    } catch (error) {
      showError(error.message || "Erreur lors de la suppression.");
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Salles"
      subtitle="Gerez les salles disponibles dans l'etablissement."
    >
      <div className="crud-page">
        <div className="crud-page__header">
          <button
            type="button"
            className="crud-page__add-button"
            onClick={() => ouvrirModal()}
          >
            + Ajouter une salle
          </button>
        </div>

        <div className="crud-page__toolbar">
          <input
            type="text"
            className="crud-page__search"
            placeholder="Rechercher une salle..."
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
                  <th>Type</th>
                  <th>Capacite</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {sallesFiltrees.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="crud-page__empty">
                      Aucune salle trouvee.
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

        {modalOuvert ? (
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
                {!edition ? (
                  <label className="crud-page__field">
                    <span>Code</span>
                    <input
                      type="text"
                      placeholder="ex: B204"
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
                ) : null}

                <label className="crud-page__field">
                  <span>Type</span>
                  <input
                    type="text"
                    placeholder="ex: Laboratoire"
                    value={formulaire.type}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        type: event.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label className="crud-page__field">
                  <span>Capacite</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="ex: 30"
                    value={formulaire.capacite}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        capacite: event.target.value,
                      })
                    }
                    required
                  />
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
