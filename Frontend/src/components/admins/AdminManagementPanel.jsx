/**
 * COMPONENT - Admin Management Panel
 *
 * Ce composant gere l'affichage et les actions
 * liees aux sous-admins.
 */
import { useEffect, useState } from "react";
import {
  creerAdmin,
  modifierAdmin,
  recupererAdmins,
  supprimerAdmin,
} from "../../services/admins.api.js";
import { usePopup } from "../feedback/PopupProvider.jsx";

const FORMULAIRE_INITIAL = {
  nom: "",
  prenom: "",
  email: "",
  password: "",
};

export function AdminManagementPanel() {
  const [admins, setAdmins] = useState([]);
  const [formulaire, setFormulaire] = useState(FORMULAIRE_INITIAL);
  const [chargement, setChargement] = useState(true);
  const [soumission, setSoumission] = useState(false);
  const [erreur, setErreur] = useState("");
  const [editionId, setEditionId] = useState(null);
  const { confirm, showError, showSuccess } = usePopup();

  async function chargerAdmins() {
    setChargement(true);
    setErreur("");

    try {
      const resultat = await recupererAdmins();
      setAdmins(Array.isArray(resultat) ? resultat : []);
    } catch (error) {
      showError(error.message || "Impossible de charger les sous-admins.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerAdmins();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormulaire((etatActuel) => ({
      ...etatActuel,
      [name]: value,
    }));
  }

  function reinitialiserFormulaire() {
    setFormulaire(FORMULAIRE_INITIAL);
    setEditionId(null);
    setErreur("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSoumission(true);
    setErreur("");

    const payload = {
      nom: formulaire.nom,
      prenom: formulaire.prenom,
      email: formulaire.email,
      password: formulaire.password,
    };

    try {
      if (editionId) {
        await modifierAdmin(editionId, payload);
        showSuccess("Sous-admin mis a jour.");
      } else {
        await creerAdmin(payload);
        showSuccess("Sous-admin cree.");
      }

      reinitialiserFormulaire();
      await chargerAdmins();
    } catch (error) {
      setErreur(error.message || "Operation impossible.");
    } finally {
      setSoumission(false);
    }
  }

  function demarrerEdition(admin) {
    setEditionId(admin.id);
    setErreur("");
    setFormulaire({
      nom: admin.nom || "",
      prenom: admin.prenom || "",
      email: admin.email || "",
      password: "",
    });
  }

  async function handleSuppression(id) {
    setErreur("");

    const confirmation = await confirm({
      title: "Supprimer le sous-admin",
      message: "Voulez-vous vraiment supprimer ce sous-admin ?",
      confirmLabel: "Supprimer",
      tone: "danger",
    });

    if (!confirmation) {
      return;
    }

    try {
      await supprimerAdmin(id);
      showSuccess("Sous-admin supprime.");

      if (editionId === id) {
        reinitialiserFormulaire();
      }

      await chargerAdmins();
    } catch (error) {
      setErreur(error.message || "Suppression impossible.");
    }
  }

  return (
    <section className="dashboard-panel dashboard-admins">
      <div className="dashboard-panel__header">
        <h2>Sous-admins</h2>
        <span>{chargement ? "..." : `${admins.length} compte(s)`}</span>
      </div>

      <div className="dashboard-admins__content">
        <form
          className="dashboard-admins__form"
          onSubmit={handleSubmit}
          autoComplete="off"
        >
          <div className="dashboard-admins__form-head">
            <strong>{editionId ? "Modifier un sous-admin" : "Ajouter un sous-admin"}</strong>
          </div>

          <label className="dashboard-admins__field">
            <span>Nom</span>
            <input
              name="nom"
              type="text"
              value={formulaire.nom}
              onChange={handleChange}
              autoComplete="off"
              required
            />
          </label>

          <label className="dashboard-admins__field">
            <span>Prenom</span>
            <input
              name="prenom"
              type="text"
              value={formulaire.prenom}
              onChange={handleChange}
              autoComplete="off"
              required
            />
          </label>

          <label className="dashboard-admins__field">
            <span>Courriel</span>
            <input
              name="email"
              type="email"
              value={formulaire.email}
              onChange={handleChange}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>

          <label className="dashboard-admins__field">
            <span>{editionId ? "Nouveau mot de passe" : "Mot de passe"}</span>
            <input
              name="password"
              type="password"
              value={formulaire.password}
              onChange={handleChange}
              autoComplete="new-password"
              required={!editionId}
            />
          </label>

          {erreur ? (
            <div className="dashboard-admins__feedback dashboard-admins__feedback--error">
              {erreur}
            </div>
          ) : null}

          <div className="dashboard-admins__actions">
            <button className="dashboard-admins__primary" type="submit" disabled={soumission}>
              {soumission ? "Enregistrement..." : editionId ? "Mettre a jour" : "Ajouter"}
            </button>
            {editionId ? (
              <button
                className="dashboard-admins__secondary"
                type="button"
                onClick={reinitialiserFormulaire}
              >
                Annuler
              </button>
            ) : null}
          </div>
        </form>

        <div className="dashboard-admins__list">
          {chargement ? (
            <p className="dashboard-empty">Chargement des sous-admins...</p>
          ) : admins.length === 0 ? (
            <p className="dashboard-empty">Aucun sous-admin enregistre.</p>
          ) : (
            admins.map((admin) => (
              <article className="dashboard-admins__item" key={admin.id}>
                <div className="dashboard-admins__item-text">
                  <strong>
                    {admin.prenom} {admin.nom}
                  </strong>
                  <p>{admin.email}</p>
                </div>

                <div className="dashboard-admins__item-actions">
                  <button
                    className="dashboard-admins__link"
                    type="button"
                    onClick={() => demarrerEdition(admin)}
                  >
                    Modifier
                  </button>
                  <button
                    className="dashboard-admins__link dashboard-admins__link--danger"
                    type="button"
                    onClick={() => handleSuppression(admin.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
