/**
 * Générateur de candidats de démarrage de cours.
 *
 * Ce module calcule toutes les heures de départ valides pour un cours d'une
 * durée donnée dans la journée académique. Il est utilisé par CandidatePrecomputer
 * pour pré-calculer les créneaux possibles de chaque cours avant la planification.
 *
 * Exemple — cours de 2h dans une journée 08:00–22:00, slots de 1h :
 *  Candidats valides : 08:00, 09:00, 10:00, ..., 20:00 (le cours fini au plus tard à 22:00)
 *  → 13 candidats valides
 *
 * Pourquoi pré-calculer ?
 * Pendant la planification, le moteur teste des milliers de placements par seconde.
 * Pré-calculer les candidats valides une seule fois par durée de cours évite de refaire
 * toutes les vérifications d'alignement à chaque tentative de placement.
 *
 * @module services/scheduler/time/StartTimeCandidates
 */
import {
  ACADEMIC_DAY_END_TIME,
  ACADEMIC_DAY_START_TIME,
  ACADEMIC_SLOT_DURATION_MINUTES,
  buildSlotMetadataFromTimeRange,
  deriveSlotIndexesForDuration,
  timeStringToMinutes,
} from "./TimeSlotUtils.js";
import { generateAcademicWeekdayTimeSlots } from "./TimeSlotGenerator.js";

/**
 * Génère tous les créneaux de départ valides pour un cours d'une durée donnée.
 *
 * Pour chaque position possible dans la grille de créneaux, vérifie que :
 *  1. Les slots de début et de fin existent dans la grille
 *  2. La plage horaire est valide (buildSlotMetadataFromTimeRange)
 *  3. Le cours se termine avant ou à la fin de journée
 *  4. L'index de départ est >= 0
 *
 * Le résultat est un tableau d'objets "candidat" contenant l'heure de début,
 * l'heure de fin et les index de slots. Ces candidats sont ensuite enrichis avec
 * la clé du cours par CandidatePrecomputer.
 *
 * @param {number} durationHours - Durée du cours en heures (entier positif)
 * @param {object} [options={}] - Options de configuration
 * @param {object[]} [options.timeSlots] - Grille de slots pré-générée (optimisation)
 * @param {string} [options.dayStartTime] - Heure de début de journée
 * @param {string} [options.dayEndTime] - Heure de fin de journée
 * @param {number} [options.slotDurationMinutes] - Durée d'un slot en minutes
 * @returns {Array<{
 *   dureeHeures: number,
 *   heure_debut: string,
 *   heure_fin: string,
 *   slotStartIndex: number,
 *   slotEndIndex: number,
 *   index: number
 * }>} Liste des créneaux de départ valides
 */
export function buildStartTimeCandidates(durationHours, options = {}) {
  const duree = Number(durationHours);

  // Utiliser la grille fournie ou en générer une nouvelle (cache implicite via options)
  const timeSlots =
    Array.isArray(options.timeSlots) && options.timeSlots.length > 0
      ? options.timeSlots
      : generateAcademicWeekdayTimeSlots(options);

  const dayEndMinutes = timeStringToMinutes(
    options.dayEndTime ?? ACADEMIC_DAY_END_TIME
  );

  // La durée doit être un entier positif pour que le cours tienne dans des slots entiers
  if (!Number.isInteger(duree) || duree <= 0 || !Number.isFinite(dayEndMinutes)) {
    return [];
  }

  // Calculer combien de slots consécutifs ce cours occupe
  const slotCount = (duree * 60) / Number(
    options.slotDurationMinutes ?? ACADEMIC_SLOT_DURATION_MINUTES
  );

  // Si le résultat n'est pas un entier, le cours ne s'aligne pas sur la grille
  if (!Number.isInteger(slotCount) || slotCount <= 0) {
    return [];
  }

  const candidates = [];

  // Parcourir les positions de départ possibles
  // Pour un cours de 2 slots dans une grille de 14 : positions 0 à 12 (inclusive)
  for (let index = 0; index + slotCount <= timeSlots.length; index += 1) {
    const slotStart = timeSlots[index];
    const slotEnd = timeSlots[index + slotCount - 1]; // Dernier slot occupé

    if (!slotStart || !slotEnd) {
      continue; // Ne devrait pas arriver, mais on se protège contre les trous dans la grille
    }

    // Construire les métadonnées de la plage horaire (début → fin du dernier slot)
    // Note : la fin d'un cours = fin du dernier slot occupé (slotEnd.fin)
    const metadata = buildSlotMetadataFromTimeRange(slotStart.debut, slotEnd.fin, options);
    if (!metadata) {
      continue; // La plage n'est pas valide (non alignée ou invalide)
    }

    candidates.push({
      dureeHeures: duree,
      heure_debut: metadata.heure_debut,        // Ex: "08:00:00"
      heure_fin: metadata.heure_fin,            // Ex: "10:00:00" pour un cours de 2h
      slotStartIndex: metadata.slotStartIndex,  // Ex: 0
      slotEndIndex: metadata.slotEndIndex,      // Ex: 2
      index: candidates.length,                // Position dans le tableau de candidats
    });
  }

  // Filtrer les candidats qui dépasseraient la fin de journée
  // (protection supplémentaire au cas où la grille aurait des irrégularités)
  return candidates.filter(
    (candidate) =>
      timeStringToMinutes(candidate.heure_fin) <= dayEndMinutes &&
      candidate.slotStartIndex >= 0
  );
}

/**
 * Génère une Map de candidats de démarrage pour plusieurs durées de cours.
 *
 * Pratique quand le scheduler doit gérer des cours de durées différentes (1h, 2h, 3h...).
 * Chaque durée est une clé dans la Map, et la valeur est le tableau de candidats correspondant.
 *
 * @param {number[]} durationHoursList - Liste des durées en heures à pré-calculer
 * @param {object} [options={}] - Options de configuration (partagées entre toutes les durées)
 * @returns {Map<number, ReturnType<typeof buildStartTimeCandidates>>}
 */
export function buildStartTimeCandidateMap(durationHoursList, options = {}) {
  const result = new Map();
  for (const durationHours of durationHoursList || []) {
    result.set(durationHours, buildStartTimeCandidates(durationHours, options));
  }
  return result;
}

/**
 * Alias de buildSlotMetadataFromTimeRange avec les valeurs par défaut académiques intégrées.
 *
 * Pratique pour obtenir les métadonnées d'un créneau à partir d'heures existantes
 * sans avoir à passer les constantes ACADEMIC_* manuellement.
 *
 * @param {string} startTime - Heure de début du créneau
 * @param {string} endTime - Heure de fin du créneau
 * @param {object} [options={}] - Options supplémentaires
 * @returns {ReturnType<import('./TimeSlotUtils.js').buildSlotMetadataFromTimeRange>}
 */
export function getCandidateMetadataForTimeRange(startTime, endTime, options = {}) {
  return buildSlotMetadataFromTimeRange(startTime, endTime, {
    ...options,
    dayStartTime: options.dayStartTime ?? ACADEMIC_DAY_START_TIME,
    dayEndTime: options.dayEndTime ?? ACADEMIC_DAY_END_TIME,
  });
}

// Ré-export pour la compatibilité — certains modules importent cette fonction depuis ici
export { deriveSlotIndexesForDuration };
