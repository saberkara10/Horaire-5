/**
 * PAGE - Affectations
 *
 * Cette page pilote la generation
 * et la gestion des affectations.
 */
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import { recupererCours } from "../services/cours.api.js";
import { recupererEtudiants } from "../services/etudiantsService.js";
import { recupererGroupes } from "../services/groupes.api.js";
import {
  genererHoraire,
  recupererHoraires,
  resetHoraires,
  supprimerAffectation,
} from "../services/horaire.api.js";
import { recupererProfesseurs } from "../services/professeurs.api.js";
import { recupererProgrammes } from "../services/programmes.api.js";
import { recupererSalles } from "../services/salles.api.js";
import { programmesCorrespondent } from "../utils/programmes.js";
import {
  SESSIONS_ACADEMIQUES,
  formaterLibelleCohorte,
} from "../utils/sessions.js";
import "../styles/AffectationsPage.css";

const ETAPES_REFERENCE = ["1", "2", "3", "4", "5", "6", "7", "8"];
const CAPACITE_MAX_GROUPE = 25;

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

function estimerGroupes(programme, etape, session, annee, effectifTotal) {
  if (!programme || !etape || !session || !annee || effectifTotal <= 0) {
    return [];
  }

  const nombreGroupes = Math.max(1, Math.ceil(effectifTotal / CAPACITE_MAX_GROUPE));
  const base = Math.floor(effectifTotal / nombreGroupes);
  const reste = effectifTotal % nombreGroupes;
  const prefixe = String(programme).replace(/\s+/g, " ").trim().slice(0, 70);

  return Array.from({ length: nombreGroupes }, (_, index) => ({
    id_groupes_etudiants: `preview-${index + 1}`,
    nom_groupe: `${prefixe} - E${etape} - ${session} ${annee} - G${index + 1}`,
    etape,
    session,
    annee,
    effectif: base + (index < reste ? 1 : 0),
    apercu: true,
  }));
}

function trierAnnees(annees) {
  return [...new Set(annees.map((annee) => Number(annee)).filter(Number.isInteger))].sort(
    (anneeA, anneeB) => anneeB - anneeA
  );
}

