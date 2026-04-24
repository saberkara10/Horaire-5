import { apiRequest } from "./api.js";

function construireQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([cle, valeur]) => {
    if (valeur !== undefined && valeur !== null && String(valeur).trim() !== "") {
      searchParams.set(cle, String(valeur));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function recupererActivityLogs(filtres = {}) {
  return apiRequest(`/api/admin/activity-logs${construireQuery(filtres)}`);
}

export function recupererActivityLog(idLog) {
  return apiRequest(`/api/admin/activity-logs/${idLog}`);
}

export function recupererActivityLogsStats() {
  return apiRequest("/api/admin/activity-logs/stats/summary");
}
