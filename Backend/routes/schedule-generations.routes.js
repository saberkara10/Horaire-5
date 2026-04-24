import * as authMiddlewares from "../middlewares/auth.js";
import { ScheduleGenerationService } from "../src/services/scheduler/ScheduleGenerationService.js";

function readGenerationId(request) {
  const idGeneration = Number(request.params.id);
  if (!Number.isInteger(idGeneration) || idGeneration <= 0) {
    return null;
  }

  return idGeneration;
}

export default function scheduleGenerationsRoutes(app) {
  const userAuth = authMiddlewares.userAuth;
  const userAdminTechnique =
    authMiddlewares.userAdminTechnique || authMiddlewares.userAdmin;
  const secured = [userAuth, userAdminTechnique];

  app.get("/api/schedule-generations", ...secured, async (request, response) => {
    try {
      const generations = await ScheduleGenerationService.listGenerations({
        idSession: request.query.id_session || null,
        status: request.query.status || null,
      });
      return response.status(200).json(generations);
    } catch (error) {
      return response.status(500).json({
        message: error.message || "Erreur lors de la lecture des generations.",
      });
    }
  });

  app.get("/api/schedule-generations/:id", ...secured, async (request, response) => {
    try {
      const idGeneration = readGenerationId(request);
      if (!idGeneration) {
        return response.status(400).json({ message: "Identifiant de generation invalide." });
      }

      const generation = await ScheduleGenerationService.getGenerationById(idGeneration);
      if (!generation) {
        return response.status(404).json({ message: "Generation introuvable." });
      }

      return response.status(200).json(generation);
    } catch (error) {
      return response.status(500).json({
        message: error.message || "Erreur lors de la lecture de la generation.",
      });
    }
  });

  app.patch("/api/schedule-generations/:id", ...secured, async (request, response) => {
    try {
      const idGeneration = readGenerationId(request);
      if (!idGeneration) {
        return response.status(400).json({ message: "Identifiant de generation invalide." });
      }

      const generation = await ScheduleGenerationService.updateGeneration(
        idGeneration,
        request.body || {},
        request
      );
      return response.status(200).json(generation);
    } catch (error) {
      return response.status(error.statusCode || 500).json({
        message: error.message || "Erreur lors de la mise a jour de la generation.",
      });
    }
  });

  app.post("/api/schedule-generations/compare", ...secured, async (request, response) => {
    try {
      const leftId = Number(request.body?.left_id || request.body?.generation_a_id);
      const rightId = Number(request.body?.right_id || request.body?.generation_b_id);

      if (!Number.isInteger(leftId) || !Number.isInteger(rightId)) {
        return response.status(400).json({
          message: "left_id et right_id sont obligatoires.",
        });
      }

      const result = await ScheduleGenerationService.compareGenerations(
        { leftId, rightId },
        request
      );
      return response.status(200).json(result);
    } catch (error) {
      return response.status(error.statusCode || 500).json({
        message: error.message || "Erreur lors de la comparaison.",
      });
    }
  });

  app.post("/api/schedule-generations/:id/restore", ...secured, async (request, response) => {
    try {
      const idGeneration = readGenerationId(request);
      if (!idGeneration) {
        return response.status(400).json({ message: "Identifiant de generation invalide." });
      }

      const result = await ScheduleGenerationService.restoreGeneration(
        idGeneration,
        {
          confirm: Boolean(request.body?.confirm),
          note: request.body?.note || null,
        },
        request
      );

      return response.status(result.requires_confirmation ? 200 : 201).json(result);
    } catch (error) {
      return response.status(error.statusCode || 500).json({
        message: error.message || "Erreur lors de la restauration.",
        ...(error.details ? { details: error.details } : {}),
      });
    }
  });

  app.post("/api/schedule-generations/:id/duplicate", ...secured, async (request, response) => {
    try {
      const idGeneration = readGenerationId(request);
      if (!idGeneration) {
        return response.status(400).json({ message: "Identifiant de generation invalide." });
      }

      const duplicated = await ScheduleGenerationService.duplicateGeneration(
        idGeneration,
        request
      );
      return response.status(201).json(duplicated);
    } catch (error) {
      return response.status(error.statusCode || 500).json({
        message: error.message || "Erreur lors de la duplication.",
      });
    }
  });

  app.patch("/api/schedule-generations/:id/archive", ...secured, async (request, response) => {
    try {
      const idGeneration = readGenerationId(request);
      if (!idGeneration) {
        return response.status(400).json({ message: "Identifiant de generation invalide." });
      }

      const archived = await ScheduleGenerationService.archiveGeneration(idGeneration, request);
      return response.status(200).json(archived);
    } catch (error) {
      return response.status(error.statusCode || 500).json({
        message: error.message || "Erreur lors de l'archivage.",
      });
    }
  });

  app.delete("/api/schedule-generations/:id", ...secured, async (request, response) => {
    try {
      const idGeneration = readGenerationId(request);
      if (!idGeneration) {
        return response.status(400).json({ message: "Identifiant de generation invalide." });
      }

      const deleted = await ScheduleGenerationService.softDeleteGeneration(
        idGeneration,
        request
      );
      return response.status(200).json(deleted);
    } catch (error) {
      return response.status(error.statusCode || 500).json({
        message: error.message || "Erreur lors de la suppression logique.",
      });
    }
  });
}
