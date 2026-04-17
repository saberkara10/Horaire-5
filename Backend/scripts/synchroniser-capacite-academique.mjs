import pool from "../db.js";
import { MAX_WEEKLY_SESSIONS_PER_PROFESSOR } from "../src/services/scheduler/AcademicCatalog.js";

async function chargerSessionActive(executor) {
  const [rows] = await executor.query(
    `SELECT id_session, nom, date_debut, date_fin
     FROM sessions
     WHERE active = TRUE
     ORDER BY id_session DESC
     LIMIT 1`
  );

  return rows[0] || null;
}

async function chargerSallesParType(executor) {
  const [rows] = await executor.query(
    `SELECT type, COUNT(*) AS nb, MIN(capacite) AS capacite_min, MAX(capacite) AS capacite_max
     FROM salles
     GROUP BY type
     ORDER BY type`
  );

  return rows;
}

async function chargerResumeCours(executor) {
  const [[resume]] = await executor.query(
    `SELECT
       COUNT(*) AS cours_actifs,
       SUM(CASE WHEN couverture.nb_professeurs = 0 THEN 1 ELSE 0 END) AS cours_sans_professeur,
       SUM(CASE WHEN couverture.nb_professeurs = 1 THEN 1 ELSE 0 END) AS cours_avec_un_professeur
     FROM cours c
     LEFT JOIN (
       SELECT id_cours, COUNT(*) AS nb_professeurs
       FROM professeur_cours
       GROUP BY id_cours
     ) couverture
       ON couverture.id_cours = c.id_cours
     WHERE c.archive = 0`
  );

  return resume;
}

async function chargerResumeProfesseurs(executor, sessionId) {
  const [rows] = await executor.query(
    `SELECT
       p.id_professeur,
       p.matricule,
       p.nom,
       p.prenom,
       p.specialite,
       COUNT(pc.id_cours) AS nb_cours,
       COALESCE(
         SUM(
           COALESCE(c.sessions_par_semaine, 1) *
           COALESCE(groupes.nb_groupes, 0)
         ),
         0
       ) AS charge_hebdo_estimee
     FROM professeurs p
     LEFT JOIN professeur_cours pc
       ON pc.id_professeur = p.id_professeur
     LEFT JOIN cours c
       ON c.id_cours = pc.id_cours
      AND c.archive = 0
     LEFT JOIN (
       SELECT programme, etape, COUNT(*) AS nb_groupes
       FROM groupes_etudiants
       WHERE id_session = ?
         AND est_groupe_special = 0
       GROUP BY programme, etape
     ) groupes
       ON groupes.programme = c.programme
      AND groupes.etape = CAST(c.etape_etude AS UNSIGNED)
     GROUP BY p.id_professeur, p.matricule, p.nom, p.prenom, p.specialite
     ORDER BY charge_hebdo_estimee DESC, nb_cours DESC, p.id_professeur ASC`,
    [sessionId]
  );

  const charges = rows.map((row) => Number(row.charge_hebdo_estimee || 0));
  const nbProfesseurs = rows.length;
  const surcharge = rows.filter(
    (row) => Number(row.charge_hebdo_estimee || 0) > MAX_WEEKLY_SESSIONS_PER_PROFESSOR
  );

  return {
    total_professeurs: nbProfesseurs,
    professeurs_en_surcharge: surcharge.length,
    charge_hebdo_max: charges.length > 0 ? Math.max(...charges) : 0,
    charge_hebdo_min: charges.length > 0 ? Math.min(...charges) : 0,
    charge_hebdo_moyenne:
      charges.length > 0
        ? Number(
            (charges.reduce((total, valeur) => total + valeur, 0) / charges.length).toFixed(2)
          )
        : 0,
    professeurs_les_plus_charges: rows.slice(0, 10).map((row) => ({
      matricule: row.matricule,
      nom: row.nom,
      prenom: row.prenom,
      specialite: row.specialite,
      nb_cours: Number(row.nb_cours || 0),
      charge_hebdo_estimee: Number(row.charge_hebdo_estimee || 0),
    })),
    professeurs_les_moins_charges: [...rows]
      .reverse()
      .slice(0, 10)
      .reverse()
      .map((row) => ({
        matricule: row.matricule,
        nom: row.nom,
        prenom: row.prenom,
        specialite: row.specialite,
        nb_cours: Number(row.nb_cours || 0),
        charge_hebdo_estimee: Number(row.charge_hebdo_estimee || 0),
      })),
  };
}

async function chargerResumeGroupes(executor, sessionId) {
  const [rows] = await executor.query(
    `SELECT programme, etape, COUNT(*) AS nb_groupes
     FROM groupes_etudiants
     WHERE id_session = ?
       AND est_groupe_special = 0
     GROUP BY programme, etape
     ORDER BY programme, etape`,
    [sessionId]
  );

  return rows;
}

async function chargerResumeDernierRapport(executor, sessionId) {
  const [rows] = await executor.query(
    `SELECT id, date_generation, details
     FROM rapports_generation
     WHERE id_session = ?
     ORDER BY date_generation DESC, id DESC
     LIMIT 1`,
    [sessionId]
  );

  if (rows.length === 0) {
    return null;
  }

  let payload = {};
  try {
    payload = rows[0].details ? JSON.parse(rows[0].details) : {};
  } catch {
    payload = {};
  }

  const nonPlanifies = Array.isArray(payload.non_planifies) ? payload.non_planifies : [];
  const raisons = new Map();

  for (const item of nonPlanifies) {
    const raison = String(item?.raison_code || "INCONNU").trim() || "INCONNU";
    raisons.set(raison, (raisons.get(raison) || 0) + 1);
  }

  return {
    id: Number(rows[0].id),
    date_generation: rows[0].date_generation,
    nb_non_planifies: nonPlanifies.length,
    non_planifies_par_raison: Object.fromEntries([...raisons.entries()].sort()),
  };
}

async function collecterAudit(executor) {
  const sessionActive = await chargerSessionActive(executor);

  if (!sessionActive) {
    throw new Error("Aucune session active n'est disponible.");
  }

  const [sallesParType, resumeCours, resumeProfesseurs, groupesParCohorte, dernierRapport] =
    await Promise.all([
      chargerSallesParType(executor),
      chargerResumeCours(executor),
      chargerResumeProfesseurs(executor, sessionActive.id_session),
      chargerResumeGroupes(executor, sessionActive.id_session),
      chargerResumeDernierRapport(executor, sessionActive.id_session),
    ]);

  return {
    session_active: sessionActive,
    salles_par_type: sallesParType,
    cours: resumeCours,
    professeurs: resumeProfesseurs,
    groupes_par_cohorte: groupesParCohorte,
    dernier_rapport: dernierRapport,
  };
}

async function main() {
  const auditAvant = await collecterAudit(pool);

  console.log(
    JSON.stringify(
      {
        avant: auditAvant,
        bootstrap: {
          active: false,
          message:
            "Bootstrap desactive. Ce script produit uniquement un audit des donnees presentes en base.",
        },
      },
      null,
      2
    )
  );
}

try {
  await main();
} finally {
  await pool.end();
}
