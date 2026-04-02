/**
 * PAGE - Disponibilites Professeurs
 *
 * Cette page gere les disponibilites
 * hebdomadaires des professeurs.
 */
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell.jsx";
import {
  recupererProfesseurs,
  recupererDisponibilitesProfesseur,
  mettreAJourDisponibilitesProfesseur,
} from "../services/professeurs.api.js";
import { JOURS_SEMAINE_COMPLETS } from "../utils/calendar.js";
import { usePopup } from "../components/feedback/PopupProvider.jsx";
import "../styles/ProfesseursPage.css";

const HEURES = Array.from({ length: 15 }, (_, index) =>
  `${String(index + 8).padStart(2, "0")}:00`
);

function normaliserHeure(heure) {
  return String(heure || "").slice(0, 5);
}

function heureEnMinutes(heure) {
  const [heures = "0", minutes = "0"] = normaliserHeure(heure).split(":").map(Number);
  return heures * 60 + minutes;
}

function trierDisponibilites(disponibilites) {
  return [...disponibilites].sort((elementA, elementB) => {
    if (Number(elementA.jour_semaine) !== Number(elementB.jour_semaine)) {
      return Number(elementA.jour_semaine) - Number(elementB.jour_semaine);
    }

    return normaliserHeure(elementA.heure_debut).localeCompare(
      normaliserHeure(elementB.heure_debut),
      "fr"
    );
  });
}

function regrouperDisponibilitesParJour(disponibilites) {
  return JOURS_SEMAINE_COMPLETS.map((jour) => ({
    ...jour,
    disponibilites: disponibilites.filter(
      (disponibilite) => Number(disponibilite.jour_semaine) === jour.value
    ),
  }));
}

function getDisponibilitesParJourEtHeure(disponibilites) {
  const map = {};

  disponibilites.forEach((disponibilite) => {
    const jourIndex = Number(disponibilite.jour_semaine) - 1;

    if (jourIndex < 0 || jourIndex > 6) {
      return;
    }

    const debut = normaliserHeure(disponibilite.heure_debut);
    const key = `${jourIndex}-${debut}`;

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(disponibilite);
  });

  return map;
}

function getHauteurBloc(heureDebut, heureFin) {
  const debut = heureEnMinutes(heureDebut);
  const fin = heureEnMinutes(heureFin);
  return ((fin - debut) / 60) * 60;
}

