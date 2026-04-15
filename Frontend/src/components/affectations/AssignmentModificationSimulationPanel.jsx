/**
 * COMPONENT - Assignment Modification Simulation Panel
 *
 * Ce composant affiche le resultat read-only du what-if de replanification
 * intelligente. Il reste purement presentionnel :
 * - le backend conserve l'autorite finale sur la validation ;
 * - le parent gere l'obsolescence de la simulation et l'application reelle ;
 * - le panneau rend lisibles les scores, impacts, warnings et blocages.
 */

function formaterNombre(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : "-";
}

function formaterDelta(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  if (numericValue > 0) {
    return `+${numericValue.toFixed(2)}`;
  }

  return numericValue.toFixed(2);
}

function determinerClasseDelta(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue === 0) {
    return "neutral";
  }

  return numericValue > 0 ? "positive" : "negative";
}

function construireImpacts(report) {
  return [
    {
      id: "etudiants",
      label: "Etudiants",
      ids: report?.impact?.etudiants?.idsImpactes || [],
      resume: report?.impact?.etudiants?.resume || "Aucun impact calcule.",
    },
    {
      id: "professeurs",
      label: "Professeurs",
      ids: report?.impact?.professeurs?.idsImpactes || [],
      resume: report?.impact?.professeurs?.resume || "Aucun impact calcule.",
    },
    {
      id: "salles",
      label: "Salles",
      ids: report?.impact?.salles?.idsImpactees || [],
      resume: report?.impact?.salles?.resume || "Aucun impact calcule.",
    },
  ];
}

/**
 * Rend la carte de simulation d'une modification intelligente.
 *
 * @param {Object} props - proprietes d'affichage.
 * @param {boolean} props.active - true si l'editeur est en mode modification.
 * @param {boolean} props.loading - true pendant l'appel what-if.
 * @param {Object|null} props.report - rapport what-if courant.
 * @param {boolean} props.isCurrent - true si la simulation correspond a l'etat courant du formulaire.
 * @param {Object[]} [props.localIssues=[]] - validations UX locales.
 * @param {Object|null} [props.lastAppliedResult=null] - dernier resultat applique.
 *
 * @returns {JSX.Element|null} Panneau de simulation ou `null`.
 */
