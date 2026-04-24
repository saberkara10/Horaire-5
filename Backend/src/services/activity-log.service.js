/**
 * Service reutilisable pour journaliser les actions sensibles.
 */

import {
  creerActivityLog,
  listerActivityLogs,
  obtenirResumeActivityLogs,
  recupererActivityLogParId,
  supprimerActivityLogsExpires,
} from "../model/activity-log.model.js";

const ACTIONS_VALIDES = new Set([
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "IMPORT",
  "GENERATE",
  "ERROR",
  "RESET",
  "LOCK_ACQUIRE",
  "LOCK_BLOCKED",
  "LOCK_RELEASE",
  "LOCK_HEARTBEAT",
  "LOCK_EXPIRE",
  "QUEUE_JOIN",
  "QUEUE_CANCEL",
  "PRESENCE_HEARTBEAT",
  "COMPARE",
  "RESTORE",
  "ARCHIVE",
  "DUPLICATE",
]);

const STATUTS_VALIDES = new Set([
  "SUCCESS",
  "ERROR",
  "REFUSED",
  "CONFLICT",
  "WAITING",
  "EXPIRED",
  "CANCELLED",
]);
const CLES_SENSIBLES = [
  "password",
  "motdepasse",
  "mot_de_passe",
  "mot_de_passe_hash",
  "token",
  "secret",
  "authorization",
  "cookie",
  "sid",
];

function contientCleSensible(cle) {
  const normalisee = String(cle || "").toLowerCase();
  return CLES_SENSIBLES.some((fragment) => normalisee.includes(fragment));
}

function nettoyerValeurSensible(valeur, profondeur = 0) {
  if (profondeur > 5) {
    return "[TRONQUE]";
  }

  if (Array.isArray(valeur)) {
    return valeur.slice(0, 50).map((item) => nettoyerValeurSensible(item, profondeur + 1));
  }

  if (!valeur || typeof valeur !== "object") {
    return valeur;
  }

  const resultat = {};
  for (const [cle, contenu] of Object.entries(valeur)) {
    resultat[cle] = contientCleSensible(cle)
      ? "[MASQUE]"
      : nettoyerValeurSensible(contenu, profondeur + 1);
  }

  return resultat;
}

function obtenirAdresseIp(request) {
  const forwardedFor = request?.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return request?.ip || request?.socket?.remoteAddress || null;
}

function obtenirUserAgent(request) {
  return request?.headers?.["user-agent"] || null;
}

function obtenirUtilisateur(request, utilisateurExplicite = null) {
  return utilisateurExplicite || request?.user || request?.session?.user || null;
}

function construireNomUtilisateur(user, fallback = null) {
  if (!user && fallback) {
    return fallback;
  }

  const nomComplet = [user?.prenom, user?.nom].filter(Boolean).join(" ").trim();
  return nomComplet || user?.email || fallback || null;
}

function construireRoleUtilisateur(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return user.roles.join(",");
  }

  return user?.role || null;
}

export function sanitiserAuditValue(valeur) {
  return nettoyerValeurSensible(valeur);
}

export async function journaliserActivite(options = {}) {
  try {
    if (process.env.NODE_ENV === "test" && process.env.FORCE_AUDIT_LOGS_IN_TESTS !== "1") {
      return null;
    }

    const request = options.request || null;
    const user = obtenirUtilisateur(request, options.user || null);
    const actionType = String(options.actionType || options.action_type || "").toUpperCase();
    const statut = String(options.status || "SUCCESS").toUpperCase();

    if (!ACTIONS_VALIDES.has(actionType)) {
      throw new Error(`Type d'action audit invalide: ${actionType || "(vide)"}`);
    }

    return await creerActivityLog({
      user_id: user?.id || options.userId || null,
      user_name: construireNomUtilisateur(user, options.userName || options.email || null),
      user_role: construireRoleUtilisateur(user) || options.userRole || null,
      action_type: actionType,
      module: String(options.module || "Application").trim(),
      target_type: options.targetType || options.target_type || null,
      target_id: options.targetId || options.target_id || null,
      description: String(options.description || "").trim() || "Action journalisee.",
      old_value: sanitiserAuditValue(options.oldValue ?? options.old_value),
      new_value: sanitiserAuditValue(options.newValue ?? options.new_value),
      status: STATUTS_VALIDES.has(statut) ? statut : "SUCCESS",
      error_message: options.errorMessage || options.error_message || null,
      ip_address: options.ipAddress || obtenirAdresseIp(request),
      user_agent: options.userAgent || obtenirUserAgent(request),
    });
  } catch (error) {
    // Le journal ne doit jamais casser une fonctionnalite metier.
    console.error("[audit-log] journalisation impossible:", error.message);
    return null;
  }
}

export async function listerJournalActivite(filtres) {
  return listerActivityLogs(filtres);
}

export async function recupererEvenementJournal(idLog) {
  return recupererActivityLogParId(idLog);
}

export async function obtenirResumeJournalActivite() {
  return obtenirResumeActivityLogs();
}

export async function nettoyerJournalActiviteExpire() {
  const jours = Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || "365", 10);
  return supprimerActivityLogsExpires(jours);
}
