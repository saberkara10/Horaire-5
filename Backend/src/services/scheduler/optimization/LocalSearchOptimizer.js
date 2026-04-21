/**
 * LocalSearchOptimizer
 *
 * Ce module ameliore localement un horaire deja faisable, sans relancer une
 * generation complete et sans toucher a la persistance.
 *
 * Son role metier est de corriger de petites decisions sous-optimales apres la
 * generation principale : trop de trous, journees fragmentees ou placements
 * peu confortables pour les etudiants et les professeurs.
 *
 * Il travaille exclusivement en memoire, sur une copie de ConstraintMatrix,
 * et ne retient qu'une modification qui garde l'horaire faisable ET ameliore
 * le score global de reference.
 *
 * Dependances principales :
 * - PlacementEvaluator pour preselectionner les meilleurs mouvements locaux
 * - ScheduleScorer pour valider les gains globaux
 * - AvailabilityChecker pour revalider les disponibilites au moment du mouvement
 * - GroupFormer pour retrouver les etudiants d'un cours dans un groupe
 */

import {
  ACADEMIC_WEEKDAY_ORDER,
  ACADEMIC_WEEKDAY_TIME_SLOTS,
} from "../AcademicCatalog.js";
import { AvailabilityChecker } from "../AvailabilityChecker.js";
import { BreakConstraintValidator } from "../constraints/BreakConstraintValidator.js";
import { ResourceDayPlacementIndex } from "../constraints/ResourceDayPlacementIndex.js";
import { GroupFormer } from "../GroupFormer.js";
import { ScheduleScorer } from "../scoring/ScheduleScorer.js";
import {
  buildStartTimeCandidates,
  getCandidateMetadataForTimeRange,
} from "../time/StartTimeCandidates.js";
import { PlacementEvaluator } from "./PlacementEvaluator.js";

const DEFAULT_MAX_IMPROVEMENTS = 4;
const DEFAULT_MAX_CANDIDATES_PER_SERIES = 3;

/**
 * Trie des placements pour garder un ordre stable.
 *
 * @param {Object} left - placement de gauche.
 * @param {Object} right - placement de droite.
 *
 * @returns {number} Ordre de tri.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : compare aussi salle et professeur pour stabiliser le tri.
 */
function comparePlacements(left, right) {
  return (
    String(left?.date || "").localeCompare(String(right?.date || ""), "fr") ||
    String(left?.heure_debut || "").localeCompare(String(right?.heure_debut || ""), "fr") ||
    String(left?.heure_fin || "").localeCompare(String(right?.heure_fin || ""), "fr") ||
    Number(left?.id_professeur || 0) - Number(right?.id_professeur || 0) ||
    Number(left?.id_salle || 0) - Number(right?.id_salle || 0)
  );
}

/**
 * Construit une cle stable de placement.
 *
 * @param {Object} placement - placement a identifier.
 *
 * @returns {string} Cle stable.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : la cle repose sur le contenu du placement et non sur la DB.
 */
function buildPlacementKey(placement) {
  return [
    placement?.id_cours || "",
    placement?.id_groupe || placement?.nom_groupe || "",
    placement?.id_professeur || "",
    placement?.id_salle || "",
    placement?.date || "",
    placement?.heure_debut || "",
    placement?.heure_fin || "",
  ].join("|");
}

/**
 * Construit l'index semaine -> jour -> date.
 *
 * @param {Map<number, string[]>} datesParJourSemaine - index des jours par semaine.
 *
 * @returns {Map<string, string>} Index par semaine et jour.
 *
 * Effets secondaires : aucun.
 * Cas particuliers : seules les dates presentes dans la session sont indexees.
 */
function buildWeekdayDateLookup(datesParJourSemaine) {
  const lookup = new Map();

  for (const [weekday, dates] of datesParJourSemaine?.entries?.() || []) {
    for (const date of dates || []) {
      const weekKey = LocalSearchOptimizer.resolveWeekKey(date);
      lookup.set(`${weekKey}|${weekday}`, String(date));
    }
  }

  return lookup;
}

/**
 * Incremente une charge par jour pour une entite.
 *
 * @param {Map<string, Map<number, number>>} index - index cible.
 * @param {number|string} entityId - identite de l'entite.
 * @param {number} weekday - jour ISO.
 *
 * @returns {void}
 *
 * Effets secondaires : incremente la charge du jour.
 * Cas particuliers : cree les Maps manquantes.
 */
function incrementDayLoad(index, entityId, weekday) {
  const entityKey = String(entityId);
  if (!index.has(entityKey)) {
    index.set(entityKey, new Map());
  }

  const loadsByDay = index.get(entityKey);
  loadsByDay.set(weekday, (loadsByDay.get(weekday) || 0) + 1);
}

