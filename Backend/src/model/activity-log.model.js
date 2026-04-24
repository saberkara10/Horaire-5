/**
 * Modele d'acces aux donnees du journal d'activite.
 */

import pool from "../../db.js";

const CHAMPS_TRI_AUTORISES = new Set([
  "created_at",
  "action_type",
  "module",
  "status",
  "user_name",
]);

function jsonOuNull(valeur) {
  if (valeur === undefined || valeur === null) {
    return null;
  }

  return JSON.stringify(valeur);
}

function parserJson(valeur) {
  if (!valeur) {
    return null;
  }

  if (typeof valeur === "object") {
    return valeur;
  }

  try {
    return JSON.parse(valeur);
  } catch {
    return null;
  }
}

function normaliserLog(ligne) {
  if (!ligne) {
    return null;
  }

  return {
    ...ligne,
    old_value: parserJson(ligne.old_value),
    new_value: parserJson(ligne.new_value),
  };
}

function ajouterFiltreEgalite(where, params, colonne, valeur) {
  const texte = String(valeur || "").trim();
  if (!texte) {
    return;
  }

  where.push(`${colonne} = ?`);
  params.push(texte);
}

function ajouterFiltreDate(where, params, colonne, valeur, operateur) {
  const texte = String(valeur || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) {
    return;
  }

  where.push(`${colonne} ${operateur} ?`);
  params.push(texte);
}

function construireWhere(filtres = {}) {
  const where = [];
  const params = [];

  ajouterFiltreDate(where, params, "DATE(created_at)", filtres.date_debut, ">=");
  ajouterFiltreDate(where, params, "DATE(created_at)", filtres.date_fin, "<=");

  if (filtres.user_id !== undefined && filtres.user_id !== null && filtres.user_id !== "") {
    const userId = Number(filtres.user_id);
    if (Number.isInteger(userId) && userId > 0) {
      where.push("user_id = ?");
      params.push(userId);
    }
  }

  ajouterFiltreEgalite(where, params, "module", filtres.module);
  ajouterFiltreEgalite(where, params, "action_type", filtres.action_type);
  ajouterFiltreEgalite(where, params, "status", filtres.status);

  const recherche = String(filtres.recherche || "").trim();
  if (recherche) {
    where.push(
      `(description LIKE ? OR user_name LIKE ? OR module LIKE ? OR target_type LIKE ? OR error_message LIKE ?)`
    );
    const pattern = `%${recherche}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

export async function creerActivityLog(entree, executor = pool) {
  const [resultat] = await executor.query(
    `INSERT INTO activity_logs (
      user_id,
      user_name,
      user_role,
      action_type,
      module,
      target_type,
      target_id,
      description,
      old_value,
      new_value,
      status,
      error_message,
      ip_address,
      user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entree.user_id ?? null,
      entree.user_name || null,
      entree.user_role || null,
      entree.action_type,
      entree.module,
      entree.target_type || null,
      entree.target_id || null,
      entree.description,
      jsonOuNull(entree.old_value),
      jsonOuNull(entree.new_value),
      entree.status || "SUCCESS",
      entree.error_message || null,
      entree.ip_address || null,
      entree.user_agent || null,
    ]
  );

  return recupererActivityLogParId(resultat.insertId, executor);
}

export async function listerActivityLogs(filtres = {}, executor = pool) {
  const page = Math.max(1, Number.parseInt(filtres.page, 10) || 1);
  const limite = Math.min(100, Math.max(10, Number.parseInt(filtres.limit, 10) || 25));
  const offset = (page - 1) * limite;
  const tri = CHAMPS_TRI_AUTORISES.has(String(filtres.sort_by || ""))
    ? String(filtres.sort_by)
    : "created_at";
  const ordre = String(filtres.sort_order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const { clause, params } = construireWhere(filtres);

  const [lignes] = await executor.query(
    `SELECT *
     FROM activity_logs
     ${clause}
     ORDER BY ${tri} ${ordre}, id_log DESC
     LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );

  const [[compte]] = await executor.query(
    `SELECT COUNT(*) AS total
     FROM activity_logs
     ${clause}`,
    params
  );

  const total = Number(compte?.total || 0);

  return {
    data: lignes.map(normaliserLog),
    pagination: {
      page,
      limit: limite,
      total,
      total_pages: Math.max(1, Math.ceil(total / limite)),
    },
  };
}

export async function recupererActivityLogParId(idLog, executor = pool) {
  const [lignes] = await executor.query(
    `SELECT *
     FROM activity_logs
     WHERE id_log = ?
     LIMIT 1`,
    [Number(idLog)]
  );

  return normaliserLog(lignes[0]);
}

export async function obtenirResumeActivityLogs(executor = pool) {
  const [[resume]] = await executor.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) AS actions_aujourdhui,
       SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) AS erreurs,
       SUM(CASE WHEN action_type IN ('LOGIN', 'LOGOUT') THEN 1 ELSE 0 END) AS connexions,
       SUM(CASE WHEN action_type IN ('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'GENERATE') THEN 1 ELSE 0 END) AS modifications
     FROM activity_logs`
  );

  const [parAction] = await executor.query(
    `SELECT action_type, COUNT(*) AS total
     FROM activity_logs
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY action_type
     ORDER BY total DESC`
  );

  const [parModule] = await executor.query(
    `SELECT module, COUNT(*) AS total
     FROM activity_logs
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY module
     ORDER BY total DESC
     LIMIT 10`
  );

  return {
    total: Number(resume?.total || 0),
    actions_aujourdhui: Number(resume?.actions_aujourdhui || 0),
    erreurs: Number(resume?.erreurs || 0),
    connexions: Number(resume?.connexions || 0),
    modifications: Number(resume?.modifications || 0),
    par_action: parAction.map((ligne) => ({
      action_type: ligne.action_type,
      total: Number(ligne.total || 0),
    })),
    par_module: parModule.map((ligne) => ({
      module: ligne.module,
      total: Number(ligne.total || 0),
    })),
  };
}

export async function supprimerActivityLogsExpires(joursConservation, executor = pool) {
  const jours = Number.parseInt(joursConservation, 10);
  if (!Number.isInteger(jours) || jours < 30) {
    return { deleted: 0 };
  }

  const [resultat] = await executor.query(
    `DELETE FROM activity_logs
     WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [jours]
  );

  return { deleted: Number(resultat.affectedRows || 0) };
}
