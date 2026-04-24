import {
  construireErreurConflit,
  normaliserRessourceDepuisPayload,
  verifierDisponibiliteRessource,
} from "../src/services/concurrency.service.js";

function envoyerErreur(response, error) {
  return response.status(error.status || 500).json({
    message: error.message || "Conflit de concurrence.",
    ...(error.lock ? { lock: error.lock } : {}),
  });
}

export function requireResourceLock(resourceType, resolveResourceId) {
  return async (request, response, next) => {
    if (process.env.NODE_ENV === "test") {
      return next();
    }

    try {
      const resourceId =
        typeof resolveResourceId === "function"
          ? resolveResourceId(request)
          : request.params?.id;
      const ressource = normaliserRessourceDepuisPayload({
        resource_type: resourceType,
        resource_id: resourceId,
      });

      const disponibilite = await verifierDisponibiliteRessource(
        ressource.resourceType,
        ressource.resourceId,
        request
      );

      if (disponibilite.available && disponibilite.own_lock) {
        return next();
      }

      if (disponibilite.available && !disponibilite.lock) {
        return next();
      }

      throw construireErreurConflit(disponibilite.lock);
    } catch (error) {
      return envoyerErreur(response, error);
    }
  };
}
