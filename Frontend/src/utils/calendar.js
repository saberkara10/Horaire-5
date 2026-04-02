/**
 * UTILS - Calendar
 *
 * Ce module fournit les constantes
 * et helpers de calendrier du frontend.
 */
export const JOURS_SEMAINE_COMPLETS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 7, label: "Dimanche" },
];

export function creerDateLocale(dateString) {
  const [annee, mois, jour] = String(dateString || "").split("-").map(Number);
  return new Date(annee || 1970, (mois || 1) - 1, jour || 1);
}

export function getDebutSemaine(date) {
  const dateReference = new Date(date);
  const jour = dateReference.getDay();
  const diff = jour === 0 ? -6 : 1 - jour;

  dateReference.setDate(dateReference.getDate() + diff);
  dateReference.setHours(0, 0, 0, 0);
  return dateReference;
}

export function getIndexJourCalendrier(date) {
  return (date.getDay() + 6) % 7;
}

export function formaterDateCourte(date) {
  return date.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}
/**
 * UTILS - Calendar
 *
 * Ce module fournit les constantes
 * et helpers de calendrier du frontend.
 */
