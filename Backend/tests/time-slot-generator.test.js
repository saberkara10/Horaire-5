import { describe, expect, test } from "@jest/globals";
import {
  ACADEMIC_DAY_END_TIME,
  ACADEMIC_DAY_START_TIME,
  ACADEMIC_SLOT_DURATION_MINUTES,
  buildSlotMetadataFromTimeRange,
  deriveSlotIndexesForDuration,
  timeStringToMinutes,
  minutesToTimeString,
} from "../src/services/scheduler/time/TimeSlotUtils.js";
import {
  generateAcademicWeekdayTimeSlots,
  formatSlotLabel,
} from "../src/services/scheduler/time/TimeSlotGenerator.js";
import {
  buildStartTimeCandidates,
  buildStartTimeCandidateMap,
  getCandidateMetadataForTimeRange,
} from "../src/services/scheduler/time/StartTimeCandidates.js";

describe("Scheduler time layer", () => {
  test("genera une grille horaire 1h de 08:00 a 22:00", () => {
    const slots = generateAcademicWeekdayTimeSlots();

    expect(slots).toHaveLength(14);
    expect(slots[0]).toMatchObject({
      index: 0,
      debut: "08:00:00",
      fin: "09:00:00",
      slotStartIndex: 0,
      slotEndIndex: 1,
    });
    expect(slots.at(-1)).toMatchObject({
      index: 13,
      debut: "21:00:00",
      fin: "22:00:00",
      slotStartIndex: 13,
      slotEndIndex: 14,
    });
    expect(formatSlotLabel(slots[0])).toBe("08:00:00 - 09:00:00");
  });

  test("convertit correctement les heures et les index de slots", () => {
    expect(timeStringToMinutes("08:00:00")).toBe(480);
    expect(minutesToTimeString(840)).toBe("14:00:00");

    expect(deriveSlotIndexesForDuration(3)).toMatchObject({
      slotCount: 3,
      slotStartIndex: 0,
      slotEndIndex: 3,
    });

    expect(buildSlotMetadataFromTimeRange("10:00:00", "13:00:00")).toMatchObject({
      heure_debut: "10:00:00",
      heure_fin: "13:00:00",
      dureeHeures: 3,
      slotStartIndex: 2,
      slotEndIndex: 5,
    });

    expect(getCandidateMetadataForTimeRange("19:00:00", "22:00:00")).toMatchObject({
      slotStartIndex: 11,
      slotEndIndex: 14,
    });
  });

  test("calcule tous les depart possibles selon la duree", () => {
    const candidats = buildStartTimeCandidates(3);

    expect(candidats).toHaveLength(12);
    expect(candidats[0]).toMatchObject({
      dureeHeures: 3,
      heure_debut: "08:00:00",
      heure_fin: "11:00:00",
      slotStartIndex: 0,
      slotEndIndex: 3,
    });
    expect(candidats.at(-1)).toMatchObject({
      dureeHeures: 3,
      heure_debut: "19:00:00",
      heure_fin: "22:00:00",
      slotStartIndex: 11,
      slotEndIndex: 14,
    });
  });

  test("construit une carte de candidats par duree", () => {
    const carte = buildStartTimeCandidateMap([1, 2, 3]);

    expect(carte.get(1)).toHaveLength(14);
    expect(carte.get(2)).toHaveLength(13);
    expect(carte.get(3)).toHaveLength(12);
    expect(carte.get(3)[1]).toMatchObject({
      heure_debut: "09:00:00",
      heure_fin: "12:00:00",
      slotStartIndex: 1,
      slotEndIndex: 4,
    });
  });

  test("reconnait les constantes par defaut du calendrier", () => {
    expect(ACADEMIC_DAY_START_TIME).toBe("08:00:00");
    expect(ACADEMIC_DAY_END_TIME).toBe("22:00:00");
    expect(ACADEMIC_SLOT_DURATION_MINUTES).toBe(60);
  });
});
