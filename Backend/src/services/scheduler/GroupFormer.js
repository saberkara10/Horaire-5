import {
  getSchedulerMaxGroupCapacity,
  getSchedulerTargetGroupSize,
  isCourseSchedulable,
} from "./SchedulerConfig.js";

export class GroupFormer {
  static formerGroupes(etudiants, cours, echouesParEtudiant) {
    const groupesFormes = [];
    const affectationsEtudiantGroupe = new Map();

    const etudiantsValides = (Array.isArray(etudiants) ? etudiants : []).filter(
      (etudiant) =>
        etudiant?.programme &&
        String(etudiant.programme).trim() !== "" &&
        etudiant?.etape != null &&
        !Number.isNaN(Number(etudiant.etape))
    );

    if (etudiantsValides.length === 0 && !(echouesParEtudiant instanceof Map)) {
      return { groupesFormes, affectationsEtudiantGroupe };
    }

    const coursPlanifiables = (Array.isArray(cours) ? cours : []).filter((coursItem) =>
      isCourseSchedulable(coursItem)
    );
    const segmentsEtudiants = GroupFormer._segmenterEtudiants(etudiantsValides);
    const chargeReprisesParCours = GroupFormer._indexerChargeReprisesParCours(
      echouesParEtudiant,
      coursPlanifiables
    );
    const reprisesParSegment = GroupFormer._segmenterChargeReprises(
      coursPlanifiables,
      chargeReprisesParCours
    );

    const segmentKeys = new Set([
      ...segmentsEtudiants.keys(),
      ...reprisesParSegment.keys(),
    ]);

    for (const segmentKey of [...segmentKeys].sort((a, b) => a.localeCompare(b, "fr"))) {
      const [programme, etapeStr] = segmentKey.split("|");
      const etudiantsSegment = segmentsEtudiants.get(segmentKey) || [];
      const coursSegment = coursPlanifiables.filter((coursItem) =>
        GroupFormer._coursCorrespondAuSegment(coursItem, programme, etapeStr)
      );

      if (coursSegment.length === 0) {
        continue;
      }

      const chargeSegment = reprisesParSegment.get(segmentKey) || new Map();
      const groupesSegment = GroupFormer._formerGroupesPourSegment({
        programme,
        etape: etapeStr,
        etudiantsSegment,
        coursSegment,
        chargeSegment,
      });

      for (const groupe of groupesSegment) {
        groupesFormes.push(groupe);
        for (const idEtudiant of groupe.etudiants) {
          if (!affectationsEtudiantGroupe.has(idEtudiant)) {
            affectationsEtudiantGroupe.set(idEtudiant, []);
          }
          affectationsEtudiantGroupe.get(idEtudiant).push(groupe.nomGroupe);
        }
      }
    }

    return { groupesFormes, affectationsEtudiantGroupe };
  }

  static formerGroupesSpeciaux(echouesParEtudiant, cours) {
    const groupesSpeciaux = [];
    const etudiantsParCoursEchoue = new Map();

    for (const [idEtudiant, coursEchoues] of echouesParEtudiant || new Map()) {
      for (const coursEchoue of Array.isArray(coursEchoues) ? coursEchoues : []) {
        const idCours = Number(coursEchoue?.id_cours);
        if (!Number.isInteger(idCours) || idCours <= 0) {
          continue;
        }

        if (!etudiantsParCoursEchoue.has(idCours)) {
          etudiantsParCoursEchoue.set(idCours, []);
        }
        etudiantsParCoursEchoue.get(idCours).push(idEtudiant);
      }
    }

    let compteurGroupe = 1;
    for (const [idCours, etudiantsCours] of etudiantsParCoursEchoue) {
      const coursInfo = (Array.isArray(cours) ? cours : []).find(
        (coursItem) => Number(coursItem?.id_cours) === idCours
      );
      if (!coursInfo) {
        continue;
      }

      const groupes = GroupFormer._creerSquelettesGroupes({
        programme: coursInfo.programme || "Inconnu",
        etape: String(coursInfo.etape_etude || "1"),
        etudiantsSegment: etudiantsCours.map((idEtudiant) => ({ id_etudiant: idEtudiant })),
        nbGroupes: Math.max(
          1,
          Math.ceil(etudiantsCours.length / getSchedulerTargetGroupSize())
        ),
        tailleMax: getSchedulerMaxGroupCapacity(),
      });

      for (const groupe of groupes) {
        groupesSpeciaux.push({
          ...groupe,
          nomGroupe: `GS-${coursInfo.code}-${compteurGroupe++}`,
          idCours,
          est_groupe_special: true,
        });
      }
    }

    return groupesSpeciaux;
  }

  static lireEffectifCours(groupe, idCours) {
    const effectifRegulier = GroupFormer._lireEffectifRegulier(groupe);
    const chargesParCours = groupe?.charge_estimee_par_cours || {};
    const chargeProjetee = Number(chargesParCours?.[Number(idCours)]);

    return Number.isFinite(chargeProjetee) && chargeProjetee > 0
      ? chargeProjetee
      : effectifRegulier;
  }

  static lireEffectifProjeteMax(groupe) {
    const effectifProjete = Number(groupe?.effectif_projete_max);
    if (Number.isFinite(effectifProjete) && effectifProjete >= 0) {
      return effectifProjete;
    }

    return GroupFormer._lireEffectifRegulier(groupe);
  }

  static _formerGroupesPourSegment({
    programme,
    etape,
    etudiantsSegment,
    coursSegment,
    chargeSegment,
  }) {
    const effectifRegulier = etudiantsSegment.length;
    const chargeRepriseMax = Math.max(
      0,
      ...[...chargeSegment.values()].map((value) => Number(value) || 0)
    );
    const volumeCoursMax = effectifRegulier + chargeRepriseMax;

    if (effectifRegulier === 0 && volumeCoursMax === 0) {
      return [];
    }

    const tailleMax = getSchedulerMaxGroupCapacity();
    const tailleCible = Math.min(getSchedulerTargetGroupSize(), tailleMax);
    const nbGroupes = Math.max(
      1,
      Math.ceil(effectifRegulier / tailleCible),
      Math.ceil(volumeCoursMax / tailleCible),
      Math.ceil(volumeCoursMax / tailleMax)
    );

    const groupes = GroupFormer._creerSquelettesGroupes({
      programme,
      etape,
      etudiantsSegment,
      nbGroupes,
      tailleMax,
    });

    const coursTries = [...coursSegment].sort((coursA, coursB) =>
      String(coursA?.code || "").localeCompare(String(coursB?.code || ""), "fr")
    );

    for (const coursItem of coursTries) {
      const idCours = Number(coursItem?.id_cours);
      const demandeReprise = Number(chargeSegment.get(idCours) || 0);
      if (demandeReprise <= 0) {
        continue;
      }

      const repartition = GroupFormer._repartirChargeReprisesCours({
        groupes,
        idCours,
        demandeReprise,
        tailleMax,
      });

      for (const groupe of groupes) {
        const cleCours = String(idCours);
        const reprisesReservees = repartition.get(groupe.nomGroupe) || 0;
        const effectifRegulierGroupe = GroupFormer._lireEffectifRegulier(groupe);
        const chargeProjetee = effectifRegulierGroupe + reprisesReservees;

        groupe.reprises_reservees_par_cours[cleCours] = reprisesReservees;
        groupe.charge_estimee_par_cours[cleCours] = chargeProjetee;
        groupe.effectif_projete_max = Math.max(
          Number(groupe.effectif_projete_max || 0),
          chargeProjetee
        );

        if (reprisesReservees > 0) {
          groupe.resume_reprises.push({
            id_cours: idCours,
            code_cours: coursItem.code,
            reprises_reservees: reprisesReservees,
            charge_projetee: chargeProjetee,
          });
        }
      }
    }

    for (const groupe of groupes) {
      groupe.effectif_projete_max = Math.max(
        Number(groupe.effectif_projete_max || 0),
        GroupFormer._lireEffectifRegulier(groupe)
      );
      groupe.nb_groupes_segment = nbGroupes;
      groupe.charge_reprise_max_segment = chargeRepriseMax;
      groupe.taille_cible_segment = tailleCible;
    }

    return groupes;
  }

