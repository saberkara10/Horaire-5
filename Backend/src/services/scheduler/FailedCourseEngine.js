import {
  isOnlineCourseSchedulingEnabled,
  resolveOperationalCourseCapacity,
} from "./SchedulerConfig.js";

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

export class FailedCourseEngine {
  static rattacherCoursEchoues({
    echouesParEtudiant,
    cours,
    groupesFormes,
    placementsPlanifies,
    matrix,
    activerCoursEnLigne = isOnlineCourseSchedulingEnabled(),
  }) {
    const affectations = [];
    const conflits = [];
    const coursParId = new Map(
      (Array.isArray(cours) ? cours : [])
        .map((coursItem) => [Number(coursItem?.id_cours), coursItem])
        .filter(([idCours]) => Number.isInteger(idCours) && idCours > 0)
    );
    const effectifInitialParGroupe = new Map(
      (Array.isArray(groupesFormes) ? groupesFormes : [])
        .filter((groupe) => groupe?.nomGroupe)
        .map((groupe) => [
          String(groupe.nomGroupe),
          Array.isArray(groupe.etudiants) ? groupe.etudiants.length : 0,
        ])
    );
    const sectionsParCours = FailedCourseEngine._indexerSectionsParCours({
      coursParId,
      placementsPlanifies,
      effectifInitialParGroupe,
      activerCoursEnLigne,
    });
    const occupationAdditionnelleParSection = new Map();

    for (const [idEtudiantBrut, coursEtudiants] of echouesParEtudiant || new Map()) {
      const idEtudiant = Number(idEtudiantBrut);
      if (!Number.isInteger(idEtudiant) || idEtudiant <= 0) {
        continue;
      }

      const demandesTriees = FailedCourseEngine._ordonnerDemandesEtudiant(
        coursEtudiants,
        sectionsParCours
      );

      for (const coursEchoue of demandesTriees) {
        const idCours = Number(coursEchoue?.id_cours);
        const coursInfo = coursParId.get(idCours);
        const contexteConflit = {
          id_cours_echoue: Number(coursEchoue?.id),
          id_etudiant: idEtudiant,
          id_cours: idCours,
          code_cours: coursInfo?.code || null,
          nom_cours: coursInfo?.nom || null,
          etudiants: [idEtudiant],
        };

        if (!coursInfo) {
          conflits.push({
            ...contexteConflit,
            raison_code: "COURS_INTROUVABLE",
            raison: "Le cours echoue n'existe plus dans le catalogue de la session active.",
            groupes_tentes: [],
          });
          continue;
        }

        if (!activerCoursEnLigne && Number(coursInfo.est_en_ligne || 0) === 1) {
          conflits.push({
            ...contexteConflit,
            raison_code: "COURS_EN_LIGNE_DESACTIVE",
            raison:
              "Le cours echoue est uniquement offert en ligne et la planification en ligne est desactivee.",
            groupes_tentes: [],
          });
          continue;
        }

        const sectionsCandidats = sectionsParCours.get(idCours) || [];
        if (sectionsCandidats.length === 0) {
          conflits.push({
            ...contexteConflit,
            raison_code: "AUCUN_GROUPE_REEL",
            raison:
              "Aucun groupe reel de la session courante ne suit actuellement ce cours.",
            groupes_tentes: [],
          });
          continue;
        }

        const tentatives = [];
        let affectationRetenue = null;

        for (const section of FailedCourseEngine._ordonnerSectionsCandidats(
          sectionsCandidats,
          occupationAdditionnelleParSection
        )) {
          const evaluation = FailedCourseEngine._evaluerSectionPourEtudiant({
            section,
            idEtudiant,
            matrix,
            occupationAdditionnelleParSection,
            activerCoursEnLigne,
          });

          if (!evaluation.compatible) {
            tentatives.push({
              id_groupe: section.id_groupe,
              nom_groupe: section.nom_groupe,
              raison_code: evaluation.raison_code,
              raison: evaluation.raison,
              capacite_max: evaluation.capacite_max ?? section.capacite_max ?? null,
              effectif_initial: evaluation.effectif_initial ?? section.effectif_initial ?? 0,
              reprises_deja_planifiees:
                evaluation.occupation_additionnelle ?? 0,
            });
            continue;
          }

          for (const placement of section.placements) {
            matrix.reserverEtudiants(
              [idEtudiant],
              placement.date,
              placement.heure_debut,
              placement.heure_fin
            );
          }

          const cleSection = FailedCourseEngine._cleSection(section);
          occupationAdditionnelleParSection.set(
            cleSection,
            (occupationAdditionnelleParSection.get(cleSection) || 0) + 1
          );

          affectationRetenue = {
            id_cours_echoue: Number(coursEchoue.id),
            id_etudiant: idEtudiant,
            id_cours: idCours,
            id_groupe: section.id_groupe,
            nom_groupe: section.nom_groupe,
            code_cours: coursInfo.code,
            nom_cours: coursInfo.nom,
            nb_seances: section.placements.length,
          };
          break;
        }

        if (affectationRetenue) {
          affectations.push(affectationRetenue);
          continue;
        }

        conflits.push({
          ...contexteConflit,
          raison_code: FailedCourseEngine._determinerRaisonConflit(tentatives),
          raison: FailedCourseEngine._construireMessageConflit(coursInfo, tentatives),
          groupes_tentes: tentatives,
        });
      }
    }

    return {
      affectations,
      conflits,
      stats: {
        demandes_total: affectations.length + conflits.length,
        affectations_reussies: affectations.length,
        conflits: conflits.length,
        cours_en_ligne_ignores: conflits.filter(
          (conflit) => conflit.raison_code === "COURS_EN_LIGNE_DESACTIVE"
        ).length,
      },
    };
  }

  static _indexerSectionsParCours({
    coursParId,
    placementsPlanifies,
    effectifInitialParGroupe,
    activerCoursEnLigne,
  }) {
    const sectionsParCle = new Map();

    for (const placement of Array.isArray(placementsPlanifies) ? placementsPlanifies : []) {
      const idCours = Number(placement?.id_cours);
      const idGroupe = Number(placement?.id_groupe);
      if (!Number.isInteger(idCours) || idCours <= 0) {
        continue;
      }

      if (!Number.isInteger(idGroupe) || idGroupe <= 0) {
        continue;
      }

      if (Boolean(placement?.est_groupe_special)) {
        continue;
      }

      if (!activerCoursEnLigne && Boolean(placement?.est_en_ligne)) {
        continue;
      }

      const coursInfo = coursParId.get(idCours);
      const cleSection = `${idCours}|${idGroupe}`;
      if (!sectionsParCle.has(cleSection)) {
        sectionsParCle.set(cleSection, {
          id_cours: idCours,
          id_groupe: idGroupe,
          nom_groupe: placement.nom_groupe || null,
          code_cours: coursInfo?.code || placement.code_cours || null,
          nom_cours: coursInfo?.nom || placement.nom_cours || null,
          capacite_max: resolveOperationalCourseCapacity(coursInfo),
          effectif_initial: Number(
            effectifInitialParGroupe.get(String(placement.nom_groupe || "")) || 0
          ),
          placements: [],
        });
      }

      sectionsParCle.get(cleSection).placements.push({
        id_cours: idCours,
        id_groupe: idGroupe,
        nom_groupe: placement.nom_groupe || null,
        date: placement.date,
        heure_debut: placement.heure_debut,
        heure_fin: placement.heure_fin,
        est_en_ligne: Boolean(placement.est_en_ligne),
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
      sections.sort((sectionA, sectionB) => {
        const nomA = normaliserTexte(sectionA.nom_groupe);
        const nomB = normaliserTexte(sectionB.nom_groupe);
        return nomA.localeCompare(nomB, "fr");
      });
    }

    return sectionsParCours;
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

  static _ordonnerSectionsCandidats(sections, occupationAdditionnelleParSection) {
    return [...sections].sort((sectionA, sectionB) => {
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
  }) {
    const occupationSupplementaire =
      occupationAdditionnelleParSection.get(FailedCourseEngine._cleSection(section)) || 0;
    const capaciteMax = Number(section.capacite_max || 0);
    if (
      capaciteMax > 0 &&
      section.effectif_initial + occupationSupplementaire + 1 > capaciteMax
    ) {
      return {
        compatible: false,
        raison_code: "GROUPE_COMPLET",
        raison:
          `Le groupe ${section.nom_groupe} est plein ` +
          `(${section.effectif_initial + occupationSupplementaire}/${capaciteMax}).`,
        capacite_max: capaciteMax,
        effectif_initial: section.effectif_initial,
        occupation_additionnelle: occupationSupplementaire,
      };
    }

    if (!activerCoursEnLigne && section.placements.some((placement) => placement.est_en_ligne)) {
      return {
        compatible: false,
        raison_code: "SECTION_EN_LIGNE",
        raison: `Le groupe ${section.nom_groupe} contient une seance en ligne.`,
        capacite_max: capaciteMax || null,
        effectif_initial: section.effectif_initial,
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
        effectif_initial: section.effectif_initial,
        occupation_additionnelle: occupationSupplementaire,
      };
    }

    return { compatible: true };
  }

  static _determinerRaisonConflit(tentatives) {
    const aConflitHoraire = tentatives.some(
      (tentative) => tentative.raison_code === "CONFLIT_HORAIRE"
    );
    const aGroupeComplet = tentatives.some(
      (tentative) => tentative.raison_code === "GROUPE_COMPLET"
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

    return "AUCUNE_SECTION_COMPATIBLE";
  }

  static _construireMessageConflit(coursInfo, tentatives) {
    const aConflitHoraire = tentatives.some(
      (tentative) => tentative.raison_code === "CONFLIT_HORAIRE"
    );
    const aGroupeComplet = tentatives.some(
      (tentative) => tentative.raison_code === "GROUPE_COMPLET"
    );

    if (aConflitHoraire && aGroupeComplet) {
      return (
        `Aucun groupe compatible n'est disponible pour ${coursInfo.code}. ` +
        "Certaines sections candidates sont en conflit avec l'horaire de l'etudiant, les autres sont deja pleines."
      );
    }

    if (aConflitHoraire) {
      return (
        `Aucun groupe compatible n'est disponible pour ${coursInfo.code}. ` +
        "Toutes les sections candidates entrent en conflit avec l'horaire principal ou une autre reprise."
      );
    }

    if (aGroupeComplet) {
      return (
        `Aucun groupe compatible n'est disponible pour ${coursInfo.code}. ` +
        "Toutes les sections candidates sont deja a pleine capacite."
      );
    }

    return (
      `Aucun rattachement stable n'a ete trouve pour ${coursInfo.code}. ` +
      "Verifiez l'offre de groupes de la session courante."
    );
  }

  static _cleSection(section) {
    return `${section.id_cours}|${section.id_groupe}`;
  }
}
