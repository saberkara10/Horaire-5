import {
  construireInitialesEtudiant,
  construireNomCompletEtudiant,
} from "../../utils/etudiants.utils.js";
import { EtudiantScheduleBoard } from "./EtudiantScheduleBoard.jsx";

function formaterNomProfesseur(metaReprise) {
  const prenom = String(metaReprise?.prenom_professeur || "").trim();
  const nom = String(metaReprise?.nom_professeur || "").trim();
  return `${prenom} ${nom}`.trim() || null;
}

function indexerDiagnosticsReprises(diagnostics) {
  const index = new Map();

  for (const diagnostic of Array.isArray(diagnostics) ? diagnostics : []) {
    const idCoursEchoue = Number(diagnostic?.cours_echoue?.id_cours_echoue || 0);
    const idCours = Number(diagnostic?.cours_echoue?.id_cours || 0);

    if (idCoursEchoue > 0) {
      index.set(`reprise-${idCoursEchoue}`, diagnostic);
    }

    if (idCours > 0 && !index.has(`cours-${idCours}`)) {
      index.set(`cours-${idCours}`, diagnostic);
    }
  }

  return index;
}

function resumerCandidatsDiagnostic(diagnostic) {
  if (!diagnostic) {
    return null;
  }

  const groupesCompatiblesMaisPleins = diagnostic.groupes_candidats
    ?.filter((groupe) => groupe.compatibilite_horaire && !groupe.place_disponible)
    .map((groupe) => groupe.nom_groupe);
  const groupesEnConflit = diagnostic.groupes_candidats
    ?.filter((groupe) => !groupe.compatibilite_horaire)
    .map((groupe) => groupe.nom_groupe);

  const segments = [];
  if (groupesCompatiblesMaisPleins?.length) {
    segments.push(`Compatibles mais pleins: ${groupesCompatiblesMaisPleins.join(", ")}`);
  }
  if (groupesEnConflit?.length) {
    segments.push(`En conflit: ${groupesEnConflit.join(", ")}`);
  }

  return segments.join(" | ") || null;
}

function indexerMetaReprises(horaireReprises) {
  const metaParReprise = new Map();

  for (const seance of Array.isArray(horaireReprises) ? horaireReprises : []) {
    const idReprise = Number(seance?.id_cours_echoue || 0);
    const idCours = Number(seance?.id_cours || 0);
    const cle = idReprise > 0 ? `reprise-${idReprise}` : `cours-${idCours}`;

    if (metaParReprise.has(cle)) {
      continue;
    }

    metaParReprise.set(cle, {
      groupe_source: seance?.groupe_source || null,
      code_salle: seance?.code_salle || null,
      prenom_professeur: seance?.prenom_professeur || null,
      nom_professeur: seance?.nom_professeur || null,
    });
  }

  return metaParReprise;
}

function formaterLibelleCharge(etudiant, resume) {
  const chargeCible = Number(
    resume?.charge_cible ?? etudiant?.charge_cible ?? etudiant?.nb_cours_normaux ?? 0
  );
  const nbReprises = Number(etudiant?.nb_reprises || resume?.nb_reprises || 0);

  if (nbReprises > 0) {
    return `${chargeCible} cours cibles (${nbReprises} reprise${nbReprises > 1 ? "s" : ""})`;
  }

  return `${chargeCible} cours cibles`;
}

function formaterLibelleReprise(reprise, diagnostic) {
  if (!reprise) {
    return "";
  }

  if (reprise.statut === "planifie" && reprise.groupe_reprise) {
    return "Rattachement stable confirme";
  }

  if (reprise.statut === "resolution_manuelle") {
    return diagnostic?.conclusion?.resume || "Aucun groupe compatible n'a ete attribue";
  }

  return "En attente de rattachement";
}

