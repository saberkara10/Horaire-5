import { useEffect, useMemo, useState } from "react";
import {
  executerEchangeCours,
  previsualiserEchangeCours,
  recupererCoursCommunsEchangeables,
} from "../../services/etudiants.api.js";
import { emettreSynchronisationPlanning } from "../../utils/planningSync.js";
import { FeedbackBanner } from "../ui/FeedbackBanner.jsx";
import { EchangeEtudiantSearchField } from "./EchangeEtudiantSearchField.jsx";

/* ─── Helpers d'affichage ─── */

function construireLibelleEtudiant(etudiant) {
  if (!etudiant) return "";
  const nom = `${etudiant.prenom || ""} ${etudiant.nom || ""}`.trim();
  const matricule = etudiant.matricule ? ` - ${etudiant.matricule}` : "";
  const groupe = etudiant.groupe || etudiant.groupe_principal;
  return groupe ? `${nom}${matricule} (${groupe})` : `${nom}${matricule}`;
}

function formaterOccurrence(occurrence) {
  if (!occurrence?.date) return "Occurrence non planifiee";

  const date = new Date(`${occurrence.date}T00:00:00`);
  const dateTexte = Number.isNaN(date.getTime())
    ? occurrence.date
    : date.toLocaleDateString("fr-CA", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });

  return `${dateTexte} ${String(occurrence.heure_debut || "").slice(0, 5)}-${String(
    occurrence.heure_fin || ""
  ).slice(0, 5)}`;
}

function formaterSource(affectation) {
  if (String(affectation?.source_horaire || "") === "individuelle") {
    return "Exception individuelle";
  }
  return "Groupe principal";
}

/* ─── Sous-composant : carte d'affectation ─── */

