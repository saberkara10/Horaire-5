/**
 * Utilitaires de calendrier pour le frontend.
 *
 * Ce module fournit toutes les constantes et fonctions liées à la manipulation
 * des dates et des semaines dans les vues de planning.
 *
 * Problème central résolu par creerDateLocale() :
 * JavaScript peut interpréter une date ISO "2025-01-15" comme UTC minuit,
 * ce qui cause un décalage d'un jour selon le fuseau horaire de l'utilisateur.
 * On crée toujours les dates en heure locale pour éviter ce piège classique.
 *
 * @module utils/calendar
 */

/**
 * Liste complète des jours de la semaine avec leur valeur numérique.
 *
 * La convention utilisée dans ce projet (inspirée de MySQL DAYOFWEEK) :
 *  - 1 = Lundi, 2 = Mardi, ..., 7 = Dimanche
 * (Attention : JavaScript getDay() utilise 0 = Dimanche, 1 = Lundi... différent !)
 *
 * @type {Array<{value: number, label: string}>}
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

/**
 * Sous-ensemble des jours ouvrables uniquement (lundi à vendredi).
 * Dérivé de JOURS_SEMAINE_COMPLETS pour garantir la cohérence.
 *
 * @type {Array<{value: number, label: string}>}
 */
export const JOURS_SEMAINE_OUVRABLES = JOURS_SEMAINE_COMPLETS.filter(
  (jour) => jour.value >= 1 && jour.value <= 5
);

/**
 * Crée un objet Date en heure locale sans décalage de fuseau horaire.
 *
 * Le problème que cette fonction résout :
 * `new Date("2025-01-15")` crée une date UTC minuit, qui en fuseau UTC-5
 * devient le 14 janvier à 19h — soit un jour trop tôt côté JavaScript.
 * On passe par `new Date(annee, mois, jour)` qui utilise toujours l'heure locale.
 *
 * Accepte :
 *  - Un objet Date existant → retourne une copie sans l'heure
 *  - Une chaîne ISO "YYYY-MM-DD" ou "YYYY-MM-DDTHH:MM:SS..." (la partie heure est ignorée)
 *  - Une chaîne invalide → retourne le 1er janvier 1970 (valeur sentinelle)
 *
 * @param {Date|string} dateString - La date à créer
 * @returns {Date} La date correspondante en heure locale (heures à 00:00:00)
 */
export function creerDateLocale(dateString) {
  // Si c'est déjà un Date, on le recrée sans l'heure pour normaliser
  if (dateString instanceof Date) {
    return new Date(
      dateString.getFullYear(),
      dateString.getMonth(),
      dateString.getDate()
    );
  }

  const texte = String(dateString || "").trim();
  if (!texte) {
    return new Date(1970, 0, 1); // Valeur sentinelle pour les dates vides
  }

  // Extraire uniquement la partie "YYYY-MM-DD" si on a un datetime complet
  const dateIso = texte.includes("T") ? texte.slice(0, 10) : texte;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);

  if (!match) {
    // Dernier recours : laisser JS parser, puis extraire la partie date
    const fallback = new Date(texte);
    if (Number.isNaN(fallback.getTime())) {
      return new Date(1970, 0, 1); // Date invalide → valeur sentinelle
    }

    return new Date(
      fallback.getFullYear(),
      fallback.getMonth(),
      fallback.getDate()
    );
  }

  // Chemin normal : parser YYYY-MM-DD en local (pas UTC)
  const [, annee, mois, jour] = match;
  return new Date(Number(annee), Number(mois) - 1, Number(jour));
  //                                           ^^^ mois 0-indexé en JavaScript
}

/**
 * Retourne le lundi de la semaine contenant la date fournie.
 *
 * Ajuste la date vers le lundi précédent (ou la date elle-même si c'est déjà un lundi).
 * L'heure est mise à minuit (00:00:00.000) pour des comparaisons cohérentes.
 *
 * Note : getDay() retourne 0 pour dimanche en JavaScript.
 * Pour le dimanche (0), on recule de 6 jours pour atteindre le lundi.
 *
 * @param {Date} date - La date à partir de laquelle trouver le lundi
 * @returns {Date} Le lundi de la semaine (à 00:00:00)
 */
export function getDebutSemaine(date) {
  const dateReference = new Date(date);
  const jour = dateReference.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi

  // diff = nombre de jours à reculer pour atteindre le lundi
  const diff = jour === 0 ? -6 : 1 - jour;

  dateReference.setDate(dateReference.getDate() + diff);
  dateReference.setHours(0, 0, 0, 0); // Normaliser l'heure à minuit
  return dateReference;
}

/**
 * Convertit un objet Date JavaScript vers l'index de jour utilisé dans ce projet.
 *
 * Ce projet utilise : 0 = lundi, 1 = mardi, ..., 6 = dimanche.
 * JavaScript utilise : 0 = dimanche, 1 = lundi, ..., 6 = samedi.
 *
 * La formule `(getDay() + 6) % 7` effectue cette conversion :
 *  - Lundi (1)     → (1+6)%7 = 0 ✓
 *  - Dimanche (0)  → (0+6)%7 = 6 ✓
 *  - Samedi (6)    → (6+6)%7 = 5 ✓
 *
 * @param {Date} date - La date dont on veut l'index de jour
 * @returns {number} Index de 0 (lundi) à 6 (dimanche)
 */
export function getIndexJourCalendrier(date) {
  return (date.getDay() + 6) % 7;
}

/**
 * Formate une date en chaîne courte lisible pour les en-têtes de calendrier.
 *
 * Exemple : new Date(2025, 0, 15) → "15 janv."
 * Utilise le format canadien-français (fr-CA) pour la cohérence avec le projet.
 *
 * @param {Date} date - La date à formater
 * @returns {string} La date formatée de manière courte (ex: "15 janv.")
 */
export function formaterDateCourte(date) {
  return date.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}
