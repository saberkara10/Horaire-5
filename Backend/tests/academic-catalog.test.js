import { describe, expect, test } from "@jest/globals";
import {
  ACADEMIC_DAY_END_TIME,
  ACADEMIC_DAY_START_TIME,
  ACADEMIC_SLOT_DURATION_MINUTES,
  ACADEMIC_PROGRAM_CATALOG,
  ACADEMIC_WEEKDAY_TIME_SLOTS,
  MAX_COURSES_PER_PROGRAM_PER_PROFESSOR,
  MAX_COURSES_PER_PROFESSOR,
  MAX_PROGRAMS_PER_PROFESSOR,
  MAX_WEEKLY_SESSIONS_PER_PROFESSOR,
  buildAcademicCourses,
  buildAcademicProfessors,
  buildAcademicTargetKey,
  getAcademicBootstrapTargets,
  createProfessorAvailabilityRows,
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

  test("calcule 112 professeurs quand 5 groupes sont requis pour chaque programme-etape", () => {
    const requiredGroupsByProgram = new Map(
      getAcademicBootstrapTargets().map((target) => [
        buildAcademicTargetKey(target.programme, target.etape),
        5,
      ])
    );

    const professeurs = buildAcademicProfessors({ requiredGroupsByProgram });

    expect(professeurs).toHaveLength(112);
    expect(
      professeurs.every(
        (professeur) => Number(professeur.estimatedWeeklyLoad || 0) <= 12
      )
    ).toBe(true);
  });

  test("ajoute 2 professeurs de reserve pour 5 cours critiques repartis sur 4 programmes", () => {
    const baseProfesseurs = buildAcademicProfessors();
    const professeurs = buildAcademicProfessors({
      reserveCourseDemands: [
        {
          code: "INF104",
          programme: "Programmation informatique",
          load: 4,
        },
        {
          code: "DAT205",
          programme: "Analyse de donnees",
          load: 2,
        },
        {
          code: "DAT306",
          programme: "Analyse de donnees",
          load: 1,
        },
        {
          code: "AIA205",
          programme: "Intelligence artificielle appliquee",
          load: 1,
        },
        {
          code: "CYB407",
          programme:
            "Technologie des systemes informatiques - cybersecurite et reseautique",
          load: 1,
        },
      ],
    });
    const professeursReserve = professeurs.filter((professeur) =>
      String(professeur.matricule).startsWith("AUTO-RESERVE-PROF-")
    );

    expect(professeurs).toHaveLength(baseProfesseurs.length + 2);
    expect(professeursReserve).toHaveLength(2);
    expect(
      professeursReserve.every(
        (professeur) => professeur.assignedCourseCodes.length <= MAX_COURSES_PER_PROFESSOR
      )
    ).toBe(true);
    expect(
      professeursReserve.every((professeur) => {
        const programmes = new Set(
          professeur.assignedCourseCodes.map((codeCours) => String(codeCours).slice(0, 3))
        );
        return programmes.size <= MAX_PROGRAMS_PER_PROFESSOR;
      })
    ).toBe(true);
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

  test("expose une grille horaire fine jusqu'a 22:00 avec des slots d'une heure", () => {
    expect(ACADEMIC_DAY_START_TIME).toBe("08:00:00");
    expect(ACADEMIC_DAY_END_TIME).toBe("22:00:00");
    expect(ACADEMIC_SLOT_DURATION_MINUTES).toBe(60);
    expect(ACADEMIC_WEEKDAY_TIME_SLOTS).toHaveLength(14);
    expect(ACADEMIC_WEEKDAY_TIME_SLOTS[0]).toMatchObject({
      debut: "08:00:00",
      fin: "09:00:00",
      slotStartIndex: 0,
      slotEndIndex: 1,
    });
    expect(ACADEMIC_WEEKDAY_TIME_SLOTS.at(-1)).toMatchObject({
      debut: "21:00:00",
      fin: "22:00:00",
      slotStartIndex: 13,
      slotEndIndex: 14,
    });
  });

  test("genere des disponibilites professeurs compatibles avec la journee etendue", () => {
    const disponibilites = createProfessorAvailabilityRows(42);

    expect(disponibilites).toHaveLength(5);
    expect(disponibilites.every((row) => row.heure_debut === "08:00:00")).toBe(
      true
    );
    expect(disponibilites.every((row) => row.heure_fin === "22:00:00")).toBe(
      true
    );
  });
});
