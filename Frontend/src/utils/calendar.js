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

export const JOURS_SEMAINE_OUVRABLES = JOURS_SEMAINE_COMPLETS.filter(
  (jour) => jour.value >= 1 && jour.value <= 5
);

export function creerDateLocale(dateString) {
  if (dateString instanceof Date) {
    return new Date(
      dateString.getFullYear(),
      dateString.getMonth(),
      dateString.getDate()
    );
  }

  const texte = String(dateString || "").trim();
  if (!texte) {
    return new Date(1970, 0, 1);
  }

  const dateIso = texte.includes("T") ? texte.slice(0, 10) : texte;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);

  if (!match) {
    const fallback = new Date(texte);
    if (Number.isNaN(fallback.getTime())) {
      return new Date(1970, 0, 1);
    }

    return new Date(
      fallback.getFullYear(),
      fallback.getMonth(),
      fallback.getDate()
    );
  }

  const [, annee, mois, jour] = match;
  return new Date(Number(annee), Number(mois) - 1, Number(jour));
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
