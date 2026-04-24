/**
 * Routes de concurrence: verrous, file d'attente et presence admin.
 */

import { userAdminResponsable, userAuth } from "../middlewares/auth.js";
import {
  annulerFileAttenteController,
  creerVerrouController,
  etatConcurrenceAdminController,
  heartbeatPresenceController,
  libererVerrouController,
  prolongerVerrouController,
  rejoindreFileAttenteController,
  verifierDisponibiliteController,
} from "../src/controllers/concurrency.controller.js";

export default function concurrencyRoutes(app) {
  const accesUtilisateur = [userAuth];
  const accesAdminGeneral = [userAuth, userAdminResponsable];

  app.get(
    "/api/concurrency/availability",
    ...accesUtilisateur,
    verifierDisponibiliteController
  );

  app.post("/api/concurrency/locks", ...accesUtilisateur, creerVerrouController);
  app.post(
    "/api/concurrency/locks/:id/heartbeat",
    ...accesUtilisateur,
    prolongerVerrouController
  );
  app.delete(
    "/api/concurrency/locks/:id",
    ...accesUtilisateur,
    libererVerrouController
  );

  app.post(
    "/api/concurrency/wait-queue",
    ...accesUtilisateur,
    rejoindreFileAttenteController
  );
  app.delete(
    "/api/concurrency/wait-queue/:id",
    ...accesUtilisateur,
    annulerFileAttenteController
  );

  app.post(
    "/api/concurrency/presence/heartbeat",
    ...accesUtilisateur,
    heartbeatPresenceController
  );

  app.get(
    "/api/admin/concurrency",
    ...accesAdminGeneral,
    etatConcurrenceAdminController
  );
}