export function DisponibilitesProfesseursPage({ utilisateur, onLogout }) {
  const [professeurs, setProfesseurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [idProfesseurActif, setIdProfesseurActif] = useState(null);
  const [chargementDisponibilites, setChargementDisponibilites] = useState(false);
  const [erreurDisponibilites, setErreurDisponibilites] = useState("");
  const [messageDisponibilites, setMessageDisponibilites] = useState("");
  const [disponibilites, setDisponibilites] = useState([]);
  const [indexEditionDisponibilite, setIndexEditionDisponibilite] = useState(null);
  const [formulaireDisponibilite, setFormulaireDisponibilite] = useState({
    jour_semaine: "1",
    heure_debut: "08:00",
    heure_fin: "10:00",
  });
  const { showError, showSuccess } = usePopup();

  useEffect(() => {
    async function chargerProfesseurs() {
      setChargement(true);

      try {
        const data = await recupererProfesseurs();
        const liste = data || [];
        setProfesseurs(liste);
        setIdProfesseurActif((valeurActuelle) => {
          if (
            valeurActuelle &&
            liste.some((professeur) => professeur.id_professeur === valeurActuelle)
          ) {
            return valeurActuelle;
          }

          return liste[0]?.id_professeur || null;
        });
      } catch (error) {
        showError(error.message || "Impossible de charger les professeurs.");
      } finally {
        setChargement(false);
      }
    }

    chargerProfesseurs();
  }, []);

  useEffect(() => {
    async function chargerDisponibilites() {
      if (!idProfesseurActif) {
        setDisponibilites([]);
        return;
      }

      setChargementDisponibilites(true);
      setErreurDisponibilites("");

      try {
        const disponibilitesData =
          await recupererDisponibilitesProfesseur(idProfesseurActif);
        setDisponibilites(trierDisponibilites(disponibilitesData || []));
      } catch (error) {
        showError(
          error.message || "Impossible de charger les disponibilites du professeur."
        );
      } finally {
        setChargementDisponibilites(false);
      }
    }

    chargerDisponibilites();
  }, [idProfesseurActif]);

  const professeurActif = useMemo(
    () =>
      professeurs.find((professeur) => professeur.id_professeur === idProfesseurActif) ||
      null,
    [professeurs, idProfesseurActif]
  );

  const disponibilitesParJour = useMemo(
    () => regrouperDisponibilitesParJour(disponibilites),
    [disponibilites]
  );

  const disponibilitesMap = useMemo(
    () => getDisponibilitesParJourEtHeure(disponibilites),
    [disponibilites]
  );

  function reinitialiserFormulaireDisponibilite() {
    setFormulaireDisponibilite({
      jour_semaine: "1",
      heure_debut: "08:00",
      heure_fin: "10:00",
    });
    setIndexEditionDisponibilite(null);
  }

  function handleChangerDisponibilite(event) {
    const { name, value } = event.target;
    setFormulaireDisponibilite((valeurActuelle) => ({
      ...valeurActuelle,
      [name]: value,
    }));
  }

  function handleEditerDisponibilite(index) {
    const disponibilite = disponibilites[index];

    setIndexEditionDisponibilite(index);
    setFormulaireDisponibilite({
      jour_semaine: String(disponibilite.jour_semaine),
      heure_debut: normaliserHeure(disponibilite.heure_debut),
      heure_fin: normaliserHeure(disponibilite.heure_fin),
    });
    setErreurDisponibilites("");
    setMessageDisponibilites("");
  }

  function handleSupprimerDisponibilite(index) {
    setDisponibilites((valeursActuelles) =>
      valeursActuelles.filter((_, indexDisponibilite) => indexDisponibilite !== index)
    );

    if (indexEditionDisponibilite === index) {
      reinitialiserFormulaireDisponibilite();
    }

    setMessageDisponibilites("Disponibilite retiree de la liste locale.");
    setErreurDisponibilites("");
  }

  function handleAjouterDisponibilite(event) {
    event.preventDefault();
    setErreurDisponibilites("");
    setMessageDisponibilites("");

    const jourSemaine = Number(formulaireDisponibilite.jour_semaine);
    const heureDebut = normaliserHeure(formulaireDisponibilite.heure_debut);
    const heureFin = normaliserHeure(formulaireDisponibilite.heure_fin);

    if (!jourSemaine || !heureDebut || !heureFin) {
      setErreurDisponibilites("Tous les champs de disponibilite sont obligatoires.");
      return;
    }

    if (heureDebut >= heureFin) {
      setErreurDisponibilites("L'heure de fin doit etre apres l'heure de debut.");
      return;
    }

    if (heureDebut < "08:00" || heureFin > "22:00") {
      setErreurDisponibilites("Les disponibilites doivent rester entre 08:00 et 22:00.");
      return;
    }

    const disponibilitesMisesAJour = disponibilites.filter(
      (_, index) => index !== indexEditionDisponibilite
    );

    const doublon = disponibilitesMisesAJour.some(
      (disponibilite) =>
        Number(disponibilite.jour_semaine) === jourSemaine &&
        normaliserHeure(disponibilite.heure_debut) === heureDebut &&
        normaliserHeure(disponibilite.heure_fin) === heureFin
    );

    if (doublon) {
      setErreurDisponibilites("Cette disponibilite existe deja pour ce professeur.");
      return;
    }

    setDisponibilites(
      trierDisponibilites([
        ...disponibilitesMisesAJour,
        {
          jour_semaine: jourSemaine,
          heure_debut: heureDebut,
          heure_fin: heureFin,
        },
      ])
    );

    setMessageDisponibilites(
      indexEditionDisponibilite !== null
        ? "Disponibilite modifiee localement."
        : "Disponibilite ajoutee localement."
    );
    reinitialiserFormulaireDisponibilite();
  }

  async function handleEnregistrerDisponibilites() {
    if (!idProfesseurActif) {
      return;
    }

    setChargementDisponibilites(true);
    setErreurDisponibilites("");
    setMessageDisponibilites("");

    try {
      const resultat = await mettreAJourDisponibilitesProfesseur(
        idProfesseurActif,
        disponibilites.map((disponibilite) => ({
          jour_semaine: Number(disponibilite.jour_semaine),
          heure_debut: normaliserHeure(disponibilite.heure_debut),
          heure_fin: normaliserHeure(disponibilite.heure_fin),
        }))
      );

      setDisponibilites(trierDisponibilites(resultat || []));
      setMessageDisponibilites("Disponibilites enregistrees avec succes.");
      showSuccess("Disponibilites enregistrees avec succes.");
    } catch (error) {
      setErreurDisponibilites(error.message || "Erreur lors de l'enregistrement.");
    } finally {
      setChargementDisponibilites(false);
    }
  }

  return (
    <AppShell
      utilisateur={utilisateur}
      onLogout={onLogout}
      title="Disponibilites professeurs"
      subtitle="Gerez les creneaux disponibles des enseignants entre 08:00 et 22:00."
    >
      <div className="crud-page">
        <section className="professeurs-page__workspace professeurs-page__workspace--full">
          <div className="professeurs-page__panel">
            <div className="professeurs-page__panel-header">
              <div>
                <h2>Disponibilites du professeur</h2>
                <p>
                  Selectionnez un professeur, gerez ses creneaux puis enregistrez-les.
                </p>
              </div>

              <select
                className="professeurs-page__select"
                value={idProfesseurActif || ""}
                onChange={(event) =>
                  setIdProfesseurActif(Number(event.target.value) || null)
                }
                disabled={chargement}
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
            </div>

            {chargement ? (
              <p className="crud-page__state">Chargement...</p>
            ) : professeurActif ? (
              <>
                <div className="professeurs-page__prof-card">
                  <strong>
                    {professeurActif.prenom} {professeurActif.nom}
                  </strong>
                  <span>{professeurActif.matricule}</span>
                  <span>{professeurActif.specialite || "Sans programme"}</span>
                </div>

                {erreurDisponibilites ? (
                  <div className="crud-page__alert crud-page__alert--error">
                    {erreurDisponibilites}
                  </div>
                ) : null}
                {messageDisponibilites ? (
                  <div className="crud-page__alert crud-page__alert--success">
                    {messageDisponibilites}
                  </div>
                ) : null}

                <form
                  className="professeurs-page__availability-form"
                  onSubmit={handleAjouterDisponibilite}
                >
                  <label className="crud-page__field">
                    <span>Jour</span>
                    <select
                      name="jour_semaine"
                      value={formulaireDisponibilite.jour_semaine}
                      onChange={handleChangerDisponibilite}
                    >
                      {JOURS_SEMAINE_COMPLETS.map((jour) => (
                        <option key={jour.value} value={jour.value}>
                          {jour.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="crud-page__field">
                    <span>Debut</span>
                    <input
                      type="time"
                      min="08:00"
                      max="22:00"
                      name="heure_debut"
                      value={formulaireDisponibilite.heure_debut}
                      onChange={handleChangerDisponibilite}
                    />
                  </label>

                  <label className="crud-page__field">
                    <span>Fin</span>
                    <input
                      type="time"
                      min="08:00"
                      max="22:00"
                      name="heure_fin"
                      value={formulaireDisponibilite.heure_fin}
                      onChange={handleChangerDisponibilite}
                    />
                  </label>

                  <div className="professeurs-page__availability-actions">
                    <button type="submit" className="crud-page__primary-button">
                      {indexEditionDisponibilite !== null ? "Mettre a jour" : "Ajouter"}
                    </button>
                    <button
                      type="button"
                      className="crud-page__secondary-button"
                      onClick={reinitialiserFormulaireDisponibilite}
                    >
                      Reinitialiser
                    </button>
                    <button
                      type="button"
                      className="crud-page__secondary-button"
                      onClick={handleEnregistrerDisponibilites}
                      disabled={chargementDisponibilites}
                    >
                      {chargementDisponibilites ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </div>
                </form>

                <div className="professeurs-page__availability-layout">
                  <div className="professeurs-page__availability-sidebar">
                    <div className="professeurs-page__days">
                      {disponibilitesParJour.map((jour) => (
                        <div className="professeurs-page__day-card" key={jour.value}>
                          <div className="professeurs-page__day-title">{jour.label}</div>
                          {jour.disponibilites.length === 0 ? (
                            <p className="professeurs-page__empty-day">Aucune disponibilite</p>
                          ) : (
                            <ul className="professeurs-page__availability-list">
                              {jour.disponibilites.map((disponibilite) => {
                                const indexDisponibilite = disponibilites.findIndex(
                                  (element) =>
                                    Number(element.jour_semaine) === Number(disponibilite.jour_semaine) &&
                                    normaliserHeure(element.heure_debut) ===
                                      normaliserHeure(disponibilite.heure_debut) &&
                                    normaliserHeure(element.heure_fin) ===
                                      normaliserHeure(disponibilite.heure_fin)
                                );

                                return (
                                  <li
                                    key={`${jour.value}-${normaliserHeure(disponibilite.heure_debut)}-${normaliserHeure(disponibilite.heure_fin)}`}
                                    className="professeurs-page__availability-item"
                                  >
                                    <span>
                                      {normaliserHeure(disponibilite.heure_debut)} -{" "}
                                      {normaliserHeure(disponibilite.heure_fin)}
                                    </span>
                                    <div className="professeurs-page__availability-item-actions">
                                      <button
                                        type="button"
                                        className="crud-page__action crud-page__action--edit"
                                        onClick={() => handleEditerDisponibilite(indexDisponibilite)}
                                      >
                                        Modifier
                                      </button>
                                      <button
                                        type="button"
                                        className="crud-page__action crud-page__action--delete"
                                        onClick={() =>
                                          handleSupprimerDisponibilite(indexDisponibilite)
                                        }
                                      >
                                        Supprimer
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="professeurs-page__schedule-list">
                    <h3>Calendrier hebdomadaire</h3>
                    <p className="professeurs-page__schedule-note">
                      Vue fixe du lundi au dimanche, de 08:00 a 22:00.
                    </p>

                    <div className="professeurs-page__calendar-wrapper">
                      <div className="professeurs-page__calendar-grid">
                        <div className="professeurs-page__hours-column">
                          <div className="professeurs-page__calendar-head-empty"></div>
                          {HEURES.map((heure) => (
                            <div key={heure} className="professeurs-page__hour-cell">
                              {heure}
                            </div>
                          ))}
                        </div>

                        {JOURS_SEMAINE_COMPLETS.map((jour, jourIndex) => (
                          <div key={jour.value} className="professeurs-page__day-column">
                            <div className="professeurs-page__calendar-head">
                              <span>{jour.label}</span>
                              <small>Disponibilites</small>
                            </div>
                            <div className="professeurs-page__calendar-body">
                              {HEURES.map((heure) => (
                                <div key={heure} className="professeurs-page__slot"></div>
                              ))}

                              {HEURES.map((heure) => {
                                const key = `${jourIndex}-${heure}`;
                                const blocs = disponibilitesMap[key] || [];

                                return blocs.map((disponibilite) => {
                                  const hauteur = getHauteurBloc(
                                    disponibilite.heure_debut,
                                    disponibilite.heure_fin
                                  );
                                  const top =
                                    ((heureEnMinutes(disponibilite.heure_debut) -
                                      heureEnMinutes(HEURES[0])) /
                                      60) *
                                    60;

                                  return (
                                    <div
                                      key={`${jour.value}-${normaliserHeure(disponibilite.heure_debut)}-${normaliserHeure(disponibilite.heure_fin)}`}
                                      className="professeurs-page__availability-session"
                                      style={{ top: `${top}px`, height: `${hauteur}px` }}
                                    >
                                      <strong>Disponible</strong>
                                      <span>
                                        {normaliserHeure(disponibilite.heure_debut)} -{" "}
                                        {normaliserHeure(disponibilite.heure_fin)}
                                      </span>
                                      <small>{professeurActif.prenom} {professeurActif.nom}</small>
                                    </div>
                                  );
                                });
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="crud-page__state">Aucun professeur selectionne.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
/**
 * PAGE - Disponibilites Professeurs
 *
 * Cette page gere les disponibilites
 * hebdomadaires des professeurs.
 */
