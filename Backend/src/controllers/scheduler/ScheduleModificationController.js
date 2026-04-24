/**
 * ScheduleModificationController
 *
 * Ce controleur expose la replanification intelligente des affectations du
 * scheduler via un endpoint HTTP dedie.
 *
 * Responsabilites principales :
 * - normaliser le payload API ;
 * - transmettre l'utilisateur courant pour la tracabilite ;
 * - relayer proprement les blocages de simulation et les erreurs serveur.
 *
 * Integration dans le systeme :
 * - s'appuie sur ScheduleModificationService pour la logique metier ;
 * - n'effectue aucune ecriture directe en base ;
 * - conserve un contrat de reponse stable pour l'interface.
 */

import pool from "../../../db.js";
import { ScheduleModificationService } from "../../services/scheduler/planning/ScheduleModificationService.js";
import { journaliserActivite } from "../../services/activity-log.service.js";

function getCurrentUser(request) {
  return request.user || request.session?.user || null;
}

export class ScheduleModificationController {
  /**
   * Applique une replanification intelligente sur une affectation existante.
   *
   * @param {import("express").Request} request - requete HTTP.
   * @param {import("express").Response} response - reponse HTTP.
   *
   * @returns {Promise<import("express").Response>} Reponse JSON.
   *
   * Effets secondaires : aucun hors service metier.
   * Cas particuliers :
   * - la simulation what-if est executee par le service avant toute ecriture ;
   * - les avertissements de degradation de score sont relayes tels quels.
   */
  static async modifyAssignment(request, response) {
    try {
      const user = getCurrentUser(request);
      const result = await ScheduleModificationService.modifyAssignment(
        {
          ...request.body,
          idUtilisateur: user?.id || user?.id_utilisateur || null,
        },
        pool
      );

      await journaliserActivite({
        request,
        actionType: "UPDATE",
        module: "Horaires",
        targetType: "Affectation",
        targetId:
          request.body?.idSeance ||
          request.body?.id_seance ||
          request.body?.idAffectationCours ||
          request.body?.id_affectation_cours,
        description: "Modification manuelle/intelligente d'une affectation horaire.",
        newValue: result,
      });

      return response.status(200).json(result);
    } catch (error) {
      await journaliserActivite({
        request,
        actionType: "UPDATE",
        module: "Horaires",
        targetType: "Affectation",
        targetId:
          request.body?.idSeance ||
          request.body?.id_seance ||
          request.body?.idAffectationCours ||
          request.body?.id_affectation_cours,
        description: "Echec de modification manuelle/intelligente d'une affectation horaire.",
        status: "ERROR",
        errorMessage: error.message,
        newValue: request.body,
      });
      return response.status(error.statusCode || 500).json({
        message:
          error.message || "Erreur lors de la modification intelligente d'affectation.",
        ...(error.code ? { code: error.code } : {}),
        ...(error.details?.simulation ? { simulation: error.details.simulation } : {}),
        ...(error.details?.warnings ? { warnings: error.details.warnings } : {}),
        ...(error.details ? { details: error.details } : {}),
      });
    }
  }
}
