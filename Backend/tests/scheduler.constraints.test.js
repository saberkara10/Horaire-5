import { describe, expect, test } from "@jest/globals";
import { AvailabilityChecker } from "../src/services/scheduler/AvailabilityChecker.js";
import { ConstraintMatrix } from "../src/services/scheduler/ConstraintMatrix.js";
import {
  MAX_COURSES_PER_PROFESSOR,
  MAX_GROUPS_PER_PROFESSOR,
  MAX_WEEKLY_SESSIONS_PER_PROFESSOR,
  REQUIRED_WEEKLY_SESSIONS_PER_GROUP,
} from "../src/services/scheduler/AcademicCatalog.js";

describe("scheduler constraints", () => {
  test("refuse une salle trop petite pour le groupe", () => {
    const cours = { est_en_ligne: 0, type_salle: "Laboratoire" };
    const salleValide = { type: "Laboratoire", capacite: 30 };
    const salleTropPetite = { type: "Laboratoire", capacite: 24 };

    expect(AvailabilityChecker.salleCompatible(salleValide, cours, 28)).toBe(true);
    expect(AvailabilityChecker.salleCompatible(salleTropPetite, cours, 28)).toBe(
      false
    );
  });

  test("considere tous les professeurs compatibles pour un cours en ligne", () => {
    expect(
      AvailabilityChecker.profCompatible(
        {
          id_professeur: 7,
          specialite: "Comptabilite",
          cours_ids: [],
        },
        {
          id_cours: 42,
          programme: "Programmation informatique",
          nom: "Services web",
          est_en_ligne: 1,
        }
      )
    ).toBe(true);
  });

  test("limite un professeur a dix groupes distincts sur la session", () => {
    const matrix = new ConstraintMatrix();

    for (let index = 1; index <= MAX_GROUPS_PER_PROFESSOR; index += 1) {
      expect(
        matrix.profPeutPrendreGroupe(7, `G${index}`, MAX_GROUPS_PER_PROFESSOR)
      ).toBe(true);
      matrix.reserver(
        index,
        7,
        `G${index}`,
        100 + index,
        `2026-09-${String(index).padStart(2, "0")}`,
        "08:00:00",
        "11:00:00"
      );
    }

    expect(matrix.profPeutPrendreGroupe(7, "G1", MAX_GROUPS_PER_PROFESSOR)).toBe(true);
    expect(
      matrix.profPeutPrendreGroupe(
        7,
        `G${MAX_GROUPS_PER_PROFESSOR + 1}`,
        MAX_GROUPS_PER_PROFESSOR
      )
    ).toBe(false);
  });

  test("autorise jusqu'a quatre cours differents pour un professeur", () => {
    const matrix = new ConstraintMatrix();

    for (let index = 1; index <= MAX_COURSES_PER_PROFESSOR; index += 1) {
      expect(matrix.profPeutEnseignerCours(11, index)).toBe(true);
      matrix.reserver(1, 11, `G-${index}`, index, `2026-09-0${index}`, "08:00:00", "11:00:00");
    }

    expect(matrix.profPeutEnseignerCours(11, 99)).toBe(false);
  });

  test("bloque un etudiant deja reserve sur le meme creneau", () => {
    const matrix = new ConstraintMatrix();

    matrix.reserver(1, 10, "G-PI-1", 201, "2026-09-01", "12:00:00", "15:00:00", {
      studentIds: [55, 56],
    });

    expect(
      matrix.etudiantsLibres([55], "2026-09-01", "12:00:00", "15:00:00")
    ).toBe(false);
    expect(
      matrix.etudiantsLibres([55], "2026-09-01", "15:00:00", "18:00:00")
    ).toBe(true);
    expect(matrix.creneauxEtudiantDansjournee(55, "2026-09-01")).toContain(
      "12:00:00"
    );
  });

  test("limite un groupe a sept seances hebdomadaires dans le moteur principal", () => {
    const matrix = new ConstraintMatrix();
    const dates = [
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ];

    for (const [index, date] of dates.entries()) {
      expect(
        matrix.groupePeutAjouterSeanceSemaine(
          "G-ADM-E1-1",
          date,
          REQUIRED_WEEKLY_SESSIONS_PER_GROUP
        )
      ).toBe(true);

      matrix.reserver(
        index + 1,
        20 + index,
        "G-ADM-E1-1",
        300 + index,
        date,
        "08:00:00",
        "11:00:00"
      );
    }

    expect(
      matrix.groupeSeancesSemaine("G-ADM-E1-1", "2026-09-04")
    ).toBe(REQUIRED_WEEKLY_SESSIONS_PER_GROUP);
    expect(
      matrix.groupePeutAjouterSeanceSemaine(
        "G-ADM-E1-1",
        "2026-09-05",
        REQUIRED_WEEKLY_SESSIONS_PER_GROUP
      )
    ).toBe(false);
  });

  test("limite un professeur a dix seances hebdomadaires", () => {
    const matrix = new ConstraintMatrix();
    const datesMemeSemaine = Array.from(
      { length: MAX_WEEKLY_SESSIONS_PER_PROFESSOR },
      (_, index) => {
        const jour = 1 + Math.floor(index / 2);
        return `2026-09-0${jour}`;
      }
    );

    for (const [indexZero, date] of datesMemeSemaine.entries()) {
      const index = indexZero + 1;
      expect(
        matrix.profPeutAjouterSeanceSemaine(
          99,
          date,
          MAX_WEEKLY_SESSIONS_PER_PROFESSOR
        )
      ).toBe(true);

      matrix.reserver(
        index,
        99,
        `G-PROF-${index}`,
        500 + index,
        date,
        "12:00:00",
        "15:00:00"
      );
    }

    expect(matrix.profSeancesSemaine(99, "2026-09-04")).toBe(
      MAX_WEEKLY_SESSIONS_PER_PROFESSOR
    );
    expect(
      matrix.profPeutAjouterSeanceSemaine(
        99,
        "2026-09-05",
        MAX_WEEKLY_SESSIONS_PER_PROFESSOR
      )
    ).toBe(false);
  });
});
