import {
  construireInitialesEtudiant,
  construireNomCompletEtudiant,
} from "../../utils/etudiants.utils.js";
import { EtudiantScheduleBoard } from "./EtudiantScheduleBoard.jsx";
import { ExportButtons } from "../export/ExportButtons.jsx";
import { usePopup } from "../feedback/PopupProvider.jsx";


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

function formaterLibelleException(exception) {
  if (!exception) {
    return "";
  }

  if (exception.type_exception === "echange_cours" && exception.etudiant_echange) {
    return `Echange de cours avec ${exception.etudiant_echange}`;
  }

  return "Exception individuelle de suivi";
}

export function EtudiantDetails({
  consultation,
  actionEnCours,
  chargementConsultation,
  onRechargerHoraire,
  onRetourListe,
  affichagePleinEcran = false,
}) {
  const { showError } = usePopup();

  if (!consultation?.etudiant) {
    return (
      <section className="panel panel--stacked detail-panel">
        <h2>Selectionnez un etudiant</h2>
        <p>
          Le panneau de droite affiche le groupe principal, les reprises, les
          exceptions individuelles et l'horaire fusionne de l'etudiant selectionne.
        </p>
      </section>
    );
  }

  const {
    etudiant,
    horaire = [],
    horaireGroupe = [],
    horaireReprises = [],
    horaireIndividuel = [],
    reprises = [],
    exceptionsIndividuelles = [],
    diagnosticReprises = [],
    resume = null,
  } = consultation;
  const horaireEnChargement = consultation?.horaire === null;
  const horaireListe = Array.isArray(horaire) ? horaire : [];
  const horaireGroupeListe = Array.isArray(horaireGroupe) ? horaireGroupe : [];
  const horaireReprisesListe = Array.isArray(horaireReprises) ? horaireReprises : [];
  const horaireIndividuelListe = Array.isArray(horaireIndividuel) ? horaireIndividuel : [];
  const reprisesListe = Array.isArray(reprises) ? reprises : [];
  const exceptionsIndividuellesListe = Array.isArray(exceptionsIndividuelles)
    ? exceptionsIndividuelles
    : [];
  const diagnosticReprisesListe = Array.isArray(diagnosticReprises)
    ? diagnosticReprises
    : [];
  const consultationEnCours =
    chargementConsultation || actionEnCours === `consultation-${etudiant.id_etudiant}`;
  const groupeLibelle = etudiant.groupe || "Sans groupe";
  const nbReprises = Number(etudiant.nb_reprises || 0);
  const reprisePlanifiee = Number(resume?.nb_reprises_planifiees || 0);
  const repriseEnAttente = Number(resume?.nb_reprises_en_attente || 0);
  const nbExceptionsIndividuelles = Number(
    resume?.cours_exceptions_individuelles || exceptionsIndividuellesListe.length || 0
  );
  const metaReprises = indexerMetaReprises(horaireReprisesListe);
  const diagnosticsIndex = indexerDiagnosticsReprises(diagnosticReprisesListe);
  const aDesReprisesEnAttente = reprisesListe.some(
    (reprise) => reprise.statut !== "planifie" || !reprise.id_groupe_reprise
  );
  const exportDesactive =
    horaireEnChargement ||
    (horaireListe.length === 0 &&
      horaireReprisesListe.length === 0 &&
      horaireIndividuelListe.length === 0 &&
      reprisesListe.length === 0 &&
      exceptionsIndividuellesListe.length === 0);

  return (
    <section
      className={`panel panel--stacked detail-panel ${
        affichagePleinEcran ? "detail-panel--immersive" : ""
      }`}
    >
      <div className="detail-card">
        {onRetourListe ? (
          <div className="detail-card__topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <button
              className="button button--secondary detail-card__back-button"
              type="button"
              onClick={onRetourListe}
            >
              Retour a la liste
            </button>
            <ExportButtons
              type="etudiant"
              id={etudiant.id_etudiant}
              nom={`${etudiant.prenom || ""} ${etudiant.nom || ""}`.trim()}
              disabled={exportDesactive}
              compact
              onError={showError}
            />
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
            <dd>{horaireGroupeListe.length}</dd>
          </div>
          <div>
            <dt>Seances reprises</dt>
            <dd>{horaireReprisesListe.length}</dd>
          </div>
          <div>
            <dt>Seances exceptions</dt>
            <dd>{horaireIndividuelListe.length}</dd>
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

          {reprisesListe.length === 0 ? (
            <p className="detail-card__subtitle">
              Cet etudiant suit uniquement le tronc commun de son groupe principal.
            </p>
          ) : (
            <ul className="schedule-preview schedule-preview--compact">
              {reprisesListe.map((reprise) => {
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
          <div className="table-header">
            <div>
              <h2>Exceptions individuelles de suivi</h2>
              <p>
                {nbExceptionsIndividuelles > 0
                  ? `${nbExceptionsIndividuelles} cours actuellement suivis hors groupe principal.`
                  : "Aucune exception individuelle active pour cet etudiant."}
              </p>
            </div>
          </div>

          {exceptionsIndividuellesListe.length === 0 ? (
            <p className="detail-card__subtitle">
              Tous les autres cours de cet etudiant restent rattaches a son groupe principal.
            </p>
          ) : (
            <ul className="schedule-preview schedule-preview--compact">
              {exceptionsIndividuellesListe.map((exception) => (
                <li
                  key={`exception-${exception.id_cours}-${exception.id_groupe_source}`}
                  className="schedule-preview__item schedule-preview__item--individuelle"
                >
                  <div className="detail-card__reprise-header">
                    <strong>{exception.code_cours}</strong>
                    <span className="status-pill status-pill--exception">EXCEPTION</span>
                  </div>
                  <span>{exception.nom_cours}</span>
                  <span>{formaterLibelleException(exception)}</span>
                  <span>
                    Groupe d&apos;accueil : {exception.groupe_source || "non renseigne"}
                  </span>
                  <span>
                    Groupe principal : {exception.groupe_principal || "non renseigne"}
                  </span>
                  {(exception.occurrences || []).length > 0 ? (
                    <span>
                      {(exception.occurrences || [])
                        .slice(0, 3)
                        .map(
                          (occurrence) =>
                            `${occurrence.date} ${String(occurrence.heure_debut || "").slice(
                              0,
                              5
                            )}-${String(occurrence.heure_fin || "").slice(0, 5)}`
                        )
                        .join(" | ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="detail-card__section">
          {horaireEnChargement ? (
            <div className="schedule-preview schedule-preview--pending">
              <div className="loader" aria-hidden="true" />
            </div>
          ) : horaireListe.length === 0 ? (
            <p className="detail-card__subtitle">
              {etudiant.groupe
                ? "Aucune seance n'est encore planifiee pour cet etudiant."
                : "Cet etudiant n'est rattache a aucun groupe pour le moment."}
            </p>
          ) : (
            <EtudiantScheduleBoard
              seances={horaireListe}
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
