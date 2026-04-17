import { apiRequest } from "./api.js";
import { readSchedulerScoringSummary } from "../utils/schedulerScoring.js";

const BASE_URL = "/api/scheduler";

function hydrateSchedulerGenerationReport(report) {
  if (!report || typeof report !== "object") {
    return report;
  }

  const scoringSummary = report.resume_scoring_v1 || readSchedulerScoringSummary(report);

  return scoringSummary
    ? {
        ...report,
        resume_scoring_v1: scoringSummary,
      }
    : report;
}

export function hydrateSchedulerSimulationReport(report) {
  if (!report || typeof report !== "object") {
    return report;
  }

  return {
    ...report,
    warnings: Array.isArray(report?.warnings) ? report.warnings : [],
    validation: {
      ...(report?.validation || {}),
      raisonsBlocage: Array.isArray(report?.validation?.raisonsBlocage)
        ? report.validation.raisonsBlocage
        : [],
      detailsParAffectation: Array.isArray(report?.validation?.detailsParAffectation)
        ? report.validation.detailsParAffectation
        : [],
    },
  };
}

/**
 * Normalise le payload de generation du scheduler.
 *
 * La generation globale doit exposer le meme choix de scoring que les autres
 * flux intelligents. Le backend normalise encore le mode, mais le frontend
 * envoie toujours un contrat stable pour eviter les divergences entre ecrans.
 *
 * @param {Object} [payload={}] - parametres de generation.
 * @returns {Object} Payload HTTP normalise.
 */
function normaliserPayloadGenerationScheduler(payload = {}) {
  return {
    id_session: payload.idSession ?? payload.id_session ?? null,
    inclure_weekend:
      payload.inclureWeekend ?? payload.inclure_weekend ?? false,
    mode_optimisation:
      payload.modeOptimisation ?? payload.mode_optimisation ?? "legacy",
    sa_params: payload.saParams ?? payload.sa_params ?? {},
  };
}

/**
 * Construit la query string partagee par la generation SSE.
 *
 * @param {Object} [payload={}] - parametres de generation.
 * @returns {URLSearchParams} Query string prete pour `/generer-stream`.
 */
export function construireQueryGenerationScheduler(payload = {}) {
  const normalizedPayload = normaliserPayloadGenerationScheduler(payload);
  const params = new URLSearchParams();

  if (normalizedPayload.id_session) {
    params.set("id_session", String(normalizedPayload.id_session));
  }

  if (normalizedPayload.inclure_weekend) {
    params.set("inclure_weekend", "true");
  }

  params.set("mode_optimisation", normalizedPayload.mode_optimisation);
  params.set("sa_params", JSON.stringify(normalizedPayload.sa_params || {}));

  return params;
}

/**
 * Liste les sessions du scheduler.
 *
 * @returns {Promise<Object[]>} Sessions disponibles.
 */
export async function recupererSessionsScheduler() {
  return apiRequest(`${BASE_URL}/sessions`, {
    credentials: "include",
  });
}

/**
 * Lance une generation complete sur une session.
 *
 * @param {Object} [payload={}] - parametres de generation.
 * @returns {Promise<Object>} Rapport de generation.
 */
export async function genererSessionScheduler(payload = {}) {
  const normalizedPayload = normaliserPayloadGenerationScheduler(payload);
  const response = await apiRequest(`${BASE_URL}/generer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalizedPayload),
    credentials: "include",
  });

  return {
    ...response,
    rapport: hydrateSchedulerGenerationReport(response?.rapport),
  };
}

/**
 * Execute un scenario what-if read-only sur le scheduler.
 *
 * @param {Object} [payload={}] - charge utile de simulation.
 * @returns {Promise<Object>} Rapport de simulation.
 */
export async function simulerScenarioScheduler(payload = {}) {
  const response = await apiRequest(`${BASE_URL}/what-if`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  return hydrateSchedulerSimulationReport(response);
}

/**
 * Previsualise une replanification intelligente d'affectation.
 *
 * Le backend passe par la meme logique de simulation que l'application reelle,
 * mais sans aucune ecriture. Le frontend s'appuie sur ce rapport pour imposer
 * une simulation a jour avant le bouton d'application.
 *
 * @param {Object} [payload={}] - donnees de modification.
 * @returns {Promise<Object>} Rapport what-if enrichi.
 */
export async function simulerModificationAffectation(payload = {}) {
  return simulerScenarioScheduler({
    id_session: payload.id_session ?? payload.idSession ?? null,
    mode_optimisation:
      payload.modeOptimisation ?? payload.mode_optimisation ?? "legacy",
    scenario: {
      type: "MODIFIER_AFFECTATION",
      id_affectation_cours:
        payload.idSeance ??
        payload.id_seance ??
        payload.idAffectationCours ??
        payload.id_affectation_cours,
      modifications: payload.modifications || {},
      portee: payload.portee || payload.scope || null,
    },
  });
}

/**
 * Applique une replanification intelligente d'affectation.
 *
 * @param {Object} [payload={}] - donnees de modification.
 * @returns {Promise<Object>} Resultat metier complet.
 */
export async function modifierAffectationIntelligemment(payload = {}) {
  const response = await apiRequest(`${BASE_URL}/modify-assignment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  return {
    ...response,
    simulation: hydrateSchedulerSimulationReport(response?.simulation),
  };
}