/**
 * Memorise un slot dans un index groupe/professeur -> jour -> slots.
 *
 * @param {Map<string, Map<number, Set<number>>>} index - index cible.
 * @param {number|string} entityId - entite concernee.
 * @param {number} weekday - jour ISO.
 * @param {number} slotIndex - slot a memoriser.
 *
 * @returns {void}
 *
 * Effets secondaires : ajoute le slot au Set.
 * Cas particuliers : ignore les slots invalides.
 */
function rememberDaySlot(index, entityId, weekday, slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    return;
  }

  const entityKey = String(entityId);
  if (!index.has(entityKey)) {
    index.set(entityKey, new Map());
  }

  const slotsByDay = index.get(entityKey);
  if (!slotsByDay.has(weekday)) {
    slotsByDay.set(weekday, new Set());
  }

  slotsByDay.get(weekday).add(slotIndex);
}

function rememberDaySession(index, entityId, weekday, sessionWindow) {
  if (!sessionWindow || !Number.isInteger(Number(sessionWindow.slotStartIndex))) {
    return;
  }

  const entityKey = String(entityId);
  if (!index.has(entityKey)) {
    index.set(entityKey, new Map());
  }

  const sessionsByDay = index.get(entityKey);
  if (!sessionsByDay.has(weekday)) {
    sessionsByDay.set(weekday, []);
  }

  sessionsByDay.get(weekday).push({
    slotStartIndex: Number(sessionWindow.slotStartIndex),
    slotEndIndex: Number(sessionWindow.slotEndIndex),
    dureeHeures: Number(sessionWindow.dureeHeures || 0),
    heure_debut: sessionWindow.heure_debut || null,
    heure_fin: sessionWindow.heure_fin || null,
  });
}

export class LocalSearchOptimizer {
  /**
   * Optimise localement un horaire deja genere.
   *
   * @param {Object} options - options d'optimisation.
   * @param {Object[]} options.placements - horaire courant.
   * @param {Object[]} options.groupesFormes - groupes moteurs.
   * @param {Map<number, string[]>} options.affectationsEtudiantGroupe - affectations etudiants.
   * @param {Object[]} options.affectationsReprises - reprises rattachees.
   * @param {Object[]} options.salles - salles disponibles.
   * @param {Map<number, string[]>} options.datesParJourSemaine - dates de la session par jour ISO.
   * @param {Object} options.matrix - matrice de contraintes courante.
   * @param {Map<number, Object[]>} options.dispParProf - disponibilites professeurs.
   * @param {Map<number, Object[]>} options.absencesParProf - absences professeurs.
   * @param {Map<number, Object[]>} options.indispoParSalle - indisponibilites salles.
   * @param {string} [options.optimizationMode="legacy"] - mode d'optimisation.
   *
   * @returns {Object} Resultat d'optimisation locale.
   *
   * Effets secondaires : aucun sur la matrice ou les placements d'origine.
   * Cas particuliers :
   * - legacy retourne un no-op pour limiter les regressions
   * - seules de petites modifications de series sont tentees
   */
  static optimize({
    placements,
    cours,
    groupesFormes,
    affectationsEtudiantGroupe,
    affectationsReprises,
    salles,
    datesParJourSemaine,
    matrix,
    dispParProf,
    absencesParProf,
    indispoParSalle,
    optimizationMode = "legacy",
    maxImprovements = DEFAULT_MAX_IMPROVEMENTS,
    maxCandidatesPerSeries = DEFAULT_MAX_CANDIDATES_PER_SERIES,
  }) {
    const normalizedMode = PlacementEvaluator.normalizeMode(optimizationMode);
    const scoringMode = PlacementEvaluator.resolveScoringMode(normalizedMode);
    const initialPlacements = [...(Array.isArray(placements) ? placements : [])].sort(
      comparePlacements
    );
    const scorePayload = LocalSearchOptimizer.buildScorePayload({
      placements: initialPlacements,
      affectationsEtudiantGroupe,
      affectationsReprises,
    });
    const scoringBefore = ScheduleScorer.scoreAllModes(scorePayload);

    if (
      normalizedMode === "legacy" ||
      initialPlacements.length === 0 ||
      typeof matrix?.clone !== "function"
    ) {
      return {
        placementsOptimises: initialPlacements,
        scoringBefore,
        scoringAfter: scoringBefore,
        improvements: [],
        improvementsRetained: 0,
        gains: LocalSearchOptimizer.summarizeGains(
          scoringBefore,
          scoringBefore,
          scoringMode
        ),
      };
    }

    const workingMatrix = matrix.clone();
    const courseIndex = LocalSearchOptimizer.buildCourseIndex(cours);
    const groupIndex = LocalSearchOptimizer.buildGroupIndex(groupesFormes);
    const weekdayDateLookup = buildWeekdayDateLookup(datesParJourSemaine);
    let workingPlacements = [...initialPlacements];
    let currentScore = ScheduleScorer.scoreSchedule(scorePayload, scoringMode);
    const acceptedImprovements = [];

    for (let iteration = 0; iteration < maxImprovements; iteration += 1) {
      const seriesList = LocalSearchOptimizer.reconstructSeries(workingPlacements);
      let acceptedImprovement = null;

      for (const series of seriesList) {
        const currentSeriesImprovement = LocalSearchOptimizer.tryImproveSeries({
          series,
          allSeries: seriesList,
          workingPlacements,
          workingMatrix,
          courseIndex,
          groupIndex,
          salles,
          weekdayDateLookup,
          dispParProf,
          absencesParProf,
          indispoParSalle,
          optimizationMode: normalizedMode,
          affectationsEtudiantGroupe,
          affectationsReprises,
          currentScore,
          maxCandidatesPerSeries,
        });

        if (currentSeriesImprovement) {
          acceptedImprovement = currentSeriesImprovement;
          break;
        }
      }

      if (!acceptedImprovement) {
        break;
      }

      workingPlacements = acceptedImprovement.placements;
      currentScore = acceptedImprovement.score;
      acceptedImprovements.push(acceptedImprovement.metadata);
    }

    const scoringAfter = ScheduleScorer.scoreAllModes(
      LocalSearchOptimizer.buildScorePayload({
        placements: workingPlacements,
        affectationsEtudiantGroupe,
        affectationsReprises,
      })
    );

    return {
      placementsOptimises: workingPlacements,
      scoringBefore,
      scoringAfter,
      improvements: acceptedImprovements,
      improvementsRetained: acceptedImprovements.length,
      gains: LocalSearchOptimizer.summarizeGains(
        scoringBefore,
        scoringAfter,
        scoringMode
      ),
    };
  }

