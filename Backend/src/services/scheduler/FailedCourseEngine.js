import {
  getFailedCourseRecoveryGroupThreshold,
  getSchedulerMaxGroupsPerProfessor,
  getSchedulerMaxWeeklySessionsPerProfessor,
  isOnlineCourseSchedulingEnabled,
  resolveOperationalCourseCapacity,
} from "./SchedulerConfig.js";
import { AvailabilityChecker } from "./AvailabilityChecker.js";
import { ACADEMIC_WEEKDAY_ORDER } from "./AcademicCatalog.js";
import { BreakConstraintValidator } from "./constraints/BreakConstraintValidator.js";
import { ResourceDayPlacementIndex } from "./constraints/ResourceDayPlacementIndex.js";
import { GroupFormer } from "./GroupFormer.js";
import { buildCourseTimeCandidates } from "./optimization/CandidatePrecomputer.js";

const FAILED_COURSE_LOG_PREFIX = "[FailedCourseEngine]";
const LOCAL_SAFE_REORG_MAX_STUDENTS = 1;
const LAST_RESORT_MAX_REGULAR_COURSE_MOVES = 3;
const LAST_RESORT_MAX_TARGET_SECTIONS_PER_COURSE = 3;
const LAST_RESORT_MAX_SOURCE_COURSES = 6;
const LAST_RESORT_MAX_COMBINATIONS = 180;

