/**
 * Service de controle de concurrence: verrous, files d'attente et presence.
 */

import {
  activerProchainEnFile,
  ajouterFileAttente,
  annulerFileAttente,
  concurrencyPool,
  creerLock,
  expirerFilesAttente,
  listerFilesAttenteActives,
  listerLocksActifs,
  listerPresences,
  prolongerLock,
  supprimerLock,
  supprimerLocksParSession,
  supprimerPresenceParSession,
  supprimerVerrousExpires,
  trouverLock,
  upsertPresence,
  nettoyerPresenceInactive,
} from "../model/concurrency.model.js";
import { journaliserActivite } from "./activity-log.service.js";

const TYPES_RESSOURCES = new Set([
  "horaire",
  "professeur",
  "groupe",
  "salle",
  "cours",
  "planification",
  "generation",
]);

const DEFAULT_LOCK_TTL_SECONDS = Number.parseInt(
  process.env.RESOURCE_LOCK_TTL_SECONDS || "900",
  10
);
const DEFAULT_QUEUE_TTL_SECONDS = Number.parseInt(
  process.env.RESOURCE_QUEUE_TTL_SECONDS || "1800",
  10
);
const DEFAULT_INACTIVITY_MINUTES = Number.parseInt(
  process.env.USER_PRESENCE_INACTIVITY_MINUTES || "15",
  10
);

function normaliserTypeRessource(type) {
  const normalise = String(type || "").trim().toLowerCase();
  return TYPES_RESSOURCES.has(normalise) ? normalise : "";
}

function normaliserIdRessource(id) {
  return String(id || "").trim().slice(0, 120);
}

function rolesUtilisateur(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return user.roles.join(",");
  }

  return user?.role || null;
}

function nomComplet(lock) {
  return [lock?.user_prenom, lock?.user_nom].filter(Boolean).join(" ").trim();
}

function messageRessourceOccupee(lock) {
  const utilisateur = nomComplet(lock) || "un autre utilisateur";
  return `Cette ressource est actuellement utilisée par ${utilisateur}. Veuillez attendre ou réessayer plus tard.`;
}

function obtenirIp(request) {
  const forwardedFor = request?.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return request?.ip || request?.socket?.remoteAddress || null;
}

function entreeUtilisateur(request) {
  const user = request?.user || request?.session?.user || {};

  return {
    user_id: user.id ?? null,
    user_nom: user.nom || null,
    user_prenom: user.prenom || null,
    user_email: user.email || null,
    user_role: rolesUtilisateur(user),
    session_id: request?.sessionID || null,
  };
}

function assertRessource(resourceType, resourceId) {
  if (!resourceType) {
    const error = new Error("Type de ressource invalide.");
    error.status = 400;
    throw error;
  }

  if (!resourceId) {
    const error = new Error("Identifiant de ressource invalide.");
    error.status = 400;
    throw error;
  }
}

export function normaliserRessourceDepuisPayload(payload = {}) {
  const resourceType = normaliserTypeRessource(
    payload.resource_type || payload.resourceType || payload.type
  );
  const resourceId = normaliserIdRessource(
    payload.resource_id || payload.resourceId || payload.id
  );

  assertRessource(resourceType, resourceId);
  return { resourceType, resourceId };
}

export async function nettoyerConcurrenceExpiree(request = null) {
  const locksExpires = await supprimerVerrousExpires();
  await expirerFilesAttente();

  for (const lock of locksExpires) {
    await activerProchainEnFile(lock.resource_type, lock.resource_id);
    await journaliserActivite({
      request,
      actionType: "LOCK_EXPIRE",
      module: "Concurrence",
      targetType: lock.resource_type,
      targetId: lock.resource_id,
      description: `Expiration automatique du verrou ${lock.id_lock}.`,
      status: "EXPIRED",
      newValue: lock,
    });
  }

  const sessionsInactives = await nettoyerPresenceInactive(DEFAULT_INACTIVITY_MINUTES);
  for (const sessionId of sessionsInactives) {
    const locksSession = await supprimerLocksParSession(sessionId);
    for (const lock of locksSession) {
      await activerProchainEnFile(lock.resource_type, lock.resource_id);
      await journaliserActivite({
        request,
        actionType: "LOCK_EXPIRE",
        module: "Concurrence",
        targetType: lock.resource_type,
        targetId: lock.resource_id,
        description: `Liberation automatique du verrou ${lock.id_lock} pour inactivite.`,
        status: "EXPIRED",
        newValue: lock,
      });
    }
  }

  return { locks_expires: locksExpires.length, sessions_inactives: sessionsInactives.length };
}

