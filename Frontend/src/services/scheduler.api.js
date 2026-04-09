import { apiRequest } from "./api.js";

const BASE_URL = "/api/scheduler";

export async function recupererSessionsScheduler() {
  return apiRequest(`${BASE_URL}/sessions`, {
    credentials: "include",
  });
}

export async function genererSessionScheduler(payload = {}) {
  return apiRequest(`${BASE_URL}/generer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
}
