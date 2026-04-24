/**
 * Modele d'acces aux donnees pour la concurrence multi-utilisateurs.
 */

import pool from "../../db.js";

let ensureConcurrencySchemaPromise = null;

async function ensureConcurrencySchema(executor = pool) {
  if (executor !== pool) {
    await creerTablesConcurrence(executor);
    return;
  }

  if (!ensureConcurrencySchemaPromise) {
    ensureConcurrencySchemaPromise = creerTablesConcurrence(executor).catch((error) => {
      ensureConcurrencySchemaPromise = null;
      throw error;
    });
  }

  await ensureConcurrencySchemaPromise;
}

async function creerTablesConcurrence(executor) {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS resource_locks (
      id_lock BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      resource_type VARCHAR(40) NOT NULL,
      resource_id VARCHAR(120) NOT NULL,
      user_id INT NULL,
      user_nom VARCHAR(100) NULL,
      user_prenom VARCHAR(100) NULL,
      user_role VARCHAR(255) NULL,
      session_id VARCHAR(128) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      metadata JSON NULL,
      PRIMARY KEY (id_lock),
      UNIQUE KEY uniq_resource_locks_resource (resource_type, resource_id),
      KEY idx_resource_locks_user_id (user_id),
      KEY idx_resource_locks_expires_at (expires_at),
      KEY idx_resource_locks_session_id (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await executor.query(
    `CREATE TABLE IF NOT EXISTS resource_wait_queue (
      id_queue BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      resource_type VARCHAR(40) NOT NULL,
      resource_id VARCHAR(120) NOT NULL,
      user_id INT NULL,
      user_nom VARCHAR(100) NULL,
      user_prenom VARCHAR(100) NULL,
      user_role VARCHAR(255) NULL,
      session_id VARCHAR(128) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'en_attente',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      activated_at DATETIME NULL,
      cancelled_at DATETIME NULL,
      expires_at DATETIME NULL,
      metadata JSON NULL,
      PRIMARY KEY (id_queue),
      UNIQUE KEY uniq_resource_wait_queue_waiting_user (resource_type, resource_id, user_id, status),
      KEY idx_resource_wait_queue_resource_status (resource_type, resource_id, status, requested_at),
      KEY idx_resource_wait_queue_user_id (user_id),
      KEY idx_resource_wait_queue_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await executor.query(
    `CREATE TABLE IF NOT EXISTS user_presence (
      id_presence BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      session_id VARCHAR(128) NOT NULL,
      user_id INT NULL,
      user_nom VARCHAR(100) NULL,
      user_prenom VARCHAR(100) NULL,
      user_email VARCHAR(255) NULL,
      user_role VARCHAR(255) NULL,
      connected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      current_module VARCHAR(100) NULL,
      current_page VARCHAR(255) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'actif',
      ip_address VARCHAR(80) NULL,
      user_agent TEXT NULL,
      PRIMARY KEY (id_presence),
      UNIQUE KEY uniq_user_presence_session (session_id),
      KEY idx_user_presence_user_id (user_id),
      KEY idx_user_presence_last_activity (last_activity_at),
      KEY idx_user_presence_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

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

function normaliserLock(ligne) {
  if (!ligne) {
    return null;
  }

  return {
    ...ligne,
    metadata: parserJson(ligne.metadata),
  };
}

function normaliserQueue(ligne) {
  if (!ligne) {
    return null;
  }

  return {
    ...ligne,
    metadata: parserJson(ligne.metadata),
  };
}

export async function supprimerVerrousExpires(executor = pool) {
  await ensureConcurrencySchema(executor);
  const [locks] = await executor.query(
    `SELECT *
     FROM resource_locks
     WHERE expires_at <= NOW()`
  );

  if (locks.length === 0) {
    return [];
  }

  await executor.query(
    `DELETE FROM resource_locks
     WHERE expires_at <= NOW()`
  );

  return locks.map(normaliserLock);
}

export async function expirerFilesAttente(executor = pool) {
  await ensureConcurrencySchema(executor);
  const [resultat] = await executor.query(
    `UPDATE resource_wait_queue
     SET status = 'expire',
         cancelled_at = NOW()
     WHERE status IN ('en_attente', 'actif')
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()`
  );

  return { updated: Number(resultat.affectedRows || 0) };
}

export async function trouverLock(resourceType, resourceId, executor = pool) {
  await ensureConcurrencySchema(executor);
  const [lignes] = await executor.query(
    `SELECT *
     FROM resource_locks
     WHERE resource_type = ?
       AND resource_id = ?
     LIMIT 1`,
    [resourceType, resourceId]
  );

  return normaliserLock(lignes[0]);
}

export async function creerLock(entree, executor = pool) {
  await ensureConcurrencySchema(executor);
  const [resultat] = await executor.query(
    `INSERT INTO resource_locks (
      resource_type,
      resource_id,
      user_id,
      user_nom,
      user_prenom,
      user_role,
      session_id,
      expires_at,
      metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?)`,
    [
      entree.resource_type,
      entree.resource_id,
      entree.user_id ?? null,
      entree.user_nom || null,
      entree.user_prenom || null,
      entree.user_role || null,
      entree.session_id || null,
      entree.ttl_seconds,
      jsonOuNull(entree.metadata),
    ]
  );

  return recupererLockParId(resultat.insertId, executor);
}

export async function recupererLockParId(idLock, executor = pool) {
  await ensureConcurrencySchema(executor);
  const [lignes] = await executor.query(
    `SELECT *
     FROM resource_locks
     WHERE id_lock = ?
     LIMIT 1`,
    [Number(idLock)]
  );

  return normaliserLock(lignes[0]);
}

export async function prolongerLock(idLock, userId, ttlSeconds, executor = pool) {
  await ensureConcurrencySchema(executor);
  const [resultat] = await executor.query(
    `UPDATE resource_locks
     SET last_activity_at = NOW(),
         expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
     WHERE id_lock = ?
       AND user_id = ?`,
    [ttlSeconds, Number(idLock), Number(userId)]
  );

  if (Number(resultat.affectedRows || 0) === 0) {
    return null;
  }

  return recupererLockParId(idLock, executor);
}

export async function supprimerLock(idLock, userId = null, executor = pool) {
  await ensureConcurrencySchema(executor);
  const params = [Number(idLock)];
  const filtreUtilisateur = userId ? "AND user_id = ?" : "";
  if (userId) {
    params.push(Number(userId));
  }

  const lock = await recupererLockParId(idLock, executor);
  if (!lock) {
    return null;
  }

  const [resultat] = await executor.query(
    `DELETE FROM resource_locks
     WHERE id_lock = ?
     ${filtreUtilisateur}`,
    params
  );

  return Number(resultat.affectedRows || 0) > 0 ? lock : null;
}

export async function supprimerLocksParSession(sessionId, executor = pool) {
  await ensureConcurrencySchema(executor);
  if (!sessionId) {
    return [];
  }

  const [locks] = await executor.query(
    `SELECT *
     FROM resource_locks
     WHERE session_id = ?`,
    [sessionId]
  );

  if (locks.length > 0) {
    await executor.query(
      `DELETE FROM resource_locks
       WHERE session_id = ?`,
      [sessionId]
    );
  }

  return locks.map(normaliserLock);
}

export async function listerLocksActifs(executor = pool) {
  await ensureConcurrencySchema(executor);
  await supprimerVerrousExpires(executor);

  const [lignes] = await executor.query(
    `SELECT *
     FROM resource_locks
     ORDER BY created_at DESC`
  );

  return lignes.map(normaliserLock);
}

export async function ajouterFileAttente(entree, executor = pool) {
  await ensureConcurrencySchema(executor);
  const [resultat] = await executor.query(
    `INSERT INTO resource_wait_queue (
      resource_type,
      resource_id,
      user_id,
      user_nom,
      user_prenom,
      user_role,
      session_id,
      status,
      expires_at,
      metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', DATE_ADD(NOW(), INTERVAL ? SECOND), ?)
     ON DUPLICATE KEY UPDATE
       requested_at = requested_at,
       expires_at = VALUES(expires_at),
       metadata = VALUES(metadata)`,
    [
      entree.resource_type,
      entree.resource_id,
      entree.user_id ?? null,
      entree.user_nom || null,
      entree.user_prenom || null,
      entree.user_role || null,
      entree.session_id || null,
      entree.ttl_seconds,
      jsonOuNull(entree.metadata),
    ]
  );

  if (resultat.insertId) {
    return recupererFileAttenteParId(resultat.insertId, executor);
  }

  return trouverFileAttenteUtilisateur(
    entree.resource_type,
    entree.resource_id,
    entree.user_id,
    executor
  );
}

export async function recupererFileAttenteParId(idQueue, executor = pool) {
  await ensureConcurrencySchema(executor);
  const [lignes] = await executor.query(
    `SELECT *
     FROM resource_wait_queue
     WHERE id_queue = ?
     LIMIT 1`,
    [Number(idQueue)]
  );

  return normaliserQueue(lignes[0]);
}

export async function trouverFileAttenteUtilisateur(
  resourceType,
  resourceId,
  userId,
  executor = pool
) {
  await ensureConcurrencySchema(executor);
  const [lignes] = await executor.query(
    `SELECT *
     FROM resource_wait_queue
     WHERE resource_type = ?
       AND resource_id = ?
       AND user_id = ?
       AND status = 'en_attente'
     LIMIT 1`,
    [resourceType, resourceId, Number(userId)]
  );

  return normaliserQueue(lignes[0]);
}

export async function activerProchainEnFile(resourceType, resourceId, executor = pool) {
  await ensureConcurrencySchema(executor);
  const [candidats] = await executor.query(
    `SELECT *
     FROM resource_wait_queue
     WHERE resource_type = ?
       AND resource_id = ?
       AND status = 'en_attente'
     ORDER BY requested_at ASC, id_queue ASC
     LIMIT 1`,
    [resourceType, resourceId]
  );

  const prochain = candidats[0];
  if (!prochain) {
    return null;
  }

  await executor.query(
    `UPDATE resource_wait_queue
     SET status = 'actif',
         activated_at = NOW()
     WHERE id_queue = ?`,
    [prochain.id_queue]
  );

  return recupererFileAttenteParId(prochain.id_queue, executor);
}

export async function annulerFileAttente(idQueue, userId, executor = pool) {
  await ensureConcurrencySchema(executor);
  const [resultat] = await executor.query(
    `UPDATE resource_wait_queue
     SET status = 'annule',
         cancelled_at = NOW()
     WHERE id_queue = ?
       AND user_id = ?
       AND status IN ('en_attente', 'actif')`,
    [Number(idQueue), Number(userId)]
  );

  return { updated: Number(resultat.affectedRows || 0) };
}

export async function listerFilesAttenteActives(executor = pool) {
  await ensureConcurrencySchema(executor);
  await expirerFilesAttente(executor);

  const [lignes] = await executor.query(
    `SELECT *
     FROM resource_wait_queue
     WHERE status IN ('en_attente', 'actif')
     ORDER BY requested_at ASC, id_queue ASC`
  );

  return lignes.map(normaliserQueue);
}

export async function upsertPresence(entree, executor = pool) {
  await ensureConcurrencySchema(executor);
  await executor.query(
    `INSERT INTO user_presence (
      session_id,
      user_id,
      user_nom,
      user_prenom,
      user_email,
      user_role,
      current_module,
      current_page,
      status,
      ip_address,
      user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       user_nom = VALUES(user_nom),
       user_prenom = VALUES(user_prenom),
       user_email = VALUES(user_email),
       user_role = VALUES(user_role),
       last_activity_at = NOW(),
       current_module = COALESCE(VALUES(current_module), current_module),
       current_page = COALESCE(VALUES(current_page), current_page),
       status = VALUES(status),
       ip_address = VALUES(ip_address),
       user_agent = VALUES(user_agent)`,
    [
      entree.session_id,
      entree.user_id ?? null,
      entree.user_nom || null,
      entree.user_prenom || null,
      entree.user_email || null,
      entree.user_role || null,
      entree.current_module || null,
      entree.current_page || null,
      entree.status || "actif",
      entree.ip_address || null,
      entree.user_agent || null,
    ]
  );
}

export async function supprimerPresenceParSession(sessionId, executor = pool) {
  await ensureConcurrencySchema(executor);
  if (!sessionId) {
    return { deleted: 0 };
  }

  const [resultat] = await executor.query(
    `DELETE FROM user_presence
     WHERE session_id = ?`,
    [sessionId]
  );

  return { deleted: Number(resultat.affectedRows || 0) };
}

export async function nettoyerPresenceInactive(inactivityMinutes, executor = pool) {
  await ensureConcurrencySchema(executor);
  const minutes = Math.max(1, Number.parseInt(inactivityMinutes, 10) || 15);

  const [sessions] = await executor.query(
    `SELECT session_id
     FROM user_presence
     WHERE last_activity_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [minutes]
  );

  await executor.query(
    `UPDATE user_presence
     SET status = 'inactif'
     WHERE last_activity_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
       AND status <> 'inactif'`,
    [minutes]
  );

  return sessions.map((ligne) => ligne.session_id).filter(Boolean);
}

export async function listerPresences(executor = pool) {
  await ensureConcurrencySchema(executor);
  const [lignes] = await executor.query(
    `SELECT
       p.*,
       l.id_lock,
       l.resource_type,
       l.resource_id,
       l.expires_at AS lock_expires_at
     FROM user_presence p
     LEFT JOIN resource_locks l
       ON l.session_id = p.session_id
     ORDER BY p.last_activity_at DESC`
  );

  return lignes;
}

export { pool as concurrencyPool };