export async function verifierDisponibiliteRessource(resourceType, resourceId, request) {
  await nettoyerConcurrenceExpiree(request);
  const lock = await trouverLock(resourceType, resourceId);

  if (!lock) {
    return { available: true, lock: null };
  }

  const userId = request?.user?.id;
  const ownLock = userId && Number(lock.user_id) === Number(userId);

  return {
    available: Boolean(ownLock),
    own_lock: Boolean(ownLock),
    lock,
    message: ownLock ? null : messageRessourceOccupee(lock),
  };
}

export async function creerVerrouRessource(payload, request) {
  const { resourceType, resourceId } = normaliserRessourceDepuisPayload(payload);
  const ttlSeconds = Math.max(
    60,
    Number.parseInt(payload.ttl_seconds || payload.ttlSeconds || DEFAULT_LOCK_TTL_SECONDS, 10)
  );
  const utilisateur = entreeUtilisateur(request);

  await nettoyerConcurrenceExpiree(request);

  const connexion = await concurrencyPool.getConnection();
  try {
    await connexion.beginTransaction();

    const lockActuel = await trouverLock(resourceType, resourceId, connexion);
    if (lockActuel && Number(lockActuel.user_id) !== Number(utilisateur.user_id)) {
      await connexion.rollback();
      await journaliserActivite({
        request,
        actionType: "LOCK_BLOCKED",
        module: "Concurrence",
        targetType: resourceType,
        targetId: resourceId,
        description: messageRessourceOccupee(lockActuel),
        status: "CONFLICT",
        newValue: { lock: lockActuel },
      });

      return {
        acquired: false,
        conflict: true,
        lock: lockActuel,
        message: messageRessourceOccupee(lockActuel),
      };
    }

    if (lockActuel) {
      const lockProlonge = await prolongerLock(
        lockActuel.id_lock,
        utilisateur.user_id,
        ttlSeconds,
        connexion
      );
      await connexion.commit();
      return { acquired: true, lock: lockProlonge, renewed: true };
    }

    const lock = await creerLock(
      {
        resource_type: resourceType,
        resource_id: resourceId,
        ...utilisateur,
        ttl_seconds: ttlSeconds,
        metadata: payload.metadata || null,
      },
      connexion
    );

    await connexion.commit();

    await mettreAJourPresence(request, {
      module: payload.module || "Concurrence",
      page: payload.page || null,
      status: "en modification",
    });
    await journaliserActivite({
      request,
      actionType: "LOCK_ACQUIRE",
      module: "Concurrence",
      targetType: resourceType,
      targetId: resourceId,
      description: `Creation du verrou ${lock.id_lock}.`,
      status: "SUCCESS",
      newValue: lock,
    });

    return { acquired: true, lock };
  } catch (error) {
    await connexion.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      const lock = await trouverLock(resourceType, resourceId);
      return {
        acquired: false,
        conflict: true,
        lock,
        message: messageRessourceOccupee(lock),
      };
    }
    throw error;
  } finally {
    connexion.release();
  }
}

export async function libererVerrouRessource(idLock, request, options = {}) {
  await nettoyerConcurrenceExpiree(request);
  const lock = await supprimerLock(
    idLock,
    options.force ? null : request?.user?.id
  );

  if (!lock) {
    const error = new Error("Verrou introuvable ou non autorisé.");
    error.status = 404;
    throw error;
  }

  const prochain = await activerProchainEnFile(lock.resource_type, lock.resource_id);
  await mettreAJourPresence(request, { status: "actif" });
  await journaliserActivite({
    request,
    actionType: "LOCK_RELEASE",
    module: "Concurrence",
    targetType: lock.resource_type,
    targetId: lock.resource_id,
    description: `Liberation du verrou ${lock.id_lock}.`,
    status: "SUCCESS",
    oldValue: lock,
    newValue: prochain ? { prochain_en_file: prochain } : null,
  });

  return { released: true, lock, next_waiter: prochain };
}

