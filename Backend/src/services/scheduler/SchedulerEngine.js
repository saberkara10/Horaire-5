/**
 * SchedulerEngine - Orchestrateur principal
 *
 * Le moteur produit maintenant un motif hebdomadaire stable:
 * un cours choisit un jour + un creneau + un professeur + une salle,
 * puis cette meme combinaison est repetee sur toutes les semaines
 * de la session.
 */

import pool from "../../../db.js";
import { ContextLoader } from "./ContextLoader.js";
import { GroupFormer } from "./GroupFormer.js";
import { ConstraintMatrix } from "./ConstraintMatrix.js";
import { AvailabilityChecker } from "./AvailabilityChecker.js";
import { FailedCourseEngine } from "./FailedCourseEngine.js";
import { SimulatedAnnealing } from "./SimulatedAnnealing.js";
import { SchedulerDataBootstrap } from "./SchedulerDataBootstrap.js";
import {
  getSchedulerMaxGroupsPerProfessor,
  getSchedulerMaxWeeklySessionsPerProfessor,
  isCourseSchedulable,
  isOnlineCourseSchedulingEnabled,
} from "./SchedulerConfig.js";
import { assurerSchemaSchedulerAcademique } from "../academic-scheduler-schema.js";
import {
  ACADEMIC_WEEKDAY_ORDER,
  ACADEMIC_WEEKDAY_TIME_SLOTS,
  MAX_GROUP_SESSIONS_PER_DAY,
  MAX_PROFESSOR_SESSIONS_PER_DAY,
  REQUIRED_WEEKLY_SESSIONS_PER_GROUP,
  TARGET_ACTIVE_DAYS_PER_GROUP,
} from "./AcademicCatalog.js";

