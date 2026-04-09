/**
 * SERVICE - Dashboard API
 *
 * Charge la synthese metier du tableau de bord.
 */

import { apiRequest } from "./api.js";

export async function recupererDashboardOverview() {
  return apiRequest("/api/dashboard/overview");
}