export function AssignmentModificationSimulationPanel({
  active,
  loading,
  report,
  isCurrent,
  localIssues = [],
  lastAppliedResult = null,
}) {
  if (!active) {
    return null;
  }

  const warnings = Array.isArray(report?.warnings) ? report.warnings : [];
  const blocages = Array.isArray(report?.validation?.raisonsBlocage)
    ? report.validation.raisonsBlocage
    : [];
  const impacts = construireImpacts(report);
  const hasReport = Boolean(report);
  const localIssuesTone = localIssues.some((issue) => issue.level === "error")
    ? "error"
    : "warning";

  return (
    <section className="affectations-page__simulation-card">
      <div className="affectations-page__simulation-header">
        <div>
          <h3>Resultat de simulation</h3>
          <p>
            La simulation est obligatoire avant application. Toute modification du
            formulaire rend la simulation precedente obsolete.
          </p>
        </div>

        {hasReport ? (
          <span
            className={[
              "affectations-page__simulation-badge",
              report.faisable
                ? "affectations-page__simulation-badge--success"
                : "affectations-page__simulation-badge--error",
            ].join(" ")}
          >
            {report.faisable ? "Faisable" : "Non faisable"}
          </span>
        ) : null}
      </div>

      {localIssues.length > 0 ? (
        <div
          className={[
            "affectations-page__simulation-block",
            `affectations-page__simulation-block--${localIssuesTone}`,
          ].join(" ")}
        >
          <strong>Verifications locales avant simulation</strong>
          <ul className="affectations-page__simulation-list">
            {localIssues.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <div className="affectations-page__simulation-empty">
          <strong>Simulation en cours...</strong>
          <span>Le moteur compare l'etat actuel, les impacts et les blocages.</span>
        </div>
      ) : !hasReport ? (
        <div className="affectations-page__simulation-empty">
          <strong>Aucune simulation lancee</strong>
          <span>
            Lancez une previsualisation pour comparer le score avant/apres et
            debloquer l'application reelle.
          </span>
        </div>
      ) : (
        <>
          {!isCurrent ? (
            <div className="affectations-page__simulation-block affectations-page__simulation-block--stale">
              <strong>Simulation obsolete</strong>
              <span>
                Le formulaire a change depuis ce rapport. Relancez la simulation
                avant d'appliquer la modification.
              </span>
            </div>
          ) : null}

          <div className="affectations-page__simulation-summary">
            <p>{report.resume || "Aucun resume analytique disponible."}</p>
            <div className="affectations-page__simulation-meta">
              <span>Portee : {report.validation?.scope || report.portee || "-"}</span>
              <span>
                Occurrences ciblees : {Number(report.meta?.occurrences_ciblees || 0) || 1}
              </span>
              <span>Conflits crees : {Number(report.conflitsCrees || 0)}</span>
              <span>Conflits resolus : {Number(report.conflitsResolus || 0)}</span>
            </div>
          </div>

          <div className="affectations-page__simulation-metrics">
            {[
              {
                id: "global",
                label: "Score global",
                before: report.scoreAvant?.scoreGlobal,
                after: report.scoreApres?.scoreGlobal,
                delta: report.difference?.scoreGlobal,
              },
              {
                id: "etudiant",
                label: "Score etudiant",
                before: report.scoreAvant?.scoreEtudiant,
                after: report.scoreApres?.scoreEtudiant,
                delta: report.difference?.scoreEtudiant,
              },
              {
                id: "professeur",
                label: "Score professeur",
                before: report.scoreAvant?.scoreProfesseur,
                after: report.scoreApres?.scoreProfesseur,
                delta: report.difference?.scoreProfesseur,
              },
            ].map((metric) => (
              <article key={metric.id} className="affectations-page__simulation-metric">
                <span>{metric.label}</span>
                <strong>
                  {formaterNombre(metric.before)}{" "}
                  <small>&rarr; {formaterNombre(metric.after)}</small>
                </strong>
                <em
                  className={`affectations-page__simulation-delta affectations-page__simulation-delta--${determinerClasseDelta(metric.delta)}`}
                >
                  {formaterDelta(metric.delta)}
                </em>
              </article>
            ))}
          </div>

          <div className="affectations-page__simulation-impact-grid">
            {impacts.map((impact) => (
              <article key={impact.id} className="affectations-page__simulation-impact">
                <div className="affectations-page__simulation-impact-header">
                  <strong>{impact.label}</strong>
                  <span>{impact.ids.length} impacte(s)</span>
                </div>
                <p>{impact.resume}</p>
                <small>
                  {impact.ids.length > 0
                    ? `IDs: ${impact.ids.join(", ")}`
                    : "Aucun identifiant specifique remonte."}
                </small>
              </article>
            ))}
          </div>

          {warnings.length > 0 ? (
            <div className="affectations-page__simulation-block affectations-page__simulation-block--warning">
              <strong>Points d'attention avant application</strong>
              <ul className="affectations-page__simulation-list">
                {warnings.map((warning) => (
                  <li key={warning.code}>
                    <span>{warning.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {blocages.length > 0 ? (
            <div className="affectations-page__simulation-block affectations-page__simulation-block--error">
              <strong>Raisons de blocage</strong>
              <ul className="affectations-page__simulation-list">
                {blocages.map((reason) => (
                  <li key={`${reason.code}-${reason.message}`}>
                    <span>{reason.message}</span>
                    <small>{reason.code}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      {lastAppliedResult ? (
        <div className="affectations-page__simulation-block affectations-page__simulation-block--success">
          <strong>Derniere modification appliquee</strong>
          <span>
            Portee {lastAppliedResult.portee || "-"} sur{" "}
            {Array.isArray(lastAppliedResult.occurrences_modifiees)
              ? lastAppliedResult.occurrences_modifiees.length
              : 0}{" "}
            occurrence(s).
          </span>
          <small>
            Historique #{lastAppliedResult.historique?.id_journal_modification_affectation || "-"}
          </small>
        </div>
      ) : null}
    </section>
  );
}
