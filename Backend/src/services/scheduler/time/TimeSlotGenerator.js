/**
 * Générateur de créneaux horaires académiques.
 *
 * Ce module génère la liste des créneaux disponibles dans une journée académique.
 * Il s'appuie sur TimeSlotUtils pour les calculs bas niveau et produit des objets
 * "slot" prêts à l'emploi pour le scheduler.
 *
 * Concept de base :
 * La journée académique est découpée en tranches (slots) de durée fixe.
 * Par défaut : 08:00 → 22:00 avec des slots de 60 min = 14 slots par jour.
 *
 * Chaque slot a :
 *  - Un index dans la journée (0 = premier slot)
 *  - Des heures de début et fin (chaînes "HH:MM:SS")
 *  - Les mêmes valeurs en minutes pour les calculs
 *  - Un slotStartIndex et slotEndIndex pour la compatibilité avec le système de grille
 *
 * @module services/scheduler/time/TimeSlotGenerator
 */
import {
  ACADEMIC_DAY_END_TIME,
  ACADEMIC_DAY_START_TIME,
  ACADEMIC_SLOT_DURATION_MINUTES,
  buildAcademicSlotTime,
  minutesToTimeString,
  timeStringToMinutes,
} from "./TimeSlotUtils.js";

/**
 * Génère la liste complète des créneaux horaires d'une journée.
 *
 * Parcourt la journée de `dayStartTime` à `dayEndTime` par pas de `slotDurationMinutes`,
 * et construit un objet pour chaque créneau complet (pas de créneau partiel à la fin).
 *
 * Le tableau retourné représente la "grille du jour" sur laquelle le scheduler
 * positionne les cours.
 *
 * Retourne [] si les paramètres sont invalides (ex: heure de fin avant heure de début).
 *
 * @param {object} [options={}] - Configuration des créneaux
 * @param {string} [options.dayStartTime="08:00:00"] - Heure de début de journée
 * @param {string} [options.dayEndTime="22:00:00"] - Heure de fin de journée
 * @param {number} [options.slotDurationMinutes=60] - Durée d'un créneau en minutes
 * @returns {Array<{
 *   index: number,
 *   debut: string,
 *   fin: string,
 *   debutMinutes: number,
 *   finMinutes: number,
 *   slotStartIndex: number,
 *   slotEndIndex: number
 * }>} Liste des créneaux de la journée
 */
export function generateTimeSlots(options = {}) {
  const dayStartTime = options.dayStartTime ?? ACADEMIC_DAY_START_TIME;
  const dayEndTime = options.dayEndTime ?? ACADEMIC_DAY_END_TIME;
  const slotDurationMinutes = Number(
    options.slotDurationMinutes ?? ACADEMIC_SLOT_DURATION_MINUTES
  );
  const dayStartMinutes = timeStringToMinutes(dayStartTime);
  const dayEndMinutes = timeStringToMinutes(dayEndTime);

  // Validation des préconditions : impossible de générer des créneaux sans bornes valides
  if (
    !Number.isFinite(dayStartMinutes) ||
    !Number.isFinite(dayEndMinutes) ||
    !Number.isFinite(slotDurationMinutes) ||
    slotDurationMinutes <= 0 ||
    dayEndMinutes <= dayStartMinutes
  ) {
    return [];
  }

  const slots = [];

  // Avancer de slot en slot jusqu'à ce qu'il n'y ait plus assez de place
  for (
    let currentMinutes = dayStartMinutes;
    currentMinutes + slotDurationMinutes <= dayEndMinutes; // Pas de créneau partiel
    currentMinutes += slotDurationMinutes
  ) {
    const meta = buildAcademicSlotTime(currentMinutes, slotDurationMinutes);

    slots.push({
      index: slots.length,                  // Position dans le tableau (0-based)
      debut: meta.debut,                    // Heure de début (ex: "08:00:00")
      fin: meta.fin,                        // Heure de fin (ex: "09:00:00")
      debutMinutes: meta.debutMinutes,      // Début en minutes depuis minuit (ex: 480)
      finMinutes: meta.finMinutes,          // Fin en minutes depuis minuit (ex: 540)
      slotStartIndex: slots.length,         // Index de début (même que index)
      slotEndIndex: slots.length + 1,       // Index de fin (exclusif)
    });
  }

  return slots;
}

/**
 * Génère les créneaux de la journée académique par défaut.
 *
 * Raccourci qui appelle generateTimeSlots() avec les valeurs par défaut du projet.
 * Résultat : 14 créneaux de 08:00 à 22:00 (un par heure).
 *
 * @param {object} [options={}] - Options pour surcharger les valeurs par défaut
 * @returns {ReturnType<typeof generateTimeSlots>} Liste des 14 créneaux
 */
export function generateAcademicWeekdayTimeSlots(options = {}) {
  return generateTimeSlots({
    dayStartTime: options.dayStartTime ?? ACADEMIC_DAY_START_TIME,
    dayEndTime: options.dayEndTime ?? ACADEMIC_DAY_END_TIME,
    slotDurationMinutes:
      options.slotDurationMinutes ?? ACADEMIC_SLOT_DURATION_MINUTES,
  });
}

/**
 * Retrouve un créneau dans une liste à partir de son heure de début.
 *
 * Utilisée par le scheduler pour vérifier qu'un cours prévu à une heure donnée
 * correspond bien à un créneau existant dans la grille.
 *
 * @param {object[]} timeSlots - La liste de créneaux générée par generateTimeSlots()
 * @param {string} startTime - L'heure de début à rechercher (ex: "08:00:00" ou "8:00")
 * @returns {object|undefined} Le créneau correspondant, ou undefined s'il n'existe pas
 */
export function findTimeSlotByStartTime(timeSlots, startTime) {
  const normalized = String(startTime || "").trim();
  return (Array.isArray(timeSlots) ? timeSlots : []).find(
    (slot) => slot.debut === normalized
  );
}

/**
 * Formate l'étiquette lisible d'un créneau pour l'affichage.
 *
 * @param {object|null} slot - Le créneau à formater
 * @returns {string} Ex: "08:00:00 - 10:00:00", ou "" si slot est null
 */
export function formatSlotLabel(slot) {
  if (!slot) {
    return "";
  }

  return `${slot.debut} - ${slot.fin}`;
}

/**
 * Retourne l'heure de fin du dernier créneau de la journée académique.
 *
 * Utilisée pour valider qu'un cours proposé ne déborde pas après la fin de journée.
 * Si aucun créneau n'est généré (paramètres invalides), retourne "00:00:00".
 *
 * @param {object} [options={}] - Options de configuration de la journée
 * @returns {string} L'heure de fin du dernier créneau, format "HH:MM:00"
 */
export function lastAcademicSlotEndTime(options = {}) {
  const slots = generateAcademicWeekdayTimeSlots(options);
  return slots.length > 0 ? slots[slots.length - 1].fin : minutesToTimeString(0);
}