  /**
   * Reconstruit des series transitoires a partir des placements.
   *
   * @param {Object[]} placements - placements actuels.
   *
   * @returns {Object[]} Series reconstruites.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - groupe par cours, groupe, professeur, jour et horaire
   * - ignore les placements incomplets
   */
  static reconstructSeries(placements) {
    const index = new Map();

    for (const placement of Array.isArray(placements) ? placements : []) {
      const weekday = LocalSearchOptimizer.resolveWeekday(placement.date);
      const timeMetadata = LocalSearchOptimizer.resolveSlotMetadata(
        placement.heure_debut,
        placement.heure_fin
      );
      if (!timeMetadata) {
        continue;
      }
      const seriesKey = [
        placement.id_cours,
        placement.id_groupe,
        placement.id_professeur,
        weekday,
        placement.heure_debut,
        placement.heure_fin,
      ].join("|");

      if (!index.has(seriesKey)) {
        index.set(seriesKey, {
          key: seriesKey,
          id_cours: Number(placement.id_cours),
          id_groupe: Number(placement.id_groupe),
          nom_groupe: placement.nom_groupe || null,
          id_professeur: Number(placement.id_professeur),
          nom_professeur: placement.nom_professeur || null,
          jourSemaine: weekday,
          creneau: {
            debut: placement.heure_debut,
            fin: placement.heure_fin,
          },
          slotIndex: timeMetadata.slotStartIndex,
          slotStartIndex: timeMetadata.slotStartIndex,
          slotEndIndex: timeMetadata.slotEndIndex,
          dureeHeures: timeMetadata.dureeHeures,
          est_en_ligne: Boolean(placement.est_en_ligne),
          est_cours_cle: Boolean(placement.est_cours_cle),
          verrouille_optimisation_locale: Boolean(placement.verrouille_optimisation_locale),
          code_cours: placement.code_cours || null,
          nom_cours: placement.nom_cours || null,
          placements: [],
        });
      }

      index.get(seriesKey).placements.push(placement);
      if (Boolean(placement.verrouille_optimisation_locale)) {
        index.get(seriesKey).verrouille_optimisation_locale = true;
      }
    }

    return [...index.values()]
      .map((series) => ({
        ...series,
        placements: [...series.placements].sort(comparePlacements),
        roomIds: [
          ...new Set(
            series.placements
              .map((placement) => Number(placement.id_salle || 0))
              .filter((roomId) => Number.isInteger(roomId) && roomId > 0)
          ),
        ],
      }))
      .sort((left, right) => left.key.localeCompare(right.key, "fr"));
  }

