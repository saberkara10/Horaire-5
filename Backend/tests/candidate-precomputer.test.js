import { describe, expect, test } from "@jest/globals";
import {
  buildCourseTimeCandidateMap,
  buildCourseTimeCandidates,
  resolveCourseDurationHours,
} from "../src/services/scheduler/optimization/CandidatePrecomputer.js";

describe("CandidatePrecomputer", () => {
  test("calcule tous les candidats horaires d'un cours de 3h sur la grille 08-22", () => {
    const course = {
      id_cours: 101,
      code: "INF101",
      duree: 3,
    };

    const candidates = buildCourseTimeCandidates(course);

    expect(candidates).toHaveLength(12);
    expect(candidates[0]).toMatchObject({
      courseKey: "course:101",
      heure_debut: "08:00:00",
      heure_fin: "11:00:00",
      slotStartIndex: 0,
      slotEndIndex: 3,
      dureeHeures: 3,
    });
    expect(candidates.at(-1)).toMatchObject({
      courseKey: "course:101",
      heure_debut: "19:00:00",
      heure_fin: "22:00:00",
      slotStartIndex: 11,
      slotEndIndex: 14,
      dureeHeures: 3,
    });
  });

  test("retombe sur une duree compatible quand le cours ne la porte pas explicitement", () => {
    expect(resolveCourseDurationHours({ code: "ADM101" }, 2)).toBe(2);
    expect(resolveCourseDurationHours({ code: "INF102", cours_duree: 180 })).toBe(3);
  });

  test("construit une map de candidats stable par cours", () => {
    const courses = [
      { id_cours: 10, code: "INF101", dureeHeures: 3 },
      { id_cours: 11, code: "INF102" },
    ];

    const candidateMap = buildCourseTimeCandidateMap(courses, {
      fallbackDurationHours: 2,
    });

    expect(candidateMap).toBeInstanceOf(Map);
    expect(candidateMap.get("course:10")).toHaveLength(12);
    expect(candidateMap.get("course:11")).toHaveLength(13);
    expect(candidateMap.get("course:11")[0]).toMatchObject({
      courseKey: "course:11",
      heure_debut: "08:00:00",
      heure_fin: "10:00:00",
      slotStartIndex: 0,
      slotEndIndex: 2,
      dureeHeures: 2,
    });
  });
});

