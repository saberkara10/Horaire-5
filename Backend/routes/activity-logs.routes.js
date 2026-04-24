/**
 * Routes reservees a l'administrateur general pour consulter l'audit log.
 */

import { userAuth } from "../middlewares/auth.js";
import {
  listerActivityLogsController,
  obtenirStatsActivityLogsController,
  recupererActivityLogController,
} from "../src/controllers/activity-log.controller.js";

export default function activityLogsRoutes(app) {
  function userAdminResponsableAudit(request, response, next) {
    const user = request.user || request.session?.user || null;
    const roles = Array.isArray(user?.roles)
      ? user.roles
      : typeof user?.role === "string"
        ? [user.role]
        : [];

    if (roles.includes("ADMIN_RESPONSABLE")) {
      return next();
    }

    return response.status(403).json({
      message: "Acces reserve a l'administrateur general.",
    });
  }

  const accesAudit = [userAuth, userAdminResponsableAudit];

  app.get(
    "/api/admin/activity-logs/stats/summary",
    ...accesAudit,
    obtenirStatsActivityLogsController
  );

  app.get(
    "/api/admin/activity-logs",
    ...accesAudit,
    listerActivityLogsController
  );

  app.get(
    "/api/admin/activity-logs/:id",
    ...accesAudit,
    recupererActivityLogController
  );
}