  /**
   * Tente d'ameliorer une serie precise.
   *
   * @param {Object} options - contexte complet.
   *
   * @returns {Object|null} Amelioration retenue ou null.
   *
   * Effets secondaires :
   * - libere temporairement la serie dans la matrice de travail
   * - re-reserve la serie d'origine si aucune amelioration n'est retenue
   *
   * Cas particuliers :
   * - ignore les series trop instables (slots inconnus ou salles incoherentes)
   * - ne retient qu'une amelioration strictement meilleure
   */
  static tryImproveSeries({
    series,
    allSeries,
    workingPlacements,
    workingMatrix,
    courseIndex,
    groupIndex,
    salles,
    weekdayDateLookup,
    dispParProf,
    absencesParProf,
    indispoParSalle,
    optimizationMode,
    affectationsEtudiantGroupe,
    affectationsReprises,
    currentScore,
    maxCandidatesPerSeries,
  }) {
    if (Boolean(series?.verrouille_optimisation_locale)) {
      return null;
    }

    if (!Number.isInteger(series.slotStartIndex) || series.slotStartIndex < 0) {
      return null;
    }

    const group = groupIndex.get(String(series.id_groupe));
    if (!group) {
      return null;
    }
    const courseInfo = courseIndex.get(Number(series.id_cours));
    if (!courseInfo) {
      return null;
    }

    const studentIds = LocalSearchOptimizer.getStudentIdsForCourse(group, series.id_cours);
    const originalSeries = {
      ...series,
      ...courseInfo,
      groupe: group,
      professeur: {
        id_professeur: series.id_professeur,
        nom: series.nom_professeur || "",
      },
    };

    LocalSearchOptimizer.releaseSeries(workingMatrix, originalSeries, studentIds);

    const remainingSeries = allSeries.filter((currentSeries) => currentSeries.key !== series.key);
    const evaluationContext = LocalSearchOptimizer.buildEvaluationContext(remainingSeries);
    const resourcePlacementIndex = LocalSearchOptimizer.buildResourcePlacementIndex({
      seriesList: remainingSeries,
      groupIndex,
    });
    const rawCandidates = LocalSearchOptimizer.enumerateCandidates({
      series: originalSeries,
      group,
      salles,
      weekdayDateLookup,
      workingMatrix,
      studentIds,
      resourcePlacementIndex,
      dispParProf,
      absencesParProf,
      indispoParSalle,
    });
    const rankedCandidates = PlacementEvaluator.rankCandidates({
      mode: optimizationMode,
      phase: "weekly",
      candidates: rawCandidates,
      context: evaluationContext,
    }).slice(0, Math.max(1, Number(maxCandidatesPerSeries || 0)));

    let bestAcceptedCandidate = null;

    for (const rankedCandidate of rankedCandidates) {
      const nextPlacements = LocalSearchOptimizer.replaceSeriesPlacements(
        workingPlacements,
        originalSeries,
        rankedCandidate.candidate.placements
      );
      const nextScore = ScheduleScorer.scoreSchedule(
        LocalSearchOptimizer.buildScorePayload({
          placements: nextPlacements,
          affectationsEtudiantGroupe,
          affectationsReprises,
        }),
        PlacementEvaluator.resolveScoringMode(optimizationMode)
      );

      if (nextScore.scoreGlobal <= currentScore.scoreGlobal) {
        continue;
      }

      if (
        !bestAcceptedCandidate ||
        nextScore.scoreGlobal > bestAcceptedCandidate.score.scoreGlobal
      ) {
        bestAcceptedCandidate = {
          candidate: rankedCandidate.candidate,
          score: nextScore,
          placements: nextPlacements,
        };
      }
    }

    if (!bestAcceptedCandidate) {
      LocalSearchOptimizer.reserveSeries(workingMatrix, originalSeries, studentIds);
      return null;
    }

    const acceptedSeries = LocalSearchOptimizer.reconstructSeries(
      bestAcceptedCandidate.candidate.placements
    )[0];
    LocalSearchOptimizer.reserveSeries(workingMatrix, acceptedSeries, studentIds);

    return {
      placements: bestAcceptedCandidate.placements,
      score: bestAcceptedCandidate.score,
      metadata: {
        idCours: series.id_cours,
        idGroupe: series.id_groupe,
        from: {
          jourSemaine: series.jourSemaine,
          heureDebut: series.creneau.debut,
          heureFin: series.creneau.fin,
        },
        to: {
          jourSemaine: bestAcceptedCandidate.candidate.jourSemaine,
          heureDebut: bestAcceptedCandidate.candidate.creneau.debut,
          heureFin: bestAcceptedCandidate.candidate.creneau.fin,
        },
        deltaScoreGlobal: Number(
          (
            bestAcceptedCandidate.score.scoreGlobal - currentScore.scoreGlobal
          ).toFixed(2)
        ),
      },
    };
  }

