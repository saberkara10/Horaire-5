/**
 * Composant — Modale de formulaire pour les salles.
 *
 * Affiche une fenêtre modale avec un formulaire permettant de créer ou modifier
 * une salle. Le mode ("creation" ou "edition") est déterminé par la prop `mode`
 * passée par le composant parent (SallesPage).
 *
 * Comportements importants :
 *  - En mode édition, le champ "Code" est désactivé (les codes ne changent pas).
 *  - Les valeurs du formulaire sont initialisées/réinitialisées à chaque ouverture
 *    de la modale via useEffect, ce qui évite des données résiduelles.
 *  - La validation locale (champs vides, capacité <= 0) est faite avant d'appeler
 *    onSoumettre() pour épargner des appels réseau inutiles.
 *  - Les erreurs renvoyées par le backend (code déjà utilisé, etc.) sont affichées
 *    via le catch sur onSoumettre().
 *
 * @module components/salles/SalleFormModal
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * État vide du formulaire.
 * Utilisé comme point de départ pour les créations et pour le reset après fermeture.
 *
 * @type {{ code: string, type: string, capacite: string }}
 */
const ETAT_INITIAL = {
  code: "",
  type: "",
  capacite: "30", // 30 places par défaut — valeur raisonnable pour une salle standard
};

/**
 * Normalise les données d'une salle existante vers le format attendu par le formulaire.
 *
 * Utilisée pour pré-remplir le formulaire en mode édition.
 * Quand `salle` est null (mode création), retourne l'état initial vide.
 *
 * @param {object|null} salle - La salle à éditer, ou null pour une nouvelle salle
 * @returns {{ code: string, type: string, capacite: string }} Valeurs prêtes pour le formulaire
 */
function normaliserValeurs(salle) {
  if (!salle) {
    return ETAT_INITIAL;
  }

  return {
    code: salle.code || "",
    type: salle.type || "",
    capacite: String(salle.capacite || "30"),
  };
}

/**
 * Modale de formulaire pour créer ou modifier une salle.
 *
 * @param {object} props
 * @param {boolean} props.estOuvert - Contrôle la visibilité de la modale
 * @param {"creation"|"edition"} props.mode - Détermine le comportement du formulaire
 * @param {object|null} props.salle - La salle à éditer (null pour une création)
 * @param {Function} props.onFermer - Callback appelé quand l'utilisateur ferme la modale
 * @param {Function} props.onSoumettre - Callback appelé avec les données validées
 * @param {string|null} props.actionEnCours - État de l'action en cours ("creation", "modification-{id}")
 * @returns {JSX.Element|null} La modale ou null si elle est fermée
 */
export function SalleFormModal({
  estOuvert,
  mode,
  salle,
  onFermer,
  onSoumettre,
  actionEnCours,
}) {
  // Valeurs actuelles des champs du formulaire
  const [valeurs, setValeurs] = useState(ETAT_INITIAL);

  // Message d'erreur de validation locale ou erreur renvoyée par le backend
  const [erreurLocale, setErreurLocale] = useState("");

  // Réinitialiser le formulaire à chaque ouverture de la modale
  // Si mode=edition, pré-remplir avec les données de la salle sélectionnée
  useEffect(() => {
    if (!estOuvert) {
      return;
    }

    setValeurs(normaliserValeurs(salle));
    setErreurLocale(""); // Effacer les erreurs précédentes
  }, [estOuvert, salle]);

  // Ne rien rendre si la modale est fermée (unmount du DOM)
  if (!estOuvert) {
    return null;
  }

  /**
   * Met à jour un champ individuel du formulaire de manière générique.
   *
   * Utilise le spread de l'état actuel pour préserver les autres champs.
   * La clé est dynamique, ce qui permet de réutiliser cette fonction pour
   * tous les champs plutôt qu'en avoir une par champ.
   *
   * @param {string} cle - Nom du champ à mettre à jour
   * @param {string} valeur - Nouvelle valeur du champ
   */
  function mettreAJourChamp(cle, valeur) {
    setValeurs((etatActuel) => ({
      ...etatActuel,
      [cle]: valeur,
    }));
  }

  /**
   * Gère la soumission du formulaire.
   *
   * Étapes :
   *  1. Empêcher le rechargement de la page (comportement natif du formulaire HTML)
   *  2. Effacer l'erreur précédente
   *  3. Valider les champs obligatoires
   *  4. Appeler onSoumettre() avec les données nettoyées
   *  5. Afficher l'erreur backend si onSoumettre() échoue
   *
   * @param {React.FormEvent} event - L'événement de soumission du formulaire
   */
  async function gererSoumission(event) {
    event.preventDefault(); // Pas de rechargement de page
    setErreurLocale("");

    // Validation locale — on vérifie avant d'envoyer au serveur
    if (!valeurs.code.trim() || !valeurs.type.trim()) {
      setErreurLocale("Les champs code et type sont obligatoires.");
      return;
    }

    if (Number(valeurs.capacite) <= 0) {
      setErreurLocale("La capacite doit etre superieure a 0.");
      return;
    }

    // Appel au parent avec les données nettoyées et converties
    await onSoumettre({
      code: valeurs.code.trim(),
      type: valeurs.type.trim(),
      capacite: Number(valeurs.capacite), // Convertir en nombre (l'input renvoie une chaîne)
    }).catch((error) => {
      // Afficher l'erreur du backend (ex: code déjà utilisé → 409 Conflict)
      setErreurLocale(error.message);
    });
  }

  // Libellé du titre selon le mode
  const titre = mode === "edition" ? "Modifier une salle" : "Ajouter une salle";

  // Vrai quand une opération réseau est en cours → désactiver le bouton submit
  const estEnTraitement =
    actionEnCours === "creation" || actionEnCours?.startsWith("modification-");

  return (
    // Overlay sombre cliquable qui ferme la modale en cliquant en dehors
    <div className="modal-overlay" role="presentation" onClick={onFermer}>
      {/* stopPropagation empêche le clic sur le contenu de fermer la modale */}
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="salle-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="salle-form-title">
            {titre}
          </h2>
          <button type="button" onClick={onFermer} className="modal-close" aria-label="Fermer">
            <X />
          </button>
        </div>

        {/* Erreur de validation ou erreur backend */}
        {erreurLocale ? <div className="modal-error">{erreurLocale}</div> : null}

        <form onSubmit={gererSoumission} className="modal-form">
          <div className="modal-form-row">
            <div className="modal-field">
              <label>Code</label>
              <input
                type="text"
                required
                maxLength={50}
                disabled={mode === "edition"} // Le code ne change pas en édition
                value={valeurs.code}
                onChange={(event) => mettreAJourChamp("code", event.target.value)}
                placeholder="A-101"
              />
            </div>

            <div className="modal-field">
              <label>Capacite</label>
              <input
                type="number"
                required
                min="1"
                value={valeurs.capacite}
                onChange={(event) => mettreAJourChamp("capacite", event.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          <div className="modal-field">
            <label>Type</label>
            <input
              type="text"
              required
              maxLength={50}
              value={valeurs.type}
              onChange={(event) => mettreAJourChamp("type", event.target.value)}
              placeholder="Laboratoire"
            />
          </div>

          <div className="modal-actions">
            {/* Bouton désactivé pendant le traitement pour éviter les doubles soumissions */}
            <button type="submit" disabled={estEnTraitement} className="modal-submit">
              {estEnTraitement ? "Enregistrement..." : mode === "edition" ? "Modifier" : "Ajouter"}
            </button>
            <button type="button" onClick={onFermer} className="modal-cancel">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
