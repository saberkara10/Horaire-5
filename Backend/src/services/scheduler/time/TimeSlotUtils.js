/**
 * Utilitaires de gestion des créneaux horaires académiques.
 *
 * Ce module est la brique de base de tout le système de planification.
 * Il définit les constantes de la journée académique et fournit les fonctions
 * de conversion entre les représentations horaires (chaîne HH:MM:SS ↔ minutes).
 *
 * Convention utilisée dans tout le projet :
 *  - Les heures sont stockées sous forme de chaîne "HH:MM:SS" (format MySQL TIME)
 *  - En interne, les calculs se font toujours en minutes depuis minuit
 *  - Un "slot" est une unité de temps atomique (60 minutes par défaut)
 *  - Un "slot index" est la position d'un slot dans la journée (0 = premier slot à 08:00)
 *
 * @module services/scheduler/time/TimeSlotUtils
 */

/**
 * Heure de début de la journée académique (format "HH:MM:SS").
 * Tous les cours doivent commencer au plus tôt à cette heure.
 * Modifiable via les options des fonctions si une école a des horaires différents.
 *
 * @type {string}
 */
export const ACADEMIC_DAY_START_TIME = "08:00:00";

/**
 * Heure de fin de la journée académique (format "HH:MM:SS").
 * Tous les cours doivent se terminer au plus tard à cette heure.
 * Une journée de 08:00 à 22:00 donne 14 heures disponibles.
 *
 * @type {string}
 */
export const ACADEMIC_DAY_END_TIME = "22:00:00";

/**
 * Durée d'un créneau atomique en minutes.
 * 60 minutes = chaque slot fait exactement 1 heure.
 * Un cours de 2h occupe donc 2 slots consécutifs.
 *
 * @type {number}
 */
export const ACADEMIC_SLOT_DURATION_MINUTES = 60;

/**
 * Pad une partie horaire (heure, minutes, secondes) avec un zéro devant si nécessaire.
 * Ex: "8" → "08", "12" → "12"
 *
 * @param {*} value - La valeur à normaliser (peut être un nombre ou une chaîne)
 * @returns {string} La valeur formatée sur 2 chiffres minimum
 */
function normalizeTimePart(value) {
  return String(value ?? "")
    .trim()
    .padStart(2, "0");
}

/**
 * Normalise une chaîne horaire vers le format "HH:MM:SS".
 *
 * Accepte les formats suivants :
 *  - "8:30"     → "08:30:00"
 *  - "14:00"    → "14:00:00"
 *  - "14:00:00" → "14:00:00" (déjà normalisé)
 *  - ""         → "" (chaîne vide → chaîne vide)
 *  - Toute autre valeur → retournée telle quelle
 *
 * @param {*} value - La chaîne horaire à normaliser
 * @returns {string} La chaîne normalisée "HH:MM:SS" ou la valeur originale si non reconnue
 */
export function normalizeTimeString(value) {
  const texte = String(value ?? "").trim();

  if (!texte) {
    return "";
  }

  // Regex : accepte HH:MM ou HH:MM:SS (les secondes sont optionnelles)
  const correspondance = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(texte);

  if (!correspondance) {
    return texte; // Format non reconnu → retourner sans modification
  }

  const heures = normalizeTimePart(correspondance[1]);
  const minutes = normalizeTimePart(correspondance[2]);
  const secondes = normalizeTimePart(correspondance[3] ?? "00"); // Secondes par défaut : 00
  return `${heures}:${minutes}:${secondes}`;
}

/**
 * Convertit une chaîne horaire "HH:MM:SS" en nombre de minutes depuis minuit.
 *
 * Exemples :
 *  - "08:00:00" → 480
 *  - "14:30:00" → 870
 *  - ""         → NaN
 *
 * @param {*} value - La chaîne horaire à convertir
 * @returns {number} Le nombre de minutes, ou NaN si la valeur est invalide
 */
export function timeStringToMinutes(value) {
  const normalized = normalizeTimeString(value);
  if (!normalized) {
    return Number.NaN;
  }

  // On ne prend que les parties heures et minutes (les secondes sont ignorées)
  const [heures, minutes = "0"] = normalized.split(":");
  const heuresInt = Number.parseInt(heures, 10);
  const minutesInt = Number.parseInt(minutes, 10);

  if (!Number.isFinite(heuresInt) || !Number.isFinite(minutesInt)) {
    return Number.NaN;
  }

  return heuresInt * 60 + minutesInt;
}