  static _repartirChargeReprisesCours({ groupes, idCours, demandeReprise, tailleMax }) {
    const repartition = new Map(groupes.map((groupe) => [groupe.nomGroupe, 0]));
    let chargeAllouee = 0;

    for (let index = 0; index < demandeReprise; index += 1) {
      const candidat = [...groupes]
        .filter((groupe) => {
          const chargeCourante =
            GroupFormer._lireEffectifRegulier(groupe) +
            (repartition.get(groupe.nomGroupe) || 0);
          return chargeCourante < tailleMax;
        })
        .sort((groupeA, groupeB) => {
          const chargeA =
            GroupFormer._lireEffectifRegulier(groupeA) +
            (repartition.get(groupeA.nomGroupe) || 0);
          const chargeB =
            GroupFormer._lireEffectifRegulier(groupeB) +
            (repartition.get(groupeB.nomGroupe) || 0);

          if (chargeA !== chargeB) {
            return chargeA - chargeB;
          }

          const reprisesA = repartition.get(groupeA.nomGroupe) || 0;
          const reprisesB = repartition.get(groupeB.nomGroupe) || 0;
          if (reprisesA !== reprisesB) {
            return reprisesA - reprisesB;
          }

          return String(groupeA.nomGroupe).localeCompare(
            String(groupeB.nomGroupe),
            "fr"
          );
        })[0];

      if (!candidat) {
        break;
      }

      repartition.set(
        candidat.nomGroupe,
        (repartition.get(candidat.nomGroupe) || 0) + 1
      );
      chargeAllouee += 1;
    }

    const cleCours = String(idCours);
    for (const groupe of groupes) {
      if (!(cleCours in groupe.charge_estimee_par_cours)) {
        groupe.charge_estimee_par_cours[cleCours] =
          GroupFormer._lireEffectifRegulier(groupe);
      }
    }

    if (chargeAllouee !== demandeReprise) {
      throw new Error(
        `Impossible de reserver la charge de reprise du cours ${idCours}: ` +
        `${chargeAllouee}/${demandeReprise} places projetees.`
      );
    }

    return repartition;
  }

  static _creerSquelettesGroupes({
    programme,
    etape,
    etudiantsSegment,
    nbGroupes,
    tailleMax,
  }) {
    if (nbGroupes <= 0) {
      return [];
    }

    const etudiantsTries = [...etudiantsSegment].sort((etudiantA, etudiantB) =>
      GroupFormer._cleTriEtudiant(etudiantA).localeCompare(
        GroupFormer._cleTriEtudiant(etudiantB),
        "fr"
      )
    );
    const nbEtudiants = etudiantsTries.length;
    const tailleBase = Math.floor(nbEtudiants / nbGroupes);
    const reste = nbEtudiants % nbGroupes;
    const etapeNum = GroupFormer._safeInt(etape);
    const programmeCode = GroupFormer._codeProgramme(programme);

    const groupes = [];
    let cursor = 0;

    for (let index = 0; index < nbGroupes; index += 1) {
      const tailleSegment = tailleBase + (index < reste ? 1 : 0);
      const tranche = etudiantsTries.slice(cursor, cursor + tailleSegment);
      cursor += tailleSegment;

      groupes.push({
        nomGroupe: `G${programmeCode}-E${etape}-${index + 1}`,
        programme: programme || "Inconnu",
        etape: etapeNum,
        taille_max: tailleMax,
        est_groupe_special: false,
        etudiants: tranche.map((etudiant) => etudiant.id_etudiant || etudiant),
        effectif_regulier: tranche.length,
        effectif_projete_max: tranche.length,
        charge_estimee_par_cours: {},
        reprises_reservees_par_cours: {},
        resume_reprises: [],
      });
    }

    return groupes;
  }

