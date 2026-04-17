import { describe, expect, test } from "@jest/globals";
import { ScheduleScorer } from "../src/services/scheduler/scoring/ScheduleScorer.js";

function getIsoWeekday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  const weekday = date.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function buildSlotMetadata(debut, fin) {
  const [startHours, startMinutes] = debut.split(":").map(Number);
  const [endHours, endMinutes] = fin.split(":").map(Number);
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;

  return {
    dureeHeures: (endTotal - startTotal) / 60,
    slotStartIndex: (startTotal - 8 * 60) / 60,
    slotEndIndex: (endTotal - 8 * 60) / 60,
  };
}

function placement({
  idAffectationCours,
  idCours,
  idProfesseur,
  idGroupe,
  nomGroupe,
  date,
  debut,
  fin,
}) {
  return {
    id_cours: idCours,
    code_cours: `C${idCours}`,
    nom_cours: `Cours ${idCours}`,
    id_affectation_cours: idAffectationCours || idCours,
    id_professeur: idProfesseur,
    nom_professeur: `Prof ${idProfesseur}`,
    id_groupe: idGroupe,
    nom_groupe: nomGroupe,
    date,
    heure_debut: debut,
    heure_fin: fin,
    jourSemaine: getIsoWeekday(date),
    ...buildSlotMetadata(debut, fin),
    id_salle: idCours,
    code_salle: `S${idCours}`,
    est_en_ligne: false,
    est_groupe_special: false,
  };
}

