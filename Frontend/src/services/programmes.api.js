import { apiRequest } from "./api.js";

export async function recupererProgrammes() {
  return apiRequest("/api/programmes");
}
