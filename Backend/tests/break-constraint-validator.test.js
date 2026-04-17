import { describe, expect, test } from "@jest/globals";
import { BreakConstraintValidator } from "../src/services/scheduler/constraints/BreakConstraintValidator.js";

describe("BreakConstraintValidator", () => {
  test("rejette un 3e cours quand la pause n'est que de 30 minutes", () => {
    const result = BreakConstraintValidator.validateSequenceBreakConstraint({
      placements: [
        {
          id_affectation_cours: 1,
          date: "2026-03-23",
          heure_debut: "08:00",
          heure_fin: "11:00",
        },
        {
          id_affectation_cours: 2,
          date: "2026-03-23",
          heure_debut: "11:00",
          heure_fin: "14:00",
        },
      ],
      proposedPlacement: {
        id_affectation_cours: 3,
        date: "2026-03-23",
        heure_debut: "14:30",
        heure_fin: "17:30",
      },
      resourceType: "etudiant",
      resourceId: 99,
    });

    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      code: "BREAK_AFTER_TWO_CONSECUTIVE_REQUIRED",
      resourceType: "etudiant",
      resourceId: 99,
      date: "2026-03-23",
    });
    expect(result.violations[0].details).toMatchObject({
      gap_minutes: 30,
      min_break_minutes: 60,
    });
  });

  test("rejette un 3e cours quand la pause est de 0 minute", () => {
    const result = BreakConstraintValidator.validateSequenceBreakConstraint({
      placements: [
        {
          id_affectation_cours: 1,
          date: "2026-03-23",
          heure_debut: "08:00",
          heure_fin: "11:00",
        },
        {
          id_affectation_cours: 2,
          date: "2026-03-23",
          heure_debut: "11:00",
          heure_fin: "14:00",
        },
      ],
      proposedPlacement: {
        id_affectation_cours: 3,
        date: "2026-03-23",
        heure_debut: "14:00",
        heure_fin: "17:00",
      },
      resourceType: "professeur",
      resourceId: 12,
    });

    expect(result.valid).toBe(false);
    expect(result.violations[0].details).toMatchObject({
      gap_minutes: 0,
      min_break_minutes: 60,
    });
  });

  test("accepte un 3e cours quand la pause est d'au moins 60 minutes", () => {
    const result = BreakConstraintValidator.validateSequenceBreakConstraint({
      placements: [
        {
          id_affectation_cours: 1,
          date: "2026-03-23",
          heure_debut: "08:00",
          heure_fin: "11:00",
        },
        {
          id_affectation_cours: 2,
          date: "2026-03-23",
          heure_debut: "11:00",
          heure_fin: "14:00",
        },
      ],
      proposedPlacement: {
        id_affectation_cours: 3,
        date: "2026-03-23",
        heure_debut: "15:00",
        heure_fin: "18:00",
      },
      resourceType: "groupe",
      resourceId: 4,
    });

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