/**
 * Convertit un nombre de minutes depuis minuit en chaîne horaire "HH:MM:00".
 *
 * Exemples :
 *  - 480  → "08:00:00"
 *  - 870  → "14:30:00"
 *  - -1   → "" (invalide)
 *
 * Note : les secondes sont toujours mises à "00" car le système ne travaille
 * pas à la précision de la seconde.
 *
 * @param {number} totalMinutes - Le nombre de minutes depuis minuit
 * @returns {string} La chaîne horaire "HH:MM:00", ou "" si invalide
 */
export function minutesToTimeString(totalMinutes) {
  if (!Number.isFinite(Number(totalMinutes))) {
    return "";
  }

  const minutesEntieres = Math.trunc(Number(totalMinutes));
  const heures = Math.floor(minutesEntieres / 60);
  const minutes = minutesEntieres % 60;

  return `${String(heures).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

/**
 * Construit les métadonnées complètes d'un créneau horaire à partir de son heure de début.
 *
 * Utilisée par TimeSlotGenerator pour créer la liste complète des créneaux de la journée.
 * Retourne un objet contenant l'heure de début ET de fin, ainsi que leurs équivalents en minutes.
 *
 * @param {number} startMinutes - L'heure de début du créneau en minutes depuis minuit
 * @param {number} [slotDurationMinutes] - La durée du créneau en minutes (défaut : 60)
 * @returns {{ debut: string, fin: string, debutMinutes: number, finMinutes: number }}
 */
export function buildAcademicSlotTime(startMinutes, slotDurationMinutes = ACADEMIC_SLOT_DURATION_MINUTES) {
  const slotStartMinutes = Number(startMinutes);
  const slotEndMinutes = slotStartMinutes + Number(slotDurationMinutes || 0);

  return {
    debut: minutesToTimeString(slotStartMinutes),          // Ex: "08:00:00"
    fin: minutesToTimeString(slotEndMinutes),              // Ex: "09:00:00"
    debutMinutes: slotStartMinutes,                        // Ex: 480
    finMinutes: slotEndMinutes,                             // Ex: 540
  };
}

/**
 * Calcule les index de slot de début et fin pour un cours d'une durée donnée.
 *
 * Le "slot index" est la position dans la grille de la journée :
 *  - Slot 0 → 08:00 à 09:00
 *  - Slot 1 → 09:00 à 10:00
 *  - ...
 *
 * Cette fonction est utilisée pour vérifier qu'un cours de N heures peut tenir
 * dans la grille sans déborder après la fin de journée.
 *
 * Retourne null si :
 *  - La durée n'est pas un entier positif
 *  - La durée en minutes n'est pas divisible exactement par la durée d'un slot
 *  - Les paramètres de journée sont invalides
 *
 * @param {number} durationHours - Durée du cours en heures (doit être un entier)
 * @param {object} [options={}] - Options de configuration
 * @param {number} [options.slotDurationMinutes] - Durée d'un slot (défaut : 60)
 * @param {string} [options.dayStartTime] - Heure de début de journée (défaut : "08:00:00")
 * @param {string} [options.dayEndTime] - Heure de fin de journée (défaut : "22:00:00")
 * @returns {{ slotCount, slotStartIndex, slotEndIndex, startMinutes, endMinutes, dayStartMinutes, dayEndMinutes }|null}
 */
export function deriveSlotIndexesForDuration(
  durationHours,
  options = {}
) {
  const duree = Number(durationHours);
  const slotDurationMinutes = Number(
    options.slotDurationMinutes ?? ACADEMIC_SLOT_DURATION_MINUTES
  );
  const dayStartMinutes = timeStringToMinutes(
    options.dayStartTime ?? ACADEMIC_DAY_START_TIME
  );
  const dayEndMinutes = timeStringToMinutes(
    options.dayEndTime ?? ACADEMIC_DAY_END_TIME
  );

  // Vérification des préconditions : tous les paramètres doivent être valides
  if (
    !Number.isInteger(duree) ||
    duree <= 0 ||
    !Number.isFinite(slotDurationMinutes) ||
    slotDurationMinutes <= 0 ||
    !Number.isFinite(dayStartMinutes) ||
    !Number.isFinite(dayEndMinutes)
  ) {
    return null;
  }

  const totalMinutes = duree * 60;

  // La durée doit être divisible par la durée d'un slot pour avoir des indices entiers
  if (totalMinutes % slotDurationMinutes !== 0) {
    return null;
  }

  const slotCount = totalMinutes / slotDurationMinutes;

  return {
    slotCount,                                            // Nombre de slots occupés (ex: 2 pour 2h)
    slotStartIndex: 0,                                    // Index de départ (relatif, à ajuster par l'appelant)
    slotEndIndex: slotCount,                              // Index de fin (exclusif)
    startMinutes: dayStartMinutes,                        // Départ absolu de la journée en minutes
    endMinutes: dayStartMinutes + totalMinutes,           // Fin du cours en minutes absolues
    dayStartMinutes,                                      // Début de journée en minutes
    dayEndMinutes,                                        // Fin de journée en minutes
  };
}

/**
 * Vérifie qu'une plage horaire (début → fin) est alignée sur la grille de slots.
 *
 * Un créneau est "aligné" si :
 *  1. L'heure de début est un multiple exact de slotDurationMinutes depuis le début de journée
 *  2. La durée totale (fin - début) est un multiple exact de slotDurationMinutes
 *
 * Exemple avec des slots de 60 min et une journée débutant à 08:00 :
 *  - "08:00" → "10:00" : ✅ aligné (2 slots)
 *  - "08:30" → "10:30" : ❌ non aligné (ne tombe pas sur un début de slot)
 *
 * @param {string} startTime - Heure de début (format "HH:MM:SS")
 * @param {string} endTime - Heure de fin (format "HH:MM:SS")
 * @param {object} [options={}] - Options de configuration
 * @returns {boolean} true si le créneau est aligné sur la grille
 */
export function isSlotAlignedTimeRange(startTime, endTime, options = {}) {
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  const slotDurationMinutes = Number(
    options.slotDurationMinutes ?? ACADEMIC_SLOT_DURATION_MINUTES
  );

  return (
    Number.isFinite(startMinutes) &&
    Number.isFinite(endMinutes) &&
    endMinutes > startMinutes &&
    // L'heure de début doit tomber exactement sur un multiple de slot depuis le début de journée
    (startMinutes - timeStringToMinutes(options.dayStartTime ?? ACADEMIC_DAY_START_TIME)) %
      slotDurationMinutes ===
      0 &&
    // La durée du cours doit être un multiple exact de slot
    (endMinutes - startMinutes) % slotDurationMinutes === 0
  );
}

/**
 * Reconstruit les métadonnées complètes d'un slot à partir d'une plage horaire existante.
 *
 * Utilisée pour récupérer les slotStartIndex et slotEndIndex d'un cours déjà planifié
 * (stocké en BDD avec heure_debut et heure_fin) afin de le replacer dans la grille interne.
 *
 * Retourne null si la plage est invalide ou non alignée sur la grille.
 *
 * @param {string} startTime - Heure de début (format "HH:MM:SS")
 * @param {string} endTime - Heure de fin (format "HH:MM:SS")
 * @param {object} [options={}] - Options de configuration
 * @returns {{ heure_debut, heure_fin, dureeHeures, slotStartIndex, slotEndIndex }|null}
 */
export function buildSlotMetadataFromTimeRange(
  startTime,
  endTime,
  options = {}
) {
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  const slotDurationMinutes = Number(
    options.slotDurationMinutes ?? ACADEMIC_SLOT_DURATION_MINUTES
  );
  const dayStartMinutes = timeStringToMinutes(
    options.dayStartTime ?? ACADEMIC_DAY_START_TIME
  );

  // Toutes les valeurs doivent être valides avant de calculer les index
  if (
    !Number.isFinite(startMinutes) ||
    !Number.isFinite(endMinutes) ||
    endMinutes <= startMinutes ||
    !Number.isFinite(slotDurationMinutes) ||
    slotDurationMinutes <= 0 ||
    !Number.isFinite(dayStartMinutes)
  ) {
    return null;
  }

  const totalMinutes = endMinutes - startMinutes;

  // La durée doit être divisible par la durée d'un slot
  if (totalMinutes % slotDurationMinutes !== 0) {
    return null;
  }

  // Calculer les index de slot dans la grille de la journée
  // slotStartIndex = (heure_debut - debut_journee) / duree_slot
  const slotStartIndex = (startMinutes - dayStartMinutes) / slotDurationMinutes;
  const slotEndIndex = (endMinutes - dayStartMinutes) / slotDurationMinutes;

  // Les index doivent être des entiers (garantit l'alignement sur la grille)
  if (!Number.isInteger(slotStartIndex) || !Number.isInteger(slotEndIndex)) {
    return null;
  }

  return {
    heure_debut: normalizeTimeString(startTime),           // Format normalisé "HH:MM:SS"
    heure_fin: normalizeTimeString(endTime),               // Format normalisé "HH:MM:SS"
    dureeHeures: totalMinutes / 60,                         // Ex: 2 pour un cours de 2h
    slotStartIndex,                                        // Ex: 0 pour 08:00 avec journée à 08:00
    slotEndIndex,                                          // Ex: 2 pour un cours de 2h starts à 08:00
  };
}
