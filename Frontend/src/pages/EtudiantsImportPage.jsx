/**
 * PAGE - Import Etudiants
 *
 * Cette page gere l'import
 * et le traitement des etudiants.
 */
import { useEffect, useMemo, useState } from "react";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import {
  recupererEtudiants,
  importerEtudiants,
  supprimerTousLesEtudiants,
} from "../services/etudiantsService.js";
import "../styles/EtudiantsImportPage.css";

export function EtudiantsImportPage({ utilisateur, onLogout }) {
  const [fichier, setFichier] = useState(null);
  const [etudiants, setEtudiants] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [etatChargement, setEtatChargement] = useState("idle");
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState("");
  const [detailsErreur, setDetailsErreur] = useState([]);
  const [resultatImport, setResultatImport] = useState(null);
  const { confirm, showError, showSuccess } = usePopup();

  async function chargerEtudiants() {
    setEtatChargement("loading");

    try {
      const liste = await recupererEtudiants();
      setEtudiants(liste || []);
      setEtatChargement("success");
    } catch (error) {
      showError(error.message || "Impossible de charger la liste des etudiants.");
      setEtatChargement("error");
    }
  }

  useEffect(() => {
    chargerEtudiants();
  }, []);

  const etudiantsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();

    if (!terme) {
      return etudiants;
    }

    return etudiants.filter((etudiant) => {
      return (
        String(etudiant.matricule || "").toLowerCase().includes(terme) ||
        String(etudiant.nom || "").toLowerCase().includes(terme) ||
        String(etudiant.prenom || "").toLowerCase().includes(terme) ||
        String(etudiant.programme || "").toLowerCase().includes(terme) ||
        String(etudiant.groupe || "").toLowerCase().includes(terme) ||
        String(etudiant.etape || "").toLowerCase().includes(terme) ||
        String(etudiant.session || "").toLowerCase().includes(terme)
      );
    });
  }, [etudiants, recherche]);

  async function handleImport(event) {
    event.preventDefault();
    setErreurFormulaire("");
    setDetailsErreur([]);
    setResultatImport(null);

    if (!fichier) {
      setErreurFormulaire("Veuillez selectionner un fichier Excel ou CSV.");
      return;
    }

    setEtatChargement("loading");

    try {
      const resultat = await importerEtudiants(fichier);
      setResultatImport(resultat);
      showSuccess(resultat.message || "Import reussi.");
      setFichier(null);
      await chargerEtudiants();
    } catch (error) {
      setErreurFormulaire(error.message || "Erreur lors de l'import.");
      setDetailsErreur(Array.isArray(error.details) ? error.details : []);
      setEtatChargement("error");
    }
  }

  async function handleSupprimerTous() {
    const confirmation = await confirm({
      title: "Supprimer tous les etudiants",
      message:
        "Tous les etudiants importes, leurs groupes generes et les horaires lies seront supprimes. Continuer ?",
      confirmLabel: "Tout supprimer",
      tone: "danger",
    });

    if (!confirmation) {
      return;
    }

    setSuppressionEnCours(true);
    setErreurFormulaire("");
    setDetailsErreur([]);

    try {
      await supprimerTousLesEtudiants();
      setResultatImport(null);
      setFichier(null);
      showSuccess("Tous les etudiants ont ete supprimes.");
      await chargerEtudiants();
    } catch (error) {
      showError(error.message || "Erreur lors de la suppression des etudiants.");
    } finally {
      setSuppressionEnCours(false);
    }
  }

  return (
    <div className="import-page">
        <section className="import-page__card import-page__card--upload">
          <div className="import-page__header">
            <div>
              <h2>Importer un fichier</h2>
              <p className="import-page__text">
                Colonnes attendues : matricule, nom, prenom, programme, etape.
              </p>
              <p className="import-page__text">
                La session reste optionnelle dans le fichier. Les groupes sont generes automatiquement par programme, etape et session avec une repartition equilibree.
              </p>
            </div>

            <button
              type="button"
              className="import-page__danger-button"
              onClick={handleSupprimerTous}
              disabled={suppressionEnCours || etudiants.length === 0}
            >
              {suppressionEnCours ? "Suppression..." : "Supprimer tous"}
            </button>
          </div>

          <form className="import-page__form" onSubmit={handleImport}>
            <label className="import-page__upload">
              <span>Fichier etudiant</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => setFichier(event.target.files?.[0] || null)}
              />
            </label>

            {fichier ? (
              <div className="import-page__file">Selectionne : {fichier.name}</div>
            ) : null}

            {erreurFormulaire ? (
              <div className="crud-page__alert crud-page__alert--error crud-page__form-feedback">
                {erreurFormulaire}
              </div>
            ) : null}

            {detailsErreur.length > 0 ? (
              <div className="crud-page__alert crud-page__alert--error crud-page__form-feedback">
                {detailsErreur.slice(0, 8).map((detail) => (
                  <div key={detail}>{detail}</div>
                ))}
              </div>
            ) : null}

            <button
              className="import-page__primary-button"
              type="submit"
              disabled={etatChargement === "loading"}
            >
              {etatChargement === "loading" ? "Import en cours..." : "Importer"}
            </button>
          </form>

          {resultatImport?.nombre_importes !== undefined ? (
            <div className="import-page__summary">
              <strong>{resultatImport.nombre_importes} etudiant(s) importe(s).</strong>
              <span>
                {resultatImport.cohorte_utilisee
                  ? `Session par defaut utilisee : ${resultatImport.cohorte_utilisee.session}.`
                  : "La liste ci-dessous a ete rechargee apres l'import."}
              </span>
              {Number(resultatImport.nombre_etudiants_ignores || 0) > 0 ? (
                <span>
                  {resultatImport.nombre_etudiants_ignores} etudiant(s) non utilisable(s)
                  ont ete ignore(s) automatiquement.
                </span>
              ) : null}
              {Number(resultatImport.nombre_cohortes_ignorees || 0) > 0 ? (
                <span>
                  {resultatImport.nombre_cohortes_ignorees} cohorte(s) non exploitable(s)
                  ont ete exclue(s) de l'import.
                </span>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="crud-page__toolbar">
          <input
            type="text"
            className="crud-page__search"
            placeholder="Rechercher un etudiant..."
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
          />
        </div>

        <section className="crud-page__table-card">
          {etatChargement === "loading" ? (
            <p className="crud-page__state">Chargement...</p>
          ) : etatChargement === "error" ? (
            <p className="crud-page__state">Impossible de charger les etudiants.</p>
          ) : (
            <table className="crud-page__table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom</th>
                  <th>Prenom</th>
                  <th>Groupe</th>
                  <th>Programme</th>
                  <th>Etape</th>
                  <th>Session</th>
                </tr>
              </thead>

              <tbody>
                {etudiantsFiltres.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="crud-page__empty">
                      Aucun etudiant trouve.
                    </td>
                  </tr>
                ) : (
                  etudiantsFiltres.map((etudiant) => (
                    <tr key={etudiant.id_etudiant}>
                      <td>{etudiant.matricule}</td>
                      <td>{etudiant.nom}</td>
                      <td>{etudiant.prenom}</td>
                      <td>{etudiant.groupe || "A generer"}</td>
                      <td>{etudiant.programme}</td>
                      <td>{etudiant.etape}</td>
                      <td>{etudiant.session}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
  );
}
