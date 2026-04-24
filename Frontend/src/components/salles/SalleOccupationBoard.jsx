/**
 * COMPONENT - Salle Occupation Board
 *
 * Ce composant affiche la lecture metier d'une salle sur une semaine :
 * - resume operationnel V3 (maintenant / prochain / disponibilite restante) ;
 * - calendrier hebdomadaire avec blocs occupes et libres ;
 * - tableau detaille de la semaine visible.
 *
 * Il reutilise la grille `cal-*` deja presente sur les autres vues horaires du
 * projet pour rester coherent avec l'existant, puis ajoute uniquement les
 * variantes visuelles propres a l'occupation de salle.
 */
import {
  JOURS_SEMAINE_COMPLETS,
  creerDateLocale,
  formaterDateCourte,
} from "../../utils/calendar.js";
import {
  HEURES_GRILLE,
  formaterDateIsoLocal,
  formaterDureeMinutes,
  formaterNomProfesseur,
  normaliserHeure,
} from "../../utils/salleOccupation.js";

const NB_JOURS_AFFICHES = 7;

function ajouterJours(dateSource, nbJours) {
  const date = new Date(dateSource);
  date.setDate(date.getDate() + nbJours);
  return date;
}

function estDateValide(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function parserDateAffichage(dateSource) {
  if (dateSource instanceof Date) {
    return estDateValide(dateSource) ? new Date(dateSource) : null;
  }

  const texte = String(dateSource || "").trim();

  if (!texte) {
    return null;
  }

  const dateIso = texte.includes("T") ? texte.slice(0, 10) : texte;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);

  if (match) {
    const [, annee, mois, jour] = match;
    const anneeNombre = Number(annee);
    const moisNombre = Number(mois);
    const jourNombre = Number(jour);
    const date = new Date(anneeNombre, moisNombre - 1, jourNombre);
    const dateCorrespond =
      date.getFullYear() === anneeNombre &&
      date.getMonth() === moisNombre - 1 &&
      date.getDate() === jourNombre;

    return estDateValide(date) && dateCorrespond ? date : null;
  }

  const fallback = new Date(texte);
  return estDateValide(fallback) ? fallback : null;
}