  static _segmenterEtudiants(etudiants) {
    const segments = new Map();

    for (const etudiant of etudiants) {
      const programme = String(etudiant?.programme || "").trim();
      const etape = etudiant?.etape != null ? String(Number(etudiant.etape)) : "";
      if (!programme || !etape) {
        continue;
      }

      const key = `${programme}|${etape}`;
      if (!segments.has(key)) {
        segments.set(key, []);
      }
      segments.get(key).push(etudiant);
    }

    return segments;
  }

  static _indexerChargeReprisesParCours(echouesParEtudiant, coursPlanifiables) {
    const coursPlanifiablesIds = new Set(
      coursPlanifiables
        .map((coursItem) => Number(coursItem?.id_cours))
        .filter((idCours) => Number.isInteger(idCours) && idCours > 0)
    );
    const chargeParCours = new Map();

    for (const coursEtudiants of echouesParEtudiant?.values?.() || []) {
      for (const coursEchoue of Array.isArray(coursEtudiants) ? coursEtudiants : []) {
        const idCours = Number(coursEchoue?.id_cours);
        if (!coursPlanifiablesIds.has(idCours)) {
          continue;
        }

        chargeParCours.set(idCours, (chargeParCours.get(idCours) || 0) + 1);
      }
    }

    return chargeParCours;
  }

  static _segmenterChargeReprises(coursPlanifiables, chargeReprisesParCours) {
    const reprisesParSegment = new Map();

    for (const coursItem of coursPlanifiables) {
      const idCours = Number(coursItem?.id_cours);
      const charge = Number(chargeReprisesParCours.get(idCours) || 0);
      if (charge <= 0) {
        continue;
      }

      const programme = String(coursItem?.programme || "").trim();
      const etape = String(coursItem?.etape_etude || "").trim();
      if (!programme || !etape) {
        continue;
      }

      const key = `${programme}|${etape}`;
      if (!reprisesParSegment.has(key)) {
        reprisesParSegment.set(key, new Map());
      }
      reprisesParSegment.get(key).set(idCours, charge);
    }

    return reprisesParSegment;
  }

  static _coursCorrespondAuSegment(cours, programme, etape) {
    const programmeCours = GroupFormer._normaliser(cours?.programme);
    const programmeSegment = GroupFormer._normaliser(programme);
    const etapeCours = String(cours?.etape_etude || "").trim();
    const etapeSegment = String(GroupFormer._safeInt(etape) ?? etape).trim();

    return (
      programmeCours !== "" &&
      programmeCours === programmeSegment &&
      etapeCours !== "" &&
      etapeCours === etapeSegment
    );
  }

  static _lireEffectifRegulier(groupe) {
    if (Number.isInteger(Number(groupe?.effectif_regulier))) {
      return Number(groupe.effectif_regulier);
    }

    return Array.isArray(groupe?.etudiants) ? groupe.etudiants.length : 0;
  }

  static _cleTriEtudiant(etudiant) {
    return [
      String(etudiant?.matricule || ""),
      String(etudiant?.nom || ""),
      String(etudiant?.prenom || ""),
      String(etudiant?.id_etudiant || ""),
    ].join("|");
  }

  static _codeProgramme(programme) {
    if (!programme) {
      return "XX";
    }

    const mots = String(programme)
      .split(/\s+/)
      .filter((mot) => mot.length >= 3);

    return (
      mots
        .slice(0, 2)
        .map((mot) => mot[0].toUpperCase())
        .join("") || String(programme).slice(0, 2).toUpperCase()
    );
  }

  static _normaliser(texte) {
    return String(texte || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  static _safeInt(valeur) {
    if (
      valeur == null ||
      valeur === "" ||
      valeur === "null" ||
      valeur === "undefined"
    ) {
      return null;
    }

    const parsed = parseInt(valeur, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
