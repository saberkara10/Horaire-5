/**
 * SERVICE - Dashboard API
 *
 * Ce service centralise les appels HTTP
 * utilises par le dashboard.
 */
const API_BASE = "http://localhost:3000/api";

export async function recupererStatistiques() {
  const options = { credentials: "include" };

  const [sallesRes, professeursRes, coursRes] = await Promise.allSettled([
    fetch(`${API_BASE}/salles`, options),
    fetch(`${API_BASE}/professeurs`, options),
    fetch(`${API_BASE}/cours`, options),
  ]);

  const salles = sallesRes.status === "fulfilled" && sallesRes.value.ok
    ? await sallesRes.value.json() : [];

  const professeurs = professeursRes.status === "fulfilled" && professeursRes.value.ok
    ? await professeursRes.value.json() : [];

  const cours = coursRes.status === "fulfilled" && coursRes.value.ok
    ? await coursRes.value.json() : [];

  return {
    salles: salles.length,
    professeurs: professeurs.length,
    cours: cours.length,
    etudiants: 0,
  };
}
/**
 * SERVICE - Dashboard API
 *
 * Ce service centralise les appels HTTP
 * utilises par le dashboard.
 */
