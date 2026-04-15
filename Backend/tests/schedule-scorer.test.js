import { describe, expect, test } from "@jest/globals";
import { ScheduleScorer } from "../src/services/scheduler/scoring/ScheduleScorer.js";

function placement({
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
    id_professeur: idProfesseur,
    nom_professeur: `Prof ${idProfesseur}`,
    id_groupe: idGroupe,
    nom_groupe: nomGroupe,
    date,
    heure_debut: debut,
    heure_fin: fin,
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
    const payload = {
      placements: [
        ...compactStudentPayload().placements,
        ...fragmentedTeacherPayload().placements,
      ],
      affectationsEtudiantGroupe: new Map([[1, ["G1"]]]),
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
    expect(bundle.details.etudiant).toBeDefined();
    expect(bundle.details.professeur).toBeDefined();
  });
});