export function EtudiantDetails({
  consultation,
  actionEnCours,
  chargementConsultation,
  onRechargerHoraire,
  onRetourListe,
  affichagePleinEcran = false,
}) {
  if (!consultation?.etudiant) {
    return (
      <section className="panel panel--stacked detail-panel">
        <h2>Selectionnez un etudiant</h2>
        <p>
          Le panneau de droite affiche le groupe principal, les reprises et
          l'horaire fusionne de l'etudiant selectionne.
        </p>
      </section>
    );
  }

  const {
    etudiant,
    horaire = [],
    horaireGroupe = [],
    horaireReprises = [],
    reprises = [],
    diagnosticReprises = [],
    resume = null,
  } = consultation;
  const consultationEnCours =
    chargementConsultation || actionEnCours === `consultation-${etudiant.id_etudiant}`;
  const groupeLibelle = etudiant.groupe || "Sans groupe";
  const nbReprises = Number(etudiant.nb_reprises || 0);
  const reprisePlanifiee = Number(resume?.nb_reprises_planifiees || 0);
  const repriseEnAttente = Number(resume?.nb_reprises_en_attente || 0);
  const metaReprises = indexerMetaReprises(horaireReprises);
  const diagnosticsIndex = indexerDiagnosticsReprises(diagnosticReprises);
  const aDesReprisesEnAttente = reprises.some(
    (reprise) => reprise.statut !== "planifie" || !reprise.id_groupe_reprise
  );

  return (
    <section
      className={`panel panel--stacked detail-panel ${
        affichagePleinEcran ? "detail-panel--immersive" : ""
      }`}
    >
      <div className="detail-card">
        {onRetourListe ? (
          <div className="detail-card__topbar">
            <button
              className="button button--secondary detail-card__back-button"
              type="button"
              onClick={onRetourListe}
            >
              Retour a la liste
            </button>
          </div>
        ) : null}

        <div className="detail-card__header">
          <div className="teacher-avatar teacher-avatar--large" aria-hidden="true">
            {construireInitialesEtudiant(etudiant)}
          </div>
          <div>
            <p className="eyebrow">Fiche etudiant</p>
            <h2>{construireNomCompletEtudiant(etudiant)}</h2>
            <p className="detail-card__subtitle">{etudiant.matricule}</p>
          </div>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Groupe principal</dt>
            <dd>{groupeLibelle}</dd>
          </div>
          <div>
            <dt>Programme</dt>
            <dd>{etudiant.programme}</dd>
          </div>
          <div>
            <dt>Etape</dt>
            <dd>Etape {etudiant.etape}</dd>
          </div>
          <div>
            <dt>Charge cible</dt>
            <dd>{formaterLibelleCharge(etudiant, resume)}</dd>
          </div>
          <div>
            <dt>Seances groupe</dt>
            <dd>{horaireGroupe.length}</dd>
          </div>
          <div>
            <dt>Seances reprises</dt>
            <dd>{horaireReprises.length}</dd>
          </div>
        </dl>

        <div className="detail-card__section">
          <div className="table-header">
            <div>
              <h2>Reprises individuelles</h2>
              <p>
                {nbReprises > 0
                  ? `${reprisePlanifiee} planifiee(s), ${repriseEnAttente} en attente.`
                  : "Aucun cours echoue a reprendre pour cet etudiant."}
              </p>
            </div>
          </div>

          {aDesReprisesEnAttente ? (
            <div className="detail-card__callout detail-card__callout--warning">
              Certaines reprises de cet etudiant n'ont pas encore de groupe
              compatible dans la session active. Relancez la generation ou
              corrigez le conflit avant validation finale.
            </div>
          ) : null}

          {reprises.length === 0 ? (
            <p className="detail-card__subtitle">
              Cet etudiant suit uniquement le tronc commun de son groupe principal.
            </p>
          ) : (
            <ul className="schedule-preview schedule-preview--compact">
              {reprises.map((reprise) => {
                const metaReprise =
                  metaReprises.get(`reprise-${reprise.id}`) ||
                  metaReprises.get(`cours-${reprise.id_cours}`) ||
                  null;
                const diagnosticReprise =
                  diagnosticsIndex.get(`reprise-${reprise.id}`) ||
                  diagnosticsIndex.get(`cours-${reprise.id_cours}`) ||
                  null;
                const professeur = formaterNomProfesseur(metaReprise);
                const salle = metaReprise?.code_salle || null;
                const groupeSuivi = reprise.groupe_reprise || metaReprise?.groupe_source || null;
                const resumeDiagnostic = resumerCandidatsDiagnostic(diagnosticReprise);

                return (
                  <li
                    key={`reprise-${reprise.id}`}
                    className="schedule-preview__item schedule-preview__item--reprise"
                  >
                    <div className="detail-card__reprise-header">
                      <strong>{reprise.code_cours}</strong>
                      <span className="status-pill status-pill--warning">REPRISE</span>
                    </div>
                    <span>{reprise.nom_cours}</span>
                    <span>{formaterLibelleReprise(reprise, diagnosticReprise)}</span>
                    {resumeDiagnostic ? <span>{resumeDiagnostic}</span> : null}
                    <span>
                      {salle ? `Salle : ${salle}` : "Salle : a confirmer"}
                    </span>
                    <span>
                      {professeur ? `Prof : ${professeur}` : "Prof : a confirmer"}
                    </span>
                    <span>
                      {groupeSuivi
                        ? `Groupe suivi : ${groupeSuivi}`
                        : "Groupe suivi : non attribue"}
                    </span>
                    <span>
                      {reprise.note_echec === null
                        ? "Note d'echec non renseignee"
                        : `Note d'echec : ${reprise.note_echec}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="detail-card__section">
          {horaire === null ? (
            <div className="schedule-preview schedule-preview--pending">
              <div className="loader" aria-hidden="true" />
            </div>
          ) : horaire.length === 0 ? (
            <p className="detail-card__subtitle">
              {etudiant.groupe
                ? "Aucune seance n'est encore planifiee pour cet etudiant."
                : "Cet etudiant n'est rattache a aucun groupe pour le moment."}
            </p>
          ) : (
            <EtudiantScheduleBoard
              seances={horaire}
              resume={resume}
              consultationEnCours={consultationEnCours}
              onRechargerHoraire={onRechargerHoraire}
            />
          )}
        </div>
      </div>
    </section>
  );
}
