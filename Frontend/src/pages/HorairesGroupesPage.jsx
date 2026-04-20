/**
 * PAGE - Horaires Groupes
 *
 * Cette page affiche le planning
 * detaille d'un groupe genere.
 *
 * Améliorations UX apportées :
 *  - Filtres Programme + Étape avant la sélection du groupe.
 *  - La liste des groupes se réduit dynamiquement selon les filtres actifs.
 *  - Si un seul groupe reste après filtrage, il est présélectionné automatiquement.
 *  - Message clair si aucun groupe ne correspond aux filtres.
 *  - Réinitialisation des filtres en un clic.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ExportButtons } from "../components/export/ExportButtons.jsx";
import {
  recupererGroupes,
  recupererPlanningGroupe,
} from "../services/groupes.api.js";
import {
  JOURS_SEMAINE_COMPLETS,
  creerDateLocale,
  formaterDateCourte,
  getDebutSemaine,
  getIndexJourCalendrier,
} from "../utils/calendar.js";
import { ecouterSynchronisationPlanning } from "../utils/planningSync.js";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import { formaterLibelleCohorte } from "../utils/sessions.js";
import "../styles/PlanningEtudiantPage.css";
import "../styles/CrudPages.css";

const HEURES = Array.from({ length: 15 }, (_, index) =>
  `${String(index + 8).padStart(2, "0")}:00`
);

function formaterDateLongue(dateStr) {
  const date = creerDateLocale(dateStr);
  return date.toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formaterHeure(heureStr) {
  return String(heureStr || "").slice(0, 5);
}

function heureEnMinutes(heure) {
  const [heures, minutes] = String(heure || "00:00").split(":").map(Number);
  return heures * 60 + minutes;
}

function getSeancesParJourEtHeure(seances, lundiSemaine) {
  const indexParCase = {};

  seances.forEach((seance) => {
    const dateSeance = creerDateLocale(seance.date);
    const jourIndex = getIndexJourCalendrier(dateSeance);
    const lundiSeance = getDebutSemaine(dateSeance);

    if (lundiSeance.getTime() !== lundiSemaine.getTime()) {
      return;
    }

    const debut = formaterHeure(seance.heure_debut);
    const cle = `${jourIndex}-${debut}`;

    if (!indexParCase[cle]) {
      indexParCase[cle] = [];
    }

    indexParCase[cle].push(seance);
  });

  return indexParCase;
}

function getHauteur(heureDebut, heureFin) {
  const debut = heureEnMinutes(formaterHeure(heureDebut));
  const fin = heureEnMinutes(formaterHeure(heureFin));
  return ((fin - debut) / 60) * 60;
}

/* ─── Normalisation accentuée pour la comparaison de filtres ─── */
function normaliserTexte(valeur) {
  return String(valeur || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* ─── Extraire les valeurs uniques d'un champ dans un tableau ─── */
function extraireValeursUniques(liste, cle) {
  const valeurs = new Set();
  liste.forEach((item) => {
    const valeur = String(item[cle] || "").trim();
    if (valeur) valeurs.add(valeur);
  });
  return [...valeurs].sort((a, b) => a.localeCompare(b, "fr"));
}

export function HorairesGroupesPage({ utilisateur, onLogout }) {
  const [groupes, setGroupes] = useState([]);
  const [idGroupeActif, setIdGroupeActif] = useState("");
  const [groupeActif, setGroupeActif] = useState(null);
  const [horaire, setHoraire] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chargementPlanning, setChargementPlanning] = useState(false);
  const [exportError, setExportError] = useState("");
  const { showError } = usePopup();
  const [lundiCourant, setLundiCourant] = useState(() =>
    getDebutSemaine(new Date())
  );

  /* ─── Filtres programme et étape ─── */
  const [filtreProgramme, setFiltreProgramme] = useState("");
  const [filtreEtape, setFiltreEtape] = useState("");

  /* ─── Chargement initial des groupes ─── */
  useEffect(() => {
    async function chargerGroupes() {
      setLoading(true);

      try {
        const groupesData = await recupererGroupes(true, {
          sessionActive: true,
          seulementAvecPlanning: true,
        });
        const liste = Array.isArray(groupesData) ? groupesData : [];
        setGroupes(liste);

        if (liste.length > 0) {
          setIdGroupeActif(String(liste[0].id_groupes_etudiants));
        } else {
          setGroupeActif(null);
          setHoraire([]);
        }
      } catch (error) {
        showError(error.message || "Impossible de charger les groupes.");
      } finally {
        setLoading(false);
      }
    }

    chargerGroupes();
  }, []);

  /* ─── Chargement du planning quand le groupe actif change ─── */
  useEffect(() => {
    async function chargerPlanning() {
      if (!idGroupeActif) {
        setGroupeActif(null);
        setHoraire([]);
        return;
      }

      setChargementPlanning(true);

      try {
        const resultat = await recupererPlanningGroupe(idGroupeActif);
        setGroupeActif(resultat.groupe || null);
        setHoraire(Array.isArray(resultat.horaire) ? resultat.horaire : []);
      } catch (error) {
        showError(error.message || "Impossible de charger l'horaire du groupe.");
      } finally {
        setChargementPlanning(false);
      }
    }

    chargerPlanning();
  }, [idGroupeActif]);

  /* ─── Synchronisation en temps réel ─── */
  useEffect(() => {
    return ecouterSynchronisationPlanning((payload) => {
      if (!idGroupeActif) return;

      const groupesImpactes = Array.isArray(payload?.groupes_impactes)
        ? payload.groupes_impactes.map((idGroupe) => Number(idGroupe))
        : [];
      const idActif = Number(idGroupeActif);

      if (groupesImpactes.length > 0 && !groupesImpactes.includes(idActif)) {
        return;
      }

      recupererPlanningGroupe(idActif)
        .then((resultat) => {
          setGroupeActif(resultat.groupe || null);
          setHoraire(Array.isArray(resultat.horaire) ? resultat.horaire : []);
        })
        .catch(() => {});
    });
  }, [idGroupeActif]);

  /* ─── Valeurs uniques de programmes et d'étapes (pour les filtres) ─── */
  const programmesDisponibles = useMemo(
    () => extraireValeursUniques(groupes, "programme"),
    [groupes]
  );

  const etapesDisponibles = useMemo(() => {
    // Si un programme est filtré, on ne propose que les étapes de ce programme
    const source = filtreProgramme
      ? groupes.filter(
          (groupe) =>
            normaliserTexte(groupe.programme) === normaliserTexte(filtreProgramme)
        )
      : groupes;
    return extraireValeursUniques(source, "etape");
  }, [groupes, filtreProgramme]);

  /* ─── Liste filtrée des groupes ─── */
  const groupesFiltres = useMemo(() => {
    let liste = groupes;

    if (filtreProgramme) {
      liste = liste.filter(
        (groupe) =>
          normaliserTexte(groupe.programme) === normaliserTexte(filtreProgramme)
      );
    }

    if (filtreEtape) {
      liste = liste.filter(
        (groupe) => normaliserTexte(groupe.etape) === normaliserTexte(filtreEtape)
      );
    }

    return liste;
  }, [groupes, filtreProgramme, filtreEtape]);

  /* ─── Présélection automatique si un seul groupe reste ─── */
  useEffect(() => {
    if (groupesFiltres.length === 1) {
      const seulGroupe = String(groupesFiltres[0].id_groupes_etudiants);
      if (seulGroupe !== idGroupeActif) {
        setIdGroupeActif(seulGroupe);
      }
    }
  }, [groupesFiltres]);

  /* ─── Cohérence : si le groupe sélectionné n'est plus dans la liste filtrée → vider ─── */
  useEffect(() => {
    if (!idGroupeActif) return;
    const toujoursDansListe = groupesFiltres.some(
      (groupe) => String(groupe.id_groupes_etudiants) === idGroupeActif
    );
    if (!toujoursDansListe && groupesFiltres.length > 0) {
      setIdGroupeActif(String(groupesFiltres[0].id_groupes_etudiants));
    } else if (!toujoursDansListe) {
      setIdGroupeActif("");
    }
  }, [groupesFiltres]);

  const finSemaine = useMemo(() => {
    const date = new Date(lundiCourant);
    date.setDate(date.getDate() + 6);
    return date;
  }, [lundiCourant]);

  const joursAvecDates = useMemo(() => {
    return JOURS_SEMAINE_COMPLETS.map(({ label }, index) => {
      const date = new Date(lundiCourant);
      date.setDate(date.getDate() + index);
      return { nom: label, date };
    });
  }, [lundiCourant]);

  const seancesMap = useMemo(
    () => getSeancesParJourEtHeure(horaire, lundiCourant),
    [horaire, lundiCourant]
  );

  /* ─── Réinitialiser les filtres ─── */
  function reinitialiserFiltres() {
    setFiltreProgramme("");
    setFiltreEtape("");
  }

  return (
    <motion.div
        className="planning-container"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {/* ── Filtres Programme + Étape ── */}
        <div className="groupe-filtres">
          {/* Filtre Programme */}
          <div className="groupe-filtres__champ">
            <span>Programme</span>
            <select
              value={filtreProgramme}
              onChange={(event) => {
                setFiltreProgramme(event.target.value);
                setFiltreEtape(""); // réinitialiser l'étape si le programme change
              }}
              disabled={loading || programmesDisponibles.length === 0}
            >
              <option value="">Tous les programmes</option>
              {programmesDisponibles.map((programme) => (
                <option key={programme} value={programme}>
                  {programme}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre Étape */}
          <div className="groupe-filtres__champ">
            <span>Étape</span>
            <select
              value={filtreEtape}
              onChange={(event) => setFiltreEtape(event.target.value)}
              disabled={loading || etapesDisponibles.length === 0}
            >
              <option value="">Toutes les étapes</option>
              {etapesDisponibles.map((etape) => (
                <option key={etape} value={etape}>
                  Étape {etape}
                </option>
              ))}
            </select>
          </div>

          {/* Réinitialiser */}
          {(filtreProgramme || filtreEtape) && (
            <button
              type="button"
              className="groupe-filtres__reset"
              onClick={reinitialiserFiltres}
            >
              Réinitialiser
            </button>
          )}

          {/* Compteur */}
          <span className="groupe-filtres__compteur">
            {loading ? "Chargement…" : `${groupesFiltres.length} groupe(s)`}
          </span>
        </div>

        {/* ── Barre d'infos + Export ── */}
        <div className="planning-infos" style={{ marginBottom: "24px" }}>
          <div className="planning-info-item">
            <span className="planning-label">Groupe</span>
            <select
              className="crud-page__search"
              value={idGroupeActif}
              onChange={(event) => setIdGroupeActif(event.target.value)}
              disabled={loading || groupesFiltres.length === 0}
            >
              {groupesFiltres.length === 0 ? (
                <option value="">Aucun groupe correspondant</option>
              ) : (
                <>
                  {groupesFiltres.length > 1 && (
                    <option value="">Choisir un groupe</option>
                  )}
                  {groupesFiltres.map((groupe) => (
                    <option
                      key={groupe.id_groupes_etudiants}
                      value={groupe.id_groupes_etudiants}
                    >
                      {groupe.nom_groupe}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
          <div className="planning-info-item">
            <span className="planning-label">Programme</span>
            <span className="planning-valeur">
              {groupeActif?.programme || "Non genere"}
            </span>
          </div>
          <div className="planning-info-item">
            <span className="planning-label">Etape</span>
            <span className="planning-valeur">{groupeActif?.etape || "-"}</span>
          </div>
          <div className="planning-info-item">
            <span className="planning-label">Cohorte</span>
            <span className="planning-valeur">
              {formaterLibelleCohorte(groupeActif?.session, groupeActif?.annee)}
            </span>
          </div>
          <div className="planning-info-item">
            <span className="planning-label">Effectif</span>
            <span className="planning-valeur">{groupeActif?.effectif || 0}</span>
          </div>
          <div className="planning-info-item" style={{ marginLeft: "auto", paddingLeft: "1rem" }}>
            <ExportButtons
              type="groupe"
              id={idGroupeActif ? Number(idGroupeActif) : null}
              nom={groupeActif?.nom_groupe || ""}
              disabled={!idGroupeActif || horaire.length === 0}
              compact={false}
              onError={(msg) => showError(msg)}
            />
          </div>
        </div>

        {exportError && (
          <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: "12px" }}>
            {exportError}
          </p>
        )}

        {loading ? (
          <p className="planning-message">Chargement des groupes...</p>
        ) : groupes.length === 0 ? (
          <p className="planning-message">Aucun groupe genere pour le moment.</p>
        ) : groupesFiltres.length === 0 ? (
          <p className="planning-message">
            Aucun groupe ne correspond aux filtres sélectionnés.{" "}
            <button
              type="button"
              onClick={reinitialiserFiltres}
              style={{
                background: "none",
                border: "none",
                color: "var(--primary)",
                cursor: "pointer",
                fontWeight: 700,
                textDecoration: "underline",
                font: "inherit",
              }}
            >
              Réinitialiser les filtres
            </button>
          </p>
        ) : chargementPlanning ? (
          <p className="planning-message">Chargement du planning...</p>
        ) : (
          <>
            <h2 className="planning-sous-titre">Cours planifies</h2>
            {horaire.length === 0 ? (
              <p className="planning-vide">Aucun cours planifie pour ce groupe.</p>
            ) : (
              <div className="planning-table-wrapper">
                <table className="planning-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Debut</th>
                      <th>Fin</th>
                      <th>Cours</th>
                      <th>Professeur</th>
                      <th>Salle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {horaire.map((seance) => (
                      <tr key={seance.id_affectation_cours}>
                        <td>{formaterDateLongue(seance.date)}</td>
                        <td>{formaterHeure(seance.heure_debut)}</td>
                        <td>{formaterHeure(seance.heure_fin)}</td>
                        <td>
                          <span className="planning-code">{seance.code_cours}</span>
                          <span className="planning-nom-cours">{seance.nom_cours}</span>
                        </td>
                        <td>
                          {seance.prenom_professeur} {seance.nom_professeur}
                        </td>
                        <td>
                          <span className="planning-salle">{seance.code_salle}</span>
                          <span className="planning-type-salle">{seance.type_salle}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="planning-sous-titre" style={{ marginTop: "40px" }}>
              Calendrier du groupe
            </h2>

            <div className="cal-nav">
              <motion.button
                className="cal-nav-btn"
                onClick={() => {
                  const date = new Date(lundiCourant);
                  date.setDate(date.getDate() - 7);
                  setLundiCourant(date);
                }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
              >
                &larr;
              </motion.button>
              <span className="cal-nav-titre">
                {formaterDateCourte(lundiCourant)} - {formaterDateCourte(finSemaine)}
              </span>
              <motion.button
                className="cal-nav-btn"
                onClick={() => {
                  const date = new Date(lundiCourant);
                  date.setDate(date.getDate() + 7);
                  setLundiCourant(date);
                }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
              >
                &rarr;
              </motion.button>
              <motion.button
                className="cal-nav-aujourd-hui"
                onClick={() => setLundiCourant(getDebutSemaine(new Date()))}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                Aujourd'hui
              </motion.button>
            </div>

            <div className="cal-wrapper">
              <div className="cal-grille">
                <div className="cal-col-heures">
                  <div className="cal-entete-vide"></div>
                  {HEURES.map((heure) => (
                    <div key={heure} className="cal-heure-cell">
                      {heure}
                    </div>
                  ))}
                </div>

                {joursAvecDates.map(({ nom, date }, jourIndex) => (
                  <div key={jourIndex} className="cal-col-jour">
                    <div className="cal-entete-jour">
                      <span className="cal-jour-nom">{nom}</span>
                      <span className="cal-jour-date">{formaterDateCourte(date)}</span>
                    </div>
                    <div className="cal-col-body">
                      {HEURES.map((heure) => (
                        <div key={heure} className="cal-slot"></div>
                      ))}
                      {HEURES.map((heure) => {
                        const cle = `${jourIndex}-${heure}`;
                        const seances = seancesMap[cle] || [];

                        return seances.map((seance) => {
                          const hauteur = getHauteur(seance.heure_debut, seance.heure_fin);
                          const debut = heureEnMinutes(formaterHeure(seance.heure_debut));
                          const heureReference = heureEnMinutes(HEURES[0]);
                          const top = ((debut - heureReference) / 60) * 60;

                          return (
                            <motion.div
                              key={seance.id_affectation_cours}
                              className="cal-seance"
                              style={{ top: `${top}px`, height: `${hauteur}px` }}
                              whileHover={{ scale: 1.015 }}
                              transition={{ duration: 0.15 }}
                            >
                              <span className="cal-seance-code">{seance.code_cours}</span>
                              <span className="cal-seance-nom">{seance.nom_cours}</span>
                              <span className="cal-seance-salle">{seance.code_salle}</span>
                              <span className="cal-seance-prof">{seance.nom_professeur}</span>
                            </motion.div>
                          );
                        });
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </motion.div>
  );
}