function normaliserTexte(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function comparerDatesHeures(placementA, placementB) {
  const dateA = String(placementA?.date || "");
  const dateB = String(placementB?.date || "");
  if (dateA !== dateB) {
    return dateA.localeCompare(dateB, "fr");
  }

  const heureA = String(placementA?.heure_debut || "");
  const heureB = String(placementB?.heure_debut || "");
  if (heureA !== heureB) {
    return heureA.localeCompare(heureB, "fr");
  }

  return String(placementA?.heure_fin || "").localeCompare(
    String(placementB?.heure_fin || ""),
    "fr"
  );
}

function clonerMap(source) {
  return new Map(source?.entries?.() || []);
}

function safePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normaliserHeure(value) {
  const texte = String(value || "").trim();
  if (!texte) {
    return "";
  }

  if (texte.length === 5) {
    return `${texte}:00`;
  }

  return texte.slice(0, 8);
}

function heureVersMinutes(value) {
  const [heures = "0", minutes = "0", secondes = "0"] = normaliserHeure(value).split(":");
  return Number(heures) * 60 + Number(minutes) + Number(secondes) / 60;
}

function plagesSeChevauchent(plageA, plageB) {
  if (String(plageA?.date || "") !== String(plageB?.date || "")) {
    return false;
  }

  return (
    heureVersMinutes(plageA?.heure_debut) < heureVersMinutes(plageB?.heure_fin) &&
    heureVersMinutes(plageB?.heure_debut) < heureVersMinutes(plageA?.heure_fin)
  );
}

function construireNomPersonne(personne) {
  return `${String(personne?.prenom || "").trim()} ${String(personne?.nom || "").trim()}`
    .trim()
    .replace(/\s+/g, " ");
}

export class FailedCourseEngine {
  static rattacherCoursEchoues({
    echouesParEtudiant,
    cours,
    etudiants = [],
    groupesFormes = [],
    affectationsEtudiantGroupe = new Map(),
    placementsPlanifies,
    matrix,
    salles = [],
    professeurs = [],
    datesParJourSemaine = new Map(),
    dispParProf = new Map(),
    absencesParProf = new Map(),
    indispoParSalle = new Map(),
    resourcePlacementIndex = null,
    activerCoursEnLigne = isOnlineCourseSchedulingEnabled(),
  }) {
    const affectations = [];
    const affectationsIndividuelles = [];
    const conflits = [];
    const placementsGeneres = [];
    const groupesGeneres = [];
    const transfertsGlobaux = [];
    const diagnosticsEtudiants = [];
    const echouesNormalises = FailedCourseEngine._normaliserDemandesParEtudiant(
      echouesParEtudiant
    );
    const coursParId = new Map(
      (Array.isArray(cours) ? cours : [])
        .map((coursItem) => [Number(coursItem?.id_cours), coursItem])
        .filter(([idCours]) => Number.isInteger(idCours) && idCours > 0)
    );
    const etudiantsParId = new Map(
      (Array.isArray(etudiants) ? etudiants : [])
        .map((etudiant) => [Number(etudiant?.id_etudiant), etudiant])
        .filter(([idEtudiant]) => Number.isInteger(idEtudiant) && idEtudiant > 0)
    );
    const sallesParId = new Map(
      (Array.isArray(salles) ? salles : [])
        .map((salle) => [Number(salle?.id_salle), salle])
        .filter(([idSalle]) => Number.isInteger(idSalle) && idSalle > 0)
    );
    const groupesParNom = new Map(
      (Array.isArray(groupesFormes) ? groupesFormes : [])
        .filter((groupe) => groupe?.nomGroupe)
        .map((groupe) => [String(groupe.nomGroupe), groupe])
    );
    const sectionsParCours = FailedCourseEngine._indexerSectionsParCours({
      coursParId,
      placementsPlanifies,
      groupesParNom,
      activerCoursEnLigne,
    });
    const sectionsParGroupeCours =
      FailedCourseEngine._indexerSectionsParGroupeCours(sectionsParCours);
    const placementsReguliersParGroupe =
      FailedCourseEngine._indexerPlacementsParGroupe(placementsPlanifies);
    const groupesParSegment = FailedCourseEngine._indexerGroupesParSegment(groupesFormes);
    const groupePrincipalParEtudiant = FailedCourseEngine._resoudreGroupesPrincipaux({
      etudiantsParId,
      groupesParNom,
      affectationsEtudiantGroupe,
    });
    const state = {
      matrix,
      coursParId,
      etudiantsParId,
      sallesParId,
      professeurs: Array.isArray(professeurs) ? professeurs : [],
      groupesFormes: Array.isArray(groupesFormes) ? groupesFormes : [],
      groupesParNom,
      sectionsParCours,
      sectionsParGroupeCours,
      placementsReguliersParGroupe,
      groupesParSegment,
      groupePrincipalParEtudiant,
      affectationsEtudiantGroupe,
      occupationAdditionnelleParSection: new Map(),
      datesParJourSemaine,
      dispParProf,
      absencesParProf,
      indispoParSalle,
      resourcePlacementIndex:
        resourcePlacementIndex instanceof ResourceDayPlacementIndex
          ? resourcePlacementIndex
          : null,
      activerCoursEnLigne,
      courseTimeCandidates: new Map(
        [...coursParId.entries()].map(([idCours, coursInfo]) => [
          idCours,
          buildCourseTimeCandidates(coursInfo),
        ])
      ),
      affectations,
      affectationsIndividuelles,
      conflits,
      placementsGeneres,
      groupesGeneres,
      transfertsGlobaux,
      diagnosticsEtudiants,
      compteurGroupeReprise: 1,
    };

    const coursCollectifsTraites = FailedCourseEngine._traiterDemandesCollectivesPrioritaires({
      echouesParEtudiant: echouesNormalises,
      state,
    });
    const echouesIndividuelsParEtudiant = FailedCourseEngine._filtrerDemandesEtudiant({
      echouesParEtudiant: echouesNormalises,
      coursExclus: coursCollectifsTraites,
    });

    const etudiantsTries = FailedCourseEngine._ordonnerEtudiantsParPriorite({
      echouesParEtudiant: echouesIndividuelsParEtudiant,
      etudiantsParId,
      groupePrincipalParEtudiant,
      groupesParNom,
      sectionsParCours,
      matrix,
    });

    for (const contexteEtudiant of etudiantsTries) {
      FailedCourseEngine._traiterEtudiant({
        contexteEtudiant,
        state,
      });
    }

    console.info(
      `${FAILED_COURSE_LOG_PREFIX} Nombre final de groupes de reprise crees: ` +
        `${groupesGeneres.length}.`
    );

    return {
      affectations,
      affectationsIndividuelles,
      conflits,
      placementsGeneres,
      groupesGeneres,
      transfertsGlobaux,
      debug: {
        etudiants: diagnosticsEtudiants,
      },
      stats: FailedCourseEngine._construireStats({
        affectations,
        affectationsIndividuelles,
        conflits,
        transfertsGlobaux,
        groupesGeneres,
      }),
    };
  }

  static _traiterEtudiant({ contexteEtudiant, state }) {
    const { idEtudiant, demandes, etudiant, groupePrincipal } = contexteEtudiant;
    const groupePrincipalNom = groupePrincipal?.nomGroupe || null;
    const libelleEtudiant = FailedCourseEngine._construireLibelleEtudiant({
      idEtudiant,
      etudiant,
      groupePrincipalNom,
    });

    console.info(
      `${FAILED_COURSE_LOG_PREFIX} Debut traitement ${libelleEtudiant} ` +
        `(${demandes.length} cours echoue(s)).`
    );

    const planDirectCourant = FailedCourseEngine._simulerPlanEtudiant({
      idEtudiant,
      demandes,
      groupePrincipalNomCible: groupePrincipalNom,
      groupePrincipalNomSource: groupePrincipalNom,
      state,
      autoriserReorganisationLocale: false,
    });

    const groupesParalleles = FailedCourseEngine._trouverGroupesParalleles({
      groupePrincipal,
      groupesParSegment: state.groupesParSegment,
    });
    const evaluationsParalleles = [];
    let meilleurPlanDirect = planDirectCourant;

    if (planDirectCourant.unresolved.length > 0 && groupesParalleles.length > 0) {
      console.info(
        `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> ` +
          `${groupesParalleles.length} groupe(s) parallele(s) a simuler.`
      );

      for (const groupeCandidat of groupesParalleles) {
        const planParallele = FailedCourseEngine._simulerPlanEtudiant({
          idEtudiant,
          demandes,
          groupePrincipalNomCible: groupeCandidat.nomGroupe,
          groupePrincipalNomSource: groupePrincipalNom,
          state,
          autoriserReorganisationLocale: false,
        });
        evaluationsParalleles.push(
          FailedCourseEngine._resumerEvaluationParallele({
            plan: planParallele,
            groupeSource: groupePrincipalNom,
            groupeCible: groupeCandidat.nomGroupe,
          })
        );

        if (FailedCourseEngine._planEstMeilleur(planParallele, meilleurPlanDirect)) {
          meilleurPlanDirect = planParallele;
        }
      }
    }

    let planFinal = meilleurPlanDirect;
    planFinal.evaluationsParalleles = evaluationsParalleles;

    if (planFinal.unresolved.length > 0) {
      planFinal = FailedCourseEngine._tenterDernierRecoursCoursFreres({
        contexteEtudiant,
        planReference: planFinal,
        groupePrincipalNomSource: groupePrincipalNom,
        state,
      });
      planFinal.evaluationsParalleles = evaluationsParalleles;
    }

    FailedCourseEngine._validerPlanEtudiant({
      contexteEtudiant,
      plan: planFinal,
      groupePrincipalNomSource: groupePrincipalNom,
      state,
    });
  }

  static _simulerPlanEtudiant({
    idEtudiant,
    demandes,
    groupePrincipalNomCible,
    groupePrincipalNomSource,
    state,
    autoriserReorganisationLocale,
    regularCourseMoves = [],
  }) {
    const workingMatrix = state.matrix?.clone?.();
    if (!workingMatrix) {
      throw new Error("La matrice de contraintes est requise pour la phase de reprise.");
    }

    const workingResourcePlacementIndex =
      (autoriserReorganisationLocale ||
        (Array.isArray(regularCourseMoves) && regularCourseMoves.length > 0)) &&
      state.resourcePlacementIndex
        ? FailedCourseEngine._clonerResourcePlacementIndex(state.resourcePlacementIndex)
        : null;
    const workingOccupation = clonerMap(state.occupationAdditionnelleParSection);
    const effectifAdjustmentsParGroupe = new Map();
    const transferInfo = FailedCourseEngine._preparerSimulationTransfert({
      idEtudiant,
      groupePrincipalNomSource,
      groupePrincipalNomCible,
      state,
      workingMatrix,
      workingResourcePlacementIndex,
      effectifAdjustmentsParGroupe,
    });
    const assignments = [];
    const unresolved = [];
    const demandesTriees = FailedCourseEngine._ordonnerDemandesEtudiant(
      demandes,
      state.sectionsParCours
    );
    let lastResortSummary = FailedCourseEngine._construireResumeDernierRecours({
      attempted: Array.isArray(regularCourseMoves) && regularCourseMoves.length > 0,
      result:
        Array.isArray(regularCourseMoves) && regularCourseMoves.length > 0
          ? "SIMULATION_OK"
          : "NON_TENTEE",
      regularCourseMoves,
    });

    if (!transferInfo.compatible) {
      for (const demande of demandesTriees) {
        unresolved.push(
          FailedCourseEngine._construireDiagnosticEchec({
            demande,
            idEtudiant,
            groupePrincipalNomSource,
            groupePrincipalNomCible,
            state,
            groupesTentes: [],
            transfertGlobal: {
              tentee: groupePrincipalNomCible !== groupePrincipalNomSource,
              groupe_source: groupePrincipalNomSource,
              groupe_cible: groupePrincipalNomCible,
              resultat: transferInfo.raison_code,
              raison: transferInfo.raison,
            },
            reorganisationLocale: {
              tentee: false,
              resultat: "NON_TENTEE",
            },
            tentativeDernierRecours: lastResortSummary,
          })
        );
      }

      return FailedCourseEngine._construirePlanSimulation({
        idEtudiant,
        groupePrincipalNomSource,
        groupePrincipalNomCible,
        assignments,
        unresolved,
        transferInfo,
        regularCourseMoves,
        lastResortSummary,
      });
    }

    if (Array.isArray(regularCourseMoves) && regularCourseMoves.length > 0) {
      const deplacementSimulation =
        FailedCourseEngine._appliquerDeplacementsCoursReguliersSimulation({
          idEtudiant,
          regularCourseMoves,
          workingMatrix,
          workingOccupation,
          workingResourcePlacementIndex,
          state,
        });
      lastResortSummary = {
        ...lastResortSummary,
        ...deplacementSimulation.resume,
      };

      if (!deplacementSimulation.compatible) {
        for (const demande of demandesTriees) {
          unresolved.push(
            FailedCourseEngine._construireDiagnosticEchec({
              demande,
              idEtudiant,
              groupePrincipalNomSource,
              groupePrincipalNomCible,
              state,
              groupesTentes: [],
              transfertGlobal: {
                tentee: groupePrincipalNomCible !== groupePrincipalNomSource,
                groupe_source: groupePrincipalNomSource,
                groupe_cible: groupePrincipalNomCible,
                resultat:
                  groupePrincipalNomCible !== groupePrincipalNomSource
                    ? "SIMULATION_OK"
                    : "NON_TENTEE",
                raison:
                  groupePrincipalNomCible !== groupePrincipalNomSource
                    ? "Le groupe cible passe les garde-fous de transfert."
                    : null,
              },
              reorganisationLocale: {
                tentee: false,
                resultat: "NON_TENTEE",
              },
              tentativeDernierRecours: lastResortSummary,
              raison_code:
                deplacementSimulation.resume?.result || "DERNIER_RECOURS_IMPOSSIBLE",
              raison:
                deplacementSimulation.resume?.reason ||
                "Le dernier recours n'a pas pu securiser les deplacements de cours reguliers.",
            })
          );
        }

        return FailedCourseEngine._construirePlanSimulation({
          idEtudiant,
          groupePrincipalNomSource,
          groupePrincipalNomCible,
          assignments,
          unresolved,
          transferInfo,
          regularCourseMoves,
          lastResortSummary,
        });
      }
    }

    for (const demande of demandesTriees) {
      const idCours = Number(demande?.id_cours);
      const coursInfo = state.coursParId.get(idCours);
      const groupesTentes = [];
      const transfertGlobal = {
        tentee: groupePrincipalNomCible !== groupePrincipalNomSource,
        groupe_source: groupePrincipalNomSource,
        groupe_cible: groupePrincipalNomCible,
        resultat:
          groupePrincipalNomCible !== groupePrincipalNomSource ? "SIMULATION_OK" : "NON_TENTEE",
        raison:
          groupePrincipalNomCible !== groupePrincipalNomSource
            ? "Le groupe cible passe les garde-fous de transfert."
            : null,
      };

      if (!coursInfo) {
        unresolved.push(
          FailedCourseEngine._construireDiagnosticEchec({
            demande,
            idEtudiant,
            groupePrincipalNomSource,
            groupePrincipalNomCible,
            state,
            groupesTentes,
            transfertGlobal,
            reorganisationLocale: {
              tentee: false,
              resultat: "NON_TENTEE",
            },
            tentativeDernierRecours: lastResortSummary,
            raison_code: "COURS_INTROUVABLE",
            raison:
              "Le cours echoue n'existe plus dans le catalogue de la session active.",
          })
        );
        continue;
      }

      if (!state.activerCoursEnLigne && Number(coursInfo.est_en_ligne || 0) === 1) {
        unresolved.push(
          FailedCourseEngine._construireDiagnosticEchec({
            demande,
            idEtudiant,
            groupePrincipalNomSource,
            groupePrincipalNomCible,
            state,
            groupesTentes,
            transfertGlobal,
            reorganisationLocale: {
              tentee: false,
              resultat: "NON_TENTEE",
            },
            tentativeDernierRecours: lastResortSummary,
            raison_code: "COURS_EN_LIGNE_DESACTIVE",
            raison:
              "Le cours echoue est uniquement offert en ligne et la planification en ligne est desactivee.",
          })
        );
        continue;
      }

      const sectionsCandidats = state.sectionsParCours.get(idCours) || [];
      if (sectionsCandidats.length === 0) {
        unresolved.push(
          FailedCourseEngine._construireDiagnosticEchec({
            demande,
            idEtudiant,
            groupePrincipalNomSource,
            groupePrincipalNomCible,
            state,
            groupesTentes,
            transfertGlobal,
            reorganisationLocale: {
              tentee: false,
              resultat: "NON_TENTEE",
            },
            tentativeDernierRecours: lastResortSummary,
            raison_code: "AUCUNE_SECTION_EXISTANTE_COMPATIBLE",
            raison:
              "Aucune section reelle ou section de reprise deja generee n'existe pour ce cours dans la session active.",
          })
        );
        continue;
      }

      const sectionRetenue = FailedCourseEngine._choisirSectionCompatible({
        sections: sectionsCandidats,
        occupationAdditionnelleParSection: workingOccupation,
        effectifAdjustmentsParGroupe,
        idEtudiant,
        workingMatrix,
        activerCoursEnLigne: state.activerCoursEnLigne,
        groupePrincipalNomCible,
        coursInfo,
        groupesTentes,
      });

      if (sectionRetenue) {
        FailedCourseEngine._reserverAffectationSectionExistante({
          idEtudiant,
          section: sectionRetenue,
          matrix: workingMatrix,
          resourcePlacementIndex: workingResourcePlacementIndex,
          occupationAdditionnelleParSection: workingOccupation,
        });
        assignments.push({
          demande,
          coursInfo,
          type: "SECTION_EXISTANTE",
          niveau: "DIRECT",
          section: sectionRetenue,
        });
        console.info(
          `${FAILED_COURSE_LOG_PREFIX} Etudiant ${idEtudiant} / ${coursInfo.code} -> ` +
            `section retenue ${sectionRetenue.nom_groupe}.`
        );
        continue;
      }

      let localAttempt = {
        tentee: autoriserReorganisationLocale,
        resultat: autoriserReorganisationLocale ? "ECHEC" : "NON_TENTEE",
        raison: autoriserReorganisationLocale
          ? "Aucune solution locale securisee n'a encore ete trouvee."
          : null,
      };

      if (autoriserReorganisationLocale) {
        const tentativeLocale = FailedCourseEngine._tenterSectionGenereeSecurisee({
          courseInfo: coursInfo,
          studentIds: [idEtudiant],
          workingMatrix,
          resourcePlacementIndex: workingResourcePlacementIndex,
          state,
          preferredSections: sectionsCandidats,
          strategyType: "REORGANISATION_LOCALE",
          idEtudiantReference: idEtudiant,
        });

        localAttempt = {
          tentee: true,
          resultat: tentativeLocale.success
            ? "SECTION_LOCALE_CREEE"
            : tentativeLocale.raison_code || "REORGANISATION_LOCALE_IMPOSSIBLE",
          raison: tentativeLocale.raison || null,
        };

        if (tentativeLocale.success) {
          assignments.push({
            demande,
            coursInfo,
            type: "SECTION_GENEREE",
            niveau: "REORGANISATION_LOCALE",
            section: tentativeLocale.section,
            groupeGenere: tentativeLocale.groupe,
            placementsGeneres: tentativeLocale.placements,
          });
          console.info(
            `${FAILED_COURSE_LOG_PREFIX} Etudiant ${idEtudiant} / ${coursInfo.code} -> ` +
              `section locale ${tentativeLocale.section.nom_groupe} creee.`
          );
          continue;
        }
      }

      unresolved.push(
        FailedCourseEngine._construireDiagnosticEchec({
          demande,
          idEtudiant,
          groupePrincipalNomSource,
          groupePrincipalNomCible,
          state,
          groupesTentes,
          transfertGlobal,
          reorganisationLocale: localAttempt,
          tentativeDernierRecours: lastResortSummary,
          raison_code: FailedCourseEngine._determinerRaisonConflit(groupesTentes),
          raison: FailedCourseEngine._construireMessageConflit(coursInfo, groupesTentes),
        })
      );
    }

    return FailedCourseEngine._construirePlanSimulation({
      idEtudiant,
      groupePrincipalNomSource,
      groupePrincipalNomCible,
      assignments,
      unresolved,
      transferInfo,
      regularCourseMoves,
      lastResortSummary,
    });
  }

  static _validerPlanEtudiant({
    contexteEtudiant,
    plan,
    groupePrincipalNomSource,
    state,
  }) {
    const { idEtudiant, etudiant } = contexteEtudiant;
    const groupePrincipalNomCible = plan.groupePrincipalNomCible;
    const libelleEtudiant = FailedCourseEngine._construireLibelleEtudiant({
      idEtudiant,
      etudiant,
      groupePrincipalNom: groupePrincipalNomSource,
    });

    if (
      plan.transferInfo.compatible &&
      groupePrincipalNomSource &&
      groupePrincipalNomCible &&
      groupePrincipalNomSource !== groupePrincipalNomCible
    ) {
      FailedCourseEngine._appliquerTransfertReel({
        idEtudiant,
        groupePrincipalNomSource,
        groupePrincipalNomCible,
        state,
      });
      state.transfertsGlobaux.push({
        id_etudiant: idEtudiant,
        matricule: etudiant?.matricule || null,
        groupe_source: groupePrincipalNomSource,
        groupe_cible: groupePrincipalNomCible,
        cours_planifies: plan.assignments.length,
        conflits_restants: plan.unresolved.length,
      });
      console.info(
        `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> transfert global retenu ` +
          `${groupePrincipalNomSource} -> ${groupePrincipalNomCible}.`
      );
    }

    for (const regularCourseMove of Array.isArray(plan.regularCourseMoves)
      ? plan.regularCourseMoves
      : []) {
      FailedCourseEngine._appliquerDeplacementCoursRegulierReel({
        idEtudiant,
        move: regularCourseMove,
        state,
      });
    }

    for (const assignment of plan.assignments) {
      if (assignment.type === "SECTION_EXISTANTE") {
        FailedCourseEngine._appliquerAffectationSectionExistante({
          idEtudiant,
          assignment,
          state,
        });
        state.affectations.push(
          FailedCourseEngine._construireAffectationReprise({
            demande: assignment.demande,
            coursInfo: assignment.coursInfo,
            section: assignment.section,
            idEtudiant,
            niveau: assignment.niveau,
          })
        );
        continue;
      }

      if (assignment.type === "SECTION_GENEREE") {
        FailedCourseEngine._appliquerSectionGeneree({
          assignment,
          state,
        });
        state.affectations.push(
          FailedCourseEngine._construireAffectationReprise({
            demande: assignment.demande,
            coursInfo: assignment.coursInfo,
            section: assignment.section,
            idEtudiant,
            niveau: assignment.niveau,
          })
        );
      }
    }

    state.diagnosticsEtudiants.push({
      id_etudiant: idEtudiant,
      matricule: etudiant?.matricule || null,
      nom: etudiant?.nom || null,
      prenom: etudiant?.prenom || null,
      groupe_source: groupePrincipalNomSource,
      groupe_cible: groupePrincipalNomCible,
      cours_planifies: plan.assignments.map((assignment) => ({
        id_cours_echoue: Number(assignment?.demande?.id || 0) || null,
        code_cours: assignment?.coursInfo?.code || null,
        nom_groupe: assignment?.section?.nom_groupe || null,
        niveau_resolution: assignment?.niveau || null,
      })),
      cours_non_planifies: plan.unresolved.map((item) => ({
        id_cours_echoue: item.id_cours_echoue,
        code_cours: item.code_cours,
        raison_code: item.raison_code,
      })),
      dernier_recours: plan.lastResortSummary || null,
      cours_reguliers_deplaces: (Array.isArray(plan.regularCourseMoves)
        ? plan.regularCourseMoves
        : []
      ).map((move) => ({
        id_cours: Number(move?.id_cours || 0) || null,
        code_cours: move?.code_cours || null,
        nom_cours: move?.nom_cours || null,
        groupe_source: move?.groupe_source || null,
        groupe_cible: move?.groupe_cible || null,
      })),
      groupes_freres_utilises: [
        ...new Set(
          (Array.isArray(plan.regularCourseMoves) ? plan.regularCourseMoves : [])
            .map((move) => String(move?.groupe_cible || "").trim())
            .filter(Boolean)
        ),
      ],
      groupes_paralleles_testes: plan.evaluationsParalleles || [],
    });

    for (const unresolvedItem of plan.unresolved) {
      unresolvedItem.groupes_paralleles_testes = plan.evaluationsParalleles || [];
      unresolvedItem.tentative_dernier_recours = plan.lastResortSummary || null;
      if (groupePrincipalNomSource && groupePrincipalNomCible !== groupePrincipalNomSource) {
        unresolvedItem.tentative_transfert_global = {
          tentee: true,
          groupe_source: groupePrincipalNomSource,
          groupe_cible: groupePrincipalNomCible,
          resultat: "TRANSFERT_GLOBAL_RESTANT_INSUFFISANT",
          raison:
            "Le transfert global ameliore ou preserve l'horaire principal mais ne suffit pas a planifier ce cours echoue.",
        };
      }
      state.conflits.push(
        FailedCourseEngine._finaliserConflit({
          item: unresolvedItem,
          raisonCode: unresolvedItem.raison_code || "AUCUNE_SECTION_EXISTANTE_COMPATIBLE",
          raison: unresolvedItem.raison,
        })
      );
    }

    console.info(
      `${FAILED_COURSE_LOG_PREFIX} Fin traitement ${libelleEtudiant} -> ` +
        `${plan.assignments.length} reprise(s) planifiee(s), ${plan.unresolved.length} non planifiee(s), ` +
        `${Array.isArray(plan.regularCourseMoves) ? plan.regularCourseMoves.length : 0} cours regulier(s) deplace(s).`
    );
  }

  static _tenterSectionGenereeSecurisee({
    courseInfo,
    studentIds,
    workingMatrix,
    resourcePlacementIndex,
    state,
    preferredSections,
    strategyType,
    idEtudiantReference = null,
  }) {
    const idsEtudiants = [
      ...new Set(
        (studentIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      ),
    ];
    if (idsEtudiants.length === 0) {
      return {
        success: false,
        raison_code: "CONFLIT_HORAIRE_PERSISTANT",
        raison: "Aucun etudiant valide a rattacher a la section generee.",
      };
    }

    if (
      strategyType === "REORGANISATION_LOCALE" &&
      idsEtudiants.length > LOCAL_SAFE_REORG_MAX_STUDENTS
    ) {
      return {
        success: false,
        raison_code: "REORGANISATION_LOCALE_IMPOSSIBLE",
        raison:
          "La reorganisation locale securisee est volontairement limitee aux cas individuels.",
      };
    }

    const groupe = FailedCourseEngine._creerGroupeReprise({
      courseInfo,
      state,
      studentIds: idsEtudiants,
      strategyType,
      idEtudiantReference,
    });
    const section = {
      id_cours: Number(courseInfo.id_cours),
      id_groupe: groupe.nomGroupe,
      nom_groupe: groupe.nomGroupe,
      code_cours: courseInfo.code,
      nom_cours: courseInfo.nom,
      capacite_max: Math.max(resolveOperationalCourseCapacity(courseInfo), idsEtudiants.length),
      effectif_initial: 0,
      est_groupe_special: true,
      origine: strategyType,
      placements: [],
    };
    const compatibleProfesseurs = FailedCourseEngine._ordonnerProfesseursCompatibles({
      courseInfo,
      professeurs: state.professeurs,
      preferredSections,
      matrix: workingMatrix,
    });

    if (compatibleProfesseurs.length === 0) {
      return {
        success: false,
        raison_code: "PROFESSEUR_INDISPONIBLE",
        raison:
          `Aucun professeur compatible n'est disponible pour ouvrir une section de reprise de ${courseInfo.code}.`,
      };
    }

    for (const professeur of compatibleProfesseurs) {
      const matrixProf = workingMatrix.clone();
      const resourceIndexProf = resourcePlacementIndex
        ? FailedCourseEngine._clonerResourcePlacementIndex(resourcePlacementIndex)
        : null;
      const resultSerie = FailedCourseEngine._chercherPlacementsSectionGeneree({
        courseInfo,
        professeur,
        studentIds: idsEtudiants,
        matrix: matrixProf,
        resourcePlacementIndex: resourceIndexProf,
        state,
        groupe,
        preferredSections,
      });

      if (!resultSerie.success) {
        continue;
      }

      section.placements = resultSerie.placements.map((placement) => ({
        ...placement,
        id_groupe: groupe.nomGroupe,
        nom_groupe: groupe.nomGroupe,
        groupe_a_persister: groupe,
        est_groupe_special: true,
        verrouille_optimisation_locale: true,
        est_reprise_generee: true,
        strategie_reprise: strategyType,
      }));

      groupe.etudiants_par_cours[String(courseInfo.id_cours)] = [...idsEtudiants];
      groupe.effectif_projete_max = idsEtudiants.length;
      groupe.charge_estimee_par_cours[String(courseInfo.id_cours)] = idsEtudiants.length;

      return {
        success: true,
        groupe,
        section,
        placements: section.placements,
      };
    }

    return {
      success: false,
      raison_code:
        strategyType === "REORGANISATION_LOCALE"
          ? "REORGANISATION_LOCALE_IMPOSSIBLE"
          : "AUCUN_CRENEAU_POUR_GROUPE_REPRISE",
      raison:
        strategyType === "REORGANISATION_LOCALE"
          ? `Aucun creneau strictement sur n'a ete trouve pour une section locale de ${courseInfo.code}.`
          : `Aucun creneau compatible n'a permis de regrouper tous les etudiants en reprise pour ${courseInfo.code}.`,
    };
  }

  static _chercherPlacementsSectionGeneree({
    courseInfo,
    professeur,
    studentIds,
    matrix,
    resourcePlacementIndex,
    state,
    groupe,
    preferredSections,
  }) {
    const sessionsParSemaine = Math.max(1, Number(courseInfo.sessions_par_semaine || 1));
    const placementsAccumules = [];
    const roomCandidates = FailedCourseEngine._ordonnerSallesCompatibles({
      courseInfo,
      sallesParId: state.sallesParId,
      preferredSections,
      studentCount: studentIds.length,
      activerCoursEnLigne: state.activerCoursEnLigne,
    });
    const usedWeekdayWindows = new Set();

    if (Number(courseInfo.est_en_ligne || 0) !== 1 && roomCandidates.length === 0) {
      return {
        success: false,
        raison_code: "SALLE_INDISPONIBLE",
        raison:
          `Aucune salle compatible ne peut accueillir ${studentIds.length} etudiant(s) pour ${courseInfo.code}.`,
      };
    }

    if (
      !matrix.profPeutPrendreGroupe(
        professeur.id_professeur,
        groupe.nomGroupe,
        getSchedulerMaxGroupsPerProfessor()
      )
    ) {
      return {
        success: false,
        raison_code: "PROFESSEUR_INDISPONIBLE",
        raison:
          `${construireNomPersonne(professeur) || "Le professeur"} atteint deja ` +
          "la limite de groupes autorises.",
      };
    }

    for (let numeroSerie = 1; numeroSerie <= sessionsParSemaine; numeroSerie += 1) {
      const serie = FailedCourseEngine._chercherSerieLibrePourSectionGeneree({
        courseInfo,
        professeur,
        studentIds,
        matrix,
        resourcePlacementIndex,
        state,
        groupe,
        roomCandidates,
        preferredSections,
        usedWeekdayWindows,
      });

      if (!serie.success) {
        return serie;
      }

      placementsAccumules.push(...serie.placements);
      usedWeekdayWindows.add(`${serie.jourSemaine}|${serie.heure_debut}|${serie.heure_fin}`);

      for (const placement of serie.placements) {
        matrix.reserver(
          placement.id_salle,
          placement.id_professeur,
          groupe.nomGroupe,
          placement.id_cours,
          placement.date,
          placement.heure_debut,
          placement.heure_fin,
          { studentIds }
        );
        FailedCourseEngine._ajouterPlacementRessourcesAIndex({
          resourcePlacementIndex,
          placement: {
            ...placement,
            id_groupe: groupe.nomGroupe,
            nom_groupe: groupe.nomGroupe,
          },
          studentIds,
        });
      }
    }

    return {
      success: true,
      placements: placementsAccumules,
    };
  }

  static _chercherSerieLibrePourSectionGeneree({
    courseInfo,
    professeur,
    studentIds,
    matrix,
    resourcePlacementIndex,
    state,
    groupe,
    roomCandidates,
    preferredSections,
    usedWeekdayWindows,
  }) {
    const creneaux = FailedCourseEngine._ordonnerCreneauxCandidats({
      courseInfo,
      state,
      preferredSections,
    });

    for (const creneau of creneaux) {
      for (const jourSemaine of ACADEMIC_WEEKDAY_ORDER) {
        const cleSerie = `${jourSemaine}|${creneau.heure_debut}|${creneau.heure_fin}`;
        if (usedWeekdayWindows.has(cleSerie)) {
          continue;
        }

        const datesSerie = state.datesParJourSemaine.get(jourSemaine) || [];
        if (datesSerie.length === 0) {
          continue;
        }

        const sallesCandidats =
          Number(courseInfo.est_en_ligne || 0) === 1 ? [null] : roomCandidates;
        for (const salle of sallesCandidats) {
          const placements = datesSerie.map((date) => ({
            id_cours: Number(courseInfo.id_cours),
            code_cours: courseInfo.code,
            nom_cours: courseInfo.nom,
            id_professeur: Number(professeur.id_professeur),
            nom_professeur: construireNomPersonne(professeur) || null,
            id_salle: salle ? Number(salle.id_salle) : null,
            code_salle: salle ? salle.code : "EN LIGNE",
            date,
            heure_debut: creneau.heure_debut,
            heure_fin: creneau.heure_fin,
            dureeHeures: creneau.dureeHeures,
            slotStartIndex: creneau.slotStartIndex,
            slotEndIndex: creneau.slotEndIndex,
            jourSemaine,
            est_en_ligne: !salle,
            est_groupe_special: true,
            est_cours_cle: Boolean(courseInfo.est_cours_cle),
          }));

          const compatibilite = FailedCourseEngine._validerPlacementsGeneres({
            placements,
            professeur,
            salle,
            studentIds,
            matrix,
            state,
            groupe,
            resourcePlacementIndex,
          });
          if (compatibilite.compatible) {
            return {
              success: true,
              placements,
              jourSemaine,
              heure_debut: creneau.heure_debut,
              heure_fin: creneau.heure_fin,
            };
          }
        }
      }
    }

    return {
      success: false,
      raison_code: Number(courseInfo.est_en_ligne || 0) === 1
        ? "CONFLIT_HORAIRE_PERSISTANT"
        : "AUCUN_CRENEAU_POUR_GROUPE_REPRISE",
      raison:
        Number(courseInfo.est_en_ligne || 0) === 1
          ? `Aucun creneau en ligne compatible n'a ete trouve pour ${courseInfo.code}.`
          : `Aucun creneau presentiel compatible n'a ete trouve pour ${courseInfo.code}.`,
    };
  }

  static _validerPlacementsGeneres({
    placements,
    professeur,
    salle,
    studentIds,
    matrix,
    state,
    groupe,
    resourcePlacementIndex,
  }) {
    for (const placement of placements) {
      if (
        !matrix.profLibre(
          professeur.id_professeur,
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        )
      ) {
        return { compatible: false, raison_code: "PROFESSEUR_INDISPONIBLE" };
      }

      if (
        !AvailabilityChecker.profDisponible(
          professeur.id_professeur,
          placement.date,
          placement.heure_debut,
          placement.heure_fin,
          state.dispParProf,
          state.absencesParProf
        )
      ) {
        return { compatible: false, raison_code: "PROFESSEUR_INDISPONIBLE" };
      }

      if (
        !matrix.profPeutAjouterSeanceSemaine(
          professeur.id_professeur,
          placement.date,
          getSchedulerMaxWeeklySessionsPerProfessor()
        )
      ) {
        return { compatible: false, raison_code: "PROFESSEUR_INDISPONIBLE" };
      }

      if (
        !matrix.groupeLibre(
          groupe.nomGroupe,
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        )
      ) {
        return { compatible: false, raison_code: "CONFLIT_HORAIRE_PERSISTANT" };
      }

      if (
        !matrix.etudiantsLibres(
          studentIds,
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        )
      ) {
        return { compatible: false, raison_code: "CONFLIT_HORAIRE_PERSISTANT" };
      }

      if (salle) {
        if (
          !matrix.salleLibre(
            salle.id_salle,
            placement.date,
            placement.heure_debut,
            placement.heure_fin
          )
        ) {
          return { compatible: false, raison_code: "SALLE_INDISPONIBLE" };
        }

        if (!AvailabilityChecker.salleDisponible(salle.id_salle, placement.date, state.indispoParSalle)) {
          return { compatible: false, raison_code: "SALLE_INDISPONIBLE" };
        }
      }

      if (
        !FailedCourseEngine._respecteContraintesPause({
          resourcePlacementIndex,
          placements: [placement],
          professeurId: professeur.id_professeur,
          groupeId: groupe.nomGroupe,
          studentIds,
        })
      ) {
        return { compatible: false, raison_code: "CONFLIT_HORAIRE_PERSISTANT" };
      }
    }

    return { compatible: true };
  }

  static _preparerSimulationTransfert({
    idEtudiant,
    groupePrincipalNomSource,
    groupePrincipalNomCible,
    state,
    workingMatrix,
    workingResourcePlacementIndex,
    effectifAdjustmentsParGroupe,
  }) {
    const result = { compatible: true, raison_code: null, raison: null };

    if (
      !groupePrincipalNomSource ||
      !groupePrincipalNomCible ||
      groupePrincipalNomSource === groupePrincipalNomCible
    ) {
      return result;
    }

    const validation = FailedCourseEngine._validerTransfertGlobal({
      groupePrincipalNomSource,
      groupePrincipalNomCible,
      state,
    });
    if (!validation.compatible) {
      return validation;
    }

    const placementsSource =
      state.placementsReguliersParGroupe.get(groupePrincipalNomSource) || [];
    const placementsCible =
      state.placementsReguliersParGroupe.get(groupePrincipalNomCible) || [];

    for (const placement of placementsSource) {
      workingMatrix.libererEtudiants(
        [idEtudiant],
        placement.date,
        placement.heure_debut,
        placement.heure_fin
      );
      FailedCourseEngine._retirerPlacementsEtudiantDeIndex({
        resourcePlacementIndex: workingResourcePlacementIndex,
        studentId: idEtudiant,
        placements: [placement],
      });
    }

    for (const placement of placementsCible) {
      workingMatrix.reserverEtudiants(
        [idEtudiant],
        placement.date,
        placement.heure_debut,
        placement.heure_fin
      );
      FailedCourseEngine._ajouterPlacementsEtudiantAIndex({
        resourcePlacementIndex: workingResourcePlacementIndex,
        studentId: idEtudiant,
        placements: [placement],
      });
    }

    effectifAdjustmentsParGroupe.set(
      groupePrincipalNomSource,
      (effectifAdjustmentsParGroupe.get(groupePrincipalNomSource) || 0) - 1
    );
    effectifAdjustmentsParGroupe.set(
      groupePrincipalNomCible,
      (effectifAdjustmentsParGroupe.get(groupePrincipalNomCible) || 0) + 1
    );

    return result;
  }

  static _validerTransfertGlobal({
    groupePrincipalNomSource,
    groupePrincipalNomCible,
    state,
  }) {
    const groupeCible = state.groupesParNom.get(groupePrincipalNomCible);
    if (!groupeCible) {
      return {
        compatible: false,
        raison_code: "AUCUN_GROUPE_PARALLELE_COMPATIBLE",
        raison: "Le groupe cible du transfert est introuvable dans le moteur.",
      };
    }

    const placementsCible =
      state.placementsReguliersParGroupe.get(groupePrincipalNomCible) || [];
    if (placementsCible.length === 0) {
      return {
        compatible: false,
        raison_code: "TRANSFERT_GLOBAL_IMPOSSIBLE",
        raison:
          "Le groupe parallele cible ne possede pas de motif principal complet dans la solution courante.",
      };
    }

    const tailleMaxCible = Number(groupeCible?.taille_max || 0);
    const effectifRegulierCible =
      Number(groupeCible?.effectif_regulier) ||
      (Array.isArray(groupeCible?.etudiants) ? groupeCible.etudiants.length : 0);
    if (tailleMaxCible > 0 && effectifRegulierCible + 1 > tailleMaxCible) {
      return {
        compatible: false,
        raison_code: "CAPACITE_INSUFFISANTE",
        raison:
          `Le groupe cible ${groupePrincipalNomCible} ne peut pas accueillir ` +
          `un etudiant supplementaire (${effectifRegulierCible + 1}/${tailleMaxCible}).`,
      };
    }

    for (const placement of placementsCible) {
      const salle = state.sallesParId.get(Number(placement?.id_salle));
      if (!salle) {
        continue;
      }

      const effectifCibleCours =
        GroupFormer.lireEffectifCours(groupeCible, placement.id_cours) + 1;
      if (Number(salle.capacite || 0) < effectifCibleCours) {
        return {
          compatible: false,
          raison_code: "SALLE_INDISPONIBLE",
          raison:
            `Le transfert vers ${groupePrincipalNomCible} surcharge la salle ${salle.code} ` +
            `pour le cours ${placement.code_cours || placement.id_cours}.`,
        };
      }
    }

    return { compatible: true, raison_code: null, raison: null };
  }

  static _appliquerTransfertReel({
    idEtudiant,
    groupePrincipalNomSource,
    groupePrincipalNomCible,
    state,
  }) {
    const placementsSource =
      state.placementsReguliersParGroupe.get(groupePrincipalNomSource) || [];
    const placementsCible =
      state.placementsReguliersParGroupe.get(groupePrincipalNomCible) || [];

    for (const placement of placementsSource) {
      state.matrix.libererEtudiants(
        [idEtudiant],
        placement.date,
        placement.heure_debut,
        placement.heure_fin
      );
      FailedCourseEngine._retirerPlacementsEtudiantDeIndex({
        resourcePlacementIndex: state.resourcePlacementIndex,
        studentId: idEtudiant,
        placements: [placement],
      });
    }

    for (const placement of placementsCible) {
      state.matrix.reserverEtudiants(
        [idEtudiant],
        placement.date,
        placement.heure_debut,
        placement.heure_fin
      );
      FailedCourseEngine._ajouterPlacementsEtudiantAIndex({
        resourcePlacementIndex: state.resourcePlacementIndex,
        studentId: idEtudiant,
        placements: [placement],
      });
    }

    FailedCourseEngine._deplacerEtudiantEntreGroupes({
      idEtudiant,
      groupeSource: state.groupesParNom.get(groupePrincipalNomSource),
      groupeCible: state.groupesParNom.get(groupePrincipalNomCible),
      sectionsParCours: state.sectionsParCours,
    });

    state.groupePrincipalParEtudiant.set(idEtudiant, groupePrincipalNomCible);
    state.affectationsEtudiantGroupe.set(idEtudiant, [groupePrincipalNomCible]);
  }

  static _deplacerEtudiantEntreGroupes({
    idEtudiant,
    groupeSource,
    groupeCible,
    sectionsParCours,
  }) {
    if (groupeSource) {
      groupeSource.etudiants = (Array.isArray(groupeSource.etudiants) ? groupeSource.etudiants : [])
        .map((value) => Number(value))
        .filter((value) => value !== Number(idEtudiant));
      groupeSource.effectif_regulier = Math.max(
        0,
        Number(groupeSource.effectif_regulier || 0) - 1
      );
      groupeSource.effectif_projete_max = Math.max(
        0,
        Number(groupeSource.effectif_projete_max || 0) - 1
      );
      for (const [idCours, valeur] of Object.entries(groupeSource.charge_estimee_par_cours || {})) {
        groupeSource.charge_estimee_par_cours[idCours] = Math.max(0, Number(valeur || 0) - 1);
      }
    }

    if (groupeCible) {
      if (!Array.isArray(groupeCible.etudiants)) {
        groupeCible.etudiants = [];
      }
      if (!groupeCible.etudiants.includes(Number(idEtudiant))) {
        groupeCible.etudiants.push(Number(idEtudiant));
      }
      groupeCible.effectif_regulier = Number(groupeCible.effectif_regulier || 0) + 1;
      groupeCible.effectif_projete_max = Number(groupeCible.effectif_projete_max || 0) + 1;
      for (const [idCours, valeur] of Object.entries(groupeCible.charge_estimee_par_cours || {})) {
        groupeCible.charge_estimee_par_cours[idCours] = Number(valeur || 0) + 1;
      }
    }

    for (const sections of sectionsParCours.values()) {
      for (const section of sections) {
        if (section.nom_groupe === groupeSource?.nomGroupe) {
          section.effectif_initial = Math.max(0, Number(section.effectif_initial || 0) - 1);
        }
        if (section.nom_groupe === groupeCible?.nomGroupe) {
          section.effectif_initial = Number(section.effectif_initial || 0) + 1;
        }
      }
    }
  }

  static _choisirSectionCompatible({
    sections,
    occupationAdditionnelleParSection,
    effectifAdjustmentsParGroupe,
    idEtudiant,
    workingMatrix,
    activerCoursEnLigne,
    groupePrincipalNomCible,
    coursInfo,
    groupesTentes,
  }) {
    for (const section of FailedCourseEngine._ordonnerSectionsCandidats(
      sections,
      occupationAdditionnelleParSection,
      groupePrincipalNomCible
    )) {
      const evaluation = FailedCourseEngine._evaluerSectionPourEtudiant({
        section,
        idEtudiant,
        matrix: workingMatrix,
        occupationAdditionnelleParSection,
        activerCoursEnLigne,
        effectifAdjustmentsParGroupe,
      });

      if (!evaluation.compatible) {
        groupesTentes.push({
          id_groupe: section.id_groupe,
          nom_groupe: section.nom_groupe,
          raison_code: evaluation.raison_code,
          raison: evaluation.raison,
          capacite_max: evaluation.capacite_max ?? section.capacite_max ?? null,
          effectif_initial: evaluation.effectif_initial ?? section.effectif_initial ?? 0,
          reprises_deja_planifiees: evaluation.occupation_additionnelle ?? 0,
          niveau: "DIRECT",
        });
        console.info(
          `${FAILED_COURSE_LOG_PREFIX} Etudiant ${idEtudiant} / ${coursInfo.code} -> ` +
            `${section.nom_groupe} rejete (${evaluation.raison_code}).`
        );
        continue;
      }

      return section;
    }

    return null;
  }

  static _reserverAffectationSectionExistante({
    idEtudiant,
    section,
    matrix,
    resourcePlacementIndex,
    occupationAdditionnelleParSection,
  }) {
    for (const placement of section.placements) {
      matrix.reserverEtudiants(
        [idEtudiant],
        placement.date,
        placement.heure_debut,
        placement.heure_fin
      );
      FailedCourseEngine._ajouterPlacementsEtudiantAIndex({
        resourcePlacementIndex,
        studentId: idEtudiant,
        placements: [placement],
      });
    }

    const cleSection = FailedCourseEngine._cleSection(section);
    occupationAdditionnelleParSection.set(
      cleSection,
      (occupationAdditionnelleParSection.get(cleSection) || 0) + 1
    );
  }

  static _appliquerAffectationSectionExistante({
    idEtudiant,
    assignment,
    state,
  }) {
    FailedCourseEngine._reserverAffectationSectionExistante({
      idEtudiant,
      section: assignment.section,
      matrix: state.matrix,
      resourcePlacementIndex: state.resourcePlacementIndex,
      occupationAdditionnelleParSection: state.occupationAdditionnelleParSection,
    });

    FailedCourseEngine._ajouterEtudiantDansSectionSpeciale({
      section: assignment.section,
      idEtudiant,
      idCours: assignment.coursInfo.id_cours,
      groupesParNom: state.groupesParNom,
    });
  }

  static _appliquerSectionGeneree({ assignment, state }) {
    const section = assignment.section;
    const groupe = assignment.groupeGenere;
    const cleSection = FailedCourseEngine._cleSection(section);

    if (!state.groupesParNom.has(groupe.nomGroupe)) {
      state.groupesFormes.push(groupe);
      state.groupesParNom.set(groupe.nomGroupe, groupe);
      state.groupesGeneres.push(groupe);
    }

    if (!state.sectionsParCours.has(section.id_cours)) {
      state.sectionsParCours.set(section.id_cours, []);
    }
    if (!state.sectionsParCours.get(section.id_cours).includes(section)) {
      state.sectionsParCours.get(section.id_cours).push(section);
    }

    const nombreAffectations =
      Array.isArray(groupe?.etudiants_par_cours?.[String(section.id_cours)])
        ? groupe.etudiants_par_cours[String(section.id_cours)].length
        : 0;
    state.occupationAdditionnelleParSection.set(cleSection, nombreAffectations);
    state.placementsGeneres.push(...assignment.placementsGeneres);

    for (const placement of assignment.placementsGeneres) {
      state.matrix.reserver(
        placement.id_salle,
        placement.id_professeur,
        placement.id_groupe,
        placement.id_cours,
        placement.date,
        placement.heure_debut,
        placement.heure_fin,
        { studentIds: FailedCourseEngine._lireEtudiantsSection(section, groupe) }
      );
      FailedCourseEngine._ajouterPlacementRessourcesAIndex({
        resourcePlacementIndex: state.resourcePlacementIndex,
        placement,
        studentIds: FailedCourseEngine._lireEtudiantsSection(section, groupe),
      });
    }
  }

  static _respecteContraintesPause({
    resourcePlacementIndex,
    placements,
    professeurId,
    groupeId,
    studentIds,
  }) {
    if (!(resourcePlacementIndex instanceof ResourceDayPlacementIndex)) {
      return true;
    }

    const resources = [
      { resourceType: "professeur", resourceId: professeurId },
      { resourceType: "groupe", resourceId: groupeId },
      ...[...(Array.isArray(studentIds) ? studentIds : [])].map((studentId) => ({
        resourceType: "etudiant",
        resourceId: studentId,
      })),
    ].filter((resource) => resource.resourceId != null && String(resource.resourceId).trim() !== "");

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

  static _ordonnerProfesseursCompatibles({
    courseInfo,
    professeurs,
    preferredSections,
    matrix,
  }) {
    const preferredProfessorIds = new Set(
      (Array.isArray(preferredSections) ? preferredSections : [])
        .flatMap((section) => section.placements || [])
        .map((placement) => Number(placement?.id_professeur))
        .filter((idProfesseur) => Number.isInteger(idProfesseur) && idProfesseur > 0)
    );

    return [...(Array.isArray(professeurs) ? professeurs : [])]
      .filter((professeur) => AvailabilityChecker.profCompatible(professeur, courseInfo))
      .sort((professeurA, professeurB) => {
        const prefA = preferredProfessorIds.has(Number(professeurA?.id_professeur)) ? 0 : 1;
        const prefB = preferredProfessorIds.has(Number(professeurB?.id_professeur)) ? 0 : 1;
        if (prefA !== prefB) {
          return prefA - prefB;
        }

        const chargeA = matrix.coursParProf.get(String(professeurA?.id_professeur))?.size || 0;
        const chargeB = matrix.coursParProf.get(String(professeurB?.id_professeur))?.size || 0;
        if (chargeA !== chargeB) {
          return chargeA - chargeB;
        }

        return construireNomPersonne(professeurA).localeCompare(
          construireNomPersonne(professeurB),
          "fr"
        );
      });
  }

  static _ordonnerSallesCompatibles({
    courseInfo,
    sallesParId,
    preferredSections,
    studentCount,
    activerCoursEnLigne,
  }) {
    if (Number(courseInfo.est_en_ligne || 0) === 1 && activerCoursEnLigne) {
      return [null];
    }

    const preferredRoomIds = new Set(
      (Array.isArray(preferredSections) ? preferredSections : [])
        .flatMap((section) => section.placements || [])
        .map((placement) => Number(placement?.id_salle))
        .filter((idSalle) => Number.isInteger(idSalle) && idSalle > 0)
    );

    return [...sallesParId.values()]
      .filter((salle) => AvailabilityChecker.salleCompatible(salle, courseInfo, studentCount))
      .sort((salleA, salleB) => {
        const prefA = preferredRoomIds.has(Number(salleA?.id_salle)) ? 0 : 1;
        const prefB = preferredRoomIds.has(Number(salleB?.id_salle)) ? 0 : 1;
        if (prefA !== prefB) {
          return prefA - prefB;
        }

        if (Number(salleA?.capacite || 0) !== Number(salleB?.capacite || 0)) {
          return Number(salleA?.capacite || 0) - Number(salleB?.capacite || 0);
        }

        return normaliserTexte(salleA?.code).localeCompare(normaliserTexte(salleB?.code), "fr");
      });
  }

  static _ordonnerCreneauxCandidats({ courseInfo, state, preferredSections }) {
    const candidats = state.courseTimeCandidates.get(Number(courseInfo.id_cours)) || [];
    const priorites = new Map();

    for (const placement of (Array.isArray(preferredSections) ? preferredSections : []).flatMap(
      (section) => section.placements || []
    )) {
      const key = `${normaliserHeure(placement.heure_debut)}|${normaliserHeure(placement.heure_fin)}`;
      priorites.set(key, 0);
    }

    return [...candidats].sort((candidatA, candidatB) => {
      const keyA = `${normaliserHeure(candidatA.heure_debut)}|${normaliserHeure(candidatA.heure_fin)}`;
      const keyB = `${normaliserHeure(candidatB.heure_debut)}|${normaliserHeure(candidatB.heure_fin)}`;
      const prioriteA = priorites.has(keyA) ? 0 : 1;
      const prioriteB = priorites.has(keyB) ? 0 : 1;
      if (prioriteA !== prioriteB) {
        return prioriteA - prioriteB;
      }

      return String(candidatA.heure_debut || "").localeCompare(
        String(candidatB.heure_debut || ""),
        "fr"
      );
    });
  }

  static _creerGroupeReprise({
    courseInfo,
    state,
    studentIds,
    strategyType,
    idEtudiantReference = null,
  }) {
    const prefixe = strategyType === "REORGANISATION_LOCALE" ? "REPRISE-LOCAL" : "REPRISE";
    const codeGroupe = FailedCourseEngine._normaliserCodeGroupeSpecial(courseInfo);
    const suffixe =
      strategyType === "REORGANISATION_LOCALE" && idEtudiantReference
        ? String(idEtudiantReference).padStart(2, "0")
        : String(state.compteurGroupeReprise++).padStart(2, "0");
    const idsEtudiants = [
      ...new Set(
        (Array.isArray(studentIds) ? studentIds : [])
          .map((idEtudiant) => Number(idEtudiant))
          .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0)
      ),
    ];

    return {
      nomGroupe: `${prefixe}-${codeGroupe}-${suffixe}`,
      programme: courseInfo.programme || null,
      etape: Number(courseInfo.etape_etude || 0) || null,
      est_groupe_special: true,
      est_groupe_reprise: true,
      type_groupe_special:
        strategyType === "REORGANISATION_LOCALE" ? "REPRISE_LOCALE" : "REPRISE",
      cours_reprise_id: Number(courseInfo.id_cours),
      cours_reprise_code: courseInfo.code || null,
      taille_max: Math.max(resolveOperationalCourseCapacity(courseInfo), idsEtudiants.length),
      etudiants: [...idsEtudiants],
      etudiants_en_reprise: [...idsEtudiants],
      etudiants_par_cours: {
        [String(courseInfo.id_cours)]: [...idsEtudiants],
      },
      charge_estimee_par_cours: {
        [String(courseInfo.id_cours)]: idsEtudiants.length,
      },
      effectif_regulier: idsEtudiants.length,
      effectif_projete_max: idsEtudiants.length,
    };
  }

  static _construireDiagnosticEchec({
    demande,
    idEtudiant,
    groupePrincipalNomSource,
    groupePrincipalNomCible,
    state,
    groupesTentes,
    transfertGlobal,
    reorganisationLocale,
    tentativeDernierRecours = null,
    raison_code = null,
    raison = null,
  }) {
    const coursInfo = state.coursParId.get(Number(demande?.id_cours));
    const etudiant = state.etudiantsParId.get(Number(idEtudiant));
    const reasonCode = raison_code || FailedCourseEngine._determinerRaisonConflit(groupesTentes);
    const reasonText =
      raison || FailedCourseEngine._construireMessageConflit(coursInfo, groupesTentes);

    return {
      id_cours_echoue: Number(demande?.id || 0) || null,
      id_etudiant: Number(idEtudiant),
      id_cours: Number(demande?.id_cours || 0) || null,
      code_cours: coursInfo?.code || demande?.code || null,
      nom_cours: coursInfo?.nom || demande?.nom || null,
      etudiants: [Number(idEtudiant)],
      etudiant: {
        id_etudiant: Number(idEtudiant),
        matricule: etudiant?.matricule || null,
        nom: etudiant?.nom || null,
        prenom: etudiant?.prenom || null,
      },
      groupe_principal: groupePrincipalNomSource || null,
      groupe_principal_simule: groupePrincipalNomCible || groupePrincipalNomSource || null,
      groupes_tentes: groupesTentes,
      sections_existantes_testees: groupesTentes,
      groupes_paralleles_testes: [],
      tentative_transfert_global: transfertGlobal,
      tentative_reorganisation_locale: reorganisationLocale,
      tentative_dernier_recours:
        tentativeDernierRecours ||
        FailedCourseEngine._construireResumeDernierRecours({
          attempted: false,
          result: "NON_TENTEE",
        }),
      tentative_groupe_reprise: {
        tentee: false,
        resultat: "NON_TENTEE",
        raison: null,
      },
      raison_code: reasonCode,
      raison: reasonText,
      recommandation: FailedCourseEngine._construireRecommandation(reasonCode, coursInfo),
      resolu: false,
    };
  }

  static _construireRecommandation(raisonCode, coursInfo) {
    switch (String(raisonCode || "")) {
      case "CAPACITE_INSUFFISANTE":
      case "GROUPES_COMPLETS":
        return `Ouvrir une capacite supplementaire ou une section de reprise pour ${coursInfo?.code || "ce cours"}.`;
      case "CONFLIT_HORAIRE":
      case "CONFLIT_HORAIRE_PERSISTANT":
        return "Verifier l'horaire principal de l'etudiant et les groupes paralleles avant une intervention manuelle.";
      case "AUCUN_GROUPE_PARALLELE_COMPATIBLE":
      case "TRANSFERT_GLOBAL_IMPOSSIBLE":
        return "Aucun transfert global propre n'a ete trouve; envisager une ouverture ciblee de reprise.";
      case "SEUIL_GROUPE_REPRISE_NON_ATTEINT":
        return "Regrouper plus d'etudiants sur le meme cours ou traiter ce cas par intervention individuelle.";
      case "AUCUN_CRENEAU_POUR_GROUPE_REPRISE":
        return "Etendre un creneau professeur ou une disponibilite salle pour permettre une section dediee.";
      default:
        return `Analyser manuellement ${coursInfo?.code || "ce cours"} avec le diagnostic detaille.`;
    }
  }

  static _finaliserConflit({ item, raisonCode, raison }) {
    return {
      ...item,
      raison_code: raisonCode,
      raison,
      recommandation: FailedCourseEngine._construireRecommandation(
        raisonCode,
        { code: item.code_cours, nom: item.nom_cours }
      ),
    };
  }

  static _construirePlanSimulation({
    idEtudiant,
    groupePrincipalNomSource,
    groupePrincipalNomCible,
    assignments,
    unresolved,
    transferInfo,
    regularCourseMoves = [],
    lastResortSummary = null,
  }) {
    return {
      idEtudiant,
      groupePrincipalNomSource,
      groupePrincipalNomCible,
      assignments,
      unresolved,
      transferInfo,
      regularCourseMoves,
      lastResortSummary,
      evaluationsParalleles: [],
      score: FailedCourseEngine._calculerScorePlan({
        assignments,
        unresolved,
        groupePrincipalNomSource,
        groupePrincipalNomCible,
        regularCourseMoves,
      }),
    };
  }

  static _planEstMeilleur(planCandidat, planReference) {
    if (!planReference) {
      return true;
    }

    return planCandidat.score > planReference.score;
  }

  static _calculerScorePlan({
    assignments,
    unresolved,
    groupePrincipalNomSource,
    groupePrincipalNomCible,
    regularCourseMoves = [],
  }) {
    const nbAssignments = Array.isArray(assignments) ? assignments.length : 0;
    const nbUnresolved = Array.isArray(unresolved) ? unresolved.length : 0;
    const nbSectionsLocales = (Array.isArray(assignments) ? assignments : []).filter(
      (assignment) => assignment.niveau === "REORGANISATION_LOCALE"
    ).length;
    const penaliteTransfert =
      groupePrincipalNomSource &&
      groupePrincipalNomCible &&
      groupePrincipalNomSource !== groupePrincipalNomCible
        ? 25
        : 0;
    const penaliteDeplacements = (Array.isArray(regularCourseMoves) ? regularCourseMoves.length : 0) * 35;
    const penaliteGroupesFreres = new Set(
      (Array.isArray(regularCourseMoves) ? regularCourseMoves : [])
        .map((move) => String(move?.groupe_cible || "").trim())
        .filter(Boolean)
    ).size * 5;

    return (
      nbAssignments * 1000 -
      nbUnresolved * 200 -
      nbSectionsLocales * 20 -
      penaliteTransfert -
      penaliteDeplacements -
      penaliteGroupesFreres
    );
  }

  static _resumerEvaluationParallele({ plan, groupeSource, groupeCible }) {
    return {
      groupe_source: groupeSource || null,
      groupe_cible: groupeCible || null,
      cours_planifies: Array.isArray(plan?.assignments) ? plan.assignments.length : 0,
      conflits_restants: Array.isArray(plan?.unresolved) ? plan.unresolved.length : 0,
      resultat:
        plan?.transferInfo?.compatible === false
          ? plan.transferInfo.raison_code || "TRANSFERT_GLOBAL_IMPOSSIBLE"
          : "SIMULATION_COMPLETE",
      raison:
        plan?.transferInfo?.compatible === false ? plan.transferInfo.raison || null : null,
    };
  }

  static _tenterDernierRecoursCoursFreres({
    contexteEtudiant,
    planReference,
    groupePrincipalNomSource,
    state,
  }) {
    const { idEtudiant, demandes, etudiant } = contexteEtudiant;
    if (!Array.isArray(planReference?.unresolved) || planReference.unresolved.length === 0) {
      return planReference;
    }

    const groupeBaseNom =
      planReference.groupePrincipalNomCible || planReference.groupePrincipalNomSource || null;
    const groupeBase =
      state.groupesParNom.get(groupeBaseNom) ||
      (groupeBaseNom ? { nomGroupe: groupeBaseNom } : null);
    if (!groupeBaseNom || !groupeBase) {
      return planReference;
    }

    const groupesFreres = FailedCourseEngine._trouverGroupesParalleles({
      groupePrincipal: groupeBase,
      groupesParSegment: state.groupesParSegment,
    });
    if (groupesFreres.length === 0) {
      return {
        ...planReference,
        lastResortSummary: FailedCourseEngine._construireResumeDernierRecours({
          attempted: false,
          result: "AUCUN_GROUPE_FRERE",
          reason: "Aucun groupe frere compatible n'est disponible pour ce segment.",
        }),
      };
    }

    const libelleEtudiant = FailedCourseEngine._construireLibelleEtudiant({
      idEtudiant,
      etudiant,
      groupePrincipalNom: groupePrincipalNomSource,
    });
    const coursReguliersEnConflit = FailedCourseEngine._identifierCoursReguliersEnConflit({
      planReference,
      groupePrincipalNom: groupeBaseNom,
      state,
    });
    const coursEchouesRestants = planReference.unresolved.map((item) => item.code_cours).filter(Boolean);

    console.info(
      `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> dernier recours: ` +
        `${coursEchouesRestants.length} cours echoue(s) restant(s): ` +
        `${coursEchouesRestants.join(", ") || "aucun"}.`
    );

    if (coursReguliersEnConflit.length === 0) {
      console.info(
        `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> aucun cours regulier conflictuel exploitable pour le dernier recours.`
      );
      return {
        ...planReference,
        lastResortSummary: FailedCourseEngine._construireResumeDernierRecours({
          attempted: true,
          result: "AUCUN_COURS_REGULIER_CONFLICTUEL",
          reason: "Les conflits restants ne sont pas debloquables par un deplacement de cours regulier.",
          unresolvedCourses: planReference.unresolved,
        }),
      };
    }

    console.info(
      `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> cours reguliers en conflit: ` +
        coursReguliersEnConflit
          .map((item) => `${item.code_cours} (${item.cours_echoues_bloques.join(", ")})`)
          .join(" | ")
    );

    const candidatsParCours = coursReguliersEnConflit
      .map((coursConflit) => ({
        course: coursConflit,
        candidates: FailedCourseEngine._listerDeplacementsCoursReguliersCandidats({
          coursConflit,
          groupePrincipalNom: groupeBaseNom,
          groupesFreres,
          state,
        }),
      }))
      .filter((item) => item.candidates.length > 0)
      .slice(0, LAST_RESORT_MAX_SOURCE_COURSES);

    const groupesFreresTestes = [
      ...new Set(
        candidatsParCours
          .flatMap((item) => item.candidates)
          .map((candidate) => String(candidate?.groupe_cible || "").trim())
          .filter(Boolean)
      ),
    ];

    if (candidatsParCours.length === 0) {
      console.info(
        `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> aucun groupe frere ne propose un horaire alternatif exploitable.`
      );
      return {
        ...planReference,
        lastResortSummary: FailedCourseEngine._construireResumeDernierRecours({
          attempted: true,
          result: "AUCUN_HORAIRE_FRERE_COMPATIBLE",
          reason: "Aucun groupe frere ne propose le cours regulier a une autre plage utile.",
          conflictingCourses: coursReguliersEnConflit,
          siblingGroupsTested: groupesFreresTestes,
          unresolvedCourses: planReference.unresolved,
        }),
      };
    }

    console.info(
      `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> groupes freres testes: ` +
        `${groupesFreresTestes.join(", ") || "aucun"}.`
    );

    const resumeInitial = FailedCourseEngine._construireResumeDernierRecours({
      attempted: true,
      result: "AUCUNE_SOLUTION",
      conflictingCourses: coursReguliersEnConflit,
      siblingGroupsTested: groupesFreresTestes,
      unresolvedCourses: planReference.unresolved,
      testedCombinations: 0,
      selectedMoves: [],
      unlockedFailedCourses: [],
    });

    let meilleurPlan = planReference;
    let meilleurResume = resumeInitial;
    const taillesCombinaisonsMax = Math.min(
      LAST_RESORT_MAX_REGULAR_COURSE_MOVES,
      candidatsParCours.length
    );
    let compteurTentatives = 0;

    for (let taille = 1; taille <= taillesCombinaisonsMax; taille += 1) {
      const combinaisons = FailedCourseEngine._genererCombinaisonsDeplacementsCours({
        candidatsParCours,
        taille,
        limite: LAST_RESORT_MAX_COMBINATIONS - compteurTentatives,
      });
      if (combinaisons.length === 0) {
        break;
      }

      let solutionCompleteTrouvee = false;
      for (const combinaison of combinaisons) {
        compteurTentatives += 1;
        const resumeCombinaison = combinaison
          .map((move) => `${move.code_cours}:${move.groupe_cible}`)
          .join(", ");
        console.info(
          `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> tentative dernier recours #${compteurTentatives}: ` +
            `${resumeCombinaison}.`
        );

        const planCandidat = FailedCourseEngine._simulerPlanEtudiant({
          idEtudiant,
          demandes,
          groupePrincipalNomCible: groupeBaseNom,
          groupePrincipalNomSource,
          state,
          autoriserReorganisationLocale: false,
          regularCourseMoves: combinaison,
        });
        const coursDebloques = planCandidat.assignments
          .filter(
            (assignment) =>
              !(planReference.assignments || []).some(
                (reference) =>
                  Number(reference?.demande?.id || 0) === Number(assignment?.demande?.id || 0)
              )
          )
          .map((assignment) => assignment?.coursInfo?.code || assignment?.demande?.code || null)
          .filter(Boolean);

        planCandidat.lastResortSummary = FailedCourseEngine._construireResumeDernierRecours({
          attempted: true,
          result:
            planCandidat.unresolved.length === 0
              ? "SOLUTION_COMPLETE"
              : planCandidat.assignments.length > planReference.assignments.length
                ? "AMELIORATION_PARTIELLE"
                : planCandidat.lastResortSummary?.result || "AUCUNE_SOLUTION",
          conflictingCourses: coursReguliersEnConflit,
          siblingGroupsTested: groupesFreresTestes,
          unresolvedCourses: planCandidat.unresolved,
          testedCombinations: compteurTentatives,
          selectedMoves: combinaison,
          unlockedFailedCourses: coursDebloques,
          reason: planCandidat.lastResortSummary?.reason || null,
        });

        console.info(
          `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> resultat tentative #${compteurTentatives}: ` +
            `${planCandidat.assignments.length} reprise(s) planifiee(s), ` +
            `${planCandidat.unresolved.length} non planifiee(s).`
        );

        if (FailedCourseEngine._planEstMeilleur(planCandidat, meilleurPlan)) {
          meilleurPlan = planCandidat;
          meilleurResume = planCandidat.lastResortSummary;
        }

        if (planCandidat.unresolved.length === 0) {
          solutionCompleteTrouvee = true;
        }
      }

      if (solutionCompleteTrouvee) {
        break;
      }
    }

    if (meilleurPlan === planReference) {
      console.info(
        `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> dernier recours non retenu apres ${compteurTentatives} tentative(s).`
      );
      return {
        ...planReference,
        lastResortSummary: {
          ...meilleurResume,
          attempted: true,
          tested_combinations: compteurTentatives,
        },
      };
    }

    console.info(
      `${FAILED_COURSE_LOG_PREFIX} ${libelleEtudiant} -> solution dernier recours retenue: ` +
        `${meilleurPlan.regularCourseMoves.length} cours regulier(s) deplace(s), ` +
        `${meilleurPlan.assignments.length} reprise(s) planifiee(s), ` +
        `${meilleurPlan.unresolved.length} non planifiee(s).`
    );

    return {
      ...meilleurPlan,
      lastResortSummary: {
        ...meilleurResume,
        attempted: true,
        tested_combinations: compteurTentatives,
      },
    };
  }

  static _identifierCoursReguliersEnConflit({
    planReference,
    groupePrincipalNom,
    state,
  }) {
    const placementsReguliers =
      state.placementsReguliersParGroupe.get(String(groupePrincipalNom || "").trim()) || [];
    if (placementsReguliers.length === 0) {
      return [];
    }

    const index = new Map();
    for (const unresolvedItem of Array.isArray(planReference?.unresolved)
      ? planReference.unresolved
      : []) {
      const sectionsEnConflit = (Array.isArray(unresolvedItem?.groupes_tentes)
        ? unresolvedItem.groupes_tentes
        : []
      ).filter((tentative) =>
        ["CONFLIT_HORAIRE", "CONFLIT_HORAIRE_PERSISTANT"].includes(
          String(tentative?.raison_code || "")
        )
      );

      for (const tentative of sectionsEnConflit) {
        const sectionReprise = state.sectionsParGroupeCours.get(
          FailedCourseEngine._cleSectionGroupeCours(
            tentative?.nom_groupe,
            unresolvedItem?.id_cours
          )
        );
        if (!sectionReprise) {
          continue;
        }

        for (const placementReprise of sectionReprise.placements || []) {
          for (const placementRegulier of placementsReguliers) {
            if (!plagesSeChevauchent(placementRegulier, placementReprise)) {
              continue;
            }

            const idCoursRegulier = Number(placementRegulier?.id_cours);
            const sectionSource = state.sectionsParGroupeCours.get(
              FailedCourseEngine._cleSectionGroupeCours(groupePrincipalNom, idCoursRegulier)
            );
            if (!sectionSource) {
              continue;
            }

            if (!index.has(idCoursRegulier)) {
              index.set(idCoursRegulier, {
                id_cours: idCoursRegulier,
                code_cours: placementRegulier?.code_cours || null,
                nom_cours: placementRegulier?.nom_cours || null,
                section_source: sectionSource,
                cours_echoues_bloques: new Set(),
                conflits: [],
              });
            }

            const entree = index.get(idCoursRegulier);
            entree.cours_echoues_bloques.add(unresolvedItem?.code_cours || unresolvedItem?.id_cours);
            entree.conflits.push({
              id_cours_echoue: unresolvedItem?.id_cours_echoue || null,
              code_cours_echoue: unresolvedItem?.code_cours || null,
              nom_groupe_reprise: sectionReprise.nom_groupe || null,
              date: placementReprise.date,
              heure_debut: placementReprise.heure_debut,
              heure_fin: placementReprise.heure_fin,
            });
          }
        }
      }
    }

    return [...index.values()]
      .map((item) => ({
        ...item,
        cours_echoues_bloques: [...item.cours_echoues_bloques].filter(Boolean).sort(),
      }))
      .sort((itemA, itemB) => {
        if (itemA.cours_echoues_bloques.length !== itemB.cours_echoues_bloques.length) {
          return itemB.cours_echoues_bloques.length - itemA.cours_echoues_bloques.length;
        }

        return normaliserTexte(itemA?.code_cours).localeCompare(
          normaliserTexte(itemB?.code_cours),
          "fr"
        );
      });
  }

  static _listerDeplacementsCoursReguliersCandidats({
    coursConflit,
    groupePrincipalNom,
    groupesFreres,
    state,
  }) {
    const sectionSource = coursConflit?.section_source || null;
    if (!sectionSource) {
      return [];
    }

    const candidats = [];
    for (const groupeFrere of Array.isArray(groupesFreres) ? groupesFreres : []) {
      const sectionCible = state.sectionsParGroupeCours.get(
        FailedCourseEngine._cleSectionGroupeCours(groupeFrere?.nomGroupe, coursConflit?.id_cours)
      );
      if (!sectionCible || sectionCible.nom_groupe === groupePrincipalNom) {
        continue;
      }

      const coursDebloques = new Set();
      let conflitsLeves = 0;
      for (const conflit of Array.isArray(coursConflit?.conflits) ? coursConflit.conflits : []) {
        const chevaucheEncore = (sectionCible.placements || []).some((placement) =>
          plagesSeChevauchent(placement, conflit)
        );
        if (!chevaucheEncore) {
          conflitsLeves += 1;
          if (conflit.code_cours_echoue) {
            coursDebloques.add(conflit.code_cours_echoue);
          }
        }
      }

      if (conflitsLeves === 0) {
        continue;
      }

      candidats.push({
        id_cours: Number(coursConflit.id_cours),
        code_cours: coursConflit.code_cours || null,
        nom_cours: coursConflit.nom_cours || null,
        groupe_source: sectionSource.nom_groupe || groupePrincipalNom || null,
        groupe_cible: sectionCible.nom_groupe || null,
        section_source: sectionSource,
        section_cible: sectionCible,
        cours_echoues_debloquables: [...coursDebloques].sort(),
        conflits_leves: conflitsLeves,
      });
    }

    return candidats
      .sort((itemA, itemB) => {
        if (itemA.cours_echoues_debloquables.length !== itemB.cours_echoues_debloquables.length) {
          return itemB.cours_echoues_debloquables.length - itemA.cours_echoues_debloquables.length;
        }

        if (itemA.conflits_leves !== itemB.conflits_leves) {
          return itemB.conflits_leves - itemA.conflits_leves;
        }

        return normaliserTexte(itemA?.groupe_cible).localeCompare(
          normaliserTexte(itemB?.groupe_cible),
          "fr"
        );
      })
      .slice(0, LAST_RESORT_MAX_TARGET_SECTIONS_PER_COURSE);
  }

  static _genererCombinaisonsDeplacementsCours({
    candidatsParCours,
    taille,
    limite,
  }) {
    const resultat = [];
    const items = Array.isArray(candidatsParCours) ? candidatsParCours : [];
    const limiteMax = Math.max(0, Number(limite || 0));
    if (items.length === 0 || taille <= 0 || limiteMax === 0) {
      return resultat;
    }

    const combinerCibles = (selection, indexSelection, combinaisonCourante) => {
      if (resultat.length >= limiteMax) {
        return;
      }

      if (indexSelection >= selection.length) {
        resultat.push(combinaisonCourante.map((item) => ({ ...item })));
        return;
      }

      for (const candidat of selection[indexSelection].candidates || []) {
        combinerCibles(selection, indexSelection + 1, [...combinaisonCourante, candidat]);
        if (resultat.length >= limiteMax) {
          return;
        }
      }
    };

    const choisirCours = (indexDepart, selection) => {
      if (resultat.length >= limiteMax) {
        return;
      }

      if (selection.length === taille) {
        combinerCibles(selection, 0, []);
        return;
      }

      for (let index = indexDepart; index < items.length; index += 1) {
        choisirCours(index + 1, [...selection, items[index]]);
        if (resultat.length >= limiteMax) {
          return;
        }
      }
    };

    choisirCours(0, []);
    return resultat;
  }

  static _appliquerDeplacementsCoursReguliersSimulation({
    idEtudiant,
    regularCourseMoves,
    workingMatrix,
    workingOccupation,
    workingResourcePlacementIndex,
    state,
  }) {
    const resume = FailedCourseEngine._construireResumeDernierRecours({
      attempted: true,
      result: "SIMULATION_OK",
      selectedMoves: regularCourseMoves,
    });

    for (const move of Array.isArray(regularCourseMoves) ? regularCourseMoves : []) {
      const evaluation = FailedCourseEngine._evaluerDeplacementCoursRegulier({
        idEtudiant,
        move,
        matrix: workingMatrix,
        occupationAdditionnelleParSection: workingOccupation,
        resourcePlacementIndex: workingResourcePlacementIndex,
        state,
      });
      if (!evaluation.compatible) {
        return {
          compatible: false,
          resume: FailedCourseEngine._construireResumeDernierRecours({
            attempted: true,
            result: evaluation.raison_code || "DERNIER_RECOURS_IMPOSSIBLE",
            reason: evaluation.raison || null,
            selectedMoves: regularCourseMoves,
          }),
        };
      }
    }

    return {
      compatible: true,
      resume,
    };
  }

  static _evaluerDeplacementCoursRegulier({
    idEtudiant,
    move,
    matrix,
    occupationAdditionnelleParSection,
    resourcePlacementIndex,
    state,
  }) {
    const sectionSource = move?.section_source;
    const sectionCible = move?.section_cible;
    if (!sectionSource || !sectionCible) {
      return {
        compatible: false,
        raison_code: "DERNIER_RECOURS_IMPOSSIBLE",
        raison: "Le cours regulier a deplacer ne dispose pas de section source et cible exploitables.",
      };
    }

    for (const placement of sectionSource.placements || []) {
      matrix.libererEtudiants([idEtudiant], placement.date, placement.heure_debut, placement.heure_fin);
      FailedCourseEngine._retirerPlacementsEtudiantDeIndex({
        resourcePlacementIndex,
        studentId: idEtudiant,
        placements: [placement],
      });
    }

    const occupationSupplementaire =
      occupationAdditionnelleParSection.get(FailedCourseEngine._cleSection(sectionCible)) || 0;
    const capaciteMax = Number(sectionCible.capacite_max || 0);
    const effectifProjet =
      Number(sectionCible.effectif_initial || 0) + occupationSupplementaire + 1;

    if (sectionCible.placements.some((placement) => Boolean(placement?.est_en_ligne))) {
      for (const placement of sectionSource.placements || []) {
        matrix.reserverEtudiants(
          [idEtudiant],
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        );
        FailedCourseEngine._ajouterPlacementsEtudiantAIndex({
          resourcePlacementIndex,
          studentId: idEtudiant,
          placements: [placement],
        });
      }

      return {
        compatible: false,
        raison_code: "SECTION_EN_LIGNE",
        raison:
          `Le groupe frere ${sectionCible.nom_groupe} propose ${move?.code_cours} en ligne.`,
      };
    }

    if (capaciteMax > 0 && effectifProjet > capaciteMax) {
      for (const placement of sectionSource.placements || []) {
        matrix.reserverEtudiants(
          [idEtudiant],
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        );
        FailedCourseEngine._ajouterPlacementsEtudiantAIndex({
          resourcePlacementIndex,
          studentId: idEtudiant,
          placements: [placement],
        });
      }

      return {
        compatible: false,
        raison_code: "CAPACITE_INSUFFISANTE",
        raison:
          `Le groupe frere ${sectionCible.nom_groupe} n'a plus de place sur ${move?.code_cours}.`,
      };
    }

    for (const placement of sectionCible.placements || []) {
      if (
        !matrix.etudiantsLibres(
          [idEtudiant],
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        )
      ) {
        for (const placementSource of sectionSource.placements || []) {
          matrix.reserverEtudiants(
            [idEtudiant],
            placementSource.date,
            placementSource.heure_debut,
            placementSource.heure_fin
          );
          FailedCourseEngine._ajouterPlacementsEtudiantAIndex({
            resourcePlacementIndex,
            studentId: idEtudiant,
            placements: [placementSource],
          });
        }

        return {
          compatible: false,
          raison_code: "CONFLIT_HORAIRE_PERSISTANT",
          raison:
            `Le groupe frere ${sectionCible.nom_groupe} conserve un conflit horaire sur ${move?.code_cours}.`,
        };
      }

      const salle = state.sallesParId.get(Number(placement?.id_salle));
      if (salle && Number(salle.capacite || 0) > 0 && effectifProjet > Number(salle.capacite || 0)) {
        for (const placementSource of sectionSource.placements || []) {
          matrix.reserverEtudiants(
            [idEtudiant],
            placementSource.date,
            placementSource.heure_debut,
            placementSource.heure_fin
          );
          FailedCourseEngine._ajouterPlacementsEtudiantAIndex({
            resourcePlacementIndex,
            studentId: idEtudiant,
            placements: [placementSource],
          });
        }

        return {
          compatible: false,
          raison_code: "SALLE_INDISPONIBLE",
          raison:
            `La salle ${salle.code} ne peut pas accueillir l'etudiant supplementaire sur ${move?.code_cours}.`,
        };
      }

      if (
        !FailedCourseEngine._respecteContraintesPauseEtudiant({
          resourcePlacementIndex,
          placement,
          studentId: idEtudiant,
        })
      ) {
        for (const placementSource of sectionSource.placements || []) {
          matrix.reserverEtudiants(
            [idEtudiant],
            placementSource.date,
            placementSource.heure_debut,
            placementSource.heure_fin
          );
          FailedCourseEngine._ajouterPlacementsEtudiantAIndex({
            resourcePlacementIndex,
            studentId: idEtudiant,
            placements: [placementSource],
          });
        }

        return {
          compatible: false,
          raison_code: "CONFLIT_HORAIRE_PERSISTANT",
          raison:
            `Le deplacement de ${move?.code_cours} vers ${sectionCible.nom_groupe} casse la pause minimale de l'etudiant.`,
        };
      }
    }

    for (const placement of sectionCible.placements || []) {
      matrix.reserverEtudiants([idEtudiant], placement.date, placement.heure_debut, placement.heure_fin);
      FailedCourseEngine._ajouterPlacementsEtudiantAIndex({
        resourcePlacementIndex,
        studentId: idEtudiant,
        placements: [placement],
      });
    }

    occupationAdditionnelleParSection.set(
      FailedCourseEngine._cleSection(sectionCible),
      occupationSupplementaire + 1
    );

    return { compatible: true };
  }

  static _respecteContraintesPauseEtudiant({
    resourcePlacementIndex,
    placement,
    studentId,
  }) {
    if (!(resourcePlacementIndex instanceof ResourceDayPlacementIndex)) {
      return true;
    }

    return BreakConstraintValidator.validateSequenceBreakConstraint({
      placements: resourcePlacementIndex.get({
        resourceType: "etudiant",
        resourceId: Number(studentId),
        date: placement?.date,
      }),
      proposedPlacement: placement,
      resourceType: "etudiant",
      resourceId: Number(studentId),
    }).valid;
  }

  static _appliquerDeplacementCoursRegulierReel({
    idEtudiant,
    move,
    state,
  }) {
    const sectionSource = move?.section_source;
    const sectionCible = move?.section_cible;
    if (!sectionSource || !sectionCible) {
      return;
    }

    for (const placement of sectionSource.placements || []) {
      state.matrix.libererEtudiants(
        [idEtudiant],
        placement.date,
        placement.heure_debut,
        placement.heure_fin
      );
      FailedCourseEngine._retirerPlacementsEtudiantDeIndex({
        resourcePlacementIndex: state.resourcePlacementIndex,
        studentId: idEtudiant,
        placements: [placement],
      });
    }

    for (const placement of sectionCible.placements || []) {
      state.matrix.reserverEtudiants(
        [idEtudiant],
        placement.date,
        placement.heure_debut,
        placement.heure_fin
      );
      FailedCourseEngine._ajouterPlacementsEtudiantAIndex({
        resourcePlacementIndex: state.resourcePlacementIndex,
        studentId: idEtudiant,
        placements: [placement],
      });
    }

    state.occupationAdditionnelleParSection.set(
      FailedCourseEngine._cleSection(sectionCible),
      (state.occupationAdditionnelleParSection.get(FailedCourseEngine._cleSection(sectionCible)) ||
        0) + 1
    );
    state.affectationsIndividuelles.push(
      FailedCourseEngine._construireAffectationIndividuelle({
        idEtudiant,
        move,
      })
    );
  }

  static _construireAffectationIndividuelle({
    idEtudiant,
    move,
  }) {
    return {
      id_etudiant: Number(idEtudiant),
      id_cours: Number(move?.id_cours || 0) || null,
      id_groupe: move?.section_cible?.id_groupe ?? null,
      nom_groupe: move?.groupe_cible || move?.section_cible?.nom_groupe || null,
      code_cours: move?.code_cours || null,
      nom_cours: move?.nom_cours || null,
      groupe_principal: move?.groupe_source || null,
      source_type: "individuelle",
    };
  }

  static _construireResumeDernierRecours({
    attempted,
    result,
    reason = null,
    conflictingCourses = [],
    siblingGroupsTested = [],
    unresolvedCourses = [],
    testedCombinations = 0,
    selectedMoves = [],
    unlockedFailedCourses = [],
    regularCourseMoves = [],
  }) {
    const moves = Array.isArray(selectedMoves) && selectedMoves.length > 0
      ? selectedMoves
      : regularCourseMoves;

    return {
      attempted: Boolean(attempted),
      result: result || "NON_TENTEE",
      reason: reason || null,
      tested_combinations: Number(testedCombinations || 0) || 0,
      cours_reguliers_en_conflit: (Array.isArray(conflictingCourses) ? conflictingCourses : []).map(
        (item) => ({
          id_cours: Number(item?.id_cours || 0) || null,
          code_cours: item?.code_cours || null,
          nom_cours: item?.nom_cours || null,
        })
      ),
      groupes_freres_testes: [...new Set((Array.isArray(siblingGroupsTested) ? siblingGroupsTested : []).filter(Boolean))],
      cours_echoues_restants: (Array.isArray(unresolvedCourses) ? unresolvedCourses : []).map((item) => ({
        id_cours_echoue: Number(item?.id_cours_echoue || 0) || null,
        code_cours: item?.code_cours || null,
      })),
      solution_retenue: {
        nb_cours_deplaces: Array.isArray(moves) ? moves.length : 0,
        cours_deplaces: (Array.isArray(moves) ? moves : []).map((move) => ({
          id_cours: Number(move?.id_cours || 0) || null,
          code_cours: move?.code_cours || null,
          nom_cours: move?.nom_cours || null,
          groupe_source: move?.groupe_source || null,
          groupe_cible: move?.groupe_cible || null,
        })),
        groupes_freres_utilises: [
          ...new Set(
            (Array.isArray(moves) ? moves : [])
              .map((move) => String(move?.groupe_cible || "").trim())
              .filter(Boolean)
          ),
        ],
        cours_echoues_debloques: [...new Set((Array.isArray(unlockedFailedCourses) ? unlockedFailedCourses : []).filter(Boolean))],
      },
    };
  }

  static _resoudreGroupesPrincipaux({
    etudiantsParId,
    groupesParNom,
    affectationsEtudiantGroupe,
  }) {
    const index = new Map();

    for (const [idEtudiant, groupes] of affectationsEtudiantGroupe?.entries?.() || []) {
      const nomGroupe = Array.isArray(groupes) ? String(groupes[0] || "").trim() : "";
      if (nomGroupe) {
        index.set(Number(idEtudiant), nomGroupe);
      }
    }

    for (const [idEtudiant] of etudiantsParId.entries()) {
      if (index.has(idEtudiant)) {
        continue;
      }

      const groupeTrouve = [...groupesParNom.values()].find((groupe) =>
        Array.isArray(groupe?.etudiants) &&
        groupe.etudiants.map((value) => Number(value)).includes(Number(idEtudiant))
      );
      if (groupeTrouve?.nomGroupe) {
        index.set(idEtudiant, groupeTrouve.nomGroupe);
      }
    }

    return index;
  }

  static _normaliserDemandesParEtudiant(echouesParEtudiant) {
    const resultat = new Map();

    for (const [idEtudiantBrut, demandesBrutes] of echouesParEtudiant?.entries?.() || []) {
      const idEtudiant = Number(idEtudiantBrut);
      if (!Number.isInteger(idEtudiant) || idEtudiant <= 0) {
        continue;
      }

      const demandesNormalisees = [];
      const clesVues = new Set();

      for (const [indexDemande, demande] of [...(Array.isArray(demandesBrutes) ? demandesBrutes : [])]
        .entries()) {
        const idCours = Number(demande?.id_cours);
        const cleDemande =
          Number.isInteger(idCours) && idCours > 0
            ? `cours:${idCours}`
            : `ligne:${Number(demande?.id || 0)}:${indexDemande}`;
        if (clesVues.has(cleDemande)) {
          continue;
        }

        clesVues.add(cleDemande);
        demandesNormalisees.push({
          ...demande,
          id_etudiant: Number(demande?.id_etudiant || idEtudiant) || idEtudiant,
        });
      }

      if (demandesNormalisees.length > 0) {
        resultat.set(idEtudiant, demandesNormalisees);
      }
    }

    return resultat;
  }

  static _indexerDemandesParCours({ echouesParEtudiant, coursParId }) {
    const index = new Map();

    for (const [idEtudiantBrut, demandes] of echouesParEtudiant?.entries?.() || []) {
      const idEtudiant = Number(idEtudiantBrut);
      if (!Number.isInteger(idEtudiant) || idEtudiant <= 0) {
        continue;
      }

      for (const demande of Array.isArray(demandes) ? demandes : []) {
        const idCours = Number(demande?.id_cours);
        if (!Number.isInteger(idCours) || idCours <= 0) {
          continue;
        }

        if (!index.has(idCours)) {
          index.set(idCours, {
            idCours,
            coursInfo: coursParId.get(idCours) || null,
            demandesParEtudiant: new Map(),
          });
        }

        const entree = index.get(idCours);
        if (!entree.demandesParEtudiant.has(idEtudiant)) {
          entree.demandesParEtudiant.set(idEtudiant, demande);
        }
      }
    }

    return [...index.values()]
      .map((entree) => ({
        ...entree,
        studentIds: [...entree.demandesParEtudiant.keys()].sort((a, b) => a - b),
      }))
      .sort((entreeA, entreeB) => {
        if (entreeA.studentIds.length !== entreeB.studentIds.length) {
          return entreeB.studentIds.length - entreeA.studentIds.length;
        }

        return normaliserTexte(entreeA?.coursInfo?.code || entreeA?.idCours).localeCompare(
          normaliserTexte(entreeB?.coursInfo?.code || entreeB?.idCours),
          "fr"
        );
      });
  }

  static _traiterDemandesCollectivesPrioritaires({ echouesParEtudiant, state }) {
    const threshold = getFailedCourseRecoveryGroupThreshold();
    const coursTraitesCollectivement = new Set();
    let nbGroupesCrees = 0;

    for (const entreeCours of FailedCourseEngine._indexerDemandesParCours({
      echouesParEtudiant,
      coursParId: state.coursParId,
    })) {
      const { idCours, coursInfo, demandesParEtudiant, studentIds } = entreeCours;
      const codeCours = coursInfo?.code || `COURS-${idCours}`;

      console.info(
        `${FAILED_COURSE_LOG_PREFIX} Cours echoue analyse ${codeCours}: ` +
          `${studentIds.length} etudiant(s) distinct(s), seuil requis = ${threshold}.`
      );

      if (studentIds.length < threshold) {
        console.info(
          `${FAILED_COURSE_LOG_PREFIX} Decision ${codeCours}: traitement individuel.`
        );
        continue;
      }

      if (!coursInfo) {
        console.info(
          `${FAILED_COURSE_LOG_PREFIX} Decision ${codeCours}: traitement individuel ` +
            "(cours introuvable dans le referentiel courant)."
        );
        continue;
      }

      coursTraitesCollectivement.add(idCours);
      console.info(
        `${FAILED_COURSE_LOG_PREFIX} Decision ${codeCours}: groupe de reprise direct.`
      );

      nbGroupesCrees += FailedCourseEngine._traiterCoursCollectif({
        coursInfo,
        demandesParEtudiant,
        studentIds,
        state,
      });
    }

    console.info(
      `${FAILED_COURSE_LOG_PREFIX} Phase collective terminee: ${nbGroupesCrees} groupe(s) de reprise cree(s).`
    );

    return coursTraitesCollectivement;
  }

  static _traiterCoursCollectif({
    coursInfo,
    demandesParEtudiant,
    studentIds,
    state,
  }) {
    const idsEtudiants = [
      ...new Set(
        (Array.isArray(studentIds) ? studentIds : [])
          .map((idEtudiant) => Number(idEtudiant))
          .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0)
      ),
    ];
    if (!coursInfo || idsEtudiants.length === 0) {
      return 0;
    }

    const lotsEtudiants = FailedCourseEngine._creerLotsRepriseCollective({
      courseInfo: coursInfo,
      studentIds: idsEtudiants,
      state,
    });

    if (lotsEtudiants.length > 1) {
      console.info(
        `${FAILED_COURSE_LOG_PREFIX} ${coursInfo.code} -> ${lotsEtudiants.length} groupe(s) necessaires ` +
          `pour respecter la capacite cible de ${lotsEtudiants[0].capaciteLot}.`
      );
    }

    let nbGroupesCrees = 0;
    for (const [indexLot, lot] of lotsEtudiants.entries()) {
      const tentativeGroupe = FailedCourseEngine._tenterSectionGenereeSecurisee({
        courseInfo: coursInfo,
        studentIds: lot.studentIds,
        workingMatrix: state.matrix,
        resourcePlacementIndex: state.resourcePlacementIndex,
        state,
        preferredSections: state.sectionsParCours.get(Number(coursInfo.id_cours)) || [],
        strategyType: "GROUPE_REPRISE",
      });

      if (!tentativeGroupe.success) {
        FailedCourseEngine._finaliserEchecCoursCollectif({
          coursInfo,
          demandesParEtudiant,
          studentIds: lot.studentIds,
          state,
          raisonCode: tentativeGroupe.raison_code || "AUCUN_CRENEAU_POUR_GROUPE_REPRISE",
          raison:
            tentativeGroupe.raison ||
            `Aucune section de reprise stable n'a pu etre ouverte pour ${coursInfo.code}.`,
        });
        continue;
      }

      const assignment = {
        type: "SECTION_GENEREE",
        niveau: "GROUPE_REPRISE",
        coursInfo,
        section: tentativeGroupe.section,
        groupeGenere: tentativeGroupe.groupe,
        placementsGeneres: tentativeGroupe.placements,
      };
      FailedCourseEngine._appliquerSectionGeneree({
        assignment,
        state,
      });

      for (const idEtudiant of lot.studentIds) {
        const demande =
          demandesParEtudiant.get(idEtudiant) || {
            id_etudiant: idEtudiant,
            id_cours: coursInfo.id_cours,
          };
        state.affectations.push(
          FailedCourseEngine._construireAffectationReprise({
            demande,
            coursInfo,
            section: tentativeGroupe.section,
            idEtudiant,
            niveau: "GROUPE_REPRISE",
          })
        );
      }

      nbGroupesCrees += 1;
      console.info(
        `${FAILED_COURSE_LOG_PREFIX} Groupe de reprise cree pour ${coursInfo.code}: ` +
          `${tentativeGroupe.section.nom_groupe} (lot ${indexLot + 1}/${lotsEtudiants.length}, ` +
          `membres: ${FailedCourseEngine._formaterMembresEtudiants(
            lot.studentIds,
            state.etudiantsParId
          )}).`
      );
    }

    return nbGroupesCrees;
  }

  static _creerLotsRepriseCollective({ courseInfo, studentIds, state }) {
    const idsEtudiants = [
      ...new Set(
        (Array.isArray(studentIds) ? studentIds : [])
          .map((idEtudiant) => Number(idEtudiant))
          .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0)
      ),
    ];
    if (idsEtudiants.length === 0) {
      return [];
    }

    const capaciteLot = FailedCourseEngine._determinerCapaciteLotRepriseCollective({
      courseInfo,
      state,
    });
    if (idsEtudiants.length <= capaciteLot) {
      return [{ studentIds: idsEtudiants, capaciteLot }];
    }

    const nbLots = Math.ceil(idsEtudiants.length / capaciteLot);
    const lots = [];
    let offset = 0;

    for (let indexLot = 0; indexLot < nbLots; indexLot += 1) {
      const restant = idsEtudiants.length - offset;
      const lotsRestants = nbLots - indexLot;
      const tailleLot = Math.ceil(restant / lotsRestants);
      lots.push({
        studentIds: idsEtudiants.slice(offset, offset + tailleLot),
        capaciteLot,
      });
      offset += tailleLot;
    }

    return lots;
  }

  static _determinerCapaciteLotRepriseCollective({ courseInfo, state }) {
    const capaciteCours = Math.max(1, Number(resolveOperationalCourseCapacity(courseInfo) || 0) || 1);
    if (Number(courseInfo?.est_en_ligne || 0) === 1 && state.activerCoursEnLigne) {
      return capaciteCours;
    }

    const capacitesCompatibles = [...(state.sallesParId?.values?.() || [])]
      .filter((salle) => AvailabilityChecker.salleCompatible(salle, courseInfo))
      .map((salle) => Math.max(0, Number(salle?.capacite || 0)))
      .filter((capacite) => capacite > 0);
    if (capacitesCompatibles.length === 0) {
      return capaciteCours;
    }

    return Math.max(1, Math.min(capaciteCours, Math.max(...capacitesCompatibles)));
  }

  static _finaliserEchecCoursCollectif({
    coursInfo,
    demandesParEtudiant,
    studentIds,
    state,
    raisonCode,
    raison,
  }) {
    for (const idEtudiant of Array.isArray(studentIds) ? studentIds : []) {
      const groupePrincipalNom = state.groupePrincipalParEtudiant.get(Number(idEtudiant)) || null;
      const demande =
        demandesParEtudiant.get(Number(idEtudiant)) || {
          id_etudiant: idEtudiant,
          id_cours: coursInfo?.id_cours,
        };
      const diagnostic = FailedCourseEngine._construireDiagnosticEchec({
        demande,
        idEtudiant,
        groupePrincipalNomSource: groupePrincipalNom,
        groupePrincipalNomCible: groupePrincipalNom,
        state,
        groupesTentes: [],
        transfertGlobal: {
          tentee: false,
          resultat: "NON_TENTEE",
          raison: null,
        },
        reorganisationLocale: {
          tentee: false,
          resultat: "NON_TENTEE",
          raison: null,
        },
        raison_code: raisonCode,
        raison,
      });
      diagnostic.tentative_groupe_reprise = {
        tentee: true,
        resultat: raisonCode,
        raison,
      };
      state.conflits.push(
        FailedCourseEngine._finaliserConflit({
          item: diagnostic,
          raisonCode,
          raison,
        })
      );
    }
  }

  static _filtrerDemandesEtudiant({ echouesParEtudiant, coursExclus }) {
    const resultat = new Map();

    for (const [idEtudiant, demandes] of echouesParEtudiant?.entries?.() || []) {
      const demandesRestantes = (Array.isArray(demandes) ? demandes : []).filter((demande) => {
        const idCours = Number(demande?.id_cours);
        return !coursExclus.has(idCours);
      });
      if (demandesRestantes.length > 0) {
        resultat.set(Number(idEtudiant), demandesRestantes);
      }
    }

    return resultat;
  }

  static _ordonnerEtudiantsParPriorite({
    echouesParEtudiant,
    etudiantsParId,
    groupePrincipalParEtudiant,
    groupesParNom,
    sectionsParCours,
    matrix,
  }) {
    return [...(echouesParEtudiant?.entries?.() || [])]
      .map(([idEtudiantBrut, demandes]) => {
        const idEtudiant = Number(idEtudiantBrut);
        const etudiant = etudiantsParId.get(idEtudiant) || null;
        const groupePrincipalNom = groupePrincipalParEtudiant.get(idEtudiant) || null;
        const minOptions = Math.min(
          ...[...(Array.isArray(demandes) ? demandes : [])].map(
            (demande) => (sectionsParCours.get(Number(demande?.id_cours)) || []).length || 0
          ),
          Number.MAX_SAFE_INTEGER
        );
        const nbContraintes = matrix?.etudiants?.get?.(String(idEtudiant))?.size || 0;
        return {
          idEtudiant,
          etudiant,
          groupePrincipal:
            groupePrincipalNom != null
              ? groupesParNom.get(groupePrincipalNom) || { nomGroupe: groupePrincipalNom }
              : null,
          demandes: Array.isArray(demandes) ? demandes : [],
          minOptions: minOptions === Number.MAX_SAFE_INTEGER ? 0 : minOptions,
          nbContraintes,
        };
      })
      .filter((item) => Number.isInteger(item.idEtudiant) && item.idEtudiant > 0)
      .sort((itemA, itemB) => {
        if (itemA.minOptions !== itemB.minOptions) {
          return itemA.minOptions - itemB.minOptions;
        }

        if (itemA.demandes.length !== itemB.demandes.length) {
          return itemB.demandes.length - itemA.demandes.length;
        }

        if (itemA.nbContraintes !== itemB.nbContraintes) {
          return itemB.nbContraintes - itemA.nbContraintes;
        }

        return normaliserTexte(itemA?.etudiant?.matricule).localeCompare(
          normaliserTexte(itemB?.etudiant?.matricule),
          "fr"
        );
      });
  }

  static _trouverGroupesParalleles({ groupePrincipal, groupesParSegment }) {
    const programme = String(groupePrincipal?.programme || "").trim();
    const etape = String(Number(groupePrincipal?.etape || 0) || "").trim();
    if (!programme || !etape) {
      return [];
    }

    const segmentKey = FailedCourseEngine._segmentKey(programme, etape);
    return (groupesParSegment.get(segmentKey) || []).filter(
      (candidat) =>
        candidat?.nomGroupe &&
        candidat.nomGroupe !== groupePrincipal?.nomGroupe &&
        !Boolean(candidat?.est_groupe_special)
    );
  }

  static _indexerGroupesParSegment(groupesFormes) {
    const index = new Map();

    for (const groupe of Array.isArray(groupesFormes) ? groupesFormes : []) {
      const programme = String(groupe?.programme || "").trim();
      const etape = String(Number(groupe?.etape || 0) || "").trim();
      if (!programme || !etape || Boolean(groupe?.est_groupe_special)) {
        continue;
      }

      const key = FailedCourseEngine._segmentKey(programme, etape);
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(groupe);
    }

    return index;
  }

  static _segmentKey(programme, etape) {
    return `${normaliserTexte(programme)}|${String(etape).trim()}`;
  }

  static _normaliserCodeGroupeSpecial(courseInfo) {
    const codeBrut = String(courseInfo?.code || courseInfo?.id_cours || "REPRISE")
      .trim()
      .toUpperCase();
    const codeNettoye = codeBrut.replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return codeNettoye || "REPRISE";
  }

  static _formaterMembresEtudiants(studentIds, etudiantsParId) {
    return [...new Set(Array.isArray(studentIds) ? studentIds : [])]
      .map((idEtudiant) => {
        const etudiant = etudiantsParId?.get?.(Number(idEtudiant));
        return String(etudiant?.matricule || idEtudiant).trim();
      })
      .filter(Boolean)
      .join(", ");
  }

  static _construireLibelleEtudiant({ idEtudiant, etudiant, groupePrincipalNom }) {
    const nomComplet = construireNomPersonne(etudiant) || `Etudiant ${idEtudiant}`;
    const matricule = String(etudiant?.matricule || "").trim();
    const groupe = groupePrincipalNom ? ` / ${groupePrincipalNom}` : "";
    return `${nomComplet}${matricule ? ` [${matricule}]` : ""}${groupe}`;
  }

  static _construireAffectationReprise({
    demande,
    coursInfo,
    section,
    idEtudiant,
    niveau,
  }) {
    return {
      id_cours_echoue: Number(demande?.id || 0) || null,
      id_etudiant: Number(idEtudiant),
      id_cours: Number(coursInfo?.id_cours || demande?.id_cours || 0) || null,
      id_groupe: section.id_groupe,
      nom_groupe: section.nom_groupe,
      code_cours: coursInfo?.code || demande?.code || null,
      nom_cours: coursInfo?.nom || demande?.nom || null,
      nb_seances: Array.isArray(section?.placements) ? section.placements.length : 0,
      niveau_resolution: niveau,
    };
  }

  static _ajouterEtudiantDansSectionSpeciale({
    section,
    idEtudiant,
    idCours,
    groupesParNom,
  }) {
    if (!Boolean(section?.est_groupe_special)) {
      return;
    }

    const groupe = groupesParNom.get(String(section.nom_groupe || ""));
    if (!groupe) {
      return;
    }

    if (!Array.isArray(groupe.etudiants)) {
      groupe.etudiants = [];
    }
    if (!groupe.etudiants.includes(Number(idEtudiant))) {
      groupe.etudiants.push(Number(idEtudiant));
    }

    if (!Array.isArray(groupe.etudiants_en_reprise)) {
      groupe.etudiants_en_reprise = [];
    }
    if (!groupe.etudiants_en_reprise.includes(Number(idEtudiant))) {
      groupe.etudiants_en_reprise.push(Number(idEtudiant));
    }

    if (!groupe.etudiants_par_cours) {
      groupe.etudiants_par_cours = {};
    }
    const cleCours = String(idCours);
    if (!Array.isArray(groupe.etudiants_par_cours[cleCours])) {
      groupe.etudiants_par_cours[cleCours] = [];
    }
    if (!groupe.etudiants_par_cours[cleCours].includes(Number(idEtudiant))) {
      groupe.etudiants_par_cours[cleCours].push(Number(idEtudiant));
    }
  }

  static _lireEtudiantsSection(section, groupe) {
    if (Array.isArray(groupe?.etudiants_par_cours?.[String(section?.id_cours)])) {
      return groupe.etudiants_par_cours[String(section.id_cours)]
        .map((idEtudiant) => Number(idEtudiant))
        .filter((idEtudiant) => Number.isInteger(idEtudiant) && idEtudiant > 0);
    }

    return [];
  }

  static _clonerResourcePlacementIndex(sourceIndex) {
    if (!(sourceIndex instanceof ResourceDayPlacementIndex)) {
      return null;
    }

    const clone = new ResourceDayPlacementIndex();
    for (const [resourceType, byId] of sourceIndex.store.entries()) {
      for (const [resourceId, byDate] of byId.entries()) {
        for (const [date, placements] of byDate.entries()) {
          for (const placement of placements) {
            clone.add({
              resourceType,
              resourceId,
              date,
              placement,
            });
          }
        }
      }
    }

    return clone;
  }

  static _ajouterPlacementsEtudiantAIndex({
    resourcePlacementIndex,
    studentId,
    placements,
  }) {
    if (!(resourcePlacementIndex instanceof ResourceDayPlacementIndex)) {
      return;
    }

    for (const placement of Array.isArray(placements) ? placements : []) {
      resourcePlacementIndex.add({
        resourceType: "etudiant",
        resourceId: Number(studentId),
        date: placement.date,
        placement,
      });
    }
  }

  static _retirerPlacementsEtudiantDeIndex({
    resourcePlacementIndex,
    studentId,
    placements,
  }) {
    if (!(resourcePlacementIndex instanceof ResourceDayPlacementIndex)) {
      return;
    }

    for (const placement of Array.isArray(placements) ? placements : []) {
      resourcePlacementIndex.remove({
        resourceType: "etudiant",
        resourceId: Number(studentId),
        date: placement.date,
        placement,
      });
    }
  }

  static _ajouterPlacementRessourcesAIndex({
    resourcePlacementIndex,
    placement,
    studentIds = [],
  }) {
    if (!(resourcePlacementIndex instanceof ResourceDayPlacementIndex)) {
      return;
    }

    resourcePlacementIndex.add({
      resourceType: "professeur",
      resourceId: placement.id_professeur,
      date: placement.date,
      placement,
    });
    resourcePlacementIndex.add({
      resourceType: "groupe",
      resourceId: placement.id_groupe,
      date: placement.date,
      placement,
    });

    for (const idEtudiant of Array.isArray(studentIds) ? studentIds : []) {
      resourcePlacementIndex.add({
        resourceType: "etudiant",
        resourceId: Number(idEtudiant),
        date: placement.date,
        placement,
      });
    }
  }

  static _indexerPlacementsParGroupe(placementsPlanifies) {
    const index = new Map();

    for (const placement of Array.isArray(placementsPlanifies) ? placementsPlanifies : []) {
      const nomGroupe = String(placement?.nom_groupe || "").trim();
      if (!nomGroupe || Boolean(placement?.est_groupe_special)) {
        continue;
      }

      if (!index.has(nomGroupe)) {
        index.set(nomGroupe, []);
      }
      index.get(nomGroupe).push({
        ...placement,
        heure_debut: normaliserHeure(placement.heure_debut),
        heure_fin: normaliserHeure(placement.heure_fin),
      });
    }

    for (const placements of index.values()) {
      placements.sort(comparerDatesHeures);
    }

    return index;
  }

  static _indexerSectionsParCours({
    coursParId,
    placementsPlanifies,
    groupesParNom,
    activerCoursEnLigne,
  }) {
    const sectionsParCle = new Map();

    for (const placement of Array.isArray(placementsPlanifies) ? placementsPlanifies : []) {
      const idCours = Number(placement?.id_cours);
      const idGroupe = placement?.id_groupe ?? placement?.nom_groupe;
      if (!Number.isInteger(idCours) || idCours <= 0 || !idGroupe) {
        continue;
      }

      if (Boolean(placement?.est_groupe_special)) {
        continue;
      }

      if (!activerCoursEnLigne && Boolean(placement?.est_en_ligne)) {
        continue;
      }

      const nomGroupe = String(placement?.nom_groupe || "").trim();
      const groupeMoteur = groupesParNom.get(nomGroupe);
      const coursInfo = coursParId.get(idCours);
      const cleSection = `${idCours}|${String(idGroupe)}`;
      if (!sectionsParCle.has(cleSection)) {
        sectionsParCle.set(cleSection, {
          id_cours: idCours,
          id_groupe: idGroupe,
          nom_groupe: nomGroupe || null,
          code_cours: coursInfo?.code || placement.code_cours || null,
          nom_cours: coursInfo?.nom || placement.nom_cours || null,
          capacite_max: resolveOperationalCourseCapacity(coursInfo),
          effectif_initial: FailedCourseEngine._lireEffectifInitialSection(groupeMoteur),
          est_groupe_special: Boolean(placement?.est_groupe_special),
          placements: [],
        });
      }

      sectionsParCle.get(cleSection).placements.push({
        id_cours: idCours,
        id_groupe: idGroupe,
        nom_groupe: nomGroupe || null,
        id_professeur: Number(placement?.id_professeur || 0) || null,
        id_salle: Number(placement?.id_salle || 0) || null,
        code_salle: placement?.code_salle || null,
        date: placement.date,
        heure_debut: normaliserHeure(placement.heure_debut),
        heure_fin: normaliserHeure(placement.heure_fin),
        est_en_ligne: Boolean(placement.est_en_ligne),
        slotStartIndex: safePositiveInteger(placement?.slotStartIndex ?? 0) || 0,
        slotEndIndex: safePositiveInteger(placement?.slotEndIndex ?? 0) || 0,
        dureeHeures: Number(placement?.dureeHeures || 0) || null,
      });
    }

    const sectionsParCours = new Map();
    for (const section of sectionsParCle.values()) {
      section.placements.sort(comparerDatesHeures);
      if (!sectionsParCours.has(section.id_cours)) {
        sectionsParCours.set(section.id_cours, []);
      }
      sectionsParCours.get(section.id_cours).push(section);
    }

    for (const sections of sectionsParCours.values()) {
      sections.sort((sectionA, sectionB) =>
        normaliserTexte(sectionA.nom_groupe).localeCompare(
          normaliserTexte(sectionB.nom_groupe),
          "fr"
        )
      );
    }

    return sectionsParCours;
  }

  static _indexerSectionsParGroupeCours(sectionsParCours) {
    const index = new Map();

    for (const sections of sectionsParCours.values()) {
      for (const section of Array.isArray(sections) ? sections : []) {
        index.set(
          FailedCourseEngine._cleSectionGroupeCours(section?.nom_groupe, section?.id_cours),
          section
        );
      }
    }

    return index;
  }

  static _lireEffectifInitialSection(groupe) {
    if (Number.isInteger(Number(groupe?.effectif_regulier))) {
      return Number(groupe.effectif_regulier);
    }

    return Array.isArray(groupe?.etudiants) ? groupe.etudiants.length : 0;
  }

  static _ordonnerDemandesEtudiant(coursEtudiants, sectionsParCours) {
    return [...(Array.isArray(coursEtudiants) ? coursEtudiants : [])].sort(
      (coursA, coursB) => {
        const nbSectionsA = (sectionsParCours.get(Number(coursA?.id_cours)) || []).length;
        const nbSectionsB = (sectionsParCours.get(Number(coursB?.id_cours)) || []).length;
        if (nbSectionsA !== nbSectionsB) {
          return nbSectionsA - nbSectionsB;
        }

        const codeA = normaliserTexte(coursA?.code);
        const codeB = normaliserTexte(coursB?.code);
        if (codeA !== codeB) {
          return codeA.localeCompare(codeB, "fr");
        }

        return Number(coursA?.id || 0) - Number(coursB?.id || 0);
      }
    );
  }

  static _ordonnerSectionsCandidats(
    sections,
    occupationAdditionnelleParSection,
    groupePrincipalNomCible = null
  ) {
    return [...sections].sort((sectionA, sectionB) => {
      const prefA = sectionA.nom_groupe === groupePrincipalNomCible ? 0 : 1;
      const prefB = sectionB.nom_groupe === groupePrincipalNomCible ? 0 : 1;
      if (prefA !== prefB) {
        return prefA - prefB;
      }

      const occupationA =
        occupationAdditionnelleParSection.get(FailedCourseEngine._cleSection(sectionA)) || 0;
      const occupationB =
        occupationAdditionnelleParSection.get(FailedCourseEngine._cleSection(sectionB)) || 0;
      if (occupationA !== occupationB) {
        return occupationA - occupationB;
      }

      if (sectionA.effectif_initial !== sectionB.effectif_initial) {
        return sectionA.effectif_initial - sectionB.effectif_initial;
      }

      return normaliserTexte(sectionA.nom_groupe).localeCompare(
        normaliserTexte(sectionB.nom_groupe),
        "fr"
      );
    });
  }

  static _evaluerSectionPourEtudiant({
    section,
    idEtudiant,
    matrix,
    occupationAdditionnelleParSection,
    activerCoursEnLigne,
    effectifAdjustmentsParGroupe = new Map(),
  }) {
    const occupationSupplementaire =
      occupationAdditionnelleParSection.get(FailedCourseEngine._cleSection(section)) || 0;
    const effectifAjuste =
      Number(section.effectif_initial || 0) +
      Number(effectifAdjustmentsParGroupe.get(section.nom_groupe) || 0);
    const capaciteMax = Number(section.capacite_max || 0);

    if (capaciteMax > 0 && effectifAjuste + occupationSupplementaire + 1 > capaciteMax) {
      return {
        compatible: false,
        raison_code: "CAPACITE_INSUFFISANTE",
        raison:
          `Le groupe ${section.nom_groupe} est plein ` +
          `(${effectifAjuste + occupationSupplementaire}/${capaciteMax}).`,
        capacite_max: capaciteMax,
        effectif_initial: effectifAjuste,
        occupation_additionnelle: occupationSupplementaire,
      };
    }

    if (!activerCoursEnLigne && section.placements.some((placement) => placement.est_en_ligne)) {
      return {
        compatible: false,
        raison_code: "SECTION_EN_LIGNE",
        raison: `Le groupe ${section.nom_groupe} contient une seance en ligne.`,
        capacite_max: capaciteMax || null,
        effectif_initial: effectifAjuste,
        occupation_additionnelle: occupationSupplementaire,
      };
    }

    const premierConflit = section.placements.find(
      (placement) =>
        !matrix.etudiantsLibres(
          [idEtudiant],
          placement.date,
          placement.heure_debut,
          placement.heure_fin
        )
    );

    if (premierConflit) {
      return {
        compatible: false,
        raison_code: "CONFLIT_HORAIRE",
        raison:
          `Conflit detecte avec ${premierConflit.date} ` +
          `${String(premierConflit.heure_debut || "").slice(0, 5)}-` +
          `${String(premierConflit.heure_fin || "").slice(0, 5)}.`,
        capacite_max: capaciteMax || null,
        effectif_initial: effectifAjuste,
        occupation_additionnelle: occupationSupplementaire,
      };
    }

    return { compatible: true };
  }

  static _determinerRaisonConflit(tentatives) {
    const aConflitHoraire = tentatives.some((tentative) =>
      ["CONFLIT_HORAIRE", "CONFLIT_HORAIRE_PERSISTANT"].includes(tentative.raison_code)
    );
    const aGroupeComplet = tentatives.some((tentative) =>
      ["GROUPE_COMPLET", "CAPACITE_INSUFFISANTE"].includes(tentative.raison_code)
    );

    if (aConflitHoraire && aGroupeComplet) {
      return "CONFLIT_HORAIRE_ET_CAPACITE";
    }
    if (aConflitHoraire) {
      return "CONFLIT_HORAIRE";
    }
    if (aGroupeComplet) {
      return "GROUPES_COMPLETS";
    }
    if (tentatives.some((tentative) => tentative.raison_code === "SECTION_EN_LIGNE")) {
      return "SECTION_EN_LIGNE";
    }
    return "AUCUNE_SECTION_EXISTANTE_COMPATIBLE";
  }

  static _construireMessageConflit(coursInfo, tentatives) {
    const aConflitHoraire = tentatives.some((tentative) =>
      ["CONFLIT_HORAIRE", "CONFLIT_HORAIRE_PERSISTANT"].includes(tentative.raison_code)
    );
    const aGroupeComplet = tentatives.some((tentative) =>
      ["GROUPE_COMPLET", "CAPACITE_INSUFFISANTE"].includes(tentative.raison_code)
    );

    if (aConflitHoraire && aGroupeComplet) {
      return (
        `Aucun groupe compatible n'est disponible pour ${coursInfo?.code || "ce cours"}. ` +
        "Certaines sections candidates sont en conflit avec l'horaire de l'etudiant, les autres sont deja pleines."
      );
    }
    if (aConflitHoraire) {
      return (
        `Aucun groupe compatible n'est disponible pour ${coursInfo?.code || "ce cours"}. ` +
        "Toutes les sections candidates entrent en conflit avec l'horaire principal ou une autre reprise."
      );
    }
    if (aGroupeComplet) {
      return (
        `Aucun groupe compatible n'est disponible pour ${coursInfo?.code || "ce cours"}. ` +
        "Toutes les sections candidates sont deja a pleine capacite."
      );
    }
    return (
      `Aucun rattachement stable n'a ete trouve pour ${coursInfo?.code || "ce cours"}. ` +
      "Verifiez l'offre de groupes de la session courante."
    );
  }

  static _construireStats({
    affectations,
    affectationsIndividuelles,
    conflits,
    transfertsGlobaux,
    groupesGeneres,
  }) {
    return {
      demandes_total: affectations.length + conflits.length,
      affectations_reussies: affectations.length,
      cours_reguliers_deplaces: Array.isArray(affectationsIndividuelles)
        ? affectationsIndividuelles.length
        : 0,
      conflits: conflits.length,
      transferts_globaux_retenus: Array.isArray(transfertsGlobaux) ? transfertsGlobaux.length : 0,
      groupes_reprise_generes: Array.isArray(groupesGeneres) ? groupesGeneres.length : 0,
      repartition_par_niveau: {
        direct: affectations.filter((item) => item?.niveau_resolution === "DIRECT").length,
        reorganisation_locale: affectations.filter(
          (item) => item?.niveau_resolution === "REORGANISATION_LOCALE"
        ).length,
        groupe_reprise: affectations.filter(
          (item) => item?.niveau_resolution === "GROUPE_REPRISE"
        ).length,
      },
    };
  }

  static _cleSection(section) {
    return `${section.id_cours}|${section.id_groupe}`;
  }

  static _cleSectionGroupeCours(nomGroupe, idCours) {
    return `${String(nomGroupe || "").trim()}|${Number(idCours || 0)}`;
  }
}