function formaterDateLongue(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formaterStatutTempsReel(tempsReel) {
  if (tempsReel?.statut === "conflit") {
    return "Conflit detecte maintenant";
  }

  if (tempsReel?.occupee_maintenant) {
    return "Occupee maintenant";
  }

  return "Libre actuellement";
}

function formaterDetailTempsReel(tempsReel) {
  const occupationActuelle = tempsReel?.occupation_actuelle;

  if (!occupationActuelle) {
    return "Aucune occupation en cours sur ce creneau.";
  }

  const professeur = formaterNomProfesseur(occupationActuelle) || "Professeur a confirmer";
  return `${occupationActuelle.groupes || "Groupe a confirmer"} | ${
    occupationActuelle.code_cours
  } | ${professeur}`;
}

function formaterProchainCreneau(tempsReel) {
  const prochainCreneau = tempsReel?.prochain_creneau;

  if (!prochainCreneau) {
    return "Aucun autre cours prevu pour cette salle.";
  }

  return `${formaterDateLongue(prochainCreneau.date)} | ${normaliserHeure(
    prochainCreneau.heure_debut
  )} - ${normaliserHeure(prochainCreneau.heure_fin)}`;
}

function formaterDetailProchainCreneau(tempsReel) {
  const prochainCreneau = tempsReel?.prochain_creneau;

  if (!prochainCreneau) {
    return "La salle reste libre sur le reste du planning charge.";
  }

  const professeur = formaterNomProfesseur(prochainCreneau) || "Professeur a confirmer";
  return `${prochainCreneau.groupes || "Groupe a confirmer"} | ${
    prochainCreneau.code_cours
  } | ${professeur}`;
}

function formaterMetaOccupation(occupation) {
  const meta = [];

  if (occupation?.type_cours) {
    meta.push(occupation.type_cours);
  }

  if (occupation?.type_salle) {
    meta.push(occupation.type_salle);
  }

  return meta.join(" | ");
}

function getStyleCreneau(creneau) {
  const top = ((Number(creneau.debut_minutes || 0) - 480) / 60) * 60;
  const height = (Number(creneau.duree_minutes || 0) / 60) * 60;

  if (creneau.statut === "libre") {
    return {
      top: `${top}px`,
      height: `${height}px`,
      left: "4px",
      width: "calc(100% - 8px)",
    };
  }

  const nbColonnes = Math.max(1, Number(creneau.nb_colonnes || 1));
  const indexColonne = Math.max(0, Number(creneau.index_colonne || 0));
  const largeurColonne = 100 / nbColonnes;

  return {
    top: `${top}px`,
    height: `${height}px`,
    left: `calc(4px + ${largeurColonne * indexColonne}%)`,
    width: `calc(${largeurColonne}% - 8px)`,
  };
}

function getClasseStatutCreneau(creneau) {
  if (creneau.statut === "conflit") {
    return "cal-seance room-occupation-board__slot room-occupation-board__slot--conflict";
  }

  if (creneau.statut === "libre") {
    return "cal-seance room-occupation-board__slot room-occupation-board__slot--free";
  }

  return "cal-seance room-occupation-board__slot room-occupation-board__slot--occupied";
}

function construireJoursAffiches(vueHebdomadaire) {
  const debutSemaine =
    parserDateAffichage(vueHebdomadaire?.debutSemaine) ||
    parserDateAffichage(vueHebdomadaire?.debutSemaineIso) ||
    parserDateAffichage(vueHebdomadaire?.debut_semaine) ||
    new Date();
  const creneauxParDate = new Map(
    (Array.isArray(vueHebdomadaire?.jours) ? vueHebdomadaire.jours : [])
      .map((jour) => {
        const date = parserDateAffichage(jour?.date);
        return date ? [formaterDateIsoLocal(date), jour.creneaux || []] : null;
      })
      .filter(Boolean)
  );

  return JOURS_SEMAINE_COMPLETS.slice(0, NB_JOURS_AFFICHES).map((jour, index) => {
    const date = ajouterJours(debutSemaine, index);
    const dateIso = formaterDateIsoLocal(date);

    return {
      date: dateIso,
      nom: jour.label,
      creneaux: creneauxParDate.get(dateIso) || [],
    };
  });
}

export function SalleOccupationBoard({
  vueHebdomadaire,
  tempsReel,
  consultationEnCours = false,
  onRecharger,
  onSemainePrecedente,
  onSemaineSuivante,
  onRevenirSemaineReference,
  peutNaviguerPrecedent = true,
  peutNaviguerSuivant = true,
}) {
  if (!vueHebdomadaire) {
    return null;
  }

  const joursAffiches = construireJoursAffiches(vueHebdomadaire);
  const datesAffichees = new Set(joursAffiches.map((jour) => jour.date));
  const occupationsSemaine =
    datesAffichees.size > 0 && Array.isArray(vueHebdomadaire.occupationsSemaine)
      ? vueHebdomadaire.occupationsSemaine.filter(
          (occupation) => datesAffichees.has(occupation.date)
        )
      : [];

  const classeEtatActuel =
    tempsReel?.statut === "conflit"
      ? "room-occupation-board__live-card--conflict"
      : tempsReel?.occupee_maintenant
        ? "room-occupation-board__live-card--occupied"
        : "room-occupation-board__live-card--free";

  return (
    <div className="detail-card__section">
      <div className="table-header">
        <div>
          <h2>Occupation hebdomadaire</h2>
          <p>
            {vueHebdomadaire.resume?.creneaux_occupes ?? 0} bloc(s) occupes et{" "}
            {vueHebdomadaire.resume?.creneaux_libres ?? 0} plage(s) libres sur la semaine.
          </p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          onClick={onRecharger}
          disabled={consultationEnCours}
        >
          {consultationEnCours ? "Actualisation..." : "Recharger"}
        </button>
      </div>

      <div className="etudiant-schedule__legend">
        <span className="status-pill room-occupation-board__pill room-occupation-board__pill--free">
          Libre
        </span>
        <span className="status-pill room-occupation-board__pill room-occupation-board__pill--occupied">
          Occupee
        </span>
        <span className="status-pill room-occupation-board__pill room-occupation-board__pill--conflict">
          Conflit
        </span>
      </div>

      <div className="room-occupation-board__live-grid">
        <article className={`room-occupation-board__live-card ${classeEtatActuel}`}>
          <span className="planning-label">Etat actuel</span>
          <strong>{formaterStatutTempsReel(tempsReel)}</strong>
          <p>{formaterDetailTempsReel(tempsReel)}</p>
        </article>
        <article className="room-occupation-board__live-card">
          <span className="planning-label">Prochain cours</span>
          <strong>{formaterProchainCreneau(tempsReel)}</strong>
          <p>{formaterDetailProchainCreneau(tempsReel)}</p>
        </article>
        <article className="room-occupation-board__live-card">
          <span className="planning-label">Disponibilite restante aujourd'hui</span>
          <strong>
            {formaterDureeMinutes(
              tempsReel?.disponibilite_restante_aujourdhui_minutes || 0
            )}
          </strong>
          <p>Calculee dynamiquement depuis l'heure courante du navigateur.</p>
        </article>
      </div>

      <div className="cal-nav">
        <button
          className="cal-nav-btn"
          type="button"
          onClick={onSemainePrecedente}
          disabled={!peutNaviguerPrecedent}
        >
          &larr;
        </button>
        <span className="cal-nav-titre">
          {formaterDateCourte(vueHebdomadaire.debutSemaine)} -{" "}
          {formaterDateCourte(vueHebdomadaire.finSemaine)}
        </span>
        <button
          className="cal-nav-btn"
          type="button"
          onClick={onSemaineSuivante}
          disabled={!peutNaviguerSuivant}
        >
          &rarr;
        </button>
        <button
          className="cal-nav-aujourd-hui"
          type="button"
          onClick={onRevenirSemaineReference}
        >
          Semaine de reference
        </button>
      </div>

      <div className="cal-wrapper">
        <div className="cal-grille">
          <div className="cal-col-heures">
            <div className="cal-entete-vide"></div>
            {HEURES_GRILLE.map((heure) => (
              <div key={heure} className="cal-heure-cell">
                {heure}
              </div>
            ))}
          </div>

          {joursAffiches.map((jour) => (
            <div key={`jour-${jour.date}`} className="cal-col-jour">
              <div className="cal-entete-jour">
                <span className="cal-jour-nom">{jour.nom}</span>
                <span className="cal-jour-date">
                  {formaterDateCourte(creerDateLocale(jour.date))}
                </span>
              </div>
              <div className="cal-col-body">
                {HEURES_GRILLE.map((heure) => (
                  <div key={heure} className="cal-slot"></div>
                ))}

                {jour.creneaux.map((creneau) => (
                    <div
                      key={creneau.id_creneau}
                      className={getClasseStatutCreneau(creneau)}
                      style={getStyleCreneau(creneau)}
                    >
                      {creneau.statut === "libre" ? (
                        <>
                          <span className="room-occupation-board__free-label">Libre</span>
                          <span className="room-occupation-board__free-meta">
                            {normaliserHeure(creneau.heure_debut)} -{" "}
                            {normaliserHeure(creneau.heure_fin)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="cal-seance-code">
                            {creneau.code_cours || "Cours a confirmer"}
                          </span>
                          <span className="room-occupation-board__slot-badge">
                            {creneau.statut === "conflit"
                              ? "CONFLIT"
                              : creneau.est_reprise
                              ? "REPRISE"
                              : "OCCUPEE"}
                          </span>
                          <span className="cal-seance-nom">
                            {creneau.nom_cours || "Nom du cours a confirmer"}
                          </span>
                          <span className="cal-seance-salle">
                            {creneau.groupes || "Groupe a confirmer"}
                          </span>
                          <span className="cal-seance-prof">
                            {formaterNomProfesseur(creneau) || "Professeur a confirmer"}
                          </span>
                          {formaterMetaOccupation(creneau) ? (
                            <span className="room-occupation-board__slot-meta">
                              {formaterMetaOccupation(creneau)}
                            </span>
                          ) : null}
                          <span className="room-occupation-board__slot-meta">
                            {creneau.effectif_total || 0}/{creneau.capacite_salle || 0} places
                          </span>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="planning-table-wrapper">
        <table className="planning-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Horaire</th>
              <th>Statut</th>
              <th>Groupe</th>
              <th>Cours</th>
              <th>Professeur</th>
              <th>Type</th>
              <th>Capacite</th>
            </tr>
          </thead>
          <tbody>
            {occupationsSemaine.length === 0 ? (
              <tr>
                <td colSpan="8" className="crud-page__empty">
                  Aucune occupation sur la semaine selectionnee.
                </td>
              </tr>
            ) : (
              occupationsSemaine.map((occupation) => (
                <tr key={`semaine-${occupation.id_affectation_cours}-${occupation.date}`}>
                  <td>{formaterDateLongue(occupation.date)}</td>
                  <td>
                    {normaliserHeure(occupation.heure_debut)} -{" "}
                    {normaliserHeure(occupation.heure_fin)}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        occupation.conflit_detecte
                          ? "room-occupation-board__pill room-occupation-board__pill--conflict"
                          : "room-occupation-board__pill room-occupation-board__pill--occupied"
                      }`}
                    >
                      {occupation.conflit_detecte ? "Conflit" : "Occupee"}
                    </span>
                  </td>
                  <td>{occupation.groupes || "Aucun groupe"}</td>
                  <td>
                    <span className="planning-code">{occupation.code_cours}</span>
                    <span className="planning-nom-cours">{occupation.nom_cours}</span>
                  </td>
                  <td>
                    {formaterNomProfesseur(occupation) || "Professeur a confirmer"}
                  </td>
                  <td>{formaterMetaOccupation(occupation) || "Non renseigne"}</td>
                  <td>
                    {occupation.effectif_total || 0}/{occupation.capacite_salle || 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="room-occupation-board__footnote">
        Reference semaine : {formaterDateIsoLocal(vueHebdomadaire.debutSemaine)}
      </div>
    </div>
  );
}
