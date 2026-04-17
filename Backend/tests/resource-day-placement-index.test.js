import { describe, expect, test } from "@jest/globals";
import {
  ResourceDayPlacementIndex,
  createResourceDayPlacementIndex,
} from "../src/services/scheduler/constraints/ResourceDayPlacementIndex.js";

describe("ResourceDayPlacementIndex", () => {
  test("isole les placements par type de ressource, identifiant et date", () => {
    const index = createResourceDayPlacementIndex();

    index.add({
      resourceType: "teacher",
      resourceId: 7,
      date: "2026-04-20",
      placement: {
        id_affectation_cours: 2,
        heure_debut: "11:00:00",
        heure_fin: "14:00:00",
      },
    });
    index.add({
      resourceType: "professeur",
      resourceId: 7,
      date: "2026-04-20",
      placement: {
        id_affectation_cours: 1,
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
      },
    });
    index.add({
      resourceType: "groupe",
      resourceId: 99,
      date: "2026-04-20",
      placement: {
        id_affectation_cours: 3,
        heure_debut: "14:00:00",
        heure_fin: "17:00:00",
      },
    });

    expect(index.get({
      resourceType: "professeur",
      resourceId: 7,
      date: "2026-04-20",
    })).toEqual([
      {
        id_affectation_cours: 1,
        date: "2026-04-20",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
      },
      {
        id_affectation_cours: 2,
        date: "2026-04-20",
        heure_debut: "11:00:00",
        heure_fin: "14:00:00",
      },
    ]);

    expect(index.get({
      resourceType: "groupe",
      resourceId: 99,
      date: "2026-04-20",
    })).toEqual([
      {
        id_affectation_cours: 3,
        date: "2026-04-20",
        heure_debut: "14:00:00",
        heure_fin: "17:00:00",
      },
    ]);
  });

  test("supprime un placement sans affecter les autres ressources ou jours", () => {
    const index = new ResourceDayPlacementIndex([
      {
        resourceType: "etudiant",
        resourceId: 101,
        date: "2026-04-20",
        placement: {
          id_affectation_cours: 10,
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
        },
      },
      {
        resourceType: "etudiant",
        resourceId: 101,
        date: "2026-04-20",
        placement: {
          id_affectation_cours: 11,
          heure_debut: "12:00:00",
          heure_fin: "15:00:00",
        },
      },
      {
        resourceType: "etudiant",
        resourceId: 101,
        date: "2026-04-21",
        placement: {
          id_affectation_cours: 12,
          heure_debut: "09:00:00",
          heure_fin: "12:00:00",
        },
      },
    ]);

    const removedCount = index.remove({
      resourceType: "student",
      resourceId: 101,
      date: "2026-04-20",
      placement: {
        id_affectation_cours: 10,
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
      },
    });

    expect(removedCount).toBe(1);
    expect(index.get({
      resourceType: "etudiant",
      resourceId: 101,
      date: "2026-04-20",
    })).toEqual([
      {
        id_affectation_cours: 11,
        date: "2026-04-20",
        heure_debut: "12:00:00",
        heure_fin: "15:00:00",
      },
    ]);
    expect(index.get({
      resourceType: "etudiant",
      resourceId: 101,
      date: "2026-04-21",
    })).toEqual([
      {
        id_affectation_cours: 12,
        date: "2026-04-21",
        heure_debut: "09:00:00",
        heure_fin: "12:00:00",
      },
    ]);
  });
});
