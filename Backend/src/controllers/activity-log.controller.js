/**
 * Controleur du journal d'activite admin.
 */

import {
  listerJournalActivite,
  obtenirResumeJournalActivite,
  recupererEvenementJournal,
} from "../services/activity-log.service.js";

export async function listerActivityLogsController(request, response) {
  try {
    const resultat = await listerJournalActivite(request.query || {});
    return response.status(200).json(resultat);
  } catch (error) {
    return response.status(500).json({
      message: "Erreur lors de la recuperation du journal d'activite.",
    });
  }
}

export async function recupererActivityLogController(request, response) {
  try {
    const idLog = Number(request.params.id);
    if (!Number.isInteger(idLog) || idLog <= 0) {
      return response.status(400).json({ message: "Identifiant de log invalide." });
    }

    const evenement = await recupererEvenementJournal(idLog);
    if (!evenement) {
      return response.status(404).json({ message: "Evenement introuvable." });
    }

    return response.status(200).json(evenement);
  } catch (error) {
    return response.status(500).json({
      message: "Erreur lors de la recuperation de l'evenement.",
    });
  }
}

export async function obtenirStatsActivityLogsController(request, response) {
  try {
    const resume = await obtenirResumeJournalActivite();
    return response.status(200).json(resume);
  } catch (error) {
    return response.status(500).json({
      message: "Erreur lors du calcul des statistiques du journal.",
    });
  }
}