export function AffectationsPage({ utilisateur, onLogout }) {
  const [cours, setCours] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);
  const [salles, setSalles] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [horaires, setHoraires] = useState([]);
  const [resumeGeneration, setResumeGeneration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [resetEnCours, setResetEnCours] = useState(false);
  const { confirm, showError, showSuccess } = usePopup();
  const [filtresGeneration, setFiltresGeneration] = useState({
    programme: "",
    etape: "",
    session: "",
    annee: "",
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

    try {
      const [
        coursData,
        etudiantsData,
        groupesData,
        professeursData,
        sallesData,
        programmesData,
        horairesData,
      ] = await Promise.all([
        recupererCours(),
        recupererEtudiants(),
        recupererGroupes(true),
        recupererProfesseurs(),
        recupererSalles(),
        recupererProgrammes(),
        recupererHoraires(),
      ]);

      setCours(Array.isArray(coursData) ? coursData : []);
      setEtudiants(Array.isArray(etudiantsData) ? etudiantsData : []);
      setGroupes(Array.isArray(groupesData) ? groupesData : []);
      setProfesseurs(Array.isArray(professeursData) ? professeursData : []);
      setSalles(Array.isArray(sallesData) ? sallesData : []);
      setProgrammes(Array.isArray(programmesData) ? programmesData : []);
      setHoraires(Array.isArray(horairesData) ? horairesData : []);
    } catch (error) {
      showError(error.message || "Impossible de charger les donnees.");
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

    const programmeSelectionne = filtresGeneration.programme;
    const etapesCours = cours
      .filter((element) =>
        programmesCorrespondent(element.programme, programmeSelectionne)
      )
      .map((element) => String(element.etape_etude || "").trim());
    const etapesEtudiants = etudiants
      .filter((etudiant) =>
        programmesCorrespondent(etudiant.programme, programmeSelectionne)
      )
      .map((etudiant) => String(etudiant.etape || "").trim());

    return [...new Set([...etapesCours, ...etapesEtudiants].filter(Boolean))]
      .filter((etape) => ETAPES_REFERENCE.includes(etape))
      .sort((a, b) => Number(a) - Number(b));
  }, [cours, etudiants, filtresGeneration.programme]);

  const sessionsDisponibles = useMemo(() => {
    if (!filtresGeneration.programme || !filtresGeneration.etape) {
      return [];
    }

    return SESSIONS_ACADEMIQUES.filter((session) =>
      etudiants.some(
        (etudiant) =>
          programmesCorrespondent(etudiant.programme, filtresGeneration.programme) &&
          String(etudiant.etape) === String(filtresGeneration.etape) &&
          String(etudiant.session) === session
      )
    );
  }, [etudiants, filtresGeneration.etape, filtresGeneration.programme]);

  const anneesDisponibles = useMemo(() => {
    if (
      !filtresGeneration.programme ||
      !filtresGeneration.etape ||
      !filtresGeneration.session
    ) {
      return [];
    }

    return trierAnnees(
      etudiants
        .filter(
          (etudiant) =>
            programmesCorrespondent(etudiant.programme, filtresGeneration.programme) &&
            String(etudiant.etape) === String(filtresGeneration.etape) &&
            String(etudiant.session) === String(filtresGeneration.session)
        )
        .map((etudiant) => etudiant.annee)
    );
  }, [
    etudiants,
    filtresGeneration.etape,
    filtresGeneration.programme,
    filtresGeneration.session,
  ]);

  const coursFiltres = useMemo(() => {
    return cours.filter((element) => {
      if (
        filtresGeneration.programme &&
        !programmesCorrespondent(element.programme, filtresGeneration.programme)
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
  }, [cours, filtresGeneration.etape, filtresGeneration.programme]);

  const etudiantsCohorte = useMemo(() => {
    return etudiants.filter((etudiant) => {
      if (
        filtresGeneration.programme &&
        !programmesCorrespondent(etudiant.programme, filtresGeneration.programme)
      ) {
        return false;
      }

      if (
        filtresGeneration.etape &&
        String(etudiant.etape) !== String(filtresGeneration.etape)
      ) {
        return false;
      }

      if (
        filtresGeneration.session &&
        String(etudiant.session) !== String(filtresGeneration.session)
      ) {
        return false;
      }

      if (
        filtresGeneration.annee &&
        Number(etudiant.annee) !== Number(filtresGeneration.annee)
      ) {
        return false;
      }

      return true;
    });
  }, [
    etudiants,
    filtresGeneration.annee,
    filtresGeneration.etape,
    filtresGeneration.programme,
    filtresGeneration.session,
  ]);

  const groupesFiltres = useMemo(() => {
    return groupes.filter((groupe) => {
      if (
        filtresGeneration.programme &&
        !programmesCorrespondent(groupe.programme, filtresGeneration.programme)
      ) {
        return false;
      }

      if (
        filtresGeneration.etape &&
        String(groupe.etape) !== String(filtresGeneration.etape)
      ) {
        return false;
      }

      if (
        filtresGeneration.session &&
        String(groupe.session) !== String(filtresGeneration.session)
      ) {
        return false;
      }

      if (
        filtresGeneration.annee &&
        Number(groupe.annee) !== Number(filtresGeneration.annee)
      ) {
        return false;
      }

      return true;
    });
  }, [
    groupes,
    filtresGeneration.annee,
    filtresGeneration.etape,
    filtresGeneration.programme,
    filtresGeneration.session,
  ]);

  const groupesAPlanifier = useMemo(() => {
    return groupesFiltres.length > 0
      ? groupesFiltres
      : estimerGroupes(
          filtresGeneration.programme,
          filtresGeneration.etape,
          filtresGeneration.session,
          filtresGeneration.annee,
          etudiantsCohorte.length
        );
  }, [
    etudiantsCohorte.length,
    filtresGeneration.annee,
    filtresGeneration.etape,
    filtresGeneration.programme,
    filtresGeneration.session,
    groupesFiltres,
  ]);

  const professeursCompatibles = useMemo(() => {
    const idsCoursSelectionnes = new Set(
      coursFiltres.map((element) => Number(element.id_cours)).filter(Boolean)
    );

    return professeurs.filter((professeur) => {
      const coursProfesseur = extraireCoursIds(professeur.cours_ids);
      return coursProfesseur.some((idCours) => idsCoursSelectionnes.has(idCours));
    });
  }, [coursFiltres, professeurs]);

  const typesSallesRequis = useMemo(() => {
    return [...new Set(coursFiltres.map((element) => element.type_salle).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "fr")
    );
  }, [coursFiltres]);

  const sallesCompatibles = useMemo(() => {
    const idsSallesReference = new Set(
      coursFiltres
        .map((element) => Number(element.id_salle_reference))
        .filter((idSalle) => Number.isInteger(idSalle) && idSalle > 0)
    );
    const typesNormalises = new Set(typesSallesRequis.map((type) => normaliserTexte(type)));

    return salles
      .filter((salle) => {
        if (idsSallesReference.has(Number(salle.id_salle))) {
          return true;
        }

        return typesNormalises.has(normaliserTexte(salle.type));
      })
      .sort((a, b) => {
        const compareType = String(a.type || "").localeCompare(String(b.type || ""), "fr");
        if (compareType !== 0) {
          return compareType;
        }

        return String(a.code || "").localeCompare(String(b.code || ""), "fr");
      });
  }, [coursFiltres, salles, typesSallesRequis]);

  const horairesFiltres = useMemo(() => {
    const recherche = normaliserTexte(filtresAffectations.recherche);

    return horaires.filter((affectation) => {
      if (
        filtresAffectations.professeur &&
        `${affectation.professeur_prenom || ""} ${affectation.professeur_nom || ""}`.trim() !==
          filtresAffectations.professeur
      ) {
        return false;
      }

      if (filtresAffectations.groupe && affectation.groupes !== filtresAffectations.groupe) {
        return false;
      }

      if (filtresAffectations.date && affectation.date !== filtresAffectations.date) {
        return false;
      }

      if (!recherche) {
        return true;
      }

      return normaliserTexte(
        [
          affectation.cours_code,
          affectation.cours_nom,
          affectation.professeur_prenom,
          affectation.professeur_nom,
          affectation.salle_code,
          affectation.groupes,
        ].join(" ")
      ).includes(recherche);
    });
  }, [filtresAffectations, horaires]);

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

  function handleChangerFiltre(event) {
    const { name, value } = event.target;

    setFiltresGeneration((actuel) => ({
      ...actuel,
      [name]: value,
      ...(name === "programme" ? { etape: "", session: "", annee: "" } : {}),
      ...(name === "etape" ? { session: "", annee: "" } : {}),
      ...(name === "session" ? { annee: "" } : {}),
    }));
  }

  function handleChangerFiltreAffectation(event) {
    const { name, value } = event.target;
    setFiltresAffectations((actuel) => ({ ...actuel, [name]: value }));
  }

  async function handleGenerer() {
    if (
      !filtresGeneration.programme ||
      !filtresGeneration.etape ||
      !filtresGeneration.session ||
      !filtresGeneration.annee
    ) {
      showError("Selectionnez d'abord un programme, une etape, une session et une annee.");
      return;
    }

    setGenerationEnCours(true);

    try {
      const resultat = await genererHoraire({
        programme: filtresGeneration.programme,
        etape: filtresGeneration.etape,
        session: filtresGeneration.session,
        annee: Number(filtresGeneration.annee),
        date_debut: filtresGeneration.date_debut,
      });

      setResumeGeneration(resultat);
      showSuccess(resultat.message || "Generation terminee.");

      const [horairesData, groupesData, etudiantsData] = await Promise.all([
        recupererHoraires(),
        recupererGroupes(true),
        recupererEtudiants(),
      ]);

      setHoraires(Array.isArray(horairesData) ? horairesData : []);
      setGroupes(Array.isArray(groupesData) ? groupesData : []);
      setEtudiants(Array.isArray(etudiantsData) ? etudiantsData : []);
    } catch (error) {
      showError(error.message || "Erreur lors de la generation.");
    } finally {
      setGenerationEnCours(false);
    }
  }

  async function handleReset() {
    const confirmation = await confirm({
      title: "Reinitialiser les horaires",
      message: "Supprimer tous les horaires generes ?",
      confirmLabel: "Supprimer",
      tone: "danger",
    });

    if (!confirmation) {
      return;
    }

    setResetEnCours(true);

    try {
      await resetHoraires();
      setResumeGeneration(null);
      setHoraires([]);
      showSuccess("Horaires reinitialises.");
    } catch (error) {
      showError(error.message || "Erreur lors de la reinitialisation.");
    } finally {
      setResetEnCours(false);
    }
  }

  async function handleSupprimer(idAffectation) {
    const confirmation = await confirm({
      title: "Supprimer l'affectation",
      message: "Supprimer cette affectation ?",
      confirmLabel: "Supprimer",
      tone: "danger",
    });

    if (!confirmation) {
      return;
    }

    try {
      await supprimerAffectation(idAffectation);
      const horairesData = await recupererHoraires();
      setHoraires(Array.isArray(horairesData) ? horairesData : []);
      showSuccess("Affectation supprimee.");
    } catch (error) {
      showError(error.message || "Erreur lors de la suppression.");
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Generer"
      subtitle="Formez automatiquement les groupes d'une cohorte puis generez leurs horaires."
    >
      <div className="affectations-page">
        <section className="affectations-page__hero">
          <div className="affectations-page__hero-card">
            <span className="affectations-page__eyebrow">Generation par cohorte</span>
            <h2>Choisissez un programme, une etape, une session et une annee</h2>
            <p>
              Les etudiants sont importes sans groupe. La generation forme les groupes
              par cohorte, trie les salles selon leur type et construit l'horaire exact
              de chaque groupe.
            </p>
          </div>
          <div className="affectations-page__stats">
            <div className="affectations-page__stat-card">
              <strong>{coursFiltres.length}</strong>
              <span>Cours dans la selection</span>
            </div>
            <div className="affectations-page__stat-card">
              <strong>{etudiantsCohorte.length}</strong>
              <span>Etudiants trouves</span>
            </div>
            <div className="affectations-page__stat-card">
              <strong>{groupesAPlanifier.length}</strong>
              <span>Groupes prevus</span>
            </div>
            <div className="affectations-page__stat-card">
              <strong>{professeursCompatibles.length}</strong>
              <span>Professeurs compatibles</span>
            </div>
          </div>
        </section>

        <section className="affectations-page__workspace">
          <div className="affectations-page__panel">
            <div className="affectations-page__panel-header">
              <div>
                <h2>Parametres de generation</h2>
                <p>Maximum {CAPACITE_MAX_GROUPE} etudiants par groupe.</p>
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
                    <span>Session</span>
                    <select
                      name="session"
                      value={filtresGeneration.session}
                      onChange={handleChangerFiltre}
                      disabled={!filtresGeneration.etape}
                    >
                      <option value="">Choisir une session</option>
                      {sessionsDisponibles.map((session) => (
                        <option key={session} value={session}>
                          {session}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="crud-page__field">
                    <span>Annee</span>
                    <select
                      name="annee"
                      value={filtresGeneration.annee}
                      onChange={handleChangerFiltre}
                      disabled={!filtresGeneration.session}
                    >
                      <option value="">Choisir une annee</option>
                      {anneesDisponibles.map((annee) => (
                        <option key={annee} value={annee}>
                          {annee}
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
                  <div className="affectations-page__cohort-preview">
                    <span className="planning-label">Cohorte choisie</span>
                    <strong>
                      {filtresGeneration.programme
                        ? `${filtresGeneration.programme} - E${filtresGeneration.etape || "-"}`
                        : "-"}
                    </strong>
                    <small>
                      {formaterLibelleCohorte(
                        filtresGeneration.session,
                        filtresGeneration.annee
                      )}
                    </small>
                  </div>
                </div>

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
                <h2>Groupes de la cohorte</h2>
                <p>
                  {groupesFiltres.length > 0
                    ? "Groupes deja generes pour cette selection."
                    : "Estimation des groupes qui seront crees pendant la generation."}
                </p>
              </div>
            </div>

            {!filtresGeneration.programme ||
            !filtresGeneration.etape ||
            !filtresGeneration.session ||
            !filtresGeneration.annee ? (
              <p className="crud-page__state">
                Selectionnez un programme, une etape, une session et une annee.
              </p>
            ) : groupesAPlanifier.length === 0 ? (
              <p className="crud-page__state">Aucun etudiant importe pour cette cohorte.</p>
            ) : (
              <div className="affectations-page__group-list">
                {groupesAPlanifier.map((groupe) => (
                  <div key={groupe.id_groupes_etudiants} className="affectations-page__group-chip">
                    <strong>{groupe.nom_groupe}</strong>
                    <span>
                      Etape {groupe.etape || "-"} - {formaterLibelleCohorte(groupe.session, groupe.annee)} - Effectif: {groupe.effectif || 0}
                    </span>
                    {groupe.apercu ? <small>Prevision avant generation</small> : null}
                  </div>
                ))}
              </div>
            )}

            <div className="affectations-page__issues">
              <h3>Types de salles utiles</h3>
              {typesSallesRequis.length === 0 ? (
                <p>Aucun type de salle requis pour la selection actuelle.</p>
              ) : (
                <ul>
                  {typesSallesRequis.map((typeSalle) => (
                    <li key={typeSalle}>
                      <strong>{typeSalle}</strong>
                      <span>
                        {
                          sallesCompatibles.filter(
                            (salle) =>
                              normaliserTexte(salle.type) === normaliserTexte(typeSalle)
                          ).length
                        }{" "}
                        salle(s) compatible(s)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {resumeGeneration?.non_planifies?.length ? (
              <div className="affectations-page__issues">
                <h3>Elements non planifies</h3>
                <ul>
                  {resumeGeneration.non_planifies.map((item) => (
                    <li key={`${item.id_cours}-${item.groupe || "all"}-${item.raison}`}>
                      <strong>
                        {item.code_cours}
                        {item.groupe ? ` - ${item.groupe}` : ""}
                      </strong>
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
              <p>Chaque ligne correspond au planning exact d'un groupe.</p>
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
                      <th>Groupe</th>
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
                          <button
                            type="button"
                            className="crud-page__action crud-page__action--delete"
                            onClick={() => handleSupprimer(affectation.id_affectation_cours)}
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
