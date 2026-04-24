import {
  annulerAttente,
  creerVerrouRessource,
  libererVerrouRessource,
  listerEtatConcurrenceAdmin,
  mettreAJourPresence,
  normaliserRessourceDepuisPayload,
  prolongerVerrouRessource,
  rejoindreFileAttente,
  verifierDisponibiliteRessource,
} from "../services/concurrency.service.js";

function repondreErreur(response, error, messageDefaut) {
  return response.status(error.status || 500).json({
    message: error.message || messageDefaut,
    ...(error.lock ? { lock: error.lock } : {}),
  });
}

export async function verifierDisponibiliteController(request, response) {
  try {
    const { resourceType, resourceId } = normaliserRessourceDepuisPayload({
      resource_type: request.query.resource_type,
      resource_id: request.query.resource_id,
    });
    const resultat = await verifierDisponibiliteRessource(
      resourceType,
      resourceId,
      request
    );

    return response.status(200).json(resultat);
  } catch (error) {
    return repondreErreur(
      response,
      error,
      "Erreur lors de la verification de disponibilite."
    );
  }
}

export async function creerVerrouController(request, response) {
  try {
    const resultat = await creerVerrouRessource(request.body || {}, request);
    return response.status(resultat.acquired ? 201 : 409).json(resultat);
  } catch (error) {
    return repondreErreur(response, error, "Erreur lors de la creation du verrou.");
  }
}

export async function libererVerrouController(request, response) {
  try {
    const resultat = await libererVerrouRessource(request.params.id, request);
    return response.status(200).json(resultat);
  } catch (error) {
    return repondreErreur(response, error, "Erreur lors de la liberation du verrou.");
  }
}

export async function prolongerVerrouController(request, response) {
  try {
    const resultat = await prolongerVerrouRessource(request.params.id, request);
    return response.status(200).json(resultat);
  } catch (error) {
    return repondreErreur(response, error, "Erreur lors du heartbeat du verrou.");
  }
}

export async function rejoindreFileAttenteController(request, response) {
  try {
    const resultat = await rejoindreFileAttente(request.body || {}, request);
    return response.status(201).json(resultat);
  } catch (error) {
    return repondreErreur(response, error, "Erreur lors de la mise en file.");
  }
}

export async function annulerFileAttenteController(request, response) {
  try {
    const resultat = await annulerAttente(request.params.id, request);
    return response.status(resultat.cancelled ? 200 : 404).json(resultat);
  } catch (error) {
    return repondreErreur(response, error, "Erreur lors de l'annulation.");
  }
}

export async function heartbeatPresenceController(request, response) {
  try {
    await mettreAJourPresence(request, {
      module: request.body?.module,
      page: request.body?.page,
      status: request.body?.status,
    });

    return response.status(200).json({ ok: true });
  } catch (error) {
    return repondreErreur(response, error, "Erreur lors du heartbeat.");
  }
}

export async function etatConcurrenceAdminController(request, response) {
  try {
    const resultat = await listerEtatConcurrenceAdmin(request);
    return response.status(200).json(resultat);
  } catch (error) {
    return repondreErreur(
      response,
      error,
      "Erreur lors de la recuperation de l'etat de concurrence."
    );
  }
}
