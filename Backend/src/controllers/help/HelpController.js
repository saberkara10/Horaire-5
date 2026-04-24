/**
 * Controller HTTP du module help.
 *
 * Le controller reste mince:
 * - lire les parametres HTTP
 * - appeler le service
 * - transformer les erreurs en reponses JSON
 */

import * as HelpService from "../../services/help/HelpService.js";

function sendJsonError(response, error, fallbackMessage) {
  if (response.headersSent) {
    return;
  }

  response.status(error.status || 500).json({
    message: error.message || fallbackMessage,
  });
}

export async function getCategories(request, response) {
  try {
    const categories = await HelpService.getCategories();
    response.status(200).json(categories);
  } catch (error) {
    sendJsonError(
      response,
      error,
      "Erreur lors de la recuperation des categories."
    );
  }
}

export async function getHelpCenter(request, response) {
  try {
    const payload = await HelpService.getHelpCenter();
    response.status(200).json(payload);
  } catch (error) {
    sendJsonError(
      response,
      error,
      "Erreur lors de la recuperation du centre d'aide."
    );
  }
}

export async function getAllVideos(request, response) {
  try {
    const videos = await HelpService.getAllVideos();
    response.status(200).json(videos);
  } catch (error) {
    sendJsonError(
      response,
      error,
      "Erreur lors de la recuperation des guides."
    );
  }
}

export async function searchVideos(request, response) {
  try {
    const query = String(request.query.q || "").trim();

    if (!query) {
      response.status(400).json({
        message: "Le parametre q est requis.",
      });
      return;
    }

    const result = await HelpService.searchVideos(query);
    response.status(200).json(result);
  } catch (error) {
    sendJsonError(response, error, "Erreur lors de la recherche des guides.");
  }
}

export async function getVideosByCategory(request, response) {
  try {
    const videos = await HelpService.getVideosByCategory(
      request.params.categoryId
    );
    response.status(200).json(videos);
  } catch (error) {
    sendJsonError(
      response,
      error,
      "Erreur lors de la recuperation des guides de cette categorie."
    );
  }
}

export async function getVideoDetail(request, response) {
  try {
    const video = await HelpService.getVideoDetail(request.params.id);
    response.status(200).json(video);
  } catch (error) {
    sendJsonError(response, error, "Erreur lors de la recuperation du guide.");
  }
}

export async function streamVideo(request, response) {
  try {
    await HelpService.streamVideo(request.params.id, request, response);
  } catch (error) {
    sendJsonError(response, error, "Erreur lors du streaming de la video.");
  }
}

export async function streamVideoSlot(request, response) {
  try {
    await HelpService.streamVideoSlot(request.params.slotId, request, response);
  } catch (error) {
    sendJsonError(response, error, "Erreur lors du streaming de la video.");
  }
}

export async function serveThumbnail(request, response) {
  try {
    await HelpService.serveThumbnail(request.params.id, response);
  } catch (error) {
    sendJsonError(response, error, "Erreur lors du chargement de la miniature.");
  }
}

export async function getDocumentDetail(request, response) {
  try {
    const document = await HelpService.getDocumentDetail(request.params.slug);
    response.status(200).json(document);
  } catch (error) {
    sendJsonError(
      response,
      error,
      "Erreur lors de la recuperation de la documentation."
    );
  }
}
