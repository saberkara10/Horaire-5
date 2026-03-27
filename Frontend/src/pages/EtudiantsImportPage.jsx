import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import {
  recupererEtudiants,
  importerEtudiants,
} from "../services/etudiantsService.js";
import "../styles/EtudiantsImportPage.css";

export function EtudiantsImportPage({ utilisateur, onLogout }) {
  const [fichier, setFichier] = useState(null);
  const [etudiants, setEtudiants] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [etatChargement, setEtatChargement] = useState("idle");
  const [messageSucces, setMessageSucces] = useState("");
  const [messageErreur, setMessageErreur] = useState("");
  const [resultatImport, setResultatImport] = useState(null);

  async function chargerEtudiants() {
    setEtatChargement("loading");
    setMessageErreur("");

    try {
      const liste = await recupererEtudiants();
      setEtudiants(liste || []);
      setEtatChargement("success");
    } catch (error) {
      setMessageErreur(
        error.message || "Impossible de charger la liste des étudiants."
      );
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
        String(etudiant.groupe || "").toLowerCase().includes(terme) ||
        String(etudiant.programme || "").toLowerCase().includes(terme) ||
        String(etudiant.etape || "").toLowerCase().includes(terme)
      );
    });
  }, [etudiants, recherche]);

  async function handleImport(event) {
    event.preventDefault();
    setMessageSucces("");
    setMessageErreur("");
    setResultatImport(null);

    if (!fichier) {
      setMessageErreur("Veuillez sélectionner un fichier Excel ou CSV.");
      return;
    }

    setEtatChargement("loading");

    try {
      const resultat = await importerEtudiants(fichier);
      setResultatImport(resultat);
      setMessageSucces(resultat.message || "Import réussi.");
      setFichier(null);
      await chargerEtudiants();
    } catch (error) {
      setMessageErreur(error.message || "Erreur lors de l'import.");
      setEtatChargement("error");
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Import Étudiants"
      subtitle="Importez un fichier Excel ou CSV pour alimenter la liste des étudiants."
    >
      <div className="import-page">
        <section className="import-page__card import-page__card--upload">
          <h2>Importer un fichier</h2>
          <p className="import-page__text">
            Colonnes attendues : matricule, nom, prenom, groupe, programme, etape.
          </p>

          <form className="import-page__form" onSubmit={handleImport}>
            <label className="import-page__upload">
              <span>Fichier étudiant</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) =>
                  setFichier(event.target.files?.[0] || null)
                }
              />
            </label>

            {fichier ? (
              <div className="import-page__file">
                Sélectionné : {fichier.name}
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

          {messageSucces ? (
            <div className="import-page__alert import-page__alert--success">
              <p>{messageSucces}</p>
              {resultatImport?.nombreImportes !== undefined ? (
                <p>{resultatImport.nombreImportes} étudiant(s) importé(s).</p>
              ) : null}
            </div>
          ) : null}

          {messageErreur ? (
            <div className="import-page__alert import-page__alert--error">
              <p>{messageErreur}</p>
            </div>
          ) : null}
        </section>

        <div className="crud-page__toolbar">
          <input
            type="text"
            className="crud-page__search"
            placeholder="Rechercher un étudiant..."
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
          />
        </div>

        <section className="crud-page__table-card">
          {etatChargement === "loading" ? (
            <p className="crud-page__state">Chargement...</p>
          ) : etatChargement === "error" ? (
            <p className="crud-page__state">
              Impossible de charger les étudiants.
            </p>
          ) : (
            <table className="crud-page__table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Groupe</th>
                  <th>Programme</th>
                  <th>Étape</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {etudiantsFiltres.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="crud-page__empty">
                      Aucun étudiant trouvé.
                    </td>
                  </tr>
                ) : (
                  etudiantsFiltres.map((etudiant) => (
                    <tr key={etudiant.id_etudiant}>
                      <td>{etudiant.matricule}</td>
                      <td>{etudiant.nom}</td>
                      <td>{etudiant.prenom}</td>
                      <td>{etudiant.groupe}</td>
                      <td>{etudiant.programme}</td>
                      <td>{etudiant.etape}</td>

                                {/* BOUTON */}
          <td>
            <button
              className="crud-page__action-button"
              onClick={() =>
                (window.location.href = `/planning-etudiant/${etudiant.id_etudiant}`)
              }
            >
              Voir l’horaire
            </button>
          </td>
                    </tr>
                    
                  ))
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </AppShell>
  );
}