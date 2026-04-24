/**
 * Routes publiques authentifiees du module help.
 *
 * Architecture:
 * routes -> controller -> service -> repository
 */

import { userAuth } from "../middlewares/auth.js";
import * as HelpController from "../src/controllers/help/HelpController.js";

export default function helpRoutes(app) {
  app.get("/api/help/center", userAuth, HelpController.getHelpCenter);
  app.get("/api/help/categories", userAuth, HelpController.getCategories);
  app.get("/api/help/videos", userAuth, HelpController.getAllVideos);
  app.get("/api/help/videos/search", userAuth, HelpController.searchVideos);
  app.get(
    "/api/help/video-slots/:slotId/stream",
    userAuth,
    HelpController.streamVideoSlot
  );
  app.get(
    "/api/help/videos/category/:categoryId",
    userAuth,
    HelpController.getVideosByCategory
  );
  app.get("/api/help/videos/:id", userAuth, HelpController.getVideoDetail);
  app.get(
    "/api/help/videos/:id/stream",
    userAuth,
    HelpController.streamVideo
  );
  app.get(
    "/api/help/videos/:id/thumbnail",
    userAuth,
    HelpController.serveThumbnail
  );
  app.get(
    "/api/help/documents/:slug",
    userAuth,
    HelpController.getDocumentDetail
  );
}