export async function prolongerVerrouRessource(idLock, request) {
  await nettoyerConcurrenceExpiree(request);
  const lock = await prolongerLock(idLock, request?.user?.id, DEFAULT_LOCK_TTL_SECONDS);

  if (!lock) {
    const error = new Error("Verrou introuvable ou expiré.");
    error.status = 404;
    throw error;
  }

  await mettreAJourPresence(request, { status: "en modification" });
  return { renewed: true, lock };
}

export async function rejoindreFileAttente(payload, request) {
  const { resourceType, resourceId } = normaliserRessourceDepuisPayload(payload);
  const utilisateur = entreeUtilisateur(request);
  const ttlSeconds = Math.max(
    300,
    Number.parseInt(payload.ttl_seconds || payload.ttlSeconds || DEFAULT_QUEUE_TTL_SECONDS, 10)
  );

  await nettoyerConcurrenceExpiree(request);

  const entree = await ajouterFileAttente({
    resource_type: resourceType,
    resource_id: resourceId,
    ...utilisateur,
    ttl_seconds: ttlSeconds,
    metadata: payload.metadata || null,
  });

  await mettreAJourPresence(request, {
    module: payload.module || "Concurrence",
    page: payload.page || null,
    status: "en attente",
  });
  await journaliserActivite({
    request,
    actionType: "QUEUE_JOIN",
    module: "Concurrence",
    targetType: resourceType,
    targetId: resourceId,
    description: `Mise en file d'attente pour ${resourceType}:${resourceId}.`,
    status: "WAITING",
    newValue: entree,
  });

  return { queued: true, queue: entree };
}

export async function annulerAttente(idQueue, request) {
  const resultat = await annulerFileAttente(idQueue, request?.user?.id);
  await mettreAJourPresence(request, { status: "actif" });
  await journaliserActivite({
    request,
    actionType: "QUEUE_CANCEL",
    module: "Concurrence",
    targetType: "File attente",
    targetId: idQueue,
    description: `Annulation de la file d'attente ${idQueue}.`,
    status: resultat.updated ? "CANCELLED" : "ERROR",
  });

  return { cancelled: resultat.updated > 0 };
}

export async function listerEtatConcurrenceAdmin(request) {
  await nettoyerConcurrenceExpiree(request);

  const [locks, waitQueue, presences] = await Promise.all([
    listerLocksActifs(),
    listerFilesAttenteActives(),
    listerPresences(),
  ]);

  return { locks, wait_queue: waitQueue, users: presences };
}

export async function mettreAJourPresence(request, options = {}) {
  if (!request?.user || !request?.sessionID) {
    return null;
  }

  const utilisateur = entreeUtilisateur(request);
  await upsertPresence({
    ...utilisateur,
    current_module: options.module || request.headers?.["x-current-module"] || null,
    current_page: options.page || request.headers?.["x-current-page"] || null,
    status: options.status || "actif",
    ip_address: obtenirIp(request),
    user_agent: request.headers?.["user-agent"] || null,
  });

  return true;
}

export async function fermerSessionConcurrence(request) {
  const sessionId = request?.sessionID;
  const locks = await supprimerLocksParSession(sessionId);
  await supprimerPresenceParSession(sessionId);

  for (const lock of locks) {
    await activerProchainEnFile(lock.resource_type, lock.resource_id);
    await journaliserActivite({
      request,
      actionType: "LOCK_RELEASE",
      module: "Concurrence",
      targetType: lock.resource_type,
      targetId: lock.resource_id,
      description: `Liberation du verrou ${lock.id_lock} a la fermeture de session.`,
      status: "SUCCESS",
      oldValue: lock,
    });
  }

  return { released_locks: locks.length };
}

export function construireErreurConflit(lock) {
  const error = new Error(messageRessourceOccupee(lock));
  error.status = 409;
  error.lock = lock;
  return error;
}
