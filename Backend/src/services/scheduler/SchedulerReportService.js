import pool from "../../../db.js";
import { FailedCourseDebugService } from "./FailedCourseDebugService.js";

function parseJson(value, fallback = {}) {
  if (!value) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toIntegerList(values) {
  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

function formatProfessorName(professeur) {
  return `${String(professeur?.prenom || "").trim()} ${String(professeur?.nom || "").trim()}`
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeReasonCode(reasonCode) {
  return String(reasonCode || "")
    .replace(/^GARANTIE_/, "")
    .trim();
}

function buildReasonBreakdown(items, reasonKey = "raison_code") {
  const counts = new Map();

  for (const item of items || []) {
    const code = String(item?.[reasonKey] || "INCONNU").trim() || "INCONNU";
    counts.set(code, (counts.get(code) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([code, total]) => ({ code, total }))
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code, "fr"));
}

function readPersistedReasonBreakdown(payload, key) {
  return Array.isArray(payload?.resume_metier?.[key])
    ? payload.resume_metier[key]
    : null;
}

function readNumeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function extractScoringV1(payload) {
  return payload?.details?.scoring_v1 || payload?.scoring_v1 || null;
}

function buildScoringModeSummary(modeKey, modePayload = {}) {
  return {
    mode: modePayload?.mode || modeKey,
    scoreGlobal: readNumeric(modePayload?.scoreGlobal),
    scoreEtudiant: readNumeric(modePayload?.scoreEtudiant),
    scoreProfesseur: readNumeric(modePayload?.scoreProfesseur),
    scoreGroupe: readNumeric(modePayload?.scoreGroupe),
  };
}

function buildScoringSummary(payload, row = {}) {
  const scoring = extractScoringV1(payload);
  const modes = scoring?.modes || {};
  const studentTotals = scoring?.details?.etudiant?.totals || {};
  const teacherTotals = scoring?.details?.professeur?.totals || {};
  const groupTotals = scoring?.details?.groupe?.totals || {};

  return {
    disponible: Boolean(scoring),
    version: scoring?.version || "v1",
    modes: Object.fromEntries(
      ["etudiant", "professeur", "equilibre"].map((modeKey) => [
        modeKey,
        buildScoringModeSummary(modeKey, modes?.[modeKey] || {}),
      ])
    ),
    metrics: {
      pausesEtudiantsRespectees: readNumeric(
        scoring?.metrics?.pausesEtudiantsRespectees ??
          studentTotals.pauseRespectedCount ??
          studentTotals.dynamicBreaksRespected
      ),
      pausesEtudiantsManquees: readNumeric(
        scoring?.metrics?.pausesEtudiantsManquees ??
          studentTotals.pauseMissedCount ??
          studentTotals.dynamicBreaksMissed
      ),
      pausesProfesseursRespectees: readNumeric(
        scoring?.metrics?.pausesProfesseursRespectees ??
          teacherTotals.pauseRespectedCount
      ),
      pausesProfesseursManquees: readNumeric(
        scoring?.metrics?.pausesProfesseursManquees ??
          teacherTotals.pauseMissedCount
      ),
      pausesGroupesRespectees: readNumeric(
        scoring?.metrics?.pausesGroupesRespectees ??
          groupTotals.pauseRespectedCount
      ),
      pausesGroupesManquees: readNumeric(
        scoring?.metrics?.pausesGroupesManquees ??
          groupTotals.pauseMissedCount
      ),
      nbCoursNonPlanifies: readNumeric(
        scoring?.metrics?.nbCoursNonPlanifies ??
          (Array.isArray(payload?.non_planifies) ? payload.non_planifies.length : null) ??
          row?.nb_cours_non_planifies
      ),
      nbConflitsEvites: readNumeric(scoring?.metrics?.nbConflitsEvites),
      penaliteCoursTardifsTotale: readNumeric(
        scoring?.metrics?.penaliteCoursTardifsTotale ??
          readNumeric(studentTotals.lateCoursePenalty) +
            readNumeric(teacherTotals.lateCoursePenalty) +
            readNumeric(groupTotals.lateCoursePenalty)
      ),
    },
  };
}

export class SchedulerReportService {
  static async listerRapports(executor = pool) {
    const [rows] = await executor.query(
      `SELECT rg.id,
              rg.id_session,
              rg.genere_par,
              rg.date_generation,
              rg.score_qualite,
              rg.nb_cours_planifies,
              rg.nb_cours_non_planifies,
              rg.nb_cours_echoues_traites,
              rg.nb_cours_en_ligne_generes,
              rg.nb_groupes_speciaux,
              rg.nb_resolutions_manuelles,
              rg.details,
              s.nom AS session_nom,
              u.nom AS generateur_nom,
              u.prenom AS generateur_prenom
       FROM rapports_generation rg
       LEFT JOIN sessions s ON s.id_session = rg.id_session
       LEFT JOIN utilisateurs u ON u.id_utilisateur = rg.genere_par
       ORDER BY rg.date_generation DESC
       LIMIT 50`
    );

    return rows.map((row) => {
      const payload = SchedulerReportService._parsePayload(row.details);
      const nonPlanifies = SchedulerReportService._extractNonPlanifies(payload);
      const reprises = SchedulerReportService._extractResolutionsManuelles(payload);

      return {
        ...row,
        resume_scoring_v1: buildScoringSummary(payload, row),
        resume_metier: {
          raisons_non_planifiees:
            readPersistedReasonBreakdown(payload, "raisons_non_planifiees") ||
            buildReasonBreakdown(nonPlanifies),
          raisons_reprises:
            readPersistedReasonBreakdown(payload, "raisons_reprises") ||
            buildReasonBreakdown(reprises),
        },
      };
    });
  }

  static async lireRapport(idRapport, executor = pool) {
    const [rows] = await executor.query(
      `SELECT rg.id,
              rg.id_session,
              rg.genere_par,
              rg.date_generation,
              rg.score_qualite,
              rg.nb_cours_planifies,
              rg.nb_cours_non_planifies,
              rg.nb_cours_echoues_traites,
              rg.nb_cours_en_ligne_generes,
              rg.nb_groupes_speciaux,
              rg.nb_resolutions_manuelles,
              rg.details,
              s.nom AS session_nom,
              u.nom AS generateur_nom,
              u.prenom AS generateur_prenom
       FROM rapports_generation rg
       LEFT JOIN sessions s ON s.id_session = rg.id_session
       LEFT JOIN utilisateurs u ON u.id_utilisateur = rg.genere_par
       WHERE rg.id = ?
       LIMIT 1`,
      [Number(idRapport)]
    );

    if (rows.length === 0) {
      return null;
    }

    return SchedulerReportService._hydraterRapport(rows[0], executor);
  }

  static async _hydraterRapport(row, executor) {
    const payload = SchedulerReportService._parsePayload(row.details);
    const nonPlanifies = SchedulerReportService._extractNonPlanifies(payload);
    const resolutionsManuelles =
      SchedulerReportService._extractResolutionsManuelles(payload);

    const [coursIndex, groupesIndex, professeursCompatibles, sallesCompatibles] =
      await Promise.all([
        SchedulerReportService._chargerCours(nonPlanifies, executor),
        SchedulerReportService._chargerGroupes(row.id_session, nonPlanifies, resolutionsManuelles, executor),
        SchedulerReportService._chargerProfesseursCompatibles(
          row.id_session,
          nonPlanifies,
          executor
        ),
        SchedulerReportService._chargerSallesCompatibles(nonPlanifies, executor),
      ]);

    const reprisesNonResolues = await SchedulerReportService._enrichirResolutionsManuelles({
      idSession: row.id_session,
      resolutionsManuelles,
      groupesIndex,
      executor,
    });
    const coursNonPlanifies = SchedulerReportService._enrichirNonPlanifies({
      nonPlanifies,
      coursIndex,
      groupesIndex,
      professeursCompatibles,
      sallesCompatibles,
    });

    return {
      ...row,
      details_bruts: payload,
      resume_scoring_v1: buildScoringSummary(payload, row),
      reprises_non_resolues: reprisesNonResolues,
      cours_non_planifies: coursNonPlanifies,
      resume_metier: {
        raisons_non_planifiees:
          readPersistedReasonBreakdown(payload, "raisons_non_planifiees") ||
          buildReasonBreakdown(coursNonPlanifies),
        raisons_reprises:
          readPersistedReasonBreakdown(payload, "raisons_reprises") ||
          buildReasonBreakdown(reprisesNonResolues),
      },
    };
  }

  static _parsePayload(detailsRaw) {
    const payload = parseJson(detailsRaw, {});

    if (!payload.details || typeof payload.details !== "object") {
      payload.details = {};
    }

    if (!payload.details.scoring_v1 && payload.scoring_v1 && typeof payload.scoring_v1 === "object") {
      payload.details = {
        ...payload.details,
        scoring_v1: payload.scoring_v1,
      };
    }

    return payload;
  }

  static _extractNonPlanifies(payload) {
    return Array.isArray(payload?.non_planifies) ? payload.non_planifies : [];
  }

  static _extractResolutionsManuelles(payload) {
    if (Array.isArray(payload?.resolutions_manuelles)) {
      return payload.resolutions_manuelles;
    }

    if (Array.isArray(payload?.details?.reprises?.conflits_details)) {
      return payload.details.reprises.conflits_details;
    }

    return [];
  }

  static async _chargerCours(nonPlanifies, executor) {
    const idsCours = toIntegerList(nonPlanifies.map((item) => item.id_cours));
    if (idsCours.length === 0) {
      return new Map();
    }

    const placeholders = idsCours.map(() => "?").join(", ");
    const [rows] = await executor.query(
      `SELECT id_cours, code, nom, programme, etape_etude, type_salle, est_en_ligne
       FROM cours
       WHERE id_cours IN (${placeholders})`,
      idsCours
    );

    return new Map(rows.map((row) => [Number(row.id_cours), row]));
  }

  static async _chargerGroupes(idSession, nonPlanifies, resolutionsManuelles, executor) {
    const nomsGroupes = [
      ...new Set(
        [
          ...nonPlanifies.map((item) => String(item?.groupe || "").trim()),
          ...resolutionsManuelles
            .flatMap((item) =>
              Array.isArray(item?.groupes_tentes)
                ? item.groupes_tentes.map((groupe) => String(groupe?.nom_groupe || "").trim())
                : []
            ),
        ].filter(Boolean)
      ),
    ];

    if (nomsGroupes.length === 0) {
      return new Map();
    }

    const placeholders = nomsGroupes.map(() => "?").join(", ");
    const [rows] = await executor.query(
      `SELECT id_groupes_etudiants, nom_groupe, programme, etape, id_session
       FROM groupes_etudiants
       WHERE nom_groupe IN (${placeholders})
         AND (? IS NULL OR id_session = ?)`,
      [...nomsGroupes, idSession ?? null, idSession ?? null]
    );

    return new Map(rows.map((row) => [String(row.nom_groupe), row]));
  }

  static async _chargerProfesseursCompatibles(idSession, nonPlanifies, executor) {
    const idsCours = toIntegerList(nonPlanifies.map((item) => item.id_cours));
    if (idsCours.length === 0) {
      return new Map();
    }

    const placeholders = idsCours.map(() => "?").join(", ");
    const [rows] = await executor.query(
      `SELECT pc.id_cours,
              p.id_professeur,
              p.matricule,
              p.nom,
              p.prenom,
              COALESCE(stats.series_actives, 0) AS series_actives,
              COALESCE(stats.groupes_actifs, 0) AS groupes_actifs
       FROM professeur_cours pc
       JOIN professeurs p
         ON p.id_professeur = pc.id_professeur
       LEFT JOIN (
         SELECT ac.id_professeur,
                COUNT(DISTINCT CONCAT(ag.id_groupes_etudiants, '|', ac.id_cours)) AS series_actives,
                COUNT(DISTINCT ag.id_groupes_etudiants) AS groupes_actifs
         FROM affectation_cours ac
         JOIN affectation_groupes ag
           ON ag.id_affectation_cours = ac.id_affectation_cours
         JOIN groupes_etudiants ge
           ON ge.id_groupes_etudiants = ag.id_groupes_etudiants
         WHERE ge.id_session = ?
         GROUP BY ac.id_professeur
       ) stats
         ON stats.id_professeur = p.id_professeur
       WHERE pc.id_cours IN (${placeholders})
       ORDER BY pc.id_cours ASC, stats.series_actives ASC, p.nom ASC, p.prenom ASC`,
      [Number(idSession) || null, ...idsCours]
    );

    const index = new Map();
    for (const row of rows) {
      const idCours = Number(row.id_cours);
      if (!index.has(idCours)) {
        index.set(idCours, []);
      }
      index.get(idCours).push({
        id_professeur: Number(row.id_professeur),
        matricule: row.matricule,
        nom_complet: formatProfessorName(row),
        series_actives: Number(row.series_actives || 0),
        groupes_actifs: Number(row.groupes_actifs || 0),
      });
    }

    return index;
  }

  static async _chargerSallesCompatibles(nonPlanifies, executor) {
    const idsCours = toIntegerList(nonPlanifies.map((item) => item.id_cours));
    if (idsCours.length === 0) {
      return new Map();
    }

    const placeholdersCours = idsCours.map(() => "?").join(", ");
    const [coursRows, sallesRows] = await Promise.all([
      executor.query(
        `SELECT id_cours, type_salle
         FROM cours
         WHERE id_cours IN (${placeholdersCours})`,
        idsCours
      ),
      executor.query(
        `SELECT id_salle, code, type, capacite
         FROM salles
         ORDER BY type ASC, code ASC`
      ),
    ]);

    const salles = sallesRows[0];
    const index = new Map();
    for (const row of coursRows[0]) {
      const typeSalle = String(row.type_salle || "").trim().toLowerCase();
      index.set(
        Number(row.id_cours),
        salles
          .filter((salle) => String(salle.type || "").trim().toLowerCase() === typeSalle)
          .map((salle) => ({
            id_salle: Number(salle.id_salle),
            code: salle.code,
            capacite: Number(salle.capacite || 0),
          }))
      );
    }

    return index;
  }

  static async _enrichirResolutionsManuelles({
    idSession,
    resolutionsManuelles,
    groupesIndex,
    executor,
  }) {
    const idsEtudiants = toIntegerList(resolutionsManuelles.map((item) => item.id_etudiant));
    const etudiantsIndex = await SchedulerReportService._chargerEtudiants(
      idsEtudiants,
      executor
    );

    const resultat = [];
    for (const conflit of resolutionsManuelles) {
      const idEtudiant = Number(conflit.id_etudiant);
      const etudiant = etudiantsIndex.get(idEtudiant) || null;
      let diagnostic = null;

      try {
        const rapportDebug = await FailedCourseDebugService.genererRapport(
          {
            idSession,
            idEtudiant,
            codes: conflit.code_cours,
            statut: "resolution_manuelle",
          },
          executor
        );
        diagnostic = rapportDebug.diagnostics?.[0] || null;
      } catch {
        diagnostic = null;
      }

      const groupesCandidats =
        diagnostic?.groupes_candidats ||
        (Array.isArray(conflit?.groupes_tentes)
          ? conflit.groupes_tentes.map((groupe) => ({
              id_groupe: groupe.id_groupe,
              nom_groupe: groupe.nom_groupe,
              decision: "REJETE",
              raisons: [
                {
                  code: groupe.raison_code || "INCONNU",
                  message: groupe.raison || "Groupe rejete.",
                },
              ],
              conflits: [],
            }))
          : []);
      resultat.push({
        ...conflit,
        etudiant: etudiant
          ? {
              id_etudiant: idEtudiant,
              matricule: etudiant.matricule,
              nom: etudiant.nom,
              prenom: etudiant.prenom,
              groupe_principal: etudiant.groupe_principal,
              programme: etudiant.programme,
              etape: etudiant.etape,
            }
          : {
              id_etudiant: idEtudiant,
              matricule: null,
              nom: null,
              prenom: null,
              groupe_principal: null,
            },
        groupe_principal:
          etudiant?.groupe_principal || groupesIndex.get(conflit?.nom_groupe)?.nom_groupe || null,
        groupes_candidats: groupesCandidats,
        conclusion_diagnostic: diagnostic?.conclusion || null,
        solutions_manuelles: SchedulerReportService._suggererActionsReprise(
          conflit,
          diagnostic
        ),
      });
    }

    return resultat;
  }

  static async _chargerEtudiants(idsEtudiants, executor) {
    if (idsEtudiants.length === 0) {
      return new Map();
    }

    const placeholders = idsEtudiants.map(() => "?").join(", ");
    const [rows] = await executor.query(
      `SELECT e.id_etudiant,
              e.matricule,
              e.nom,
              e.prenom,
              e.programme,
              e.etape,
              ge.nom_groupe AS groupe_principal
       FROM etudiants e
       LEFT JOIN groupes_etudiants ge
         ON ge.id_groupes_etudiants = e.id_groupes_etudiants
       WHERE e.id_etudiant IN (${placeholders})`,
      idsEtudiants
    );

    return new Map(rows.map((row) => [Number(row.id_etudiant), row]));
  }

  static _enrichirNonPlanifies({
    nonPlanifies,
    coursIndex,
    groupesIndex,
    professeursCompatibles,
    sallesCompatibles,
  }) {
    return nonPlanifies.map((item) => {
      const idCours = Number(item.id_cours);
      const cours = coursIndex.get(idCours) || null;
      const groupe = item.groupe ? groupesIndex.get(String(item.groupe)) || null : null;
      const profs = (professeursCompatibles.get(idCours) || []).slice(0, 5);
      const salles = (sallesCompatibles.get(idCours) || []).slice(0, 5);
      const reasonCode = normalizeReasonCode(item.raison_code);

      return {
        ...item,
        cours: cours
          ? {
              id_cours: idCours,
              code: cours.code,
              nom: cours.nom,
              programme: cours.programme,
              etape: cours.etape_etude,
              type_salle: cours.type_salle,
            }
          : null,
        groupe: groupe
          ? {
              id_groupe: Number(groupe.id_groupes_etudiants),
              nom_groupe: groupe.nom_groupe,
              programme: groupe.programme,
              etape: groupe.etape,
            }
          : item.groupe
          ? {
              id_groupe: null,
              nom_groupe: item.groupe,
              programme: null,
              etape: null,
            }
          : null,
        professeurs_compatibles: profs,
        salles_compatibles: salles,
        solutions_manuelles: SchedulerReportService._suggererActionsCoursNonPlanifie({
          item,
          cours,
          profs,
          salles,
          reasonCode,
        }),
      };
    });
  }

  static _suggererActionsReprise(conflit, diagnostic) {
    const suggestions = [];
    const reasonCode = String(conflit?.raison_code || "");

    if (reasonCode === "AUCUN_GROUPE_REEL") {
      suggestions.push(
        `Regenerer ou ouvrir au moins un groupe reel pour ${conflit.code_cours} dans la session cible.`
      );
    }

    if (reasonCode.includes("CONFLIT_HORAIRE")) {
      const premierGroupeCompatible = diagnostic?.groupes_candidats?.find(
        (groupe) => groupe.place_disponible && !groupe.compatibilite_horaire
      );
      suggestions.push(
        "Verifier manuellement l'horaire principal de l'etudiant et deplacer soit le groupe principal, soit la reprise sur un autre groupe compatible."
      );
      if (premierGroupeCompatible?.conflits?.[0]?.conflit_avec) {
        const conflitHoraire = premierGroupeCompatible.conflits[0].conflit_avec;
        suggestions.push(
          `Le premier conflit connu concerne ${conflitHoraire.code_cours} (${conflitHoraire.groupe_source}) le ${conflitHoraire.date} de ${String(conflitHoraire.heure_debut).slice(0, 5)} a ${String(conflitHoraire.heure_fin).slice(0, 5)}.`
        );
      }
    }

    if (reasonCode === "GROUPES_COMPLETS") {
      suggestions.push(
        "Augmenter la capacite autorisee du groupe ou regenerer la cohorte source avec un groupe supplementaire."
      );
    }

    if (suggestions.length === 0) {
      suggestions.push(
        conflit?.raison || "Analyser manuellement les groupes candidats et relancer une generation ciblee."
      );
    }

    return suggestions;
  }

  static _suggererActionsCoursNonPlanifie({ item, cours, profs, salles, reasonCode }) {
    const suggestions = [];

    if (reasonCode === "PROFESSEURS_SATURES") {
      if (profs.length > 0) {
        const topProfesseurs = profs
          .slice(0, 3)
          .map(
            (professeur) =>
              `${professeur.nom_complet} (${professeur.series_actives} series actives)`
          )
          .join(", ");
        suggestions.push(
          `Etendre la charge hebdomadaire d'un professeur compatible pour ${item.code}: ${topProfesseurs}.`
        );
      } else {
        suggestions.push(
          `Associer manuellement au moins un professeur a ${item.code} dans professeur_cours.`
        );
      }
      suggestions.push(
        "Si possible, ouvrir un autre creneau de disponibilite sur un jour encore libre pour les professeurs compatibles."
      );
    }

    if (reasonCode === "AUCUN_PROFESSEUR_COMPATIBLE") {
      suggestions.push(
        `Associer un professeur compatible a ${item.code} puis relancer une generation ciblee du groupe concerné.`
      );
    }

    if (reasonCode === "SALLES_SATUREES" || reasonCode === "SALLE_INSUFFISANTE") {
      if (salles.length > 0) {
        suggestions.push(
          `Liberer ou reserver une salle compatible pour ${item.code}: ${salles
            .slice(0, 4)
            .map((salle) => `${salle.code} (${salle.capacite})`)
            .join(", ")}.`
        );
      } else if (cours?.type_salle) {
        suggestions.push(
          `Ajouter une nouvelle salle de type ${cours.type_salle} ou requalifier une salle existante.`
        );
      }
    }

    if (reasonCode === "ETUDIANTS_OCCUPES" || reasonCode === "GROUPE_SATURE") {
      suggestions.push(
        "Relancer une generation ciblee sur le groupe apres avoir deplace un cours conflictuel ou ajuste la cohorte source."
      );
    }

    if (suggestions.length === 0) {
      suggestions.push(item.suggestion || item.raison || "Intervention manuelle requise.");
    }

    return suggestions;
  }
}
