import { describe, expect, test } from "@jest/globals";
import {
  ACADEMIC_PROGRAM_CATALOG,
  MAX_COURSES_PER_PROGRAM_PER_PROFESSOR,
  MAX_COURSES_PER_PROFESSOR,
  MAX_PROGRAMS_PER_PROFESSOR,
  MAX_WEEKLY_SESSIONS_PER_PROFESSOR,
  buildAcademicCourses,
  buildAcademicProfessors,
  getAcademicBootstrapTargets,
} from "../src/services/scheduler/AcademicCatalog.js";

describe("AcademicCatalog", () => {
  test("genere des professeurs auto mutualises avec une charge hebdomadaire maitrisee", () => {
    const professeurs = buildAcademicProfessors();
    const nomsComplets = professeurs.map((professeur) =>
      `${professeur.prenom} ${professeur.nom}`.toLowerCase()
    );

    expect(new Set(professeurs.map((professeur) => professeur.matricule)).size).toBe(
      professeurs.length
    );
    expect(new Set(nomsComplets).size).toBe(professeurs.length);
    expect(professeurs.length).toBeGreaterThan(0);
    expect(
      professeurs.some((professeur) => professeur.assignedCourseCodes.length > 1)
    ).toBe(true);

    for (const professeur of professeurs) {
      const coursParProgramme = professeur.assignedCourseCodes.reduce(
        (acc, codeCours) => {
          const prefixe = String(codeCours).slice(0, 3);
          acc.set(prefixe, (acc.get(prefixe) || 0) + 1);
          return acc;
        },
        new Map()
      );

      expect(professeur.assignedCourseCodes.length).toBeGreaterThan(0);
      expect(professeur.assignedCourseCodes.length).toBeLessThanOrEqual(
        MAX_COURSES_PER_PROFESSOR
      );
      expect(Number(professeur.estimatedWeeklyLoad || 0)).toBeGreaterThan(0);
      expect(Number(professeur.estimatedWeeklyLoad || 0)).toBeLessThanOrEqual(
        MAX_WEEKLY_SESSIONS_PER_PROFESSOR
      );
      expect(coursParProgramme.size).toBeLessThanOrEqual(MAX_PROGRAMS_PER_PROFESSOR);
      expect(
        [...coursParProgramme.values()].every(
          (nombreCours) =>
            nombreCours > 0 &&
            nombreCours <= MAX_COURSES_PER_PROGRAM_PER_PROFESSOR
        )
      ).toBe(true);
    }
  });

  test("augmente la couverture prof quand un programme depasse 4 groupes", () => {
    const professeurs = buildAcademicProfessors({
      requiredGroupsByProgram: new Map([["gestion des services de restauration", 6]]),
    });

    const professeursRes = professeurs.filter((professeur) =>
      professeur.assignedCourseCodes.some((codeCours) => String(codeCours).startsWith("RES"))
    );
    const couvertureParCours = new Map();

    for (const professeur of professeursRes) {
      for (const codeCours of professeur.assignedCourseCodes.filter((codeCours) =>
        String(codeCours).startsWith("RES")
      )) {
        couvertureParCours.set(
          codeCours,
          (couvertureParCours.get(codeCours) || 0) + 1
        );
      }
    }

    expect(professeursRes.length).toBeGreaterThan(7);
    expect(
      professeursRes.every(
        (professeur) =>
          Number(professeur.estimatedWeeklyLoad || 0) <=
          MAX_WEEKLY_SESSIONS_PER_PROFESSOR
      )
    ).toBe(true);
    expect(couvertureParCours.get("RES101")).toBeGreaterThanOrEqual(1);
  });

  test("expose un catalogue multi-etapes avec cours pour les etapes 1 a 4", () => {
    const cours = buildAcademicCourses();
    const etapes = new Set(
      ACADEMIC_PROGRAM_CATALOG.map((programme) => String(programme.etape))
    );
    const targets = getAcademicBootstrapTargets();

    expect(etapes).toEqual(new Set(["1", "2", "3", "4"]));
    expect(
      cours.some(
        (coursItem) =>
          coursItem.programme === "Programmation informatique" &&
          String(coursItem.etape_etude) === "4" &&
          String(coursItem.code).startsWith("INF4")
      )
    ).toBe(true);
    expect(
      cours.some(
        (coursItem) =>
          coursItem.code === "INF201" &&
          coursItem.nom === "Programmation orientee objet"
      )
    ).toBe(true);
    expect(
      targets.some(
        (target) =>
          target.programme === "Programmation informatique" &&
          String(target.etape) === "2" &&
          Number(target.targetStudentCount) > 0
      )
    ).toBe(true);
  });
});
