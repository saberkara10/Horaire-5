/**
 * SERVICE - Programmes API
 *
 * Ce service centralise les appels HTTP
 * lies aux programmes.
 */
import { apiRequest } from "./api.js";

export async function recupererProgrammes() {
  return apiRequest("/api/programmes");
}
/**
 * SERVICE - Programmes API
 *
 * Ce service centralise les appels HTTP
 * lies aux programmes.
 */