function compactStudentPayload() {
  return {
    placements: [
      placement({ idCours: 101, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-07", debut: "08:00:00", fin: "11:00:00" }),
      placement({ idCours: 102, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-07", debut: "11:00:00", fin: "14:00:00" }),
      placement({ idCours: 103, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-07", debut: "15:00:00", fin: "18:00:00" }),
      placement({ idCours: 104, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-08", debut: "08:00:00", fin: "11:00:00" }),
      placement({ idCours: 105, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-08", debut: "11:00:00", fin: "14:00:00" }),
      placement({ idCours: 106, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-10", debut: "08:00:00", fin: "11:00:00" }),
      placement({ idCours: 107, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-10", debut: "11:00:00", fin: "14:00:00" }),
    ],
    affectationsEtudiantGroupe: new Map([[1, ["G1"]]]),
    affectationsReprises: [],
  };
}

function fragmentedStudentPayload() {
  return {
    placements: [
      placement({ idCours: 201, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-07", debut: "11:00:00", fin: "14:00:00" }),
      placement({ idCours: 202, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-08", debut: "08:00:00", fin: "11:00:00" }),
      placement({ idCours: 203, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-08", debut: "14:00:00", fin: "17:00:00" }),
      placement({ idCours: 204, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-09", debut: "11:00:00", fin: "14:00:00" }),
      placement({ idCours: 205, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-10", debut: "14:00:00", fin: "17:00:00" }),
      placement({ idCours: 206, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-11", debut: "11:00:00", fin: "14:00:00" }),
      placement({ idCours: 207, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-11", debut: "17:00:00", fin: "20:00:00" }),
    ],
    affectationsEtudiantGroupe: new Map([[1, ["G1"]]]),
    affectationsReprises: [],
  };
}

function compactTeacherPayload() {
  return {
    placements: [
      placement({ idCours: 301, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-07", debut: "08:00:00", fin: "11:00:00" }),
      placement({ idCours: 302, idProfesseur: 10, idGroupe: 2, nomGroupe: "G2", date: "2026-09-07", debut: "11:00:00", fin: "14:00:00" }),
      placement({ idCours: 303, idProfesseur: 10, idGroupe: 3, nomGroupe: "G3", date: "2026-09-07", debut: "15:00:00", fin: "18:00:00" }),
      placement({ idCours: 304, idProfesseur: 10, idGroupe: 1, nomGroupe: "G1", date: "2026-09-09", debut: "08:00:00", fin: "11:00:00" }),
      placement({ idCours: 305, idProfesseur: 10, idGroupe: 2, nomGroupe: "G2", date: "2026-09-09", debut: "11:00:00", fin: "14:00:00" }),
      placement({ idCours: 306, idProfesseur: 10, idGroupe: 3, nomGroupe: "G3", date: "2026-09-10", debut: "08:00:00", fin: "11:00:00" }),
    ],
    affectationsEtudiantGroupe: new Map(),
    affectationsReprises: [],
  };
}

function fragmentedTeacherPayload() {
  return {
    placements: [
      placement({ idCours: 401, idProfesseur: 20, idGroupe: 1, nomGroupe: "G1", date: "2026-09-07", debut: "08:00:00", fin: "11:00:00" }),
      placement({ idCours: 402, idProfesseur: 20, idGroupe: 2, nomGroupe: "G2", date: "2026-09-07", debut: "14:00:00", fin: "17:00:00" }),
      placement({ idCours: 403, idProfesseur: 20, idGroupe: 3, nomGroupe: "G3", date: "2026-09-07", debut: "17:00:00", fin: "20:00:00" }),
      placement({ idCours: 404, idProfesseur: 20, idGroupe: 1, nomGroupe: "G1", date: "2026-09-09", debut: "08:00:00", fin: "11:00:00" }),
      placement({ idCours: 405, idProfesseur: 20, idGroupe: 2, nomGroupe: "G2", date: "2026-09-09", debut: "17:00:00", fin: "20:00:00" }),
      placement({ idCours: 406, idProfesseur: 20, idGroupe: 3, nomGroupe: "G3", date: "2026-09-11", debut: "11:00:00", fin: "14:00:00" }),
    ],
    affectationsEtudiantGroupe: new Map(),
    affectationsReprises: [],
  };
}

describe("ScheduleScorer", () => {
  test("favorise un horaire etudiant compact sur 3 jours", () => {
    const compact = ScheduleScorer.scoreSchedule(compactStudentPayload(), "equilibre");
    const fragmented = ScheduleScorer.scoreSchedule(fragmentedStudentPayload(), "equilibre");

    expect(compact.scoreEtudiant).toBeGreaterThan(fragmented.scoreEtudiant);
    expect(compact.details.etudiant.averages.activeDaysPerWeek).toBe(3);
    expect(fragmented.details.etudiant.averages.activeDaysPerWeek).toBe(5);
  });

  test("favorise un horaire professeur compact avec amplitude raisonnable", () => {
    const compact = ScheduleScorer.scoreSchedule(compactTeacherPayload(), "equilibre");
    const fragmented = ScheduleScorer.scoreSchedule(fragmentedTeacherPayload(), "equilibre");

    expect(compact.scoreProfesseur).toBeGreaterThan(fragmented.scoreProfesseur);
    expect(fragmented.details.professeur.totals.longAmplitudeDays).toBeGreaterThan(0);
  });

  test("ignore les reprises dans le score principal etudiant", () => {
    const payloadSansReprise = {
      ...compactStudentPayload(),
      placements: [
        ...compactStudentPayload().placements,
        placement({ idCours: 900, idProfesseur: 20, idGroupe: 2, nomGroupe: "G2", date: "2026-09-12", debut: "11:00:00", fin: "14:00:00" }),
      ],
    };
    const payloadAvecReprise = {
      ...payloadSansReprise,
      affectationsReprises: [
        {
          id_etudiant: 1,
          id_cours: 900,
          id_groupe: 2,
          nom_groupe: "G2",
        },
      ],
    };

    const sansReprise = ScheduleScorer.scoreSchedule(payloadSansReprise, "equilibre");
    const avecReprise = ScheduleScorer.scoreSchedule(payloadAvecReprise, "equilibre");

    expect(avecReprise.scoreEtudiant).toBe(sansReprise.scoreEtudiant);
    expect(avecReprise.details.etudiant.coverage.recoveryExcludedFromPrincipalScore).toBe(
      true
    );
    expect(avecReprise.details.etudiant.totals.recoverySessions).toBe(1);
  });

  test("supporte les trois modes avec une ponderation differente", () => {
    const studentPlacements = compactStudentPayload().placements.map((row) => ({
      ...row,
      id_groupe: 11,
      nom_groupe: "GSTUDENT",
    }));
    const payload = {
      placements: [
        ...studentPlacements,
        ...fragmentedTeacherPayload().placements,
      ],
      affectationsEtudiantGroupe: new Map([[1, ["GSTUDENT"]]]),
      affectationsReprises: [],
    };

    const etudiant = ScheduleScorer.scoreSchedule(payload, "etudiant");
    const professeur = ScheduleScorer.scoreSchedule(payload, "professeur");
    const bundle = ScheduleScorer.scoreAllModes(payload);

    expect(etudiant.scoreGlobal).toBeGreaterThan(professeur.scoreGlobal);
    expect(bundle).toMatchObject({
      version: "v1",
      readOnly: true,
      modes: {
        etudiant: {
          mode: "etudiant",
        },
        professeur: {
          mode: "professeur",
        },
        equilibre: {
          mode: "equilibre",
        },
      },
    });
    expect(bundle.modes.equilibre.scoreGroupe).toBeDefined();
    expect(bundle.details.etudiant).toBeDefined();
    expect(bundle.details.professeur).toBeDefined();
    expect(bundle.details.groupe).toBeDefined();
  });

  test("produit les quatre scores et les compteurs de pause", () => {
    const payload = {
      placements: [
        placement({
          idAffectationCours: 1,
          idCours: 601,
          idProfesseur: 30,
          idGroupe: 7,
          nomGroupe: "G7",
          date: "2026-09-07",
          debut: "08:00:00",
          fin: "10:00:00",
        }),
        placement({
          idAffectationCours: 2,
          idCours: 602,
          idProfesseur: 30,
          idGroupe: 7,
          nomGroupe: "G7",
          date: "2026-09-07",
          debut: "10:00:00",
          fin: "12:00:00",
        }),
        placement({
          idAffectationCours: 3,
          idCours: 603,
          idProfesseur: 30,
          idGroupe: 7,
          nomGroupe: "G7",
          date: "2026-09-07",
          debut: "13:00:00",
          fin: "15:00:00",
        }),
      ],
      affectationsEtudiantGroupe: new Map([[1, ["G7"]]]),
      affectationsReprises: [],
      participantsParAffectation: new Map([
        [1, [1]],
        [2, [1]],
        [3, [1]],
      ]),
    };

    const score = ScheduleScorer.scoreSchedule(payload, "equilibre");

    expect(score).toEqual(
      expect.objectContaining({
        scoreGlobal: expect.any(Number),
        scoreEtudiant: expect.any(Number),
        scoreProfesseur: expect.any(Number),
        scoreGroupe: expect.any(Number),
      })
    );
    expect(score.metrics.pausesEtudiantsRespectees).toBe(1);
    expect(score.metrics.pausesProfesseursRespectees).toBe(1);
    expect(score.metrics.pausesGroupesRespectees).toBe(1);
    expect(score.metrics.pausesEtudiantsManquees).toBe(0);
    expect(score.details.etudiant.totals.pauseRespectedCount).toBe(1);
    expect(score.details.professeur.totals.pauseRespectedCount).toBe(1);
    expect(score.details.groupe.totals.pauseRespectedCount).toBe(1);
  });

  test("penalise progressivement les slots tardifs apres 18h", () => {
    const payloadEarly = {
      placements: [
        placement({
          idCours: 701,
          idProfesseur: 40,
          idGroupe: 8,
          nomGroupe: "G8",
          date: "2026-09-08",
          debut: "15:00:00",
          fin: "18:00:00",
        }),
      ],
      affectationsEtudiantGroupe: new Map([[1, ["G8"]]]),
      affectationsReprises: [],
    };
    const payloadLate = {
      placements: [
        placement({
          idCours: 702,
          idProfesseur: 40,
          idGroupe: 8,
          nomGroupe: "G8",
          date: "2026-09-08",
          debut: "18:00:00",
          fin: "22:00:00",
        }),
      ],
      affectationsEtudiantGroupe: new Map([[1, ["G8"]]]),
      affectationsReprises: [],
    };

    const early = ScheduleScorer.scoreSchedule(payloadEarly, "equilibre");
    const late = ScheduleScorer.scoreSchedule(payloadLate, "equilibre");

    expect(early.details.etudiant.totals.lateCoursePenalty).toBe(0);
    expect(late.details.etudiant.totals.lateCoursePenalty).toBe(10);
    expect(late.details.professeur.totals.lateCoursePenalty).toBe(10);
    expect(late.details.groupe.totals.lateCoursePenalty).toBe(10);
    expect(late.scoreGlobal).toBeLessThan(early.scoreGlobal);
  });

  test("utilise les participants reels et pas seulement le groupe principal", () => {
    const payload = {
      placements: [
        placement({
          idAffectationCours: 801,
          idCours: 801,
          idProfesseur: 50,
          idGroupe: 9,
          nomGroupe: "G9",
          date: "2026-09-09",
          debut: "18:00:00",
          fin: "21:00:00",
        }),
      ],
      affectationsEtudiantGroupe: new Map([
        [1, ["G9"]],
        [2, ["G10"]],
      ]),
      affectationsReprises: [],
      participantsParAffectation: new Map([[801, [1, 2]]]),
    };

    const score = ScheduleScorer.scoreSchedule(payload, "equilibre");

    expect(score.details.etudiant.studentsAnalyzed).toBe(2);
    expect(score.details.etudiant.coverage.realParticipantsIncluded).toBe(true);
    expect(score.details.etudiant.totals.lateCoursePenalty).toBe(12);
  });
});
