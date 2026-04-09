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
