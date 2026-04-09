const STATUTS_REPLANIFICATION = new Set([
  "AUCUN_IMPACT",
  "SUCCES",
  "PARTIEL",
  "ECHEC",
]);

function normaliserStatut(statut) {
  const valeur = String(statut || "").trim().toUpperCase();

  if (STATUTS_REPLANIFICATION.has(valeur)) {
    return valeur;
  }

  return "AUCUN_IMPACT";
}

function serialiserValeur(valeur) {
  if (valeur == null) {
    return null;
  }

  return JSON.stringify(valeur);
}

function parserValeurJson(valeur, fallback = null) {
  if (valeur == null || valeur === "") {
    return fallback;
  }

  if (typeof valeur === "object") {
    return valeur;
  }

  try {
    return JSON.parse(valeur);
  } catch {
    return fallback;
  }
}

export async function assurerTableJournalReplanificationsDisponibilites(
  executor
) {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS journal_replanifications_disponibilites (
      id_journal_replanification INT NOT NULL AUTO_INCREMENT,
      id_professeur INT NOT NULL,
      source_operation VARCHAR(64) NOT NULL DEFAULT 'disponibilites_professeur',
      statut VARCHAR(32) NOT NULL,
      seances_concernees INT NOT NULL DEFAULT 0,
      seances_replanifiees INT NOT NULL DEFAULT 0,
      seances_replanifiees_meme_semaine INT NOT NULL DEFAULT 0,
      seances_reportees_semaines_suivantes INT NOT NULL DEFAULT 0,
      seances_non_replanifiees INT NOT NULL DEFAULT 0,
      disponibilites_avant_json LONGTEXT NULL,
      disponibilites_apres_json LONGTEXT NULL,
      resume_json LONGTEXT NULL,
      details_json LONGTEXT NULL,
      cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_journal_replanification),
      KEY idx_journal_replanifications_professeur (id_professeur, cree_le),
      CONSTRAINT fk_journal_replanifications_professeur
        FOREIGN KEY (id_professeur) REFERENCES professeurs (id_professeur)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

export async function enregistrerJournalReplanificationDisponibilites(
  executor,
  {
    id_professeur,
    statut,
    disponibilites_avant = [],
    disponibilites_apres = [],
    replanification = null,
    details = null,
  }
) {
  await assurerTableJournalReplanificationsDisponibilites(executor);

  const resume = replanification?.resume || {};

  await executor.query(
    `INSERT INTO journal_replanifications_disponibilites (
      id_professeur,
      statut,
      seances_concernees,
      seances_replanifiees,
      seances_replanifiees_meme_semaine,
      seances_reportees_semaines_suivantes,
      seances_non_replanifiees,
      disponibilites_avant_json,
      disponibilites_apres_json,
      resume_json,
      details_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(id_professeur),
      normaliserStatut(statut),
      Number(replanification?.seances_concernees || 0),
      Number(resume.seances_replanifiees || 0),
      Number(resume.seances_replanifiees_meme_semaine || 0),
      Number(resume.seances_reportees_semaines_suivantes || 0),
      Number(resume.seances_non_replanifiees || 0),
      serialiserValeur(disponibilites_avant),
      serialiserValeur(disponibilites_apres),
      serialiserValeur(replanification),
      serialiserValeur(details),
    ]
  );
}

export async function recupererJournalReplanificationDisponibilites(
  executor,
  idProfesseur,
  { limit = 12 } = {}
) {
  await assurerTableJournalReplanificationsDisponibilites(executor);

  const limite = Math.max(1, Math.min(50, Number(limit) || 12));
  const [rows] = await executor.query(
    `SELECT id_journal_replanification,
            id_professeur,
            source_operation,
            statut,
            seances_concernees,
            seances_replanifiees,
            seances_replanifiees_meme_semaine,
            seances_reportees_semaines_suivantes,
            seances_non_replanifiees,
            disponibilites_avant_json,
            disponibilites_apres_json,
            resume_json,
            details_json,
            DATE_FORMAT(cree_le, '%Y-%m-%d %H:%i:%s') AS cree_le
     FROM journal_replanifications_disponibilites
     WHERE id_professeur = ?
     ORDER BY id_journal_replanification DESC
     LIMIT ?`,
    [Number(idProfesseur), limite]
  );

  return rows.map((row) => ({
    ...row,
    disponibilites_avant: parserValeurJson(row.disponibilites_avant_json, []),
    disponibilites_apres: parserValeurJson(row.disponibilites_apres_json, []),
    resume: parserValeurJson(row.resume_json, null),
    details: parserValeurJson(row.details_json, []),
  }));
}