  /**
   * Enumere de petits mouvements locaux faisables pour une serie.
   *
   * @param {Object} options - contexte de la serie.
   *
   * @returns {Object[]} Candidats faisables.
   *
   * Effets secondaires : aucun.
   * Cas particuliers :
   * - ne change pas le professeur
   * - conserve le nombre d'occurrences de la serie
   * - saute les mouvements sans salle stable en presentiel
   */
  static enumerateCandidates({
    series,
    group,
    salles,
    weekdayDateLookup,
    workingMatrix,
    studentIds,
    resourcePlacementIndex,
    dispParProf,
    absencesParProf,
    indispoParSalle,
  }) {
    const candidates = [];
    const weekKeys = series.placements.map((placement) =>
      LocalSearchOptimizer.resolveWeekKey(placement.date)
    );
    const compatibleRooms = series.est_en_ligne
      ? [null]
      : [...(Array.isArray(salles) ? salles : [])]
          .filter((room) =>
            AvailabilityChecker.salleCompatible(
              room,
              series,
              GroupFormer.lireEffectifCours(group, series.id_cours)
            )
          )
          .sort(
            (left, right) => Number(left.capacite || 0) - Number(right.capacite || 0)
          );

    for (const targetWeekday of ACADEMIC_WEEKDAY_ORDER) {
      const targetDates = weekKeys.map((weekKey) =>
        weekdayDateLookup.get(`${weekKey}|${targetWeekday}`)
      );
      if (targetDates.some((date) => !date)) {
        continue;
      }

      const timeCandidates = buildStartTimeCandidates(series.dureeHeures || 1);

      for (const [candidateIndex, timeWindow] of timeCandidates.entries()) {
        if (
          targetWeekday === series.jourSemaine &&
          String(timeWindow.heure_debut) === String(series.creneau.debut) &&
          String(timeWindow.heure_fin) === String(series.creneau.fin)
        ) {
          continue;
        }

        if (series.est_en_ligne) {
          const placements = LocalSearchOptimizer.buildCandidatePlacements({
            series,
            targetDates,
            targetWeekday,
            timeWindow,
            room: null,
          });

          if (
            LocalSearchOptimizer.isCandidateFeasible({
              series,
              placements,
              room: null,
              workingMatrix,
              studentIds,
              resourcePlacementIndex,
              dispParProf,
              absencesParProf,
              indispoParSalle,
            })
          ) {
            candidates.push({
              ...series,
              groupe: group,
              professeur: { id_professeur: series.id_professeur },
              salle: null,
              idGroupe: series.id_groupe,
              jourSemaine: targetWeekday,
              creneau: {
                debut: timeWindow.heure_debut,
                fin: timeWindow.heure_fin,
              },
              slotIndex: timeWindow.slotStartIndex,
              slotStartIndex: timeWindow.slotStartIndex,
              slotEndIndex: timeWindow.slotEndIndex,
              dureeHeures: timeWindow.dureeHeures,
              indexStrategie: targetWeekday === series.jourSemaine ? 0 : 1,
              indexProfesseur: 0,
              indexCreneau: candidateIndex,
              indexSalle: 0,
              coverageRatio: 1,
              roomCoverageRatio: 0,
              placements,
            });
          }

          continue;
        }

        for (const [roomIndex, room] of compatibleRooms.entries()) {
          const placements = LocalSearchOptimizer.buildCandidatePlacements({
            series,
            targetDates,
            targetWeekday,
            timeWindow,
            room,
          });

          if (
            !LocalSearchOptimizer.isCandidateFeasible({
              series,
              placements,
              room,
              workingMatrix,
              studentIds,
              resourcePlacementIndex,
              dispParProf,
              absencesParProf,
              indispoParSalle,
            })
          ) {
            continue;
          }

          candidates.push({
            ...series,
            groupe: group,
            professeur: { id_professeur: series.id_professeur },
            salle: room,
            idGroupe: series.id_groupe,
            jourSemaine: targetWeekday,
            creneau: {
              debut: timeWindow.heure_debut,
              fin: timeWindow.heure_fin,
            },
            slotIndex: timeWindow.slotStartIndex,
            slotStartIndex: timeWindow.slotStartIndex,
            slotEndIndex: timeWindow.slotEndIndex,
            dureeHeures: timeWindow.dureeHeures,
            indexStrategie: targetWeekday === series.jourSemaine ? 0 : 1,
            indexProfesseur: 0,
            indexCreneau: candidateIndex,
            indexSalle: roomIndex,
            coverageRatio: 1,
            roomCoverageRatio: 1,
            placements,
          });

          if (roomIndex >= 1) {
            break;
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Verifie qu'un candidat reste faisable une fois la serie liberee.
   *
   * @param {Object} options - candidat et contexte de verification.
   *
   * @returns {boolean} True si le candidat est faisable.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : verifie a la fois matrice, disponibilites et salles.
   */
  static isCandidateFeasible({
    series,
    placements,
    room,
    workingMatrix,
    studentIds,
    resourcePlacementIndex,
    dispParProf,
    absencesParProf,
    indispoParSalle,
  }) {
    if (
      !LocalSearchOptimizer.respectsBreakConstraints({
        series,
        placements,
        studentIds,
        resourcePlacementIndex,
      })
    ) {
      return false;
    }

    return placements.every((placement) => {
      if (
        !workingMatrix.profLibre(
          series.id_professeur,
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        )
      ) {
        return false;
      }

      if (
        !AvailabilityChecker.profDisponible(
          series.id_professeur,
          placement.date,
          placement.heure_debut,
          placement.heure_fin,
          dispParProf,
          absencesParProf
        )
      ) {
        return false;
      }

      if (
        !workingMatrix.groupeLibre(
          series.id_groupe,
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        )
      ) {
        return false;
      }

      if (
        !workingMatrix.etudiantsLibres(
          studentIds,
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        )
      ) {
        return false;
      }

      if (room === null) {
        return true;
      }

      return (
        workingMatrix.salleLibre(
          room.id_salle,
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        ) &&
        AvailabilityChecker.salleDisponible(room.id_salle, placement.date, indispoParSalle)
      );
    });
  }

  /**
   * Produit des placements candidats a partir d'une serie et d'une destination.
   *
   * @param {Object} options - serie source et destination.
   *
   * @returns {Object[]} Placements candidats.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : le nombre d'occurrences est conserve.
   */
  static buildCandidatePlacements({ series, targetDates, targetWeekday, timeWindow, room }) {
    return [...targetDates]
      .sort((left, right) => String(left).localeCompare(String(right), "fr"))
      .map((date) => ({
        ...series.placements[0],
        date,
        heure_debut: timeWindow.heure_debut,
        heure_fin: timeWindow.heure_fin,
        id_salle: room ? room.id_salle : null,
        code_salle: room ? room.code : "EN LIGNE",
        est_en_ligne: room ? false : Boolean(series.est_en_ligne),
        jour_semaine: targetWeekday,
        slotStartIndex: timeWindow.slotStartIndex,
        slotEndIndex: timeWindow.slotEndIndex,
        dureeHeures: timeWindow.dureeHeures,
      }));
  }

  /**
   * Construit le payload partage avec scoring_v1.
   *
   * @param {Object} options - placements et affectations.
   *
   * @returns {Object} Payload de scoring.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : laisse scoring_v1 gerer les details des reprises.
   */
  static buildScorePayload({ placements, affectationsEtudiantGroupe, affectationsReprises }) {
    return {
      placements: [...(Array.isArray(placements) ? placements : [])].sort(comparePlacements),
      affectationsEtudiantGroupe,
      affectationsReprises,
    };
  }

  /**
   * Remplace une serie par une autre dans une solution.
   *
   * @param {Object[]} placements - solution courante.
   * @param {Object} sourceSeries - serie d'origine.
   * @param {Object[]} candidatePlacements - nouvelle serie.
   *
   * @returns {Object[]} Nouvelle solution.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : se base sur les cles de placements pour eviter une
   * dependance a des identifiants de serie persistants.
   */
  static replaceSeriesPlacements(placements, sourceSeries, candidatePlacements) {
    const sourceKeys = new Set(
      sourceSeries.placements.map((placement) => buildPlacementKey(placement))
    );

    return [
      ...(Array.isArray(placements) ? placements : []).filter(
        (placement) => !sourceKeys.has(buildPlacementKey(placement))
      ),
      ...(Array.isArray(candidatePlacements) ? candidatePlacements : []),
    ].sort(comparePlacements);
  }

  /**
   * Construit les index de charge attendus par PlacementEvaluator.
   *
   * @param {Object[]} seriesList - series restantes.
   *
   * @returns {Object} Context d'evaluation locale.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : les index sont bases sur des series et non sur les
   * occurrences individuelles, comme pendant la generation principale.
   */
  static buildEvaluationContext(seriesList) {
    const chargeSeriesParJour = new Map();
    const chargeSeriesParGroupeJour = new Map();
    const chargeSeriesParProfJour = new Map();
    const slotsParGroupeJour = new Map();
    const slotsParProfJour = new Map();
    const sessionsParGroupeJour = new Map();
    const sessionsParProfJour = new Map();

    for (const series of Array.isArray(seriesList) ? seriesList : []) {
      chargeSeriesParJour.set(
        series.jourSemaine,
        (chargeSeriesParJour.get(series.jourSemaine) || 0) + 1
      );
      incrementDayLoad(chargeSeriesParGroupeJour, series.id_groupe, series.jourSemaine);
      incrementDayLoad(chargeSeriesParProfJour, series.id_professeur, series.jourSemaine);
      rememberDaySlot(
        slotsParGroupeJour,
        series.id_groupe,
        series.jourSemaine,
        series.slotStartIndex
      );
      rememberDaySlot(
        slotsParProfJour,
        series.id_professeur,
        series.jourSemaine,
        series.slotStartIndex
      );
      rememberDaySession(sessionsParGroupeJour, series.id_groupe, series.jourSemaine, series);
      rememberDaySession(
        sessionsParProfJour,
        series.id_professeur,
        series.jourSemaine,
        series
      );
    }

    return {
      chargeSeriesParJour,
      chargeSeriesParGroupeJour,
      chargeSeriesParProfJour,
      slotsParGroupeJour,
      slotsParProfJour,
      sessionsParGroupeJour,
      sessionsParProfJour,
    };
  }

  static buildResourcePlacementIndex({ seriesList, groupIndex }) {
    const index = new ResourceDayPlacementIndex();

    for (const series of Array.isArray(seriesList) ? seriesList : []) {
      const group = groupIndex.get(String(series.id_groupe));
      const studentIds = group
        ? LocalSearchOptimizer.getStudentIdsForCourse(group, series.id_cours)
        : [];

      for (const placement of Array.isArray(series.placements) ? series.placements : []) {
        index.add({
          resourceType: "professeur",
          resourceId: series.id_professeur,
          date: placement.date,
          placement,
        });
        index.add({
          resourceType: "groupe",
          resourceId: series.id_groupe,
          date: placement.date,
          placement,
        });

        for (const studentId of studentIds) {
          index.add({
            resourceType: "etudiant",
            resourceId: studentId,
            date: placement.date,
            placement,
          });
        }
      }
    }

    return index;
  }

  /**
   * Construit un index de cours par identifiant.
   *
   * @param {Object[]} courses - catalogue disponible.
   *
   * @returns {Map<number, Object>} Index des cours.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : ignore les cours sans identifiant exploitable.
   */
  static buildCourseIndex(courses) {
    return new Map(
      [...(Array.isArray(courses) ? courses : [])]
        .map((course) => [Number(course.id_cours), course])
        .filter(([courseId]) => Number.isInteger(courseId) && courseId > 0)
    );
  }

  /**
   * Construit un index de groupes moteur par identifiant.
   *
   * @param {Object[]} groupesFormes - groupes connus.
   *
   * @returns {Map<string, Object>} Index des groupes.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : ignore les groupes sans identifiant resolvable.
   */
  static buildGroupIndex(groupesFormes) {
    return new Map(
      [...(Array.isArray(groupesFormes) ? groupesFormes : [])]
        .map((group) => [
          String(group.id_groupe || group.id_groupes_etudiants || group.idGroupe || ""),
          group,
        ])
        .filter(([groupKey]) => groupKey !== "")
    );
  }

  /**
   * Lit les etudiants d'un cours dans un groupe.
   *
   * @param {Object} group - groupe moteur.
   * @param {number} courseId - cours cible.
   *
   * @returns {number[]} Liste des etudiants a proteger.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : fusionne regulier + reprises reservees du cours.
   */
  static getStudentIdsForCourse(group, courseId) {
    const regularStudentIds = Array.isArray(group?.etudiants)
      ? group.etudiants
          .map((studentId) => Number(studentId))
          .filter((studentId) => Number.isInteger(studentId) && studentId > 0)
      : [];
    const recoveryStudentIds = Array.isArray(group?.etudiants_par_cours?.[String(courseId)])
      ? group.etudiants_par_cours[String(courseId)]
          .map((studentId) => Number(studentId))
          .filter((studentId) => Number.isInteger(studentId) && studentId > 0)
      : [];

    return [...new Set([...regularStudentIds, ...recoveryStudentIds])];
  }

  static respectsBreakConstraints({
    series,
    placements,
    studentIds,
    resourcePlacementIndex,
  }) {
    if (!(resourcePlacementIndex instanceof ResourceDayPlacementIndex)) {
      return true;
    }

    const resources = [
      {
        resourceType: "professeur",
        resourceId: series.id_professeur,
      },
      {
        resourceType: "groupe",
        resourceId: series.id_groupe,
      },
      ...[...(Array.isArray(studentIds) ? studentIds : [])].map((studentId) => ({
        resourceType: "etudiant",
        resourceId: studentId,
      })),
    ].filter(
      (resource) =>
        Number.isInteger(Number(resource.resourceId)) &&
        Number(resource.resourceId) > 0
    );

    return (Array.isArray(placements) ? placements : []).every((placement) =>
      resources.every((resource) =>
        BreakConstraintValidator.validateSequenceBreakConstraint({
          placements: resourcePlacementIndex.get({
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            date: placement.date,
          }),
          proposedPlacement: placement,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
        }).valid
      )
    );
  }

  /**
   * Reserve une serie dans une matrice de travail.
   *
   * @param {Object} matrix - matrice de travail.
   * @param {Object} series - serie a reserver.
   * @param {number[]} studentIds - etudiants lies a la serie.
   *
   * @returns {void}
   *
   * Effets secondaires : reserve chaque occurrence de la serie.
   * Cas particuliers : conserve le cours et la salle d'origine de chaque occurrence.
   */
  static reserveSeries(matrix, series, studentIds) {
    for (const placement of series.placements) {
      matrix.reserver(
        placement.id_salle,
        placement.id_professeur,
        placement.id_groupe,
        placement.id_cours,
        placement.date,
        placement.heure_debut,
        placement.heure_fin,
        { studentIds }
      );
    }
  }

  /**
   * Libere une serie dans une matrice de travail.
   *
   * @param {Object} matrix - matrice de travail.
   * @param {Object} series - serie a liberer.
   * @param {number[]} studentIds - etudiants lies a la serie.
   *
   * @returns {void}
   *
   * Effets secondaires : libere chaque occurrence de la serie.
   * Cas particuliers : la liberation n'efface pas les reservations d'autres series.
   */
  static releaseSeries(matrix, series, studentIds) {
    for (const placement of series.placements) {
      matrix.liberer(
        placement.id_salle,
        placement.id_professeur,
        placement.id_groupe,
        placement.date,
        placement.heure_debut,
        placement.heure_fin,
        placement.id_cours,
        { studentIds }
      );
    }
  }

  /**
   * Resume les gains obtenus entre deux etats de scoring_v1.
   *
   * @param {Object} scoringBefore - scoring initial.
   * @param {Object} scoringAfter - scoring final.
   * @param {string} scoringMode - mode scoring de reference.
   *
   * @returns {Object} Gains principaux.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : legacy utilise equilibre comme reference de rapport.
   */
  static summarizeGains(scoringBefore, scoringAfter, scoringMode) {
    const beforeMode = scoringBefore?.modes?.[scoringMode] || {};
    const afterMode = scoringAfter?.modes?.[scoringMode] || {};
    const beforeStudent = scoringBefore?.details?.etudiant || {};
    const afterStudent = scoringAfter?.details?.etudiant || {};
    const beforeTeacher = scoringBefore?.details?.professeur || {};
    const afterTeacher = scoringAfter?.details?.professeur || {};

    return {
      scoreGlobalDelta: Number(
        (Number(afterMode.scoreGlobal || 0) - Number(beforeMode.scoreGlobal || 0)).toFixed(2)
      ),
      scoreEtudiantDelta: Number(
        (Number(afterMode.scoreEtudiant || 0) - Number(beforeMode.scoreEtudiant || 0)).toFixed(2)
      ),
      scoreProfesseurDelta: Number(
        (Number(afterMode.scoreProfesseur || 0) - Number(beforeMode.scoreProfesseur || 0)).toFixed(2)
      ),
      reductionTrousEtudiantsHeures: Number(
        (
          Number(beforeStudent?.totals?.holeHours || 0) -
          Number(afterStudent?.totals?.holeHours || 0)
        ).toFixed(2)
      ),
      reductionFragmentationEtudiante:
        Number(beforeStudent?.totals?.fragmentedDays || 0) -
        Number(afterStudent?.totals?.fragmentedDays || 0),
      reductionTrousProfesseursHeures: Number(
        (
          Number(beforeTeacher?.totals?.holeHours || 0) -
          Number(afterTeacher?.totals?.holeHours || 0)
        ).toFixed(2)
      ),
      reductionFragmentationProfesseurs:
        Number(beforeTeacher?.totals?.fragmentedDays || 0) -
        Number(afterTeacher?.totals?.fragmentedDays || 0),
      reductionLonguesAmplitudesProfesseurs:
        Number(beforeTeacher?.totals?.longAmplitudeDays || 0) -
        Number(afterTeacher?.totals?.longAmplitudeDays || 0),
    };
  }

  /**
   * Calcule le jour ISO d'une date.
   *
   * @param {string|Date} dateValue - date source.
   *
   * @returns {number} Jour ISO.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : dimanche devient 7.
   */
  static resolveWeekday(dateValue) {
    const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
    const weekday = date.getDay();
    return weekday === 0 ? 7 : weekday;
  }

  /**
   * Calcule la cle de semaine ISO simplifiee.
   *
   * @param {string|Date} dateValue - date source.
   *
   * @returns {string} Date du lundi de la semaine.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : format YYYY-MM-DD.
   */
  static resolveWeekKey(dateValue) {
    const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
    const weekday = date.getDay() === 0 ? 7 : date.getDay();
    date.setDate(date.getDate() - (weekday - 1));
    return date.toISOString().slice(0, 10);
  }

  /**
   * Retrouve l'index du slot de reference.
   *
   * @param {string} startTime - heure de debut.
   * @param {string} endTime - heure de fin.
   *
   * @returns {number} Index du slot ou -1.
   *
   * Effets secondaires : aucun.
   * Cas particuliers : retourne -1 si l'horaire sort du catalogue auto.
   */
  static resolveSlotMetadata(startTime, endTime) {
    const metadata = getCandidateMetadataForTimeRange(startTime, endTime);
    if (metadata) {
      return metadata;
    }

    const slotIndex = ACADEMIC_WEEKDAY_TIME_SLOTS.findIndex(
      (slot) => slot.debut === startTime && slot.fin === endTime
    );

    if (slotIndex < 0) {
      return null;
    }

    return {
      slotStartIndex: slotIndex,
      slotEndIndex: slotIndex + 1,
      dureeHeures: 1,
    };
  }

  static resolveSlotIndex(startTime, endTime) {
    return LocalSearchOptimizer.resolveSlotMetadata(startTime, endTime)?.slotStartIndex ?? -1;
  }
}
