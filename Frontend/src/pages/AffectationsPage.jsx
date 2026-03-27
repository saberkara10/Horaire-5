import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { recupererCours } from "../services/cours.api.js";
import { recupererProfesseurs } from "../services/professeurs.api.js";
import { recupererSalles } from "../services/salles.api.js";
import { recupererProgrammes } from "../services/programmes.api.js";
import { apiRequest } from "../services/api.js";
import {
  genererHoraire,
  modifierAffectation,
  recupererAffectation,
  recupererHoraires,
  resetHoraires,
  supprimerAffectation,
} from "../services/horaire.api.js";
import "../styles/AffectationsPage.css";

const ETAPES_REFERENCE = ["1", "2", "3", "4", "5", "6", "7", "8"];

function normaliserTexte(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formaterHeure(heure) {
  return heure ? heure.slice(0, 5) : "";
}

function formaterDate(date) {
  if (!date) {
    return "";
  }

  const [annee, mois, jour] = String(date).split("-").map(Number);
  const dateLocale = new Date(annee, (mois || 1) - 1, jour || 1);

  return dateLocale.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dateCouranteLocale() {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

function extraireCoursIds(coursIds) {
  return String(coursIds || "")
    .split(",")
    .map((idCours) => Number(idCours.trim()))
    .filter((idCours) => Number.isInteger(idCours) && idCours > 0);
}

export function AffectationsPage({ utilisateur, onLogout }) {
  const [cours, setCours] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);
  const [salles, setSalles] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [horaires, setHoraires] = useState([]);
  const [resumeGeneration, setResumeGeneration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [resetEnCours, setResetEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [modalOuvert, setModalOuvert] = useState(false);
  const [sauvegardeEdition, setSauvegardeEdition] = useState(false);
  const [formulaireEdition, setFormulaireEdition] = useState({
    id_affectation_cours: null,
    id_cours: "",
    id_professeur: "",
    id_salle: "",
    date: "",
    heure_debut: "",
    heure_fin: "",
    groupes: "",
    cours_label: "",
  });
  const [filtresGeneration, setFiltresGeneration] = useState({
    programme: "",
    etape: "",
    mode_groupe: "all",
    id_groupe: "",
    date_debut: dateCouranteLocale(),
  });
  const [filtresAffectations, setFiltresAffectations] = useState({
    recherche: "",
    professeur: "",
    groupe: "",
    date: "",
  });

  async function chargerDonnees() {
    setLoading(true);
    setErreur("");

    try {
      const [
        coursData,
        profsData,
        sallesData,
        groupesData,
        programmesData,
        affectationsData,
      ] = await Promise.all([
        recupererCours(),
        recupererProfesseurs(),
        recupererSalles(),
        apiRequest("/api/groupes?details=1"),
        recupererProgrammes(),
        recupererHoraires(),
      ]);

      setCours(Array.isArray(coursData) ? coursData : []);
      setProfesseurs(Array.isArray(profsData) ? profsData : []);
      setSalles(Array.isArray(sallesData) ? sallesData : []);
      setGroupes(Array.isArray(groupesData) ? groupesData : []);
      setProgrammes(Array.isArray(programmesData) ? programmesData : []);
      setHoraires(Array.isArray(affectationsData) ? affectationsData : []);
    } catch (error) {
      setErreur(error.message || "Impossible de charger les donnees.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    chargerDonnees();
  }, []);

  const programmesDisponibles = useMemo(() => {
    return [...new Set(programmes.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "fr")
    );
  }, [programmes]);

  const etapesDisponibles = useMemo(() => {
    if (!filtresGeneration.programme) {
      return [];
    }

    const programmeNormalise = normaliserTexte(filtresGeneration.programme);
    const etapesCours = cours
      .filter(
        (element) => normaliserTexte(element.programme) === programmeNormalise
      )
      .map((element) => String(element.etape_etude || "").trim());

    const etapesGroupes = groupes
      .filter(
        (groupe) => normaliserTexte(groupe.programme) === programmeNormalise
      )
      .map((groupe) => String(groupe.etape || "").trim());

    const etapesLiees = [
      ...new Set([...etapesCours, ...etapesGroupes].filter(Boolean)),
    ]
      .filter((etape) => ETAPES_REFERENCE.includes(etape))
      .sort((etapeA, etapeB) => Number(etapeA) - Number(etapeB));

    return etapesLiees.length > 0 ? etapesLiees : ETAPES_REFERENCE;
  }, [cours, groupes, filtresGeneration.programme]);

  const groupesFiltres = useMemo(() => {
    return groupes.filter((groupe) => {
      if (
        filtresGeneration.programme &&
        normaliserTexte(groupe.programme) !==
          normaliserTexte(filtresGeneration.programme)
      ) {
        return false;
      }

      if (
        filtresGeneration.etape &&
        String(groupe.etape) !== String(filtresGeneration.etape)
      ) {
        return false;
      }

      return true;
    });
  }, [groupes, filtresGeneration.programme, filtresGeneration.etape]);

  const coursFiltres = useMemo(() => {
    return cours.filter((element) => {
      if (
        filtresGeneration.programme &&
        normaliserTexte(element.programme) !==
          normaliserTexte(filtresGeneration.programme)
      ) {
        return false;
      }

      if (
        filtresGeneration.etape &&
        String(element.etape_etude) !== String(filtresGeneration.etape)
      ) {
        return false;
      }

      return true;
    });
  }, [cours, filtresGeneration.programme, filtresGeneration.etape]);

  const professeursCompatibles = useMemo(() => {
    const idsCoursSelectionnes = new Set(
      coursFiltres.map((element) => Number(element.id_cours)).filter(Boolean)
    );

    return professeurs.filter((professeur) => {
      const coursProfesseur = extraireCoursIds(professeur.cours_ids);
      return coursProfesseur.some((idCours) => idsCoursSelectionnes.has(idCours));
    });
  }, [professeurs, coursFiltres]);

  const sallesCompatibles = useMemo(() => {
    const idsSallesRequises = new Set(
      coursFiltres
        .map((element) => Number(element.id_salle_reference))
        .filter((idSalle) => Number.isInteger(idSalle) && idSalle > 0)
    );

    return salles.filter((salle) => idsSallesRequises.has(Number(salle.id_salle)));
  }, [coursFiltres, salles]);

  const groupeSelectionne = useMemo(() => {
    if (!filtresGeneration.id_groupe) {
      return null;
    }

    return (
      groupesFiltres.find(
        (groupe) =>
          Number(groupe.id_groupes_etudiants) === Number(filtresGeneration.id_groupe)
      ) || null
    );
  }, [groupesFiltres, filtresGeneration.id_groupe]);

  const groupesAffectationsDisponibles = useMemo(() => {
    return [...new Set(horaires.map((affectation) => affectation.groupes).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "fr")
    );
  }, [horaires]);

  const professeursAffectationsDisponibles = useMemo(() => {
    return [...new Set(
      horaires
        .map(
          (affectation) =>
            `${affectation.professeur_prenom || ""} ${affectation.professeur_nom || ""}`.trim()
        )
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "fr"));
  }, [horaires]);

  const horairesFiltres = useMemo(() => {
    const rechercheNormalisee = normaliserTexte(filtresAffectations.recherche);

    return horaires.filter((affectation) => {
      if (filtresAffectations.professeur) {
        const professeur = `${affectation.professeur_prenom || ""} ${
          affectation.professeur_nom || ""
        }`.trim();

        if (professeur !== filtresAffectations.professeur) {
          return false;
        }
      }

      if (filtresAffectations.groupe && affectation.groupes !== filtresAffectations.groupe) {
        return false;
      }

      if (filtresAffectations.date && affectation.date !== filtresAffectations.date) {
        return false;
      }

      if (!rechercheNormalisee) {
        return true;
      }

      const contenu = normaliserTexte(
        [
          affectation.cours_code,
          affectation.cours_nom,
          affectation.professeur_prenom,
          affectation.professeur_nom,
          affectation.salle_code,
          affectation.groupes,
        ].join(" ")
      );

      return contenu.includes(rechercheNormalisee);
    });
  }, [horaires, filtresAffectations]);

  function handleChangerFiltre(event) {
    const { name, value } = event.target;

    setFiltresGeneration((valeurActuelle) => {
      if (name === "programme") {
        return {
          ...valeurActuelle,
          programme: value,
          etape: "",
          id_groupe: "",
        };
      }

      if (name === "etape") {
        return {
          ...valeurActuelle,
          etape: value,
          id_groupe: "",
        };
      }

      if (name === "mode_groupe") {
        return {
          ...valeurActuelle,
          mode_groupe: value,
          id_groupe: value === "single" ? valeurActuelle.id_groupe : "",
        };
      }

      return {
        ...valeurActuelle,
        [name]: value,
      };
    });
  }

  function handleChangerFiltreAffectation(event) {
    const { name, value } = event.target;
    setFiltresAffectations((valeurActuelle) => ({
      ...valeurActuelle,
      [name]: value,
    }));
  }

  function reinitialiserFiltresAffectations() {
    setFiltresAffectations({
      recherche: "",
      professeur: "",
      groupe: "",
      date: "",
    });
  }

  async function handleGenerer() {
    if (!filtresGeneration.programme || !filtresGeneration.etape) {
      setErreur("Selectionnez d'abord un programme et une etape.");
      return;
    }

    if (
      filtresGeneration.mode_groupe === "single" &&
      !filtresGeneration.id_groupe
    ) {
      setErreur("Selectionnez un groupe pour la generation ciblee.");
      return;
    }

    setGenerationEnCours(true);
    setMessage("");
    setErreur("");

    try {
      const resultat = await genererHoraire({
        programme: filtresGeneration.programme,
        etape: filtresGeneration.etape,
        mode_groupe: filtresGeneration.mode_groupe,
        id_groupe:
          filtresGeneration.mode_groupe === "single"
            ? Number(filtresGeneration.id_groupe)
            : null,
        date_debut: filtresGeneration.date_debut,
      });

      setResumeGeneration(resultat);
      setMessage(resultat.message || "Generation terminee.");
      const horairesData = await recupererHoraires();
      setHoraires(Array.isArray(horairesData) ? horairesData : []);
    } catch (error) {
      setErreur(error.message || "Erreur lors de la generation.");
    } finally {
      setGenerationEnCours(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("Supprimer tous les horaires generes ?")) {
      return;
    }

    setResetEnCours(true);
    setMessage("");
    setErreur("");

    try {
      await resetHoraires();
      setResumeGeneration(null);
      setHoraires([]);
      setMessage("Horaires reinitialises.");
    } catch (error) {
      setErreur(error.message || "Erreur lors de la reinitialisation.");
    } finally {
      setResetEnCours(false);
    }
  }

  async function handleSupprimer(idAffectation) {
    if (!window.confirm("Supprimer cette affectation ?")) {
      return;
    }

    setMessage("");
    setErreur("");

    try {
      await supprimerAffectation(idAffectation);
      const horairesData = await recupererHoraires();
      setHoraires(Array.isArray(horairesData) ? horairesData : []);
      setMessage("Affectation supprimee.");
    } catch (error) {
      setErreur(error.message || "Erreur lors de la suppression.");
    }
  }

  async function handleOuvrirEdition(idAffectation) {
    setErreur("");
    setMessage("");

    try {
      const detail = await recupererAffectation(idAffectation);
      setFormulaireEdition({
        id_affectation_cours: detail.id_affectation_cours,
        id_cours: String(detail.id_cours || ""),
        id_professeur: String(detail.id_professeur || ""),
        id_salle: String(detail.id_salle || ""),
        date: detail.date || "",
        heure_debut: formaterHeure(detail.heure_debut),
        heure_fin: formaterHeure(detail.heure_fin),
        groupes: detail.groupes || "",
        cours_label: `${detail.cours_code} - ${detail.cours_nom}`,
      });
      setModalOuvert(true);
    } catch (error) {
      setErreur(error.message || "Impossible de charger cette affectation.");
    }
  }

  function handleChangerEdition(event) {
    const { name, value } = event.target;
    setFormulaireEdition((valeurActuelle) => ({
      ...valeurActuelle,
      [name]: value,
    }));
  }

  function fermerModal() {
    setModalOuvert(false);
    setSauvegardeEdition(false);
    setFormulaireEdition({
      id_affectation_cours: null,
      id_cours: "",
      id_professeur: "",
      id_salle: "",
      date: "",
      heure_debut: "",
      heure_fin: "",
      groupes: "",
      cours_label: "",
    });
  }

  async function handleSauvegarderEdition(event) {
    event.preventDefault();
    setSauvegardeEdition(true);
    setErreur("");
    setMessage("");

    try {
      await modifierAffectation(formulaireEdition.id_affectation_cours, {
        id_cours: Number(formulaireEdition.id_cours),
        id_professeur: Number(formulaireEdition.id_professeur),
        id_salle: Number(formulaireEdition.id_salle),
        date: formulaireEdition.date,
        heure_debut: formulaireEdition.heure_debut,
        heure_fin: formulaireEdition.heure_fin,
      });

      const horairesData = await recupererHoraires();
      setHoraires(Array.isArray(horairesData) ? horairesData : []);
      setMessage("Affectation modifiee avec succes.");
      fermerModal();
    } catch (error) {
      setErreur(error.message || "Erreur lors de la modification.");
      setSauvegardeEdition(false);
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Generer"
      subtitle="Preparez les affectations par programme et etape, puis ajustez-les si besoin."
    >
      <div className="affectations-page">
        {message ? (
          <div className="crud-page__alert crud-page__alert--success">{message}</div>
        ) : null}
        {erreur ? (
          <div className="crud-page__alert crud-page__alert--error">{erreur}</div>
        ) : null}

        <section className="affectations-page__hero">
          <div className="affectations-page__hero-card">
            <span className="affectations-page__eyebrow">Planification ciblee</span>
            <h2>Lancez une generation ciblee a partir des groupes et des cours relies</h2>
            <p>
              Choisissez un programme et une etape. Les groupes, les cours,
              les professeurs rattaches et les salles de reference sont relies
              automatiquement avant generation.
            </p>
          </div>

          <div className="affectations-page__stats">
            <div className="affectations-page__stat-card">
              <strong>{coursFiltres.length}</strong>
              <span>Cours dans la selection</span>
            </div>
            <div className="affectations-page__stat-card">
              <strong>{groupesFiltres.length}</strong>
              <span>Groupes trouves</span>
            </div>
            <div className="affectations-page__stat-card">
              <strong>{professeursCompatibles.length}</strong>
              <span>Professeurs compatibles</span>
            </div>
            <div className="affectations-page__stat-card">
              <strong>{sallesCompatibles.length}</strong>
              <span>Salles compatibles</span>
            </div>
          </div>
        </section>

        <section className="affectations-page__workspace">
          <div className="affectations-page__panel">
            <div className="affectations-page__panel-header">
              <div>
                <h2>Parametres de generation</h2>
                <p>La selection pilote directement les groupes a planifier.</p>
              </div>
            </div>

            {loading ? (
              <p className="crud-page__state">Chargement...</p>
            ) : (
              <div className="affectations-page__form">
                <div className="affectations-page__row">
                  <label className="crud-page__field">
                    <span>Programme</span>
                    <select
                      name="programme"
                      value={filtresGeneration.programme}
                      onChange={handleChangerFiltre}
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
                      name="etape"
                      value={filtresGeneration.etape}
                      onChange={handleChangerFiltre}
                      disabled={!filtresGeneration.programme}
                    >
                      <option value="">Choisir une etape</option>
                      {etapesDisponibles.map((etape) => (
                        <option key={etape} value={etape}>
                          Etape {etape}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="affectations-page__row">
                  <label className="crud-page__field">
                    <span>Date de debut</span>
                    <input
                      type="date"
                      name="date_debut"
                      value={filtresGeneration.date_debut}
                      onChange={handleChangerFiltre}
                    />
                  </label>

                  <div className="affectations-page__group-mode">
                    <span>Portee</span>
                    <label className="affectations-page__radio">
                      <input
                        type="radio"
                        name="mode_groupe"
                        value="all"
                        checked={filtresGeneration.mode_groupe === "all"}
                        onChange={handleChangerFiltre}
                      />
                      <span>Tous les groupes</span>
                    </label>
                    <label className="affectations-page__radio">
                      <input
                        type="radio"
                        name="mode_groupe"
                        value="single"
                        checked={filtresGeneration.mode_groupe === "single"}
                        onChange={handleChangerFiltre}
                      />
                      <span>Un seul groupe</span>
                    </label>
                  </div>
                </div>

                {filtresGeneration.mode_groupe === "single" ? (
                  <label className="crud-page__field">
                    <span>Groupe cible</span>
                    <select
                      name="id_groupe"
                      value={filtresGeneration.id_groupe}
                      onChange={handleChangerFiltre}
                    >
                      <option value="">Choisir un groupe</option>
                      {groupesFiltres.map((groupe) => (
                        <option
                          key={groupe.id_groupes_etudiants}
                          value={groupe.id_groupes_etudiants}
                        >
                          {groupe.nom_groupe} ({groupe.effectif || 0} etudiants)
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="affectations-page__actions">
                  <button
                    className="crud-page__primary-button"
                    type="button"
                    onClick={handleGenerer}
                    disabled={generationEnCours || loading}
                  >
                    {generationEnCours ? "Generation..." : "Generer"}
                  </button>

                  <button
                    className="crud-page__secondary-button"
                    type="button"
                    onClick={handleReset}
                    disabled={resetEnCours || horaires.length === 0}
                  >
                    {resetEnCours ? "Reinitialisation..." : "Reinitialiser tout"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="affectations-page__panel">
            <div className="affectations-page__panel-header">
              <div>
                <h2>Groupes trouves automatiquement</h2>
                <p>
                  {groupeSelectionne
                    ? `Generation ciblee sur ${groupeSelectionne.nom_groupe}.`
                    : "La liste se met a jour selon le programme et l'etape selectionnes."}
                </p>
              </div>
            </div>

            {groupesFiltres.length === 0 ? (
              <p className="crud-page__state">
                Aucun groupe ne correspond encore a cette selection.
              </p>
            ) : (
              <div className="affectations-page__group-list">
                {groupesFiltres.map((groupe) => (
                  <div
                    key={groupe.id_groupes_etudiants}
                    className={`affectations-page__group-chip ${
                      Number(filtresGeneration.id_groupe) ===
                      Number(groupe.id_groupes_etudiants)
                        ? "affectations-page__group-chip--active"
                        : ""
                    }`}
                  >
                    <strong>{groupe.nom_groupe}</strong>
                    <span>
                      Etape {groupe.etape || "-"} - Effectif: {groupe.effectif || 0}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {resumeGeneration?.non_planifies?.length ? (
              <div className="affectations-page__issues">
                <h3>Elements non planifies</h3>
                <ul>
                  {resumeGeneration.non_planifies.map((item) => (
                    <li key={`${item.id_cours}-${item.raison}`}>
                      <strong>{item.code_cours}</strong>
                      <span>{item.raison}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="affectations-page__panel">
          <div className="affectations-page__panel-header">
            <div>
              <h2>Affectations generees</h2>
              <p>Toute affectation reste modifiable apres generation.</p>
            </div>
            <span className="affectations-page__count">
              {horairesFiltres.length} / {horaires.length} affectation(s)
            </span>
          </div>

          {horaires.length === 0 ? (
            <p className="crud-page__state">Aucune affectation generee pour le moment.</p>
          ) : (
            <>
              <div className="affectations-page__filters">
                <label className="crud-page__field">
                  <span>Recherche</span>
                  <input
                    type="text"
                    name="recherche"
                    placeholder="Cours, prof, salle ou groupe"
                    value={filtresAffectations.recherche}
                    onChange={handleChangerFiltreAffectation}
                  />
                </label>

                <label className="crud-page__field">
                  <span>Professeur</span>
                  <select
                    name="professeur"
                    value={filtresAffectations.professeur}
                    onChange={handleChangerFiltreAffectation}
                  >
                    <option value="">Tous les professeurs</option>
                    {professeursAffectationsDisponibles.map((professeur) => (
                      <option key={professeur} value={professeur}>
                        {professeur}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="crud-page__field">
                  <span>Groupe</span>
                  <select
                    name="groupe"
                    value={filtresAffectations.groupe}
                    onChange={handleChangerFiltreAffectation}
                  >
                    <option value="">Tous les groupes</option>
                    {groupesAffectationsDisponibles.map((groupe) => (
                      <option key={groupe} value={groupe}>
                        {groupe}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="crud-page__field">
                  <span>Date</span>
                  <input
                    type="date"
                    name="date"
                    value={filtresAffectations.date}
                    onChange={handleChangerFiltreAffectation}
                  />
                </label>

                <div className="affectations-page__filter-actions">
                  <button
                    type="button"
                    className="crud-page__secondary-button"
                    onClick={reinitialiserFiltresAffectations}
                  >
                    Effacer les filtres
                  </button>
                </div>
              </div>

              <div className="crud-page__table-card">
                <table className="crud-page__table">
                <thead>
                  <tr>
                    <th>Cours</th>
                    <th>Professeur</th>
                    <th>Salle</th>
                    <th>Date</th>
                    <th>Horaire</th>
                    <th>Groupes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {horairesFiltres.map((affectation) => (
                    <tr key={affectation.id_affectation_cours}>
                      <td>
                        <strong>{affectation.cours_code}</strong>
                        <br />
                        <small>{affectation.cours_nom}</small>
                      </td>
                      <td>
                        {affectation.professeur_prenom} {affectation.professeur_nom}
                      </td>
                      <td>{affectation.salle_code}</td>
                      <td>{formaterDate(affectation.date)}</td>
                      <td>
                        {formaterHeure(affectation.heure_debut)} -{" "}
                        {formaterHeure(affectation.heure_fin)}
                      </td>
                      <td>{affectation.groupes || "-"}</td>
                      <td>
                        <div className="crud-page__actions">
                          <button
                            type="button"
                            className="crud-page__action crud-page__action--edit"
                            onClick={() =>
                              handleOuvrirEdition(affectation.id_affectation_cours)
                            }
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="crud-page__action crud-page__action--delete"
                            onClick={() =>
                              handleSupprimer(affectation.id_affectation_cours)
                            }
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>

              {horairesFiltres.length === 0 ? (
                <p className="crud-page__state">
                  Aucune affectation ne correspond aux filtres actuels.
                </p>
              ) : null}
            </>
          )}
        </section>

        {modalOuvert ? (
          <div className="crud-page__modal-overlay" onClick={fermerModal}>
            <div
              className="crud-page__modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="crud-page__modal-header">
                <h2>Modifier une affectation</h2>
                <button
                  type="button"
                  className="crud-page__close"
                  onClick={fermerModal}
                >
                  x
                </button>
              </div>

              <form className="crud-page__form" onSubmit={handleSauvegarderEdition}>
                <label className="crud-page__field">
                  <span>Cours</span>
                  <input value={formulaireEdition.cours_label} disabled />
                </label>

                <label className="crud-page__field">
                  <span>Groupes</span>
                  <input value={formulaireEdition.groupes || "-"} disabled />
                </label>

                <label className="crud-page__field">
                  <span>Professeur</span>
                  <select
                    name="id_professeur"
                    value={formulaireEdition.id_professeur}
                    onChange={handleChangerEdition}
                  >
                    <option value="">Choisir un professeur</option>
                    {professeurs.map((professeur) => (
                      <option
                        key={professeur.id_professeur}
                        value={professeur.id_professeur}
                      >
                        {professeur.matricule} - {professeur.prenom} {professeur.nom}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="crud-page__field">
                  <span>Salle</span>
                  <select
                    name="id_salle"
                    value={formulaireEdition.id_salle}
                    onChange={handleChangerEdition}
                  >
                    <option value="">Choisir une salle</option>
                    {salles.map((salle) => (
                      <option key={salle.id_salle} value={salle.id_salle}>
                        {salle.code} - {salle.type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="crud-page__field">
                  <span>Date</span>
                  <input
                    type="date"
                    name="date"
                    value={formulaireEdition.date}
                    onChange={handleChangerEdition}
                  />
                </label>

                <label className="crud-page__field">
                  <span>Heure de debut</span>
                  <input
                    type="time"
                    name="heure_debut"
                    value={formulaireEdition.heure_debut}
                    onChange={handleChangerEdition}
                  />
                </label>

                <label className="crud-page__field">
                  <span>Heure de fin</span>
                  <input
                    type="time"
                    name="heure_fin"
                    value={formulaireEdition.heure_fin}
                    onChange={handleChangerEdition}
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
                    {sauvegardeEdition ? "Enregistrement..." : "Enregistrer"}
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