export class SchedulerEngine {
  static async generer(options = {}) {
    const {
      idSession = null,
      idUtilisateur = null,
      inclureWeekend = false,
      saParams = {},
      onProgress = null,
    } = options;
    const weekendAutorise = false;

    await assurerSchemaSchedulerAcademique();

    try {
      const sessionBootstrap = idSession
        ? await SchedulerEngine._chargerSession(idSession, pool)
        : null;
      const bootstrapReport =
        await SchedulerDataBootstrap.ensureOperationalDataset({
          executor: pool,
          session: sessionBootstrap,
        });

      if (bootstrapReport.details.length > 0) {
        console.info("[Scheduler] Bootstrap:", bootstrapReport.details.join(" | "));
      }
    } catch (bootstrapErr) {
      console.warn("[Scheduler] Bootstrap non bloquant:", bootstrapErr.message);
    }

    const connection = await pool.getConnection();
    const rapport = {
      session: null,
      score_qualite: 0,
      score_initial: 0,
      nb_cours_planifies: 0,
      nb_cours_non_planifies: 0,
      nb_cours_echoues_traites: 0,
      nb_cours_en_ligne_generes: 0,
      nb_groupes_speciaux: 0,
      nb_resolutions_manuelles: 0,
      affectations: [],
      non_planifies: [],
      resolutions_manuelles: [],
      iterations_sa: 0,
      groupes_crees: [],
      details: {},
    };

    try {
      await connection.beginTransaction();
      SchedulerEngine._progress(onProgress, "PHASE_1", "Chargement du contexte...", 5);

      const ctx = await ContextLoader.charger(idSession, connection);
      rapport.session = ctx.session;

      const {
        session,
        sessionSaison,
        cours,
        professeurs,
        salles,
        etudiants,
        dispParProf,
        absencesParProf,
        indispoParSalle,
        affectationsExistantes,
        echouesParEtudiant,
      } = ctx;
      const nbDemandesCoursEchoues = [...echouesParEtudiant.values()].reduce(
        (total, listeCours) => total + (Array.isArray(listeCours) ? listeCours.length : 0),
        0
      );

      if (cours.length === 0) {
        throw new Error("Aucun cours actif. Ajoutez d'abord les cours de la session.");
      }

      if (professeurs.length === 0) {
        throw new Error("Aucun professeur trouve. Ajoutez au moins un professeur.");
      }

      const coursPlanifiables = cours.filter((item) => isCourseSchedulable(item));
      if (coursPlanifiables.length === 0) {
        throw new Error(
          "Aucun cours planifiable. Verifiez la configuration ENABLE_ONLINE_COURSES et le catalogue actif."
        );
      }

      const coursPresentiels = coursPlanifiables.filter((item) => !item.est_en_ligne);
      if (salles.length === 0 && coursPresentiels.length > 0) {
        throw new Error("Aucune salle disponible pour les cours en presentiel.");
      }

      SchedulerEngine._progress(onProgress, "PHASE_2", "Formation des groupes...", 15);

      const { groupesFormes, affectationsEtudiantGroupe } = GroupFormer.formerGroupes(
        etudiants,
        cours,
        echouesParEtudiant
      );
      rapport.groupes_crees = groupesFormes.map((groupe) => ({
        nom: groupe.nomGroupe,
        taille_reguliere: Array.isArray(groupe.etudiants) ? groupe.etudiants.length : 0,
        taille_projete_max: GroupFormer.lireEffectifProjeteMax(groupe),
        reprises_reservees: (groupe.resume_reprises || []).reduce(
          (total, item) => total + Number(item?.reprises_reservees || 0),
          0
        ),
      }));

      const idGroupeParNom = await SchedulerEngine._persisterGroupes(
        groupesFormes,
        session.id_session,
        connection
      );
      await SchedulerEngine._detacherEtudiantsHorsSession(
        session.id_session,
        sessionSaison,
        connection
      );
      await SchedulerEngine._mettreAJourGroupesEtudiants(
        affectationsEtudiantGroupe,
        idGroupeParNom,
        connection
      );

      SchedulerEngine._progress(
        onProgress,
        "PHASE_3",
        "Construction des matrices de contraintes...",
        25
      );

      const matrix = new ConstraintMatrix();

      SchedulerEngine._progress(
        onProgress,
        "PHASE_4",
        "Construction du motif hebdomadaire recurrent...",
        35
      );

      const jours = AvailabilityChecker.genererJours(
        session.date_debut,
        session.date_fin,
        weekendAutorise
      );
      const datesParJourSemaine =
        SchedulerEngine._indexerDatesParJourSemaine(jours);
      const creneaux = [...ACADEMIC_WEEKDAY_TIME_SLOTS];
      const preferencesStabilite = SchedulerEngine._construirePreferencesStabilite(
        affectationsExistantes
      );
      const chargeSeriesParProf = new Map();
      const chargeSeriesParJour = new Map();
      const chargeSeriesParGroupeJour = new Map();
      const chargeSeriesParProfJour = new Map();
      const slotsParGroupeJour = new Map();
      const slotsParProfJour = new Map();

      await SchedulerEngine._supprimerHoraireSession(session.id_session, connection);
      await SchedulerEngine._supprimerGroupesVidesSession(
        session.id_session,
        groupesFormes.map((groupe) => groupe.nomGroupe),
        connection
      );

      const solution = [];
      const nonPlanifies = [];

      const coursTries = [...coursPlanifiables].sort((coursA, coursB) => {
        if (coursA.est_cours_cle !== coursB.est_cours_cle) {
          return coursB.est_cours_cle - coursA.est_cours_cle;
        }

        const sallesCoursA = coursA.est_en_ligne
          ? 0
          : salles.filter((salle) => AvailabilityChecker.salleCompatible(salle, coursA))
              .length;
        const sallesCoursB = coursB.est_en_ligne
          ? 0
          : salles.filter((salle) => AvailabilityChecker.salleCompatible(salle, coursB))
              .length;

        return sallesCoursA - sallesCoursB;
      });

      for (const coursActuel of coursTries) {
        const sallesCompatiblesType = coursActuel.est_en_ligne
          ? [null]
          : salles
              .filter((salle) => AvailabilityChecker.salleCompatible(salle, coursActuel))
              .sort((salleA, salleB) => salleA.capacite - salleB.capacite);

        if (!coursActuel.est_en_ligne && sallesCompatiblesType.length === 0) {
          nonPlanifies.push({
            id_cours: coursActuel.id_cours,
            code: coursActuel.code,
            nom: coursActuel.nom,
            raison: `Aucune salle compatible pour le type "${coursActuel.type_salle}".`,
          });
          continue;
        }

        const profsCompatibles = professeurs
          .filter((professeur) =>
            AvailabilityChecker.profCompatible(professeur, coursActuel)
          )
          .sort((profA, profB) => {
            const chargeA = chargeSeriesParProf.get(profA.id_professeur) || 0;
            const chargeB = chargeSeriesParProf.get(profB.id_professeur) || 0;

            if (chargeA !== chargeB) {
              return chargeA - chargeB;
            }

            const nbGroupesA =
              matrix.groupesParProf.get(String(profA.id_professeur))?.size || 0;
            const nbGroupesB =
              matrix.groupesParProf.get(String(profB.id_professeur))?.size || 0;

            if (nbGroupesA !== nbGroupesB) {
              return nbGroupesA - nbGroupesB;
            }

            const nbCoursA =
              matrix.coursParProf.get(String(profA.id_professeur))?.size || 0;
            const nbCoursB =
              matrix.coursParProf.get(String(profB.id_professeur))?.size || 0;
            if (nbCoursA !== nbCoursB) {
              return nbCoursA - nbCoursB;
            }

            return String(profA.matricule || "").localeCompare(
              String(profB.matricule || ""),
              "fr"
            );
          });

        if (profsCompatibles.length === 0) {
          nonPlanifies.push({
            id_cours: coursActuel.id_cours,
            code: coursActuel.code,
            nom: coursActuel.nom,
            raison: "Aucun professeur compatible trouve.",
          });
          continue;
        }

        const groupesCours = groupesFormes.filter((groupe) => {
          const programmeGroupe = AvailabilityChecker._normaliser(groupe.programme || "");
          const programmeCours = AvailabilityChecker._normaliser(
            coursActuel.programme || ""
          );
          const etapeGroupe =
            groupe.etape != null ? String(Number(groupe.etape)) : "";
          const etapeCours = String(coursActuel.etape_etude || "").trim();

          return (
            programmeGroupe !== "" &&
            programmeGroupe === programmeCours &&
            etapeGroupe !== "" &&
            etapeGroupe === etapeCours
          );
        });

        if (groupesCours.length === 0) {
          continue;
        }

        const seancesParSemaine = Math.max(
          1,
          Number(coursActuel.sessions_par_semaine || 1)
        );

        for (const groupe of groupesCours) {
          const idGroupe = idGroupeParNom.get(groupe.nomGroupe);
          const effectifGroupe = GroupFormer.lireEffectifCours(
            groupe,
            coursActuel.id_cours
          );

          if (!idGroupe) {
            nonPlanifies.push({
              id_cours: coursActuel.id_cours,
              code: coursActuel.code,
              nom: coursActuel.nom,
              groupe: groupe.nomGroupe,
              raison: "Le groupe n'a pas pu etre persiste avant la generation.",
            });
            continue;
          }

          const sallesCompatibles = coursActuel.est_en_ligne
            ? [null]
            : sallesCompatiblesType
                .filter((salle) =>
                  AvailabilityChecker.salleCompatible(
                    salle,
                    coursActuel,
                    effectifGroupe
                  )
                )
                .sort((salleA, salleB) => salleA.capacite - salleB.capacite);

          if (!coursActuel.est_en_ligne && sallesCompatibles.length === 0) {
            nonPlanifies.push({
              id_cours: coursActuel.id_cours,
              code: coursActuel.code,
              nom: coursActuel.nom,
              groupe: groupe.nomGroupe,
              raison: `Aucune salle compatible ne peut accueillir ${effectifGroupe} etudiants pour le type "${coursActuel.type_salle}".`,
            });
            continue;
          }

          for (
            let numeroSeance = 1;
            numeroSeance <= seancesParSemaine;
            numeroSeance += 1
          ) {
            const serie = SchedulerEngine._trouverSerieHebdomadaire({
              cours: coursActuel,
              groupe,
              idGroupe,
              profsCompatibles,
              sallesCompatibles,
              datesParJourSemaine,
              creneaux,
              matrix,
              dispParProf,
              absencesParProf,
              indispoParSalle,
              chargeSeriesParProf,
              chargeSeriesParJour,
              chargeSeriesParGroupeJour,
              chargeSeriesParProfJour,
              slotsParGroupeJour,
              slotsParProfJour,
              numeroSeance,
              preferencesStabilite,
            });

            if (!serie) {
              nonPlanifies.push({
                id_cours: coursActuel.id_cours,
                code: coursActuel.code,
                nom: coursActuel.nom,
                groupe: groupe.nomGroupe,
                seance: numeroSeance,
                raison:
                  "Aucun motif hebdomadaire stable disponible pour toute la session.",
              });
              continue;
            }

            solution.push(...serie.placements);
          }
        }
      }
      SchedulerEngine._progress(
        onProgress,
        "PHASE_4B",
        "Passe de recuperation des cours non planifies...",
        45
      );

      const nonPlanifiesOriginaux = [...nonPlanifies];
      nonPlanifies.length = 0;

      for (const np of nonPlanifiesOriginaux) {
        const coursActuel = cours.find((c) => c.id_cours === np.id_cours);
        if (!coursActuel) { nonPlanifies.push(np); continue; }

        const groupe = groupesFormes.find((g) => g.nomGroupe === np.groupe);
        const idGroupe = np.groupe ? idGroupeParNom.get(np.groupe) : null;
        if (!groupe || !idGroupe) { nonPlanifies.push(np); continue; }

        const effectifGroupe = GroupFormer.lireEffectifCours(
          groupe,
          coursActuel.id_cours
        );

        const serie = SchedulerEngine._trouverSerieAssouplie({
          cours: coursActuel,
          groupe,
          idGroupe,
          professeurs,
          salles,
          datesParJourSemaine,
          creneaux,
          matrix,
          dispParProf,
          absencesParProf,
          indispoParSalle,
          chargeSeriesParProf,
          chargeSeriesParJour,
          chargeSeriesParGroupeJour,
          chargeSeriesParProfJour,
          slotsParGroupeJour,
          slotsParProfJour,
          effectifGroupe,
        });

        if (serie) {
          solution.push(...serie.placements);
        } else {
          const diag = SchedulerEngine._diagnosticPrecis({
            cours: coursActuel,
            groupe,
            idGroupe,
            professeurs,
            salles,
            datesParJourSemaine,
            creneaux,
            matrix,
            dispParProf,
            absencesParProf,
            indispoParSalle,
          });
          nonPlanifies.push({ ...np, ...diag });
        }
      }

      SchedulerEngine._progress(
        onProgress,
        "PHASE_4C",
        "Garantie 7 cours par groupe...",
        50
      );

      const { placementsGarantie, diagnosticsGarantie } =
        SchedulerEngine._passeDeGarantieGroupes({
          solution,
          cours: coursPlanifiables,
          groupesFormes,
          idGroupeParNom,
          professeurs,
          salles,
          datesParJourSemaine,
          creneaux,
          matrix,
          dispParProf,
          absencesParProf,
          indispoParSalle,
          chargeSeriesParProf,
          chargeSeriesParJour,
          chargeSeriesParGroupeJour,
          chargeSeriesParProfJour,
          slotsParGroupeJour,
          slotsParProfJour,
        });

      solution.push(...placementsGarantie);
      nonPlanifies.push(...diagnosticsGarantie);

      SchedulerEngine._progress(
        onProgress,
        "PHASE_5",
        "Traitement des cours echoues...",
        55
      );

      const {
        affectations: affectationsReprises,
        conflits: conflitsReprises,
        stats: statsReprises,
      } = FailedCourseEngine.rattacherCoursEchoues({
        echouesParEtudiant,
        cours,
        groupesFormes,
        placementsPlanifies: solution,
        matrix,
        activerCoursEnLigne: isOnlineCourseSchedulingEnabled(),
      });
      rapport.nb_cours_echoues_traites = nbDemandesCoursEchoues;
      rapport.nb_cours_en_ligne_generes = solution.filter((placement) =>
        Boolean(placement.est_en_ligne)
      ).length;
      rapport.nb_groupes_speciaux = 0;
      rapport.nb_resolutions_manuelles = conflitsReprises.length;
      rapport.resolutions_manuelles = conflitsReprises;

      SchedulerEngine._progress(
        onProgress,
        "PHASE_6",
        "Evaluation de la solution stable...",
        70
      );

      const saContext = { jours, dispParProf, absencesParProf, indispoParSalle };
      const scoreInitial = SimulatedAnnealing._evaluerSolution(solution, saContext);
      const solutionOptimisee = solution;
      const scoreFinal = scoreInitial;
      const qualite = SchedulerEngine._calculerScoreQualite({
        solution: solutionOptimisee,
        nonPlanifies,
        nbResolutionsManuelles: conflitsReprises.length,
        preferencesStabilite,
      });

      rapport.score_initial = SchedulerEngine._safeNum(scoreInitial, 0);
      rapport.iterations_sa = 0;
      rapport.score_qualite = qualite.score;
      rapport.details = {
        mode_planification: "hebdomadaire_recurrent",
        semaine_type_repliquee: true,
        optimisation_simulated_annealing: false,
        weekend_autorise: weekendAutorise,
        cours_en_ligne_actifs: isOnlineCourseSchedulingEnabled(),
        raison:
          "Le motif hebdomadaire doit rester identique toute la session, donc le recuit simule est neutralise.",
        sa_params_recus: saParams,
        qualite,
        preference_stabilite_referencees: preferencesStabilite.size,
        reprises: {
          ...statsReprises,
          conflits_details: conflitsReprises,
        },
      };

      SchedulerEngine._progress(
        onProgress,
        "PHASE_7",
        "Persistance en base de donnees...",
        85
      );

      for (const placement of solutionOptimisee) {
        await connection.query(
          `INSERT IGNORE INTO plages_horaires (date, heure_debut, heure_fin)
           VALUES (?, ?, ?)`,
          [placement.date, placement.heure_debut, placement.heure_fin]
        );

        const [[plage]] = await connection.query(
          `SELECT id_plage_horaires
           FROM plages_horaires
           WHERE date = ? AND heure_debut = ? AND heure_fin = ?
           LIMIT 1`,
          [placement.date, placement.heure_debut, placement.heure_fin]
        );

        const [affectation] = await connection.query(
          `INSERT INTO affectation_cours (id_cours, id_professeur, id_salle, id_plage_horaires)
           VALUES (?, ?, ?, ?)`,
          [
            placement.id_cours,
            placement.id_professeur,
            placement.id_salle,
            plage.id_plage_horaires,
          ]
        );

        if (placement.id_groupe) {
          await connection.query(
            `INSERT IGNORE INTO affectation_groupes (id_groupes_etudiants, id_affectation_cours)
             VALUES (?, ?)`,
            [placement.id_groupe, affectation.insertId]
          );
        }

        rapport.affectations.push({
          ...placement,
          id_affectation_cours: affectation.insertId,
        });
      }

      await SchedulerEngine._persisterAffectationsIndividuellesReprises(
        affectationsReprises,
        session.id_session,
        connection
      );
      await SchedulerEngine._marquerCoursEchouesEnResolutionManuelle(
        conflitsReprises,
        session.id_session,
        connection
      );

      rapport.non_planifies = nonPlanifies;
      rapport.nb_cours_planifies = solutionOptimisee.length;
      rapport.nb_cours_non_planifies = nonPlanifies.length;
      const snapshotRapportMetier = SchedulerEngine._construireSnapshotRapportMetier({
        etudiants,
        affectationsEtudiantGroupe,
        groupesFormes,
        nonPlanifies,
        conflitsReprises,
      });
      rapport.details.rapport_metier = snapshotRapportMetier;

      await connection.query(
        `INSERT INTO rapports_generation
         (id_session, genere_par, score_qualite, nb_cours_planifies,
          nb_cours_non_planifies, nb_cours_echoues_traites, nb_cours_en_ligne_generes,
          nb_groupes_speciaux, nb_resolutions_manuelles, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          SchedulerEngine._safeNum(session.id_session) || null,
          SchedulerEngine._safeNum(idUtilisateur) || null,
          SchedulerEngine._safeNum(rapport.score_qualite, 0),
          SchedulerEngine._safeNum(rapport.nb_cours_planifies, 0),
          SchedulerEngine._safeNum(rapport.nb_cours_non_planifies, 0),
          SchedulerEngine._safeNum(rapport.nb_cours_echoues_traites, 0),
          SchedulerEngine._safeNum(rapport.nb_cours_en_ligne_generes, 0),
          SchedulerEngine._safeNum(rapport.nb_groupes_speciaux, 0),
          SchedulerEngine._safeNum(rapport.nb_resolutions_manuelles, 0),
          JSON.stringify({
            non_planifies: nonPlanifies,
            resolutions_manuelles: conflitsReprises,
            details: rapport.details,
            rapport_metier: snapshotRapportMetier,
          }),
        ]
      );

      await connection.commit();
      SchedulerEngine._progress(onProgress, "DONE", "Generation terminee.", 100);

      return rapport;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Tolerance-based weekly pattern search.
   * Instead of requiring ALL dates to pass, filter dates individually
   * and accept patterns with >= 60% coverage. This is the critical fix
   * that prevents massive unplanned courses when a prof is absent even
   * one week out of 16.
   */
  static _trouverSerieHebdomadaire({
    cours,
    groupe,
    idGroupe,
    profsCompatibles,
    sallesCompatibles,
    datesParJourSemaine,
    creneaux,
    matrix,
    dispParProf,
    absencesParProf,
    indispoParSalle,
    chargeSeriesParProf,
    chargeSeriesParJour,
    chargeSeriesParGroupeJour,
    chargeSeriesParProfJour,
    slotsParGroupeJour,
    slotsParProfJour,
    numeroSeance,
    preferencesStabilite,
  }) {
    const MIN_COVERAGE = 0.60;

    const preferenceSerie = SchedulerEngine._lirePreferenceStabilite(
      preferencesStabilite,
      groupe.nomGroupe,
      cours.id_cours,
      numeroSeance
    );
    const joursOrdonnesPrincipaux = SchedulerEngine._ordonnerJoursPourGroupe({
      datesParJourSemaine,
      idGroupe,
      chargeSeriesParJour,
      chargeSeriesParGroupeJour,
    });
    const joursOrdonnesSecours = SchedulerEngine._ordonnerJoursPourGroupe({
      datesParJourSemaine,
      idGroupe,
      chargeSeriesParJour,
      chargeSeriesParGroupeJour,
      autoriserJourSupplementaire: true,
    });

    const profsTries = [...profsCompatibles].sort((profA, profB) => {
      const chargeA = chargeSeriesParProf.get(profA.id_professeur) || 0;
      const chargeB = chargeSeriesParProf.get(profB.id_professeur) || 0;

      if (chargeA !== chargeB) {
        return chargeA - chargeB;
      }

      const groupesA =
        matrix.groupesParProf.get(String(profA.id_professeur))?.size || 0;
      const groupesB =
        matrix.groupesParProf.get(String(profB.id_professeur))?.size || 0;

      if (groupesA !== groupesB) {
        return groupesA - groupesB;
      }

      return String(profA.nom || "").localeCompare(String(profB.nom || ""), "fr");
    });

    const strategiesJours = [
      joursOrdonnesPrincipaux,
      joursOrdonnesSecours.filter(
        (jourSemaine) => !joursOrdonnesPrincipaux.includes(jourSemaine)
      ),
    ].filter((joursStrategie) => joursStrategie.length > 0);
    let meilleurCandidat = null;

    for (const [indexStrategie, joursOrdonnes] of strategiesJours.entries()) {
      for (const jourSemaine of joursOrdonnes) {
        const datesToutes = datesParJourSemaine.get(jourSemaine) || [];
        if (datesToutes.length === 0) {
          continue;
        }

        if (
          SchedulerEngine._lireChargeJour(
            chargeSeriesParGroupeJour,
            idGroupe,
            jourSemaine
          ) >= MAX_GROUP_SESSIONS_PER_DAY
        ) {
          continue;
        }

        const creneauxOrdonnesGroupe = SchedulerEngine._ordonnerCreneauxPourGroupeJour(
          creneaux,
          slotsParGroupeJour,
          idGroupe,
          jourSemaine
        );

        for (const [indexProfesseur, professeur] of profsTries.entries()) {
          if (
            !matrix.profPeutPrendreGroupe(
              professeur.id_professeur,
              idGroupe,
              getSchedulerMaxGroupsPerProfessor()
            )
          ) {
            continue;
          }

          if (
            SchedulerEngine._lireChargeJour(
              chargeSeriesParProfJour,
              professeur.id_professeur,
              jourSemaine
            ) >= MAX_PROFESSOR_SESSIONS_PER_DAY
          ) {
            continue;
          }

          if (
            !matrix.profPeutEnseignerCours(
              professeur.id_professeur,
              cours.id_cours
            )
          ) {
            continue;
          }

          const creneauxOrdonnes =
            SchedulerEngine._ordonnerCreneauxPourProfesseurJour(
              creneauxOrdonnesGroupe,
              creneaux,
              slotsParProfJour,
              professeur.id_professeur,
              jourSemaine
            );

          for (const [indexCreneau, creneau] of creneauxOrdonnes.entries()) {
            const slotIndex = creneaux.findIndex(
              (slot) => slot.debut === creneau.debut && slot.fin === creneau.fin
            );
            const etudiantsCours = SchedulerEngine._lireEtudiantsCours(
              groupe,
              cours.id_cours
            );

            // === CRITICAL FIX: filter dates instead of rejecting entire pattern ===
            const datesDisponibles = datesToutes.filter(
              (date) =>
                matrix.profLibre(
                  professeur.id_professeur,
                  date,
                  creneau.debut,
                  creneau.fin
                ) &&
                AvailabilityChecker.profDisponible(
                  professeur.id_professeur,
                  date,
                  creneau.debut,
                  creneau.fin,
                  dispParProf,
                  absencesParProf
                ) &&
                matrix.groupeLibre(idGroupe, date, creneau.debut, creneau.fin) &&
                matrix.etudiantsLibres(
                  etudiantsCours,
                  date,
                  creneau.debut,
                  creneau.fin
                ) &&
                matrix.groupePeutAjouterSeanceSemaine(
                  idGroupe,
                  date,
                  REQUIRED_WEEKLY_SESSIONS_PER_GROUP
                ) &&
                matrix.profPeutAjouterSeanceSemaine(
                  professeur.id_professeur,
                  date,
                  getSchedulerMaxWeeklySessionsPerProfessor()
                )
            );

            const seuilCouverture = Math.max(1, Math.ceil(datesToutes.length * MIN_COVERAGE));
            if (datesDisponibles.length < seuilCouverture) {
              continue;
            }

            const coverageRatio = datesDisponibles.length / datesToutes.length;
            const coverageBonus = Math.round((coverageRatio - MIN_COVERAGE) * 50);

            if (cours.est_en_ligne) {
              meilleurCandidat = SchedulerEngine._enregistrerMeilleurCandidatSerie({
                meilleurCandidat,
                score: SchedulerEngine._scoreCandidatSerie({
                  cours,
                  groupe,
                  idGroupe,
                  professeur,
                  salle: null,
                  jourSemaine,
                  creneau,
                  slotIndex,
                  matrix,
                  chargeSeriesParJour,
                  chargeSeriesParGroupeJour,
                  chargeSeriesParProfJour,
                  slotsParGroupeJour,
                  slotsParProfJour,
                  preferenceSerie,
                  indexStrategie,
                  indexProfesseur,
                  indexCreneau,
                }) + coverageBonus,
                payload: {
                  cours,
                  groupe,
                  idGroupe,
                  professeur,
                  salle: null,
                  datesSerie: datesDisponibles,
                  creneau,
                  matrix,
                  chargeSeriesParProf,
                  chargeSeriesParJour,
                  chargeSeriesParGroupeJour,
                  chargeSeriesParProfJour,
                  slotsParGroupeJour,
                  slotsParProfJour,
                  jourSemaine,
                  slotIndex,
                },
              });
              continue;
            }

            for (const [indexSalle, salle] of sallesCompatibles.entries()) {
              const datesAvecSalle = datesDisponibles.filter(
                (date) =>
                  matrix.salleLibre(
                    salle.id_salle,
                    date,
                    creneau.debut,
                    creneau.fin
                  ) &&
                  AvailabilityChecker.salleDisponible(
                    salle.id_salle,
                    date,
                    indispoParSalle
                  )
              );

              const seuilSalle = Math.max(1, Math.ceil(datesToutes.length * MIN_COVERAGE * 0.7));
              if (datesAvecSalle.length < seuilSalle) {
                continue;
              }

              const salleCoverageBonus = Math.round(
                ((datesAvecSalle.length / datesToutes.length) - MIN_COVERAGE * 0.7) * 30
              );

              meilleurCandidat = SchedulerEngine._enregistrerMeilleurCandidatSerie({
                meilleurCandidat,
                score: SchedulerEngine._scoreCandidatSerie({
                  cours,
                  groupe,
                  idGroupe,
                  professeur,
                  salle,
                  jourSemaine,
                  creneau,
                  slotIndex,
                  matrix,
                  chargeSeriesParJour,
                  chargeSeriesParGroupeJour,
                  chargeSeriesParProfJour,
                  slotsParGroupeJour,
                  slotsParProfJour,
                  preferenceSerie,
                  indexStrategie,
                  indexProfesseur,
                  indexCreneau,
                  indexSalle,
                }) + coverageBonus + salleCoverageBonus,
                payload: {
                  cours,
                  groupe,
                  idGroupe,
                  professeur,
                  salle,
                  datesSerie: datesAvecSalle,
                  creneau,
                  matrix,
                  chargeSeriesParProf,
                  chargeSeriesParJour,
                  chargeSeriesParGroupeJour,
                  chargeSeriesParProfJour,
                  slotsParGroupeJour,
                  slotsParProfJour,
                  jourSemaine,
                  slotIndex,
                },
              });
            }
          }
        }
      }
    }

    if (!meilleurCandidat) {
      return null;
    }

    return SchedulerEngine._reserverSerie(meilleurCandidat.payload);
  }

  static _reserverSerie({
    cours,
    groupe,
    idGroupe,
    professeur,
    salle,
    datesSerie,
    creneau,
    matrix,
    chargeSeriesParProf,
    chargeSeriesParJour,
    chargeSeriesParGroupeJour,
    chargeSeriesParProfJour,
    slotsParGroupeJour,
    slotsParProfJour,
    jourSemaine,
    slotIndex,
  }) {
    const placements = datesSerie.map((date) => ({
      id_cours: cours.id_cours,
      code_cours: cours.code,
      nom_cours: cours.nom,
      id_professeur: professeur.id_professeur,
      nom_professeur: `${professeur.prenom} ${professeur.nom}`,
      id_salle: salle ? salle.id_salle : null,
      code_salle: salle ? salle.code : "EN LIGNE",
      date,
      heure_debut: creneau.debut,
      heure_fin: creneau.fin,
      nom_groupe: groupe.nomGroupe,
      id_groupe: idGroupe,
      est_en_ligne: Boolean(cours.est_en_ligne),
      est_cours_cle: Boolean(cours.est_cours_cle),
      est_groupe_special: false,
    }));

    for (const placement of placements) {
      matrix.reserver(
        placement.id_salle,
        placement.id_professeur,
        placement.id_groupe,
        placement.id_cours,
        placement.date,
        placement.heure_debut,
        placement.heure_fin,
        { studentIds: SchedulerEngine._lireEtudiantsCours(groupe, cours.id_cours) }
      );
    }

    chargeSeriesParProf.set(
      professeur.id_professeur,
      (chargeSeriesParProf.get(professeur.id_professeur) || 0) + 1
    );
    chargeSeriesParJour.set(
      jourSemaine,
      (chargeSeriesParJour.get(jourSemaine) || 0) + 1
    );
    SchedulerEngine._incrementerChargeJour(
      chargeSeriesParGroupeJour,
      idGroupe,
      jourSemaine
    );
    SchedulerEngine._incrementerChargeJour(
      chargeSeriesParProfJour,
      professeur.id_professeur,
      jourSemaine
    );
    SchedulerEngine._memoriserSlotJour(
      slotsParGroupeJour,
      idGroupe,
      jourSemaine,
      slotIndex
    );
    SchedulerEngine._memoriserSlotJour(
      slotsParProfJour,
      professeur.id_professeur,
      jourSemaine,
      slotIndex
    );

    return {
      placements,
      professeur,
      salle,
      jourSemaine,
    };
  }

  static _enregistrerMeilleurCandidatSerie({
    meilleurCandidat,
    score,
    payload,
  }) {
    if (!meilleurCandidat || score > meilleurCandidat.score) {
      return { score, payload };
    }

    return meilleurCandidat;
  }

  static _construirePreferencesStabilite(affectationsExistantes = []) {
    const index = new Map();
    const patternsParSerie = new Map();

    for (const affectation of affectationsExistantes) {
      if (Number(affectation?.est_groupe_special || 0) === 1) {
        continue;
      }

      const groupeKey = String(affectation?.nom_groupe || "").trim();
      const coursKey = Number(affectation?.id_cours);

      if (!groupeKey || !Number.isFinite(coursKey) || coursKey <= 0) {
        continue;
      }

      const serieKey = `${groupeKey}|${coursKey}`;
      if (!patternsParSerie.has(serieKey)) {
        patternsParSerie.set(serieKey, new Map());
      }

      const jourSemaine = SchedulerEngine._jourIso(affectation.date);
      const patternKey = [
        jourSemaine,
        String(affectation.heure_debut),
        String(affectation.heure_fin),
        Number(affectation.id_professeur) || 0,
        Number(affectation.id_salle) || 0,
      ].join("|");
      const patternCourant = patternsParSerie.get(serieKey).get(patternKey) || {
        jourSemaine,
        heure_debut: String(affectation.heure_debut),
        heure_fin: String(affectation.heure_fin),
        id_professeur: Number(affectation.id_professeur) || null,
        id_salle: Number(affectation.id_salle) || null,
        occurrences: 0,
      };
      patternCourant.occurrences += 1;
      patternsParSerie.get(serieKey).set(patternKey, patternCourant);
    }

    for (const [serieKey, patterns] of patternsParSerie) {
      const sortedPatterns = [...patterns.values()].sort((patternA, patternB) => {
        if (patternA.occurrences !== patternB.occurrences) {
          return patternB.occurrences - patternA.occurrences;
        }

        if (patternA.jourSemaine !== patternB.jourSemaine) {
          return patternA.jourSemaine - patternB.jourSemaine;
        }

        return String(patternA.heure_debut).localeCompare(
          String(patternB.heure_debut),
          "fr"
        );
      });

      index.set(serieKey, sortedPatterns);
    }

    return index;
  }

  static _lirePreferenceStabilite(
    preferencesStabilite,
    nomGroupe,
    idCours,
    numeroSeance
  ) {
    const serieKey = `${String(nomGroupe || "").trim()}|${Number(idCours)}`;
    const preferences = preferencesStabilite.get(serieKey) || [];
    return preferences[Math.max(0, Number(numeroSeance || 1) - 1)] || null;
  }

  static _lireEtudiantsCours(groupe, idCours) {
    const idsReguliers = Array.isArray(groupe?.etudiants)
      ? groupe.etudiants
          .map((idEtudiant) => Number(idEtudiant))
          .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0)
      : [];
    const idsCours = Array.isArray(groupe?.etudiants_par_cours?.[String(idCours)])
      ? groupe.etudiants_par_cours[String(idCours)]
          .map((idEtudiant) => Number(idEtudiant))
          .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0)
      : [];

    return [...new Set([...idsReguliers, ...idsCours])];
  }

  static _scoreCandidatSerie({
    cours,
    groupe,
    idGroupe,
    professeur,
    salle,
    jourSemaine,
    creneau,
    slotIndex,
    matrix,
    chargeSeriesParJour,
    chargeSeriesParGroupeJour,
    chargeSeriesParProfJour,
    slotsParGroupeJour,
    slotsParProfJour,
    preferenceSerie,
    indexStrategie = 0,
    indexProfesseur = 0,
    indexCreneau = 0,
    indexSalle = 0,
  }) {
    let score = 0;
    const chargeJourGroupe =
      SchedulerEngine._lireChargeJour(chargeSeriesParGroupeJour, idGroupe, jourSemaine) +
      1;
    const chargeJourProf =
      SchedulerEngine._lireChargeJour(
        chargeSeriesParProfJour,
        professeur.id_professeur,
        jourSemaine
      ) + 1;
    const joursActifsGroupe = SchedulerEngine._compterJoursActifs(
      chargeSeriesParGroupeJour,
      idGroupe
    );
    const jourDejaActifPourGroupe =
      SchedulerEngine._lireChargeJour(chargeSeriesParGroupeJour, idGroupe, jourSemaine) > 0;
    const jourDejaActifPourProf =
      SchedulerEngine._lireChargeJour(
        chargeSeriesParProfJour,
        professeur.id_professeur,
        jourSemaine
      ) > 0;
    const slotsGroupe = SchedulerEngine._lireSlotsJour(
      slotsParGroupeJour,
      idGroupe,
      jourSemaine
    );
    const slotsProf = SchedulerEngine._lireSlotsJour(
      slotsParProfJour,
      professeur.id_professeur,
      jourSemaine
    );
    const distanceSlotGroupe = SchedulerEngine._distanceSlotAuxExistants(
      slotIndex,
      slotsGroupe
    );
    const distanceSlotProf = SchedulerEngine._distanceSlotAuxExistants(
      slotIndex,
      slotsProf
    );
    const effectifGroupe = GroupFormer.lireEffectifCours(groupe, cours?.id_cours);
    const capaciteSalle = Number(salle?.capacite || 0);

    if (chargeJourGroupe === 1) {
      score += 18;
    } else if (chargeJourGroupe === 2) {
      score += 28;
    } else {
      score -= 80;
    }

    if (jourDejaActifPourGroupe) {
      score += 20;
    } else if (joursActifsGroupe < TARGET_ACTIVE_DAYS_PER_GROUP) {
      score += 14;
    } else {
      score -= 35;
    }

    if (chargeJourProf === 1) {
      score += 12;
    } else if (chargeJourProf === 2) {
      score += 18;
    } else if (chargeJourProf === 3) {
      score += 6;
    } else {
      score -= 50;
    }

    if (jourDejaActifPourProf) {
      score += 10;
    }

    score -= distanceSlotGroupe * 6;
    score -= distanceSlotProf * 4;
    score -= (chargeSeriesParJour.get(jourSemaine) || 0) * 2;
    score -= indexStrategie * 25;
    score -= indexProfesseur * 4;
    score -= indexCreneau * 3;
    score -= indexSalle * 2;

    if (capaciteSalle > 0 && effectifGroupe > 0) {
      const margeCapacite = Math.max(0, capaciteSalle - effectifGroupe);
      score += Math.max(0, 12 - margeCapacite);
    }

    if (preferenceSerie) {
      const slotPreference = SchedulerEngine._trouverIndexSlotReference(
        creneau.debut,
        creneau.fin
      );
      const slotReferencePreference = SchedulerEngine._trouverIndexSlotReference(
        preferenceSerie.heure_debut,
        preferenceSerie.heure_fin
      );

      if (Number(preferenceSerie.jourSemaine) === Number(jourSemaine)) {
        score += 90;
      } else {
        score -=
          Math.abs(Number(preferenceSerie.jourSemaine) - Number(jourSemaine)) * 12;
      }

      if (
        String(preferenceSerie.heure_debut) === String(creneau.debut) &&
        String(preferenceSerie.heure_fin) === String(creneau.fin)
      ) {
        score += 110;
      } else if (
        slotReferencePreference >= 0 &&
        slotPreference >= 0
      ) {
        score -= Math.abs(slotReferencePreference - slotPreference) * 18;
      }

      if (
        Number(preferenceSerie.id_professeur) === Number(professeur.id_professeur)
      ) {
        score += 60;
      }

      if (
        Number(preferenceSerie.id_salle || 0) > 0 &&
        Number(preferenceSerie.id_salle) === Number(salle?.id_salle)
      ) {
        score += 35;
      }
    }

    return score;
  }

  static _progress(callback, phase, message, pct) {
    if (typeof callback === "function") {
      callback({ phase, message, pct });
    }
  }

  static _indexerDatesParJourSemaine(jours) {
    const datesParJour = new Map();

    for (const jour of jours) {
      const jourSemaine = SchedulerEngine._jourIso(jour);
      if (!datesParJour.has(jourSemaine)) {
        datesParJour.set(jourSemaine, []);
      }
      datesParJour.get(jourSemaine).push(jour);
    }

    return datesParJour;
  }

  static _jourIso(date) {
    const dateTexte = String(date || "").includes("T")
      ? String(date).slice(0, 10)
      : String(date || "");
    const dateObj = new Date(`${dateTexte}T00:00:00`);
    const jour = dateObj.getDay();
    return jour === 0 ? 7 : jour;
  }

  static _lireChargeJour(index, idEntite, jourSemaine) {
    const parJour = index.get(String(idEntite));
    if (!parJour) {
      return 0;
    }
    return parJour.get(jourSemaine) || 0;
  }

  static _compterJoursActifs(index, idEntite) {
    const parJour = index.get(String(idEntite));
    if (!parJour) {
      return 0;
    }

    return [...parJour.values()].filter((charge) => Number(charge) > 0).length;
  }

  static _incrementerChargeJour(index, idEntite, jourSemaine) {
    const cle = String(idEntite);
    if (!index.has(cle)) {
      index.set(cle, new Map());
    }
    const parJour = index.get(cle);
    parJour.set(jourSemaine, (parJour.get(jourSemaine) || 0) + 1);
  }

  static _ordonnerJoursPourGroupe({
    datesParJourSemaine,
    idGroupe,
    chargeSeriesParJour,
    chargeSeriesParGroupeJour,
    autoriserJourSupplementaire = false,
  }) {
    const joursDisponibles = ACADEMIC_WEEKDAY_ORDER.filter((jour) =>
      datesParJourSemaine.has(jour)
    );
    const joursActifs = joursDisponibles.filter(
      (jour) =>
        SchedulerEngine._lireChargeJour(
          chargeSeriesParGroupeJour,
          idGroupe,
          jour
        ) > 0
    );
    const nbJoursActifs = joursActifs.length;

    return joursDisponibles
      .filter((jour) => {
        const chargeGroupe = SchedulerEngine._lireChargeJour(
          chargeSeriesParGroupeJour,
          idGroupe,
          jour
        );

        if (chargeGroupe >= MAX_GROUP_SESSIONS_PER_DAY) {
          return false;
        }

        if (chargeGroupe > 0) {
          return true;
        }

        return (
          autoriserJourSupplementaire ||
          nbJoursActifs < TARGET_ACTIVE_DAYS_PER_GROUP
        );
      })
      .sort((jourA, jourB) => {
        const chargeGroupeA = SchedulerEngine._lireChargeJour(
          chargeSeriesParGroupeJour,
          idGroupe,
          jourA
        );
        const chargeGroupeB = SchedulerEngine._lireChargeJour(
          chargeSeriesParGroupeJour,
          idGroupe,
          jourB
        );

        const prioriteA = SchedulerEngine._prioriteJourPourGroupe(
          chargeGroupeA,
          nbJoursActifs
        );
        const prioriteB = SchedulerEngine._prioriteJourPourGroupe(
          chargeGroupeB,
          nbJoursActifs
        );

        if (prioriteA !== prioriteB) {
          return prioriteA - prioriteB;
        }

        if (chargeGroupeA !== chargeGroupeB) {
          return chargeGroupeA - chargeGroupeB;
        }

        const chargeGlobaleA = chargeSeriesParJour.get(jourA) || 0;
        const chargeGlobaleB = chargeSeriesParJour.get(jourB) || 0;

        if (chargeGlobaleA !== chargeGlobaleB) {
          return chargeGlobaleA - chargeGlobaleB;
        }

        return (
          ACADEMIC_WEEKDAY_ORDER.indexOf(jourA) -
          ACADEMIC_WEEKDAY_ORDER.indexOf(jourB)
        );
      });
  }

  static _prioriteJourPourGroupe(chargeJour, nbJoursActifs) {
    if (chargeJour === 1) {
      return 0;
    }

    if (chargeJour === 0) {
      return nbJoursActifs < TARGET_ACTIVE_DAYS_PER_GROUP ? 1 : 3;
    }

    if (chargeJour >= 2 && nbJoursActifs < TARGET_ACTIVE_DAYS_PER_GROUP) {
      return 2;
    }

    return 0;
  }

  static _ordonnerCreneauxPourGroupeJour(
    creneaux,
    slotsParGroupeJour,
    idGroupe,
    jourSemaine
  ) {
    const slotsUtilises = SchedulerEngine._lireSlotsJour(
      slotsParGroupeJour,
      idGroupe,
      jourSemaine
    );

    return creneaux
      .map((creneau, index) => ({ ...creneau, _index: index }))
      .sort((slotA, slotB) => {
        const distanceA = SchedulerEngine._distanceSlotAuxExistants(
          slotA._index,
          slotsUtilises
        );
        const distanceB = SchedulerEngine._distanceSlotAuxExistants(
          slotB._index,
          slotsUtilises
        );

        if (distanceA !== distanceB) {
          return distanceA - distanceB;
        }

        return slotA._index - slotB._index;
      })
      .map(({ _index, ...creneau }) => creneau);
  }

  static _ordonnerCreneauxPourProfesseurJour(
    creneauxOrdonnes,
    creneauxReference,
    slotsParProfJour,
    idProfesseur,
    jourSemaine
  ) {
    const slotsUtilises = SchedulerEngine._lireSlotsJour(
      slotsParProfJour,
      idProfesseur,
      jourSemaine
    );

    return creneauxOrdonnes
      .map((creneau) => ({
        creneau,
        indexReference: creneauxReference.findIndex(
          (slot) =>
            slot.debut === creneau.debut && slot.fin === creneau.fin
        ),
      }))
      .sort((slotA, slotB) => {
        const distanceA = SchedulerEngine._distanceSlotAuxExistants(
          slotA.indexReference,
          slotsUtilises
        );
        const distanceB = SchedulerEngine._distanceSlotAuxExistants(
          slotB.indexReference,
          slotsUtilises
        );

        if (distanceA !== distanceB) {
          return distanceA - distanceB;
        }

        return slotA.indexReference - slotB.indexReference;
      })
      .map(({ creneau }) => creneau);
  }

  static _distanceSlotAuxExistants(slotIndex, slotsUtilises) {
    if (slotsUtilises.size === 0) {
      return slotIndex;
    }

    return Math.min(
      ...[...slotsUtilises].map((slotUtilise) =>
        Math.abs(slotIndex - slotUtilise)
      )
    );
  }

  static _trouverIndexSlotReference(heureDebut, heureFin) {
    return ACADEMIC_WEEKDAY_TIME_SLOTS.findIndex(
      (slot) => slot.debut === heureDebut && slot.fin === heureFin
    );
  }

  static _lireSlotsJour(index, idEntite, jourSemaine) {
    const parJour = index.get(String(idEntite));
    if (!parJour) {
      return new Set();
    }

    return new Set(parJour.get(jourSemaine) || []);
  }

  static _memoriserSlotJour(index, idEntite, jourSemaine, slotIndex) {
    const cle = String(idEntite);
    if (!index.has(cle)) {
      index.set(cle, new Map());
    }

    const parJour = index.get(cle);
    if (!parJour.has(jourSemaine)) {
      parJour.set(jourSemaine, new Set());
    }

    parJour.get(jourSemaine).add(slotIndex);
  }

  static async _chargerSession(idSession, executor = pool) {
    const [rows] = await executor.query(
      `SELECT id_session, nom, date_debut, date_fin, active
       FROM sessions
       WHERE id_session = ?
       LIMIT 1`,
      [Number(idSession)]
    );

    return rows[0] || null;
  }

  static async _persisterGroupes(groupesFormes, idSession, connection) {
    const idGroupeParNom = new Map();

    for (const groupe of groupesFormes) {
      const nomGroupe = String(groupe.nomGroupe || "").slice(0, 100);
      const tailleMax = SchedulerEngine._safeNum(groupe.taille_max, 30);
      const etapeVal =
        groupe.etape != null && !Number.isNaN(Number(groupe.etape))
          ? Number(groupe.etape)
          : null;
      const programmeVal = groupe.programme
        ? String(groupe.programme).slice(0, 150)
        : null;
      const estSpecial = groupe.est_groupe_special ? 1 : 0;
      const sessionVal = SchedulerEngine._safeNum(idSession) || null;

      const [existants] = await connection.query(
        `SELECT id_groupes_etudiants
         FROM groupes_etudiants
         WHERE nom_groupe = ? AND (id_session <=> ?)
         LIMIT 1`,
        [nomGroupe, sessionVal]
      );

      let idGroupe;
      if (existants.length > 0) {
        idGroupe = existants[0].id_groupes_etudiants;
        await connection.query(
          `UPDATE groupes_etudiants
           SET taille_max = ?, est_groupe_special = ?, id_session = ?, programme = ?, etape = ?
           WHERE id_groupes_etudiants = ?`,
          [tailleMax, estSpecial, sessionVal, programmeVal, etapeVal, idGroupe]
        );
      } else {
        const [resultat] = await connection.query(
          `INSERT INTO groupes_etudiants (
             nom_groupe,
             taille_max,
             est_groupe_special,
             id_session,
             programme,
             etape
           ) VALUES (?, ?, ?, ?, ?, ?)`,
          [nomGroupe, tailleMax, estSpecial, sessionVal, programmeVal, etapeVal]
        );
        idGroupe = resultat.insertId;
      }

      idGroupeParNom.set(groupe.nomGroupe, idGroupe);
    }

    return idGroupeParNom;
  }

  static async _attacherGroupesAuxPlacements(
    placements,
    idGroupeParNom,
    idSession,
    connection
  ) {
    const groupesSupplementaires = [];

    for (const placement of placements) {
      if (placement.id_groupe && Number.isInteger(Number(placement.id_groupe))) {
        continue;
      }

      const groupePersistable = placement.groupe_a_persister;
      if (!groupePersistable?.nomGroupe) {
        continue;
      }

      if (idGroupeParNom.has(groupePersistable.nomGroupe)) {
        placement.id_groupe = idGroupeParNom.get(groupePersistable.nomGroupe);
        continue;
      }

      groupesSupplementaires.push(groupePersistable);
    }

    if (groupesSupplementaires.length > 0) {
      const groupesPersistes = await SchedulerEngine._persisterGroupes(
        groupesSupplementaires,
        idSession,
        connection
      );

      for (const [nomGroupe, idGroupe] of groupesPersistes) {
        idGroupeParNom.set(nomGroupe, idGroupe);
      }
    }

    for (const placement of placements) {
      if (placement.id_groupe && Number.isInteger(Number(placement.id_groupe))) {
        continue;
      }

      const nomGroupe = placement.groupe_a_persister?.nomGroupe || placement.nom_groupe;
      if (nomGroupe && idGroupeParNom.has(nomGroupe)) {
        placement.id_groupe = idGroupeParNom.get(nomGroupe);
      }
    }
  }

  static async _mettreAJourGroupesEtudiants(
    affectationsEtudiantGroupe,
    idGroupeParNom,
    connection
  ) {
    for (const [idEtudiant, groupes] of affectationsEtudiantGroupe) {
      if (groupes.length === 0) {
        continue;
      }

      const idGroupe = idGroupeParNom.get(groupes[0]);
      if (!idGroupe) {
        continue;
      }

      await connection.query(
        `UPDATE etudiants
         SET id_groupes_etudiants = ?
         WHERE id_etudiant = ?`,
        [idGroupe, idEtudiant]
      );
    }
  }

  static async _detacherEtudiantsHorsSession(idSession, sessionSaison, connection) {
    if (!idSession || !sessionSaison) {
      return;
    }

    await connection.query(
      `UPDATE etudiants e
       INNER JOIN groupes_etudiants ge
         ON ge.id_groupes_etudiants = e.id_groupes_etudiants
       SET e.id_groupes_etudiants = NULL
       WHERE ge.id_session = ?
         AND (
           e.session IS NULL OR
           TRIM(LOWER(e.session)) <> TRIM(LOWER(?))
         )`,
      [idSession, sessionSaison]
    );
  }

  static async _supprimerHoraireSession(idSession, connection) {
    if (!idSession) {
      return;
    }

    try {
      await connection.query(
        `DELETE FROM affectation_etudiants
         WHERE id_session = ?
           AND source_type = 'reprise'`,
        [idSession]
      );

      await connection.query(
        `DELETE ag
         FROM affectation_groupes ag
         INNER JOIN groupes_etudiants ge
           ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
         WHERE ge.id_session = ?`,
        [idSession]
      );

      await connection.query(
        `DELETE ac
         FROM affectation_cours ac
         LEFT JOIN affectation_groupes ag
           ON ag.id_affectation_cours = ac.id_affectation_cours
         WHERE ag.id_affectation_cours IS NULL`
      );

      await connection.query(
        `DELETE ph
         FROM plages_horaires ph
         LEFT JOIN affectation_cours ac
           ON ac.id_plage_horaires = ph.id_plage_horaires
         WHERE ac.id_plage_horaires IS NULL`
      );

      await connection.query(
        `UPDATE cours_echoues
         SET statut = 'a_reprendre',
             id_groupe_reprise = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_session = ?
           AND statut <> 'reussi'`,
        [idSession]
      );
    } catch (error) {
      console.warn("[Scheduler] nettoyage horaire non bloquant:", error.message);
    }
  }

  static async _supprimerGroupesVidesSession(
    idSession,
    groupesAPreserver = [],
    connection
  ) {
    if (!idSession) {
      return;
    }

    const nomsPreserves = [...new Set((groupesAPreserver || []).filter(Boolean))];
    const clausePreservation =
      nomsPreserves.length > 0
        ? `AND ge.nom_groupe NOT IN (${nomsPreserves.map(() => "?").join(", ")})`
        : "";

    await connection.query(
      `DELETE FROM groupes_etudiants
       WHERE id_groupes_etudiants IN (
         SELECT id_groupes_etudiants
         FROM (
           SELECT ge.id_groupes_etudiants
           FROM groupes_etudiants ge
           LEFT JOIN etudiants e
             ON e.id_groupes_etudiants = ge.id_groupes_etudiants
           LEFT JOIN affectation_etudiants ae
             ON ae.id_groupes_etudiants = ge.id_groupes_etudiants
            AND ae.id_session = ge.id_session
           WHERE ge.id_session = ?
             ${clausePreservation}
           GROUP BY ge.id_groupes_etudiants
           HAVING COUNT(DISTINCT e.id_etudiant) = 0
              AND COUNT(DISTINCT ae.id_etudiant) = 0
         ) groupes_vides
       )`,
      [idSession, ...nomsPreserves]
    );
  }

  static async _persisterAffectationsIndividuellesReprises(
    affectations,
    idSession,
    connection
  ) {
    if (!idSession || !Array.isArray(affectations) || affectations.length === 0) {
      return;
    }

    for (const affectation of affectations) {
      const idCoursEchoue = Number(affectation?.id_cours_echoue);
      const idEtudiant = Number(affectation?.id_etudiant);
      const idGroupe = Number(affectation?.id_groupe);
      const idCours = Number(affectation?.id_cours);

      if (
        !Number.isInteger(idCoursEchoue) ||
        idCoursEchoue <= 0 ||
        !Number.isInteger(idEtudiant) ||
        idEtudiant <= 0 ||
        !Number.isInteger(idGroupe) ||
        idGroupe <= 0 ||
        !Number.isInteger(idCours) ||
        idCours <= 0
      ) {
        continue;
      }

      await connection.query(
        `INSERT INTO affectation_etudiants (
           id_etudiant,
           id_groupes_etudiants,
           id_cours,
           id_session,
           source_type,
           id_cours_echoue
         )
         VALUES (?, ?, ?, ?, 'reprise', ?)
         ON DUPLICATE KEY UPDATE
           id_groupes_etudiants = VALUES(id_groupes_etudiants),
           id_cours = VALUES(id_cours),
           id_session = VALUES(id_session),
           source_type = VALUES(source_type),
           id_cours_echoue = VALUES(id_cours_echoue)`,
        [idEtudiant, idGroupe, idCours, Number(idSession), idCoursEchoue]
      );

      await connection.query(
        `UPDATE cours_echoues
         SET statut = 'planifie',
             id_groupe_reprise = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND id_session = ?`,
        [idGroupe, idCoursEchoue, Number(idSession)]
      );
    }
  }

  static async _marquerCoursEchouesEnResolutionManuelle(
    resolutionsManuelles,
    idSession,
    connection
  ) {
    if (!idSession || !Array.isArray(resolutionsManuelles) || resolutionsManuelles.length === 0) {
      return;
    }

    for (const resolution of resolutionsManuelles) {
      const idCoursEchoue = Number(resolution?.id_cours_echoue);

      if (Number.isInteger(idCoursEchoue) && idCoursEchoue > 0) {
        await connection.query(
          `UPDATE cours_echoues
           SET statut = 'resolution_manuelle',
               id_groupe_reprise = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND id_session = ?
             AND statut <> 'reussi'`,
          [idCoursEchoue, Number(idSession)]
        );
        continue;
      }

      const idCours = Number(resolution?.cours?.id_cours);
      const idsEtudiants = Array.isArray(resolution?.etudiants)
        ? resolution.etudiants
            .map((idEtudiant) => Number(idEtudiant))
            .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0)
        : [];

      if (!Number.isInteger(idCours) || idCours <= 0 || idsEtudiants.length === 0) {
        continue;
      }

      const placeholders = idsEtudiants.map(() => "?").join(", ");
      await connection.query(
        `UPDATE cours_echoues
         SET statut = 'resolution_manuelle',
             id_groupe_reprise = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_session = ?
           AND id_cours = ?
           AND id_etudiant IN (${placeholders})
           AND statut <> 'reussi'`,
        [idSession, idCours, ...idsEtudiants]
      );
    }
  }

  static _safeNum(value, fallback = null) {
    if (value == null) {
      return fallback;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  static _construireSnapshotRapportMetier({
    etudiants,
    affectationsEtudiantGroupe,
    groupesFormes,
    nonPlanifies,
    conflitsReprises,
  }) {
    const etudiantsIndex = new Map(
      (Array.isArray(etudiants) ? etudiants : []).map((etudiant) => [
        Number(etudiant.id_etudiant),
        etudiant,
      ])
    );
    const groupesIndex = new Map(
      (Array.isArray(groupesFormes) ? groupesFormes : []).map((groupe) => [
        String(groupe.nomGroupe),
        groupe,
      ])
    );

    return {
      reprises_non_resolues: (Array.isArray(conflitsReprises) ? conflitsReprises : []).map(
        (conflit) => {
          const etudiant = etudiantsIndex.get(Number(conflit.id_etudiant)) || null;
          return {
            id_etudiant: Number(conflit.id_etudiant),
            matricule: etudiant?.matricule || null,
            nom: etudiant?.nom || null,
            prenom: etudiant?.prenom || null,
            groupe_principal:
              affectationsEtudiantGroupe?.get?.(Number(conflit.id_etudiant))?.[0] || null,
            code_cours: conflit.code_cours || null,
            nom_cours: conflit.nom_cours || null,
            raison_code: conflit.raison_code || null,
            raison: conflit.raison || null,
          };
        }
      ),
      cours_non_planifies: (Array.isArray(nonPlanifies) ? nonPlanifies : []).map((item) => {
        const groupe = item?.groupe ? groupesIndex.get(String(item.groupe)) : null;
        return {
          id_cours: Number(item.id_cours),
          code: item.code || null,
          nom: item.nom || null,
          groupe: item.groupe || null,
          programme: groupe?.programme || null,
          etape: groupe?.etape || null,
          raison_code: item.raison_code || null,
          raison: item.raison || null,
          suggestion: item.suggestion || null,
        };
      }),
    };
  }

  static _calculerScoreQualite({
    solution,
    nonPlanifies,
    nbResolutionsManuelles,
    preferencesStabilite = new Map(),
  }) {
    const joursParGroupe = new Map();
    const seancesParGroupeJour = new Map();
    const seancesHebdoParGroupe = new Map();
    let nbWeekend = 0;
    let seancesStables = 0;
    let seancesReferencees = 0;

    for (const placement of solution) {
      const jourIso = SchedulerEngine._jourIso(placement.date);
      if (jourIso === 6 || jourIso === 7) {
        nbWeekend += 1;
      }

      if (placement.est_groupe_special) {
        continue;
      }

      const groupeKey = String(placement.id_groupe || placement.nom_groupe);
      if (!joursParGroupe.has(groupeKey)) {
        joursParGroupe.set(groupeKey, new Set());
      }
      joursParGroupe.get(groupeKey).add(jourIso);

      const cleJour = `${groupeKey}|${jourIso}`;
      if (!seancesParGroupeJour.has(cleJour)) {
        seancesParGroupeJour.set(cleJour, new Set());
      }
      seancesParGroupeJour
        .get(cleJour)
        .add(`${placement.id_cours}|${placement.heure_debut}|${placement.heure_fin}`);

      const cleSemaine = ConstraintMatrix.cleSemaine(placement.date);
      const cleHebdo = `${groupeKey}|${cleSemaine}`;
      seancesHebdoParGroupe.set(
        cleHebdo,
        (seancesHebdoParGroupe.get(cleHebdo) || 0) + 1
      );

      const preferencesSerie = preferencesStabilite.get(
        `${String(placement.nom_groupe || "").trim()}|${Number(placement.id_cours)}`
      );

      if (Array.isArray(preferencesSerie) && preferencesSerie.length > 0) {
        seancesReferencees += 1;
        const correspondance = preferencesSerie.some(
          (preference) =>
            Number(preference.jourSemaine) === Number(jourIso) &&
            String(preference.heure_debut) === String(placement.heure_debut) &&
            String(preference.heure_fin) === String(placement.heure_fin)
        );

        if (correspondance) {
          seancesStables += 1;
        }
      }
    }

    let groupesHorsPlage = 0;
    for (const joursActifs of joursParGroupe.values()) {
      if (joursActifs.size < 3 || joursActifs.size > 4) {
        groupesHorsPlage += 1;
      }
    }

    let groupesSurcharges = 0;
    for (const seancesJour of seancesParGroupeJour.values()) {
      if (seancesJour.size > MAX_GROUP_SESSIONS_PER_DAY) {
        groupesSurcharges += 1;
      }
    }

    let groupesSousChargeHebdo = 0;
    let groupesSurChargeHebdo = 0;
    for (const [cleHebdo, totalSeances] of seancesHebdoParGroupe) {
      const maximum = REQUIRED_WEEKLY_SESSIONS_PER_GROUP;
      const minimum = REQUIRED_WEEKLY_SESSIONS_PER_GROUP;

      if (totalSeances < minimum) {
        groupesSousChargeHebdo += 1;
      }

      if (totalSeances > maximum) {
        groupesSurChargeHebdo += 1;
      }
    }

    const tauxStabilite =
      seancesReferencees > 0 ? seancesStables / seancesReferencees : 1;

    const penalites =
      nonPlanifies.length * 12 +
      nbResolutionsManuelles * 8 +
      nbWeekend * 5 +
      groupesHorsPlage * 5 +
      groupesSurcharges * 2 +
      groupesSousChargeHebdo * 10 +
      groupesSurChargeHebdo * 12 +
      Math.round((1 - tauxStabilite) * 20);

    return {
      score: Math.max(0, Math.min(100, 100 - penalites)),
      nb_weekend: nbWeekend,
      groupes_hors_plage: groupesHorsPlage,
      groupes_surcharges: groupesSurcharges,
      groupes_sous_charge_hebdo: groupesSousChargeHebdo,
      groupes_sur_charge_hebdo: groupesSurChargeHebdo,
      taux_stabilite_reference: Number(tauxStabilite.toFixed(3)),
      nb_non_planifies: nonPlanifies.length,
      nb_resolutions_manuelles: nbResolutionsManuelles,
    };
  }

  /**
   * Passe 2 assouplie avec stabilite partielle.
   * Utilise le filtrage par date (meme approche que Phase 4) avec un seuil
   * de couverture plus bas (40%) pour maximiser la recuperation.
   * Cascade : in-person complet → hybride → entierement en ligne.
   */
  static _trouverSerieAssouplie({
    cours, groupe, idGroupe, professeurs, salles,
    datesParJourSemaine, creneaux, matrix,
    dispParProf, absencesParProf, indispoParSalle,
    chargeSeriesParProf, chargeSeriesParJour,
    chargeSeriesParGroupeJour, chargeSeriesParProfJour,
    slotsParGroupeJour, slotsParProfJour,
    effectifGroupe,
  }) {
    const onlineEnabled = isOnlineCourseSchedulingEnabled();
    if (!onlineEnabled && Boolean(cours?.est_en_ligne)) {
      return null;
    }

    const PLAFOND_HEBDO = getSchedulerMaxWeeklySessionsPerProfessor() + 2;
    const MIN_COVERAGE_ASSOUPLIE = 0.40;
    const joursDisponibles = ACADEMIC_WEEKDAY_ORDER.filter(
      (j) => datesParJourSemaine.has(j)
    );

    const profsCompat = professeurs
      .filter((p) => AvailabilityChecker.profCompatible(p, cours))
      .sort((a, b) =>
        (chargeSeriesParProf.get(a.id_professeur) || 0) -
        (chargeSeriesParProf.get(b.id_professeur) || 0)
      );
    if (profsCompat.length === 0) return null;

    const sallesCompat = cours.est_en_ligne
      ? []
      : salles
          .filter((s) => AvailabilityChecker.salleCompatible(s, cours, effectifGroupe))
          .sort((a, b) => a.capacite - b.capacite);

    for (const jourSemaine of joursDisponibles) {
      const datesToutes = datesParJourSemaine.get(jourSemaine) || [];
      if (datesToutes.length === 0) continue;
      const etudiantsCours = SchedulerEngine._lireEtudiantsCours(groupe, cours.id_cours);

      for (const prof of profsCompat) {
        for (const creneau of creneaux) {
          // Filtrage par date au lieu de .every()
          const datesDisponibles = datesToutes.filter((date) =>
            matrix.profLibre(prof.id_professeur, date, creneau.debut, creneau.fin) &&
            AvailabilityChecker.profDisponible(
              prof.id_professeur, date, creneau.debut, creneau.fin,
              dispParProf, absencesParProf
            ) &&
            matrix.groupeLibre(idGroupe, date, creneau.debut, creneau.fin) &&
            matrix.etudiantsLibres(etudiantsCours, date, creneau.debut, creneau.fin) &&
            matrix.groupePeutAjouterSeanceSemaine(idGroupe, date, REQUIRED_WEEKLY_SESSIONS_PER_GROUP) &&
            matrix.profPeutAjouterSeanceSemaine(prof.id_professeur, date, PLAFOND_HEBDO)
          );

          const seuil = Math.max(1, Math.ceil(datesToutes.length * MIN_COVERAGE_ASSOUPLIE));
          if (datesDisponibles.length < seuil) continue;

          const slotIdx = creneaux.findIndex(
            (s) => s.debut === creneau.debut && s.fin === creneau.fin
          );

          // Tentative 1 : in-person integral (salle dispo sur toutes les dates filtrées)
          if (!cours.est_en_ligne) {
            for (const salle of sallesCompat) {
              const datesAvecSalle = datesDisponibles.filter((d) =>
                matrix.salleLibre(salle.id_salle, d, creneau.debut, creneau.fin) &&
                AvailabilityChecker.salleDisponible(salle.id_salle, d, indispoParSalle)
              );
              if (datesAvecSalle.length >= seuil) {
                return SchedulerEngine._reserverSerieFallback({
                  cours, groupe, idGroupe, prof, datesSerie: datesAvecSalle, creneau, matrix,
                  salle, estEnLigne: false,
                  chargeSeriesParProf, chargeSeriesParJour,
                  chargeSeriesParGroupeJour, chargeSeriesParProfJour,
                  slotsParGroupeJour, slotsParProfJour, jourSemaine, slotIdx,
                });
              }
            }
          }

          // Tentative 2 : hybride (in-person quand salle dispo, en ligne sinon)
          if (onlineEnabled && !cours.est_en_ligne && sallesCompat.length > 0) {
            const placements = datesDisponibles.map((date) => {
              let sa = null;
              for (const s of sallesCompat) {
                if (
                  matrix.salleLibre(s.id_salle, date, creneau.debut, creneau.fin) &&
                  AvailabilityChecker.salleDisponible(s.id_salle, date, indispoParSalle)
                ) { sa = s; break; }
              }
              return {
                id_cours: cours.id_cours, code_cours: cours.code, nom_cours: cours.nom,
                id_professeur: prof.id_professeur,
                nom_professeur: `${prof.prenom} ${prof.nom}`,
                id_salle: sa ? sa.id_salle : null,
                code_salle: sa ? sa.code : "EN LIGNE",
                date, heure_debut: creneau.debut, heure_fin: creneau.fin,
                nom_groupe: groupe.nomGroupe, id_groupe: idGroupe,
                est_en_ligne: !sa,
                est_cours_cle: Boolean(cours.est_cours_cle),
                est_groupe_special: false,
              };
            });
            for (const p of placements) {
              matrix.reserver(
                p.id_salle, p.id_professeur, p.id_groupe, p.id_cours,
                p.date, p.heure_debut, p.heure_fin,
                { studentIds: SchedulerEngine._lireEtudiantsCours(groupe, cours.id_cours) }
              );
            }
            chargeSeriesParProf.set(prof.id_professeur, (chargeSeriesParProf.get(prof.id_professeur) || 0) + 1);
            chargeSeriesParJour.set(jourSemaine, (chargeSeriesParJour.get(jourSemaine) || 0) + 1);
            SchedulerEngine._incrementerChargeJour(chargeSeriesParGroupeJour, idGroupe, jourSemaine);
            SchedulerEngine._incrementerChargeJour(chargeSeriesParProfJour, prof.id_professeur, jourSemaine);
            SchedulerEngine._memoriserSlotJour(slotsParGroupeJour, idGroupe, jourSemaine, slotIdx);
            SchedulerEngine._memoriserSlotJour(slotsParProfJour, prof.id_professeur, jourSemaine, slotIdx);
            return { placements, professeur: prof, salle: null, jourSemaine };
          }

          // Tentative 3 : entierement en ligne
          if (onlineEnabled) {
            const placements = datesDisponibles.map((date) => ({
              id_cours: cours.id_cours, code_cours: cours.code, nom_cours: cours.nom,
              id_professeur: prof.id_professeur,
              nom_professeur: `${prof.prenom} ${prof.nom}`,
              id_salle: null, code_salle: "EN LIGNE",
              date, heure_debut: creneau.debut, heure_fin: creneau.fin,
              nom_groupe: groupe.nomGroupe, id_groupe: idGroupe,
              est_en_ligne: true,
              est_cours_cle: Boolean(cours.est_cours_cle),
              est_groupe_special: false,
            }));
            for (const p of placements) {
              matrix.reserver(
                null, p.id_professeur, p.id_groupe, p.id_cours,
                p.date, p.heure_debut, p.heure_fin,
                { studentIds: SchedulerEngine._lireEtudiantsCours(groupe, cours.id_cours) }
              );
            }
            chargeSeriesParProf.set(prof.id_professeur, (chargeSeriesParProf.get(prof.id_professeur) || 0) + 1);
            chargeSeriesParJour.set(jourSemaine, (chargeSeriesParJour.get(jourSemaine) || 0) + 1);
            SchedulerEngine._incrementerChargeJour(chargeSeriesParGroupeJour, idGroupe, jourSemaine);
            SchedulerEngine._incrementerChargeJour(chargeSeriesParProfJour, prof.id_professeur, jourSemaine);
            SchedulerEngine._memoriserSlotJour(slotsParGroupeJour, idGroupe, jourSemaine, slotIdx);
            SchedulerEngine._memoriserSlotJour(slotsParProfJour, prof.id_professeur, jourSemaine, slotIdx);
            return { placements, professeur: prof, salle: null, jourSemaine };
          }
        }
      }
    }
    return null;
  }

  static _reserverSerieFallback({
    cours, groupe, idGroupe, prof, datesSerie, creneau, matrix,
    salle, estEnLigne,
    chargeSeriesParProf, chargeSeriesParJour,
    chargeSeriesParGroupeJour, chargeSeriesParProfJour,
    slotsParGroupeJour, slotsParProfJour, jourSemaine, slotIdx,
  }) {
    const placements = datesSerie.map((date) => ({
      id_cours: cours.id_cours, code_cours: cours.code, nom_cours: cours.nom,
      id_professeur: prof.id_professeur,
      nom_professeur: `${prof.prenom} ${prof.nom}`,
      id_salle: estEnLigne ? null : salle.id_salle,
      code_salle: estEnLigne ? "EN LIGNE" : salle.code,
      date, heure_debut: creneau.debut, heure_fin: creneau.fin,
      nom_groupe: groupe.nomGroupe, id_groupe: idGroupe,
      est_en_ligne: estEnLigne,
      est_cours_cle: Boolean(cours.est_cours_cle),
      est_groupe_special: false,
    }));
    for (const p of placements) {
      matrix.reserver(
        p.id_salle, p.id_professeur, p.id_groupe, p.id_cours,
        p.date, p.heure_debut, p.heure_fin,
        { studentIds: SchedulerEngine._lireEtudiantsCours(groupe, cours.id_cours) }
      );
    }
    chargeSeriesParProf.set(prof.id_professeur, (chargeSeriesParProf.get(prof.id_professeur) || 0) + 1);
    chargeSeriesParJour.set(jourSemaine, (chargeSeriesParJour.get(jourSemaine) || 0) + 1);
    SchedulerEngine._incrementerChargeJour(chargeSeriesParGroupeJour, idGroupe, jourSemaine);
    SchedulerEngine._incrementerChargeJour(chargeSeriesParProfJour, prof.id_professeur, jourSemaine);
    SchedulerEngine._memoriserSlotJour(slotsParGroupeJour, idGroupe, jourSemaine, slotIdx);
    SchedulerEngine._memoriserSlotJour(slotsParProfJour, prof.id_professeur, jourSemaine, slotIdx);
    return { placements, professeur: prof, salle, jourSemaine };
  }

  static _diagnosticPrecis({
    cours, groupe, idGroupe, professeurs, salles,
    datesParJourSemaine, creneaux, matrix,
    dispParProf, absencesParProf, indispoParSalle,
  }) {
    const profsCompat = professeurs.filter((p) => AvailabilityChecker.profCompatible(p, cours));
    if (profsCompat.length === 0) {
      return {
        raison: `Cours ${cours.code} : aucun professeur qualifie pour "${cours.nom}" (programme: ${cours.programme}).`,
        raison_code: "AUCUN_PROFESSEUR_COMPATIBLE",
        suggestion: "Affecter un professeur a ce cours.",
      };
    }
    const effectif = GroupFormer.lireEffectifCours(groupe, cours?.id_cours);
    const sallesCompat = salles.filter((s) => AvailabilityChecker.salleCompatible(s, cours, effectif));
    if (!cours.est_en_ligne && sallesCompat.length === 0) {
      return {
        raison: `Cours ${cours.code} : aucune salle de type "${cours.type_salle}" pour ${effectif} etudiants.`,
        raison_code: "SALLE_INSUFFISANTE",
        suggestion: `Ajouter une salle "${cours.type_salle}" capacite >= ${effectif}.`,
      };
    }
    const jours = ACADEMIC_WEEKDAY_ORDER.filter((j) => datesParJourSemaine.has(j));
    const etudiantsCours = SchedulerEngine._lireEtudiantsCours(groupe, cours?.id_cours);
    let blocagesGroupe = 0;
    let blocagesEtudiants = 0;
    let blocagesProf = 0;
    let blocagesSalle = 0;
    let slotsTestes = 0;
    for (const jour of jours) {
      const datesSerie = datesParJourSemaine.get(jour) || [];
      for (const creneau of creneaux) {
        slotsTestes++;
        const groupeOk = datesSerie.every((d) => matrix.groupeLibre(idGroupe, d, creneau.debut, creneau.fin));
        if (!groupeOk) { blocagesGroupe++; continue; }
        const etudiantsOk = datesSerie.every((d) =>
          matrix.etudiantsLibres(etudiantsCours, d, creneau.debut, creneau.fin)
        );
        if (!etudiantsOk) { blocagesEtudiants++; continue; }
        let profOk = false;
        for (const p of profsCompat) {
          if (datesSerie.every((d) =>
            matrix.profLibre(p.id_professeur, d, creneau.debut, creneau.fin) &&
            AvailabilityChecker.profDisponible(p.id_professeur, d, creneau.debut, creneau.fin, dispParProf, absencesParProf)
          )) { profOk = true; break; }
        }
        if (!profOk) { blocagesProf++; continue; }
        if (!cours.est_en_ligne) {
          let salleOk = false;
          for (const s of sallesCompat) {
            if (datesSerie.every((d) => matrix.salleLibre(s.id_salle, d, creneau.debut, creneau.fin))) { salleOk = true; break; }
          }
          if (!salleOk) { blocagesSalle++; }
        }
      }
    }
    if (
      blocagesEtudiants >= blocagesGroupe &&
      blocagesEtudiants >= blocagesProf &&
      blocagesEtudiants >= blocagesSalle
    ) {
      return {
        raison:
          `Cours ${cours.code} pour ${groupe.nomGroupe} : ` +
          `${blocagesEtudiants}/${slotsTestes} creneaux bloquent au moins un etudiant du cours.`,
        raison_code: "ETUDIANTS_OCCUPES",
        suggestion:
          "Verifier les conflits entre l'horaire principal et les reprises deja rattachees.",
      };
    }
    if (blocagesGroupe >= blocagesProf && blocagesGroupe >= blocagesSalle) {
      return {
        raison: `Cours ${cours.code} pour ${groupe.nomGroupe} : groupe sature, ${blocagesGroupe}/${slotsTestes} creneaux occupes.`,
        raison_code: "GROUPE_SATURE",
        suggestion: "Verifier que le groupe ne depasse pas la charge maximale par jour.",
      };
    }
    if (blocagesProf >= blocagesSalle) {
      return {
        raison: `Cours ${cours.code} pour ${groupe.nomGroupe} : ${profsCompat.length} prof(s) compatible(s) tous occupes.`,
        raison_code: "PROFESSEURS_SATURES",
        suggestion: "Augmenter la capacite des professeurs ou ajouter un enseignant.",
      };
    }
    return {
      raison: `Cours ${cours.code} pour ${groupe.nomGroupe} : ${sallesCompat.length} salle(s) "${cours.type_salle}" toutes occupees.`,
      raison_code: "SALLES_SATUREES",
      suggestion: `Ajouter des salles de type "${cours.type_salle}".`,
    };
  }

  /**
   * Phase 4C — Garantie metier : chaque groupe doit recevoir 7 cours.
   * Apres les passes 4 et 4B, identifie les groupes sous-servis et
   * tente agressivement de combler les manques via la passe assouplie.
   */
  static _passeDeGarantieGroupes({
    solution, cours, groupesFormes, idGroupeParNom,
    professeurs, salles,
    datesParJourSemaine, creneaux, matrix,
    dispParProf, absencesParProf, indispoParSalle,
    chargeSeriesParProf, chargeSeriesParJour,
    chargeSeriesParGroupeJour, chargeSeriesParProfJour,
    slotsParGroupeJour, slotsParProfJour,
  }) {
    const coursParGroupe = new Map();
    for (const placement of solution) {
      if (!placement.id_groupe) continue;
      const key = String(placement.id_groupe);
      if (!coursParGroupe.has(key)) coursParGroupe.set(key, new Set());
      coursParGroupe.get(key).add(placement.id_cours);
    }

    const placementsGarantie = [];
    const diagnosticsGarantie = [];

    for (const groupe of groupesFormes) {
      const idGroupe = idGroupeParNom.get(groupe.nomGroupe);
      if (!idGroupe) continue;

      const coursSchedules = coursParGroupe.get(String(idGroupe)) || new Set();
      if (coursSchedules.size >= REQUIRED_WEEKLY_SESSIONS_PER_GROUP) continue;

      const coursAttendu = cours.filter((c) => {
        const programmeGroupe = AvailabilityChecker._normaliser(groupe.programme || "");
        const programmeCours = AvailabilityChecker._normaliser(c.programme || "");
        const etapeGroupe = groupe.etape != null ? String(Number(groupe.etape)) : "";
        const etapeCours = String(c.etape_etude || "").trim();
        return (
          programmeGroupe !== "" &&
          programmeGroupe === programmeCours &&
          etapeGroupe !== "" &&
          etapeGroupe === etapeCours
        );
      });

      const coursManquants = coursAttendu.filter(
        (c) => !coursSchedules.has(c.id_cours)
      );

      if (coursManquants.length === 0) continue;

      console.info(
        `[Scheduler] Garantie: ${groupe.nomGroupe} a ${coursSchedules.size}/${REQUIRED_WEEKLY_SESSIONS_PER_GROUP} cours, ` +
        `${coursManquants.length} manquant(s): ${coursManquants.map((c) => c.code).join(", ")}`
      );

      for (const coursManquant of coursManquants) {
        if (coursSchedules.size >= REQUIRED_WEEKLY_SESSIONS_PER_GROUP) break;

        const effectifGroupe = GroupFormer.lireEffectifCours(
          groupe,
          coursManquant.id_cours
        );

        const serie = SchedulerEngine._trouverSerieAssouplie({
          cours: coursManquant,
          groupe,
          idGroupe,
          professeurs,
          salles,
          datesParJourSemaine,
          creneaux,
          matrix,
          dispParProf,
          absencesParProf,
          indispoParSalle,
          chargeSeriesParProf,
          chargeSeriesParJour,
          chargeSeriesParGroupeJour,
          chargeSeriesParProfJour,
          slotsParGroupeJour,
          slotsParProfJour,
          effectifGroupe,
        });

        if (serie) {
          placementsGarantie.push(...serie.placements);
          coursSchedules.add(coursManquant.id_cours);
          console.info(
            `[Scheduler] Garantie: +1 cours ${coursManquant.code} pour ${groupe.nomGroupe} ` +
            `(${coursSchedules.size}/${REQUIRED_WEEKLY_SESSIONS_PER_GROUP})`
          );
        } else {
          const diag = SchedulerEngine._diagnosticPrecis({
            cours: coursManquant,
            groupe,
            idGroupe,
            professeurs,
            salles,
            datesParJourSemaine,
            creneaux,
            matrix,
            dispParProf,
            absencesParProf,
            indispoParSalle,
          });
          diagnosticsGarantie.push({
            id_cours: coursManquant.id_cours,
            code: coursManquant.code,
            nom: coursManquant.nom,
            groupe: groupe.nomGroupe,
            raison: `Garantie: ${diag.raison}`,
            raison_code: `GARANTIE_${diag.raison_code || "ECHEC"}`,
            suggestion: diag.suggestion || "",
          });
        }
      }

      if (coursSchedules.size < REQUIRED_WEEKLY_SESSIONS_PER_GROUP) {
        console.warn(
          `[Scheduler] Garantie: ${groupe.nomGroupe} reste a ${coursSchedules.size}/${REQUIRED_WEEKLY_SESSIONS_PER_GROUP} cours apres toutes les tentatives.`
        );
      }
    }

    console.info(
      `[Scheduler] Phase 4C terminee: ${placementsGarantie.length} placements ajoutes, ` +
      `${diagnosticsGarantie.length} echecs restants.`
    );

    return { placementsGarantie, diagnosticsGarantie };
  }

  /**
   * Génération ciblée pour un seul groupe.
   *
   * Cette méthode génère ou régénère l'horaire d'un groupe précis,
   * sans toucher aux autres groupes de la session.
   *
   * @param {Object} options
   * @param {number} options.idGroupe        Identifiant du groupe à régénérer
   * @param {number|null} options.idUtilisateur Utilisateur déclencheur
   * @returns {Promise<Object>} Rapport de génération
   */
  static async genererGroupe({ idGroupe, idSession = null, idUtilisateur = null } = {}) {
    if (!idGroupe || !Number.isInteger(Number(idGroupe))) {
      throw Object.assign(new Error("Identifiant de groupe invalide."), { statusCode: 400 });
    }

    await assurerSchemaSchedulerAcademique();

    const connection = await pool.getConnection();
    const rapport = {
      id_groupe: idGroupe,
      score_qualite: 0,
      nb_cours_planifies: 0,
      nb_cours_non_planifies: 0,
      affectations: [],
      non_planifies: [],
      details: { mode: "generation_ciblee_groupe" },
    };

    try {
      await connection.beginTransaction();

      // Charger la session active
      const [sessions] = await connection.query(
        `SELECT id_session, nom, date_debut, date_fin
         FROM sessions
         WHERE ${idSession ? "id_session = ?" : "active = TRUE"}
         ORDER BY id_session DESC
         LIMIT 1`,
        idSession ? [Number(idSession)] : []
      );
      const session = sessions[0];

      if (!session) {
        throw Object.assign(
          new Error("Aucune session active. Activez une session dans Pilotage sessions."),
          { statusCode: 422 }
        );
      }

      // Charger le groupe cible
      const [[groupeDb]] = await connection.query(
        `SELECT ge.id_groupes_etudiants, ge.nom_groupe, ge.programme, ge.etape
         FROM groupes_etudiants ge
         WHERE ge.id_groupes_etudiants = ?`,
        [idGroupe]
      );

      if (!groupeDb) {
        throw Object.assign(new Error("Groupe introuvable."), { statusCode: 404 });
      }

      // Charger les étudiants du groupe
      const [etudiants] = await connection.query(
        `SELECT id_etudiant, matricule, nom, prenom, programme, etape, session
         FROM etudiants
         WHERE id_groupes_etudiants = ?`,
        [idGroupe]
      );

      const [reprisesAttachees] = await connection.query(
        `SELECT ae.id_cours,
                ae.id_etudiant
         FROM affectation_etudiants ae
         WHERE ae.id_session = ?
           AND ae.id_groupes_etudiants = ?
           AND ae.source_type = 'reprise'`,
        [session.id_session, idGroupe]
      );

      // Supprimer UNIQUEMENT les affectations de ce groupe
      await connection.query(
        `DELETE ag FROM affectation_groupes ag
         WHERE ag.id_groupes_etudiants = ?`,
        [idGroupe]
      );

      // Charger le contexte global (cours, profs, salles, contraintes)
      const [cours] = await connection.query(
        `SELECT c.id_cours, c.code, c.nom, c.duree, c.programme, c.etape_etude,
                c.type_salle, c.est_cours_cle, c.est_en_ligne,
                c.max_etudiants_par_groupe, c.min_etudiants_par_groupe,
                c.sessions_par_semaine, c.archive
         FROM cours c
         WHERE c.archive = FALSE
         ORDER BY c.est_cours_cle DESC, c.code ASC`
      );

      const [professeursBruts] = await connection.query(
        `SELECT p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite,
                COALESCE(GROUP_CONCAT(DISTINCT pc.id_cours ORDER BY pc.id_cours SEPARATOR ','), '') AS cours_ids
         FROM professeurs p
         LEFT JOIN professeur_cours pc ON pc.id_professeur = p.id_professeur
         GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
         ORDER BY p.nom ASC`
      );

      const [salles] = await connection.query(
        `SELECT id_salle, code, type, capacite FROM salles ORDER BY capacite ASC, code ASC`
      );

      const [disponibilites] = await connection.query(
        `SELECT id_professeur, jour_semaine, heure_debut, heure_fin,
                DATE_FORMAT(date_debut_effet, '%Y-%m-%d') AS date_debut_effet,
                DATE_FORMAT(date_fin_effet, '%Y-%m-%d') AS date_fin_effet
         FROM disponibilites_professeurs
         WHERE date_fin_effet >= ? AND date_debut_effet <= ?
         ORDER BY id_professeur, jour_semaine`,
        [session.date_debut, session.date_fin]
      );

      const [absencesRows] = await connection.query(
        `SELECT id_professeur, date_debut, date_fin, type
         FROM absences_professeurs
         WHERE date_fin >= CURDATE()
         ORDER BY id_professeur, date_debut`
      );

      const [sallesIndispoRows] = await connection.query(
        `SELECT id_salle, date_debut, date_fin, raison
         FROM salles_indisponibles
         WHERE date_fin >= CURDATE()
         ORDER BY id_salle, date_debut`
      );

      const professeurs = professeursBruts.map((p) => ({
        ...p,
        cours_ids: String(p.cours_ids || "")
          .split(",")
          .map(Number)
          .filter((v) => Number.isInteger(v) && v > 0),
      }));

      const dispParProf = new Map();
      for (const d of disponibilites) {
        if (!dispParProf.has(d.id_professeur)) dispParProf.set(d.id_professeur, []);
        dispParProf.get(d.id_professeur).push(d);
      }

      const absencesParProf = new Map();
      for (const a of absencesRows) {
        if (!absencesParProf.has(a.id_professeur)) absencesParProf.set(a.id_professeur, []);
        absencesParProf.get(a.id_professeur).push(a);
      }

      const indispoParSalle = new Map();
      for (const si of sallesIndispoRows) {
        if (!indispoParSalle.has(si.id_salle)) indispoParSalle.set(si.id_salle, []);
        indispoParSalle.get(si.id_salle).push(si);
      }

      // Construire la représentation du groupe pour le moteur
      const programmeGroupe = groupeDb.programme ||
        (etudiants.length > 0 ? etudiants[0].programme : null);
      const etapeGroupe = groupeDb.etape ||
        (etudiants.length > 0 ? String(etudiants[0].etape || "") : null);
      const effectifRegulier = etudiants.length;

      if (!programmeGroupe || String(etapeGroupe || "").trim() === "") {
        throw Object.assign(
          new Error(
            `Le groupe "${groupeDb.nom_groupe}" n'a pas de programme ou d'etape exploitables pour la generation ciblee.`
          ),
          { statusCode: 422 }
        );
      }

      if (effectifRegulier === 0 && reprisesAttachees.length === 0) {
        throw Object.assign(
          new Error(
            `Le groupe "${groupeDb.nom_groupe}" ne contient aucun etudiant regulier ni aucune reprise rattachee.`
          ),
          { statusCode: 422 }
        );
      }

      const etudiantsRepriseParCours = reprisesAttachees.reduce((index, row) => {
        const idCours = String(Number(row.id_cours));
        if (!index[idCours]) {
          index[idCours] = [];
        }
        index[idCours].push(Number(row.id_etudiant));
        return index;
      }, {});
      const chargeEstimeeParCours = {};
      for (const [idCours, etudiantsCours] of Object.entries(etudiantsRepriseParCours)) {
        chargeEstimeeParCours[idCours] = effectifRegulier + etudiantsCours.length;
      }

      const groupeForMoteur = {
        nomGroupe: groupeDb.nom_groupe,
        programme: programmeGroupe,
        etape: etapeGroupe,
        etudiants: etudiants.map((e) => e.id_etudiant),
        etudiants_par_cours: etudiantsRepriseParCours,
        effectif_regulier: effectifRegulier,
        charge_estimee_par_cours: chargeEstimeeParCours,
        effectif_projete_max: Math.max(
          effectifRegulier,
          ...Object.values(chargeEstimeeParCours).map((value) => Number(value) || 0)
        ),
        taille: effectifRegulier,
      };

      // Filtrer les cours compatibles avec ce groupe
      const normaliser = (s) => String(s || "").trim().toUpperCase();
      const coursFiltres = cours.filter((c) => {
        if (c.archive) return false;
        if (!isCourseSchedulable(c)) return false;
        const pgCours = normaliser(c.programme);
        const pgGroupe = normaliser(programmeGroupe);
        const etapeCours = String(c.etape_etude || "").trim();
        const etapeGrp = String(etapeGroupe || "").trim();
        return pgCours !== "" && pgCours === pgGroupe &&
               etapeCours !== "" && etapeCours === etapeGrp;
      });

      if (coursFiltres.length === 0) {
        throw Object.assign(
          new Error(
            `Aucun cours planifiable pour le programme "${programmeGroupe}" étape ${etapeGroupe}. ` +
            `Vérifiez les cours du catalogue.`
          ),
          { statusCode: 422 }
        );
      }

      // Générer les plages (dates) de la session
      const weekendAutorise = false;
      const jours = AvailabilityChecker.genererJours(
        session.date_debut,
        session.date_fin,
        weekendAutorise
      );
      const datesParJourSemaine = SchedulerEngine._indexerDatesParJourSemaine(jours);
      const creneaux = [...ACADEMIC_WEEKDAY_TIME_SLOTS];

      // Matrices de contraintes GLOBALES (pour éviter les conflits avec les autres groupes)
      const [affectationsExistantesGlobales] = await connection.query(
        `SELECT ac.id_affectation_cours, ac.id_cours, ac.id_professeur, ac.id_salle,
                ag.id_groupes_etudiants,
                DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
                ph.heure_debut, ph.heure_fin
         FROM affectation_cours ac
         JOIN plages_horaires ph ON ph.id_plage_horaires = ac.id_plage_horaires
         JOIN affectation_groupes ag ON ag.id_affectation_cours = ac.id_affectation_cours
         JOIN groupes_etudiants ge ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
         WHERE ge.id_session = ?
           AND ag.id_groupes_etudiants != ?`,
        [session.id_session, idGroupe]
      );

      const matrix = new ConstraintMatrix();

      // Pré-remplir la matrice avec les contraintes des AUTRES groupes
      // pour éviter les conflits prof/salle (on utilise reserver avec un idCours fictif = 0)
      for (const aff of affectationsExistantesGlobales) {
        matrix.reserver(
          aff.id_salle || null,
          aff.id_professeur,
          aff.id_groupes_etudiants || null,
          aff.id_cours || 0,
          aff.date,
          aff.heure_debut,
          aff.heure_fin
        );
      }

      const etudiantsAContraindre = [
        ...new Set([
          ...groupeForMoteur.etudiants,
          ...reprisesAttachees
            .map((row) => Number(row.id_etudiant))
            .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0),
        ]),
      ];

      if (etudiantsAContraindre.length > 0) {
        const placeholdersEtudiants = etudiantsAContraindre.map(() => "?").join(", ");
        const [occupationsEtudiants] = await connection.query(
          `SELECT occupation.id_etudiant,
                  occupation.id_cours,
                  occupation.date,
                  occupation.heure_debut,
                  occupation.heure_fin
           FROM (
             SELECT e.id_etudiant,
                    ac.id_cours,
                    DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
                    ph.heure_debut,
                    ph.heure_fin,
                    ge.id_groupes_etudiants AS id_groupe_source
             FROM etudiants e
             JOIN groupes_etudiants ge
               ON ge.id_groupes_etudiants = e.id_groupes_etudiants
             JOIN affectation_groupes ag
               ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
             JOIN affectation_cours ac
               ON ac.id_affectation_cours = ag.id_affectation_cours
             JOIN plages_horaires ph
               ON ph.id_plage_horaires = ac.id_plage_horaires
             WHERE e.id_etudiant IN (${placeholdersEtudiants})
               AND ge.id_session = ?

             UNION ALL

             SELECT ae.id_etudiant,
                    ac.id_cours,
                    DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
                    ph.heure_debut,
                    ph.heure_fin,
                    ae.id_groupes_etudiants AS id_groupe_source
             FROM affectation_etudiants ae
             JOIN affectation_groupes ag
               ON ag.id_groupes_etudiants = ae.id_groupes_etudiants
             JOIN affectation_cours ac
               ON ac.id_affectation_cours = ag.id_affectation_cours
              AND ac.id_cours = ae.id_cours
             JOIN plages_horaires ph
               ON ph.id_plage_horaires = ac.id_plage_horaires
             WHERE ae.id_etudiant IN (${placeholdersEtudiants})
               AND ae.id_session = ?
               AND ae.source_type = 'reprise'
           ) occupation
           WHERE occupation.id_groupe_source <> ?`,
          [
            ...etudiantsAContraindre,
            session.id_session,
            ...etudiantsAContraindre,
            session.id_session,
            idGroupe,
          ]
        );

        for (const occupation of occupationsEtudiants) {
          matrix.reserver(
            null,
            null,
            null,
            occupation.id_cours || 0,
            occupation.date,
            occupation.heure_debut,
            occupation.heure_fin,
            { studentIds: [occupation.id_etudiant] }
          );
        }
      }

      const chargeSeriesParProf = new Map();
      const chargeSeriesParJour = new Map();
      const chargeSeriesParGroupeJour = new Map();
      const chargeSeriesParProfJour = new Map();
      const slotsParGroupeJour = new Map();
      const slotsParProfJour = new Map();
      const preferencesStabilite = new Map(); // Pas de préférence historique → variabilité possible

      const solution = [];
      const nonPlanifies = [];

      // Trier les cours par priorité (clé en premier, moins de salles en premier)
      const coursTries = [...coursFiltres].sort((a, b) => {
        if (a.est_cours_cle !== b.est_cours_cle) return b.est_cours_cle - a.est_cours_cle;
        const sallesA = a.est_en_ligne ? 0 : salles.filter((s) => AvailabilityChecker.salleCompatible(s, a)).length;
        const sallesB = b.est_en_ligne ? 0 : salles.filter((s) => AvailabilityChecker.salleCompatible(s, b)).length;
        return sallesA - sallesB;
      });

      // Générer les séances pour le groupe
      for (const coursActuel of coursTries) {
        const sallesCompatiblesType = coursActuel.est_en_ligne
          ? [null]
          : salles
              .filter((s) => AvailabilityChecker.salleCompatible(s, coursActuel))
              .sort((a, b) => a.capacite - b.capacite);

        if (!coursActuel.est_en_ligne && sallesCompatiblesType.length === 0) {
          nonPlanifies.push({
            id_cours: coursActuel.id_cours,
            code: coursActuel.code,
            nom: coursActuel.nom,
            raison: `Aucune salle compatible pour le type "${coursActuel.type_salle}".`,
          });
          continue;
        }

        const profsCompatibles = professeurs
          .filter((p) => AvailabilityChecker.profCompatible(p, coursActuel))
          .sort((a, b) =>
            (chargeSeriesParProf.get(a.id_professeur) || 0) -
            (chargeSeriesParProf.get(b.id_professeur) || 0)
          );

        if (profsCompatibles.length === 0) {
          nonPlanifies.push({
            id_cours: coursActuel.id_cours,
            code: coursActuel.code,
            nom: coursActuel.nom,
            raison: "Aucun professeur compatible.",
          });
          continue;
        }

        const effectifGroupe = GroupFormer.lireEffectifCours(
          groupeForMoteur,
          coursActuel.id_cours
        );
        const sallesCompatibles = coursActuel.est_en_ligne
          ? [null]
          : sallesCompatiblesType
              .filter((s) => AvailabilityChecker.salleCompatible(s, coursActuel, effectifGroupe))
              .sort((a, b) => a.capacite - b.capacite);

        if (!coursActuel.est_en_ligne && sallesCompatibles.length === 0) {
          nonPlanifies.push({
            id_cours: coursActuel.id_cours,
            code: coursActuel.code,
            nom: coursActuel.nom,
            groupe: groupeForMoteur.nomGroupe,
            raison: `Aucune salle ne peut accueillir ${effectifGroupe} étudiants pour le type "${coursActuel.type_salle}".`,
          });
          continue;
        }

        const seancesParSemaine = Math.max(1, Number(coursActuel.sessions_par_semaine || 1));

        for (let n = 1; n <= seancesParSemaine; n++) {
          const serie = SchedulerEngine._trouverSerieHebdomadaire({
            cours: coursActuel,
            groupe: groupeForMoteur,
            idGroupe,
            profsCompatibles,
            sallesCompatibles,
            datesParJourSemaine,
            creneaux,
            matrix,
            dispParProf,
            absencesParProf,
            indispoParSalle,
            chargeSeriesParProf,
            chargeSeriesParJour,
            chargeSeriesParGroupeJour,
            chargeSeriesParProfJour,
            slotsParGroupeJour,
            slotsParProfJour,
            numeroSeance: n,
            preferencesStabilite,
          });

          if (serie) {
            solution.push(...serie.placements);
          } else {
            // Tentative assouplie
            const serieAssouplie = SchedulerEngine._trouverSerieAssouplie({
              cours: coursActuel,
              groupe: groupeForMoteur,
              idGroupe,
              professeurs,
              salles,
              datesParJourSemaine,
              creneaux,
              matrix,
              dispParProf,
              absencesParProf,
              indispoParSalle,
              chargeSeriesParProf,
              chargeSeriesParJour,
              chargeSeriesParGroupeJour,
              chargeSeriesParProfJour,
              slotsParGroupeJour,
              slotsParProfJour,
              effectifGroupe,
            });

            if (serieAssouplie) {
              solution.push(...serieAssouplie.placements);
            } else {
              nonPlanifies.push({
                id_cours: coursActuel.id_cours,
                code: coursActuel.code,
                nom: coursActuel.nom,
                groupe: groupeForMoteur.nomGroupe,
                seance: n,
                raison: "Aucun créneau disponible pour ce groupe dans la session.",
              });
            }
          }
        }
      }

      // Score qualité
      const qualite = SchedulerEngine._calculerScoreQualite({
        solution,
        nonPlanifies,
        nbResolutionsManuelles: 0,
        preferencesStabilite,
      });
      rapport.score_qualite = qualite.score;

      // Persister les nouvelles affectations pour ce groupe
      for (const placement of solution) {
        await connection.query(
          `INSERT IGNORE INTO plages_horaires (date, heure_debut, heure_fin) VALUES (?, ?, ?)`,
          [placement.date, placement.heure_debut, placement.heure_fin]
        );

        const [[plage]] = await connection.query(
          `SELECT id_plage_horaires FROM plages_horaires
           WHERE date = ? AND heure_debut = ? AND heure_fin = ? LIMIT 1`,
          [placement.date, placement.heure_debut, placement.heure_fin]
        );

        const [affectation] = await connection.query(
          `INSERT INTO affectation_cours (id_cours, id_professeur, id_salle, id_plage_horaires)
           VALUES (?, ?, ?, ?)`,
          [placement.id_cours, placement.id_professeur, placement.id_salle, plage.id_plage_horaires]
        );

        await connection.query(
          `INSERT IGNORE INTO affectation_groupes (id_groupes_etudiants, id_affectation_cours)
           VALUES (?, ?)`,
          [idGroupe, affectation.insertId]
        );

        rapport.affectations.push({
          ...placement,
          id_affectation_cours: affectation.insertId,
        });
      }

      rapport.nb_cours_planifies = solution.length;
      rapport.nb_cours_non_planifies = nonPlanifies.length;
      rapport.non_planifies = nonPlanifies;
      rapport.details = {
        mode: "generation_ciblee_groupe",
        nom_groupe: groupeDb.nom_groupe,
        programme: programmeGroupe,
        etape: etapeGroupe,
        session: session.nom,
        nb_etudiants: etudiants.length,
        nb_reprises_rattachees: reprisesAttachees.length,
        effectif_projete_max: GroupFormer.lireEffectifProjeteMax(groupeForMoteur),
        nb_cours_catalogue: coursFiltres.length,
        qualite,
      };

      await connection.commit();

      console.info(
        `[SchedulerEngine] genererGroupe: "${groupeDb.nom_groupe}" → ` +
        `${rapport.nb_cours_planifies} séances planifiées, ` +
        `${rapport.nb_cours_non_planifies} non planifiées.`
      );

      return rapport;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