function CarteAffectation({ titre, affectation, conflits = [] }) {
  if (!affectation) return null;

  return (
    <article className="course-exchange__card">
      <div className="course-exchange__card-header">
        <div>
          <h3>{titre}</h3>
          <p>
            {affectation.groupe_source || "Groupe non renseigne"} -{" "}
            {formaterSource(affectation)}
          </p>
        </div>
        <span
          className={`status-pill ${
            conflits.length > 0 ? "status-pill--warning" : "status-pill--success"
          }`}
        >
          {conflits.length > 0 ? "Conflit" : "Valide"}
        </span>
      </div>

      <div className="course-exchange__occurrences">
        {(affectation.occurrences || []).map((occurrence) => (
          <span
            key={`${affectation.id_cours}-${occurrence.id_affectation_cours}-${occurrence.date}`}
          >
            {formaterOccurrence(occurrence)}
          </span>
        ))}
      </div>

      {conflits.length > 0 ? (
        <ul className="course-exchange__conflicts">
          {conflits.map((conflit, index) => (
            <li
              key={`${conflit.date}-${conflit.heure_debut}-${conflit.code_cours_conflit}-${index}`}
            >
              {formaterOccurrence(conflit)} bloque par{" "}
              {conflit.code_cours_conflit || "un cours"} (
              {conflit.groupe_conflit || "groupe non renseigne"})
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/* ─── Composant principal ─── */

export function CourseExchangePanel({
  etudiants = [],
  etudiantSelectionneId = null,
}) {
  const [idEtudiantA, setIdEtudiantA] = useState("");
  const [idEtudiantB, setIdEtudiantB] = useState("");
  const [idCours, setIdCours] = useState("");
  const [optionsEchange, setOptionsEchange] = useState(null);
  const [previewEchange, setPreviewEchange] = useState(null);
  const [etatAction, setEtatAction] = useState("idle");
  const [messageErreur, setMessageErreur] = useState("");
  const [detailsErreur, setDetailsErreur] = useState([]);
  const [messageSucces, setMessageSucces] = useState("");

  /* ─── Pré-sélectionner l'étudiant A depuis le contexte parent ─── */
  useEffect(() => {
    if (!etudiantSelectionneId || idEtudiantA) return;
    setIdEtudiantA(String(etudiantSelectionneId));
  }, [etudiantSelectionneId, idEtudiantA]);

  const coursDisponibles = useMemo(
    () => optionsEchange?.cours_communs || [],
    [optionsEchange]
  );

  /* ─── Charger les cours communs dès que A et B sont sélectionnés ─── */
  useEffect(() => {
    let actif = true;

    async function chargerOptions() {
      if (!idEtudiantA || !idEtudiantB) {
        setOptionsEchange(null);
        setIdCours("");
        setPreviewEchange(null);
        return;
      }

      if (idEtudiantA === idEtudiantB) {
        setOptionsEchange(null);
        setIdCours("");
        setPreviewEchange(null);
        setMessageErreur(
          "Deux etudiants differents sont requis pour un echange cible."
        );
        setDetailsErreur([]);
        return;
      }

      setEtatAction("chargement-options");
      setMessageErreur("");
      setDetailsErreur([]);
      setMessageSucces("");
      setPreviewEchange(null);

      try {
        const resultat = await recupererCoursCommunsEchangeables(
          idEtudiantA,
          idEtudiantB
        );
        if (!actif) return;
        setOptionsEchange(resultat);
        setIdCours("");
      } catch (error) {
        if (!actif) return;
        setOptionsEchange(null);
        setIdCours("");
        setPreviewEchange(null);
        setMessageErreur(
          error.message || "Erreur lors du chargement des cours communs."
        );
        setDetailsErreur(error.details || []);
      } finally {
        if (actif) setEtatAction("idle");
      }
    }

    void chargerOptions();
    return () => { actif = false; };
  }, [idEtudiantA, idEtudiantB]);

  /* ─── Charger le preview dès que A, B et le cours sont connus ─── */
  useEffect(() => {
    let actif = true;

    async function chargerPreview() {
      if (!idEtudiantA || !idEtudiantB || !idCours) {
        setPreviewEchange(null);
        return;
      }

      setEtatAction("chargement-preview");
      setMessageErreur("");
      setDetailsErreur([]);
      setMessageSucces("");

      try {
        const resultat = await previsualiserEchangeCours(
          idEtudiantA,
          idEtudiantB,
          idCours
        );
        if (!actif) return;
        setPreviewEchange(resultat);
      } catch (error) {
        if (!actif) return;
        setPreviewEchange(null);
        setMessageErreur(
          error.message || "Erreur lors de la verification de l'echange."
        );
        setDetailsErreur(error.details || []);
      } finally {
        if (actif) setEtatAction("idle");
      }
    }

    void chargerPreview();
    return () => { actif = false; };
  }, [idEtudiantA, idEtudiantB, idCours]);

  /* ─── Exécuter l'échange ─── */
  async function soumettreEchange() {
    if (!previewEchange?.echange_possible) return;

    setEtatAction("soumission");
    setMessageErreur("");
    setDetailsErreur([]);
    setMessageSucces("");

    try {
      const resultat = await executerEchangeCours({
        id_etudiant_a: Number(idEtudiantA),
        id_etudiant_b: Number(idEtudiantB),
        id_cours: Number(idCours),
      });

      setMessageSucces(resultat.message || "Echange execute.");
      setDetailsErreur([]);
      emettreSynchronisationPlanning({
        ...(resultat.synchronisation || {}),
        etudiants_impactes: resultat.etudiants_impactes || [],
        groupes_impactes: resultat.groupes_impactes || [],
      });

      try {
        const [optionsFraiches, previewFraiche] = await Promise.all([
          recupererCoursCommunsEchangeables(idEtudiantA, idEtudiantB),
          previsualiserEchangeCours(idEtudiantA, idEtudiantB, idCours),
        ]);
        setOptionsEchange(optionsFraiches);
        setPreviewEchange(previewFraiche);
      } catch {
        setPreviewEchange(null);
      }
    } catch (error) {
      setMessageErreur(
        error.message || "Erreur lors de l'echange cible du cours."
      );
      setDetailsErreur(error.details || []);
    } finally {
      setEtatAction("idle");
    }
  }

  const blocages = previewEchange?.blocages || [];
  const chargement =
    etatAction === "chargement-options" || etatAction === "chargement-preview";
  const soumission = etatAction === "soumission";

  return (
    <section className="panel panel--stacked">
      <div className="table-header">
        <div>
          <h2>Echange cible d&apos;un cours</h2>
          <p>
            Cette operation echange un seul cours entre deux etudiants sans
            modifier leur groupe principal.
          </p>
        </div>
      </div>

      <FeedbackBanner type="success" message={messageSucces} />
      <FeedbackBanner
        type="error"
        message={messageErreur}
        details={detailsErreur}
        maxDetails={6}
      />

      <div className="course-exchange__form">
        {/* ─── Étudiant A ─── */}
        <EchangeEtudiantSearchField
          etudiants={etudiants}
          selectedId={idEtudiantA}
          onSelect={setIdEtudiantA}
          excludeId={idEtudiantB}
          label="Étudiant A"
          placeholder="Nom, prénom, matricule, groupe ou programme…"
        />

        {/* ─── Étudiant B ─── */}
        <EchangeEtudiantSearchField
          etudiants={etudiants}
          selectedId={idEtudiantB}
          onSelect={setIdEtudiantB}
          excludeId={idEtudiantA}
          label="Étudiant B"
          placeholder="Nom, prénom, matricule, groupe ou programme…"
        />

        {/* ─── Cours commun (select dynamique) ─── */}
        <label className="field">
          <span>Cours commun</span>
          <select
            value={idCours}
            onChange={(event) => setIdCours(event.target.value)}
            disabled={
              !idEtudiantA ||
              !idEtudiantB ||
              coursDisponibles.length === 0 ||
              chargement
            }
          >
            <option value="">
              {chargement
                ? "Chargement en cours…"
                : coursDisponibles.length > 0
                  ? "Selectionner un cours"
                  : "Aucun cours disponible"}
            </option>
            {coursDisponibles.map((cours) => (
              <option
                key={`exchange-course-${cours.id_cours}`}
                value={cours.id_cours}
                disabled={!cours.echange_utile}
              >
                {cours.code_cours} - {cours.nom_cours}
                {!cours.echange_utile ? " (meme section actuelle)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {optionsEchange?.session ? (
        <div className="course-exchange__meta">
          <span className="status-pill status-pill--busy">
            Session active : {optionsEchange.session.nom}
          </span>
          <span className="course-exchange__summary">
            {coursDisponibles.filter((cours) => cours.echange_utile).length}{" "}
            cours reellement echangeables detectes.
          </span>
        </div>
      ) : null}

      {idEtudiantA && idEtudiantB && !chargement && coursDisponibles.length === 0 ? (
        <div className="detail-card__callout">
          Aucun cours commun exploitable n&apos;a ete trouve pour cette paire
          d&apos;etudiants dans la session active.
        </div>
      ) : null}

      {previewEchange ? (
        <div className="course-exchange__preview">
          <div className="course-exchange__preview-header">
            <div>
              <h3>
                {previewEchange.cours?.code_cours} -{" "}
                {previewEchange.cours?.nom_cours}
              </h3>
              <p>
                Comparaison des sections actuelles et cibles, avec verification
                des conflits.
              </p>
            </div>
            <span
              className={`status-pill ${
                previewEchange.echange_possible
                  ? "status-pill--success"
                  : "status-pill--warning"
              }`}
            >
              {previewEchange.echange_possible ? "Echange possible" : "Bloque"}
            </span>
          </div>

          <div className="course-exchange__columns">
            <div className="course-exchange__column">
              <h4>{construireLibelleEtudiant(previewEchange.etudiant_a)}</h4>
              <CarteAffectation
                titre="Section actuelle"
                affectation={previewEchange.etudiant_a?.affectation_actuelle}
              />
              <CarteAffectation
                titre="Section recue"
                affectation={previewEchange.etudiant_a?.affectation_cible}
                conflits={previewEchange.etudiant_a?.conflits || []}
              />
            </div>

            <div className="course-exchange__column">
              <h4>{construireLibelleEtudiant(previewEchange.etudiant_b)}</h4>
              <CarteAffectation
                titre="Section actuelle"
                affectation={previewEchange.etudiant_b?.affectation_actuelle}
              />
              <CarteAffectation
                titre="Section recue"
                affectation={previewEchange.etudiant_b?.affectation_cible}
                conflits={previewEchange.etudiant_b?.conflits || []}
              />
            </div>
          </div>

          {blocages.length > 0 ? (
            <div className="detail-card__callout detail-card__callout--warning">
              {blocages.join(" ")}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="course-exchange__actions">
        <button
          className="button button--primary"
          type="button"
          onClick={soumettreEchange}
          disabled={!previewEchange?.echange_possible || soumission || chargement}
        >
          {soumission ? "Echange en cours..." : "Executer l'echange"}
        </button>
      </div>
    </section>
  );
}
