import pool from "../../../db.js";
import { resolveOperationalCourseCapacity } from "./SchedulerConfig.js";

function toMinutes(value) {
  const [hours, minutes = "0", seconds = "0"] = String(value || "00:00:00").split(":");
  return Number(hours) * 60 + Number(minutes) + Number(seconds) / 60;
}

function plagesSeChevauchent(plageA, plageB) {
  if (String(plageA?.date || "") !== String(plageB?.date || "")) {
    return false;
  }

  return (
    toMinutes(plageA.heure_debut) < toMinutes(plageB.heure_fin) &&
    toMinutes(plageB.heure_debut) < toMinutes(plageA.heure_fin)
  );
}

function parseListFilter(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export class FailedCourseDebugService {
  static async genererRapport(options = {}, executor = pool) {
    const session = options.idSession
      ? await FailedCourseDebugService._chargerSessionParId(options.idSession, executor)
      : await FailedCourseDebugService._chargerSessionActive(executor);
    if (!session) {
      throw new Error("Aucune session cible n'est definie.");
    }

    const filtres = {
      codes: parseListFilter(options.codes),
      matricules: parseListFilter(options.matricules),
      idEtudiant: options.idEtudiant ? Number(options.idEtudiant) : null,
      statut: String(options.statut || "resolution_manuelle").trim(),
    };

    const cas = await FailedCourseDebugService._chargerCas(session.id_session, filtres, executor);
    const occupationsParEtudiant = new Map();
    const groupesParCours = new Map();
    const diagnostics = [];

    for (const casEchoue of cas) {
      const occupations =
        occupationsParEtudiant.get(casEchoue.id_etudiant) ||
        (await FailedCourseDebugService._chargerOccupationsEtudiant(
          casEchoue.id_etudiant,
          session.id_session,
          executor
        ));
      occupationsParEtudiant.set(casEchoue.id_etudiant, occupations);

      const groupesCandidats =
        groupesParCours.get(casEchoue.id_cours) ||
        (await FailedCourseDebugService._chargerGroupesCandidats(
          casEchoue.id_cours,
          session.id_session,
          executor
        ));
      groupesParCours.set(casEchoue.id_cours, groupesCandidats);

      const groupesDiagnostiques = groupesCandidats.map((groupe) =>
        FailedCourseDebugService._evaluerGroupe({
          groupe,
          occupations,
        })
      );

      diagnostics.push({
        etudiant: {
          id_etudiant: Number(casEchoue.id_etudiant),
          matricule: casEchoue.matricule,
          nom: casEchoue.nom,
          prenom: casEchoue.prenom,
          groupe_principal: casEchoue.groupe_principal,
        },
        cours_echoue: {
          id_cours_echoue: Number(casEchoue.id_cours_echoue),
          id_cours: Number(casEchoue.id_cours),
          code: casEchoue.code,
          nom: casEchoue.nom_cours,
          statut: casEchoue.statut,
        },
        groupes_candidats: groupesDiagnostiques,
        conclusion: FailedCourseDebugService._conclureDiagnostic(
          casEchoue,
          groupesDiagnostiques
        ),
      });
    }

    return {
      session,
      filtres,
      total_cas: diagnostics.length,
      diagnostics,
    };
  }

  static async _chargerSessionActive(executor) {
    const [rows] = await executor.query(
      `SELECT id_session, nom, date_debut, date_fin
       FROM sessions
       WHERE active = TRUE
       ORDER BY id_session DESC
       LIMIT 1`
    );

    return rows[0] || null;
  }

  static async _chargerSessionParId(idSession, executor) {
    const [rows] = await executor.query(
      `SELECT id_session, nom, date_debut, date_fin
       FROM sessions
       WHERE id_session = ?
       LIMIT 1`,
      [Number(idSession)]
    );

    return rows[0] || null;
  }

  static async _chargerCas(idSession, filtres, executor) {
    const clauses = [
      "ce.id_session = ?",
      "ce.statut = ?",
    ];
    const params = [Number(idSession), filtres.statut];

    if (filtres.codes.length > 0) {
      clauses.push(`c.code IN (${filtres.codes.map(() => "?").join(", ")})`);
      params.push(...filtres.codes);
    }

    if (filtres.matricules.length > 0) {
      clauses.push(`e.matricule IN (${filtres.matricules.map(() => "?").join(", ")})`);
      params.push(...filtres.matricules);
    }

    if (Number.isInteger(filtres.idEtudiant) && filtres.idEtudiant > 0) {
      clauses.push("e.id_etudiant = ?");
      params.push(filtres.idEtudiant);
    }

    const [rows] = await executor.query(
      `SELECT ce.id AS id_cours_echoue,
              ce.id_etudiant,
              ce.statut,
              e.matricule,
              e.nom,
              e.prenom,
              ge.nom_groupe AS groupe_principal,
              c.id_cours,
              c.code,
              c.nom AS nom_cours
       FROM cours_echoues ce
       JOIN etudiants e
         ON e.id_etudiant = ce.id_etudiant
       LEFT JOIN groupes_etudiants ge
         ON ge.id_groupes_etudiants = e.id_groupes_etudiants
       JOIN cours c
         ON c.id_cours = ce.id_cours
       WHERE ${clauses.join(" AND ")}
       ORDER BY c.code ASC, e.matricule ASC`,
      params
    );

    return rows;
  }

  static async _chargerOccupationsEtudiant(idEtudiant, idSession, executor) {
    const [rows] = await executor.query(
      `SELECT
         'principal' AS source_type,
         c.code AS code_cours,
         c.nom AS nom_cours,
         ge.nom_groupe AS groupe_source,
         DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
         ph.heure_debut,
         ph.heure_fin
       FROM etudiants e
       JOIN groupes_etudiants ge
         ON ge.id_groupes_etudiants = e.id_groupes_etudiants
       JOIN affectation_groupes ag
         ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
       JOIN affectation_cours ac
         ON ac.id_affectation_cours = ag.id_affectation_cours
       JOIN cours c
         ON c.id_cours = ac.id_cours
       JOIN plages_horaires ph
         ON ph.id_plage_horaires = ac.id_plage_horaires
       WHERE e.id_etudiant = ?
         AND ge.id_session = ?
         AND NOT EXISTS (
           SELECT 1
           FROM affectation_etudiants ae_override
           WHERE ae_override.id_etudiant = e.id_etudiant
             AND ae_override.id_cours = ac.id_cours
             AND ae_override.id_session = ge.id_session
             AND ae_override.source_type = 'individuelle'
         )

       UNION ALL

       SELECT
         ae.source_type AS source_type,
         c.code AS code_cours,
         c.nom AS nom_cours,
         ge.nom_groupe AS groupe_source,
         DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
         ph.heure_debut,
         ph.heure_fin
       FROM affectation_etudiants ae
       JOIN groupes_etudiants ge
         ON ge.id_groupes_etudiants = ae.id_groupes_etudiants
       JOIN affectation_groupes ag
         ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
       JOIN affectation_cours ac
         ON ac.id_affectation_cours = ag.id_affectation_cours
        AND ac.id_cours = ae.id_cours
       JOIN cours c
         ON c.id_cours = ac.id_cours
       JOIN plages_horaires ph
         ON ph.id_plage_horaires = ac.id_plage_horaires
       WHERE ae.id_etudiant = ?
         AND ae.id_session = ?
         AND ae.source_type IN ('reprise', 'individuelle')

       ORDER BY date ASC, heure_debut ASC`,
      [Number(idEtudiant), Number(idSession), Number(idEtudiant), Number(idSession)]
    );

    return rows;
  }

  static async _chargerGroupesCandidats(idCours, idSession, executor) {
    const [rows] = await executor.query(
      `SELECT
         ge.id_groupes_etudiants AS id_groupe,
         ge.nom_groupe,
         c.max_etudiants_par_groupe,
         COALESCE(effectifs.effectif_principal, 0) AS effectif_principal,
         COALESCE(reprises.reprises_planifiees, 0) AS reprises_planifiees,
         DATE_FORMAT(ph.date, '%Y-%m-%d') AS date,
         ph.heure_debut,
         ph.heure_fin,
         p.prenom AS prenom_professeur,
         p.nom AS nom_professeur,
         s.code AS code_salle
       FROM groupes_etudiants ge
       JOIN affectation_groupes ag
         ON ag.id_groupes_etudiants = ge.id_groupes_etudiants
       JOIN affectation_cours ac
         ON ac.id_affectation_cours = ag.id_affectation_cours
       JOIN cours c
         ON c.id_cours = ac.id_cours
       JOIN plages_horaires ph
         ON ph.id_plage_horaires = ac.id_plage_horaires
       LEFT JOIN professeurs p
         ON p.id_professeur = ac.id_professeur
       LEFT JOIN salles s
         ON s.id_salle = ac.id_salle
       LEFT JOIN (
         SELECT id_groupes_etudiants, COUNT(*) AS effectif_principal
         FROM etudiants
         GROUP BY id_groupes_etudiants
       ) effectifs
         ON effectifs.id_groupes_etudiants = ge.id_groupes_etudiants
       LEFT JOIN (
         SELECT id_groupes_etudiants, id_cours, COUNT(*) AS reprises_planifiees
         FROM affectation_etudiants
         WHERE id_session = ?
           AND source_type IN ('reprise', 'individuelle')
         GROUP BY id_groupes_etudiants, id_cours
       ) reprises
         ON reprises.id_groupes_etudiants = ge.id_groupes_etudiants
        AND reprises.id_cours = c.id_cours
       WHERE ge.id_session = ?
         AND c.id_cours = ?
       ORDER BY ge.nom_groupe ASC, ph.date ASC, ph.heure_debut ASC`,
      [Number(idSession), Number(idSession), Number(idCours)]
    );

    const groupes = new Map();
    for (const row of rows) {
      const idGroupe = Number(row.id_groupe);
      if (!groupes.has(idGroupe)) {
        const effectifPrincipal = Number(row.effectif_principal || 0);
        const reprisesPlanifiees = Number(row.reprises_planifiees || 0);
        groupes.set(idGroupe, {
          id_groupe: idGroupe,
          nom_groupe: row.nom_groupe,
          max_etudiants_par_groupe: resolveOperationalCourseCapacity(row),
          effectif_principal: effectifPrincipal,
          reprises_planifiees: reprisesPlanifiees,
          effectif_total: effectifPrincipal + reprisesPlanifiees,
          plages_horaires: [],
        });
      }

      groupes.get(idGroupe).plages_horaires.push({
        date: row.date,
        heure_debut: row.heure_debut,
        heure_fin: row.heure_fin,
        professeur: `${String(row.prenom_professeur || "").trim()} ${String(
          row.nom_professeur || ""
        ).trim()}`
          .trim()
          .replace(/\s+/g, " "),
        salle: row.code_salle || null,
      });
    }

    return [...groupes.values()];
  }

  static _evaluerGroupe({ groupe, occupations }) {
    const conflits = [];
    for (const plageCandidate of groupe.plages_horaires) {
      for (const occupation of occupations) {
        if (!plagesSeChevauchent(plageCandidate, occupation)) {
          continue;
        }

        conflits.push({
          date: plageCandidate.date,
          heure_debut: plageCandidate.heure_debut,
          heure_fin: plageCandidate.heure_fin,
          conflit_avec: {
            source_type: occupation.source_type,
            code_cours: occupation.code_cours,
            nom_cours: occupation.nom_cours,
            groupe_source: occupation.groupe_source,
            date: occupation.date,
            heure_debut: occupation.heure_debut,
            heure_fin: occupation.heure_fin,
          },
        });
      }
    }

    const capaciteMax = Number(groupe.max_etudiants_par_groupe || 0);
    const placeDisponible =
      capaciteMax <= 0 ? true : Number(groupe.effectif_total || 0) < capaciteMax;
    const compatibleHoraire = conflits.length === 0;
    const raisons = [];

    if (!placeDisponible) {
      raisons.push({
        code: "GROUPE_COMPLET",
        message:
          `Le groupe est plein: ${groupe.effectif_total}/${groupe.max_etudiants_par_groupe}.`,
      });
    }

    if (!compatibleHoraire) {
      raisons.push({
        code: "CONFLIT_HORAIRE",
        message:
          `${conflits.length} conflit(s) detecte(s) avec l'horaire principal ou une reprise deja planifiee.`,
      });
    }

    return {
      ...groupe,
      decision: raisons.length === 0 ? "ACCEPTE" : "REJETE",
      compatibilite_horaire: compatibleHoraire,
      place_disponible: placeDisponible,
      raisons,
      conflits,
    };
  }

  static _conclureDiagnostic(casEchoue, groupesDiagnostiques) {
    if (groupesDiagnostiques.length === 0) {
      return {
        cause_principale: "DONNEES",
        resume:
          `Aucun groupe reel de la session active n'offre ${casEchoue.code}.`,
      };
    }

    const groupesAcceptes = groupesDiagnostiques.filter(
      (groupe) => groupe.decision === "ACCEPTE"
    );
    if (groupesAcceptes.length > 0) {
      return {
        cause_principale: "CODE_OU_ETAT",
        resume:
          `${groupesAcceptes.length} groupe(s) sont attribuables sur les donnees actuelles. ` +
          "Le statut resolution_manuelle ne correspond donc pas a l'etat observable et doit etre revalide.",
      };
    }

    const groupesSansConflitMaisPleins = groupesDiagnostiques.filter(
      (groupe) => groupe.compatibilite_horaire && !groupe.place_disponible
    );
    const groupesEnConflit = groupesDiagnostiques.filter(
      (groupe) => !groupe.compatibilite_horaire
    );

    if (
      groupesSansConflitMaisPleins.length > 0 &&
      groupesEnConflit.length === groupesDiagnostiques.length
    ) {
      return {
        cause_principale: "DONNEES_ET_CONTRAINTES",
        resume:
          `Des groupes existent pour ${casEchoue.code}, mais tous sont a pleine capacite. ` +
          `${groupesSansConflitMaisPleins.length} groupe(s) seraient compatibles sur l'horaire si une place etait disponible.`,
      };
    }

    if (groupesSansConflitMaisPleins.length > 0) {
      return {
        cause_principale: "DONNEES_ET_CONTRAINTES",
        resume:
          `Aucun groupe n'est attribuable pour ${casEchoue.code}: ` +
          `${groupesSansConflitMaisPleins.length} groupe(s) sans conflit sont pleins, ` +
          `${groupesEnConflit.length} groupe(s) supplementaires ont un conflit horaire.`,
      };
    }

    return {
      cause_principale: "VRAI_CONFLIT_HORAIRE",
      resume:
        `Tous les groupes candidats pour ${casEchoue.code} sont rejetes a cause de conflits horaires reels.`,
    };
  }
}
