import { describe, expect, test } from "@jest/globals";
import { compareGenerationPlacements } from "../src/services/scheduler/ScheduleGenerationService.js";

function buildPlacement({
  comparisonKey,
  courseId,
  teacherId,
  roomId,
  date,
  start,
  end,
  courseCode,
  teacherName,
  roomCode,
  groupIds = [101],
  groupNames = ["Groupe A"],
}) {
  return {
    comparison_key: comparisonKey,
    id_cours: courseId,
    id_professeur: teacherId,
    id_salle: roomId,
    date_cours: date,
    heure_debut: start,
    heure_fin: end,
    payload: {
      code_cours: courseCode,
      nom_professeur: teacherName,
      code_salle: roomCode,
      group_ids: groupIds,
      group_names: groupNames,
    },
  };
}

describe("schedule generation service comparison", () => {
  test("detecte les changements de creneau, professeur et salle", () => {
    const left = [
      buildPlacement({
        comparisonKey: "cours-a|1",
        courseId: 1,
        teacherId: 11,
        roomId: 21,
        date: "2026-01-12",
        start: "08:00:00",
        end: "10:00:00",
        courseCode: "420-A01",
        teacherName: "Alice Tremblay",
        roomCode: "B-201",
      }),
    ];
    const right = [
      buildPlacement({
        comparisonKey: "cours-a|1",
        courseId: 1,
        teacherId: 12,
        roomId: 22,
        date: "2026-01-13",
        start: "10:00:00",
        end: "12:00:00",
        courseCode: "420-A01",
        teacherName: "Bruno Gagnon",
        roomCode: "C-301",
      }),
    ];

    const result = compareGenerationPlacements(
      left,
      right,
      { placement_count: 1, conflict_count: 2, teacher_count: 1, room_count: 1, quality_score: 72 },
      { placement_count: 1, conflict_count: 1, teacher_count: 1, room_count: 1, quality_score: 81 }
    );

    expect(result.changes.movedCourses).toHaveLength(1);
    expect(result.changes.changedTeachers).toHaveLength(1);
    expect(result.changes.changedRooms).toHaveLength(1);
    expect(result.overview.delta.conflict_count).toBe(-1);
    expect(result.overview.delta.quality_score).toBe(9);
  });

  test("detecte les ajouts et suppressions", () => {
    const left = [
      buildPlacement({
        comparisonKey: "cours-a|1",
        courseId: 1,
        teacherId: 11,
        roomId: 21,
        date: "2026-01-12",
        start: "08:00:00",
        end: "10:00:00",
        courseCode: "420-A01",
        teacherName: "Alice Tremblay",
        roomCode: "B-201",
      }),
    ];
    const right = [
      buildPlacement({
        comparisonKey: "cours-b|1",
        courseId: 2,
        teacherId: 15,
        roomId: 31,
        date: "2026-01-14",
        start: "13:00:00",
        end: "15:00:00",
        courseCode: "420-B02",
        teacherName: "Camille Roy",
        roomCode: "A-101",
      }),
    ];

    const result = compareGenerationPlacements(left, right);

    expect(result.changes.added).toHaveLength(1);
    expect(result.changes.removed).toHaveLength(1);
  });
});
