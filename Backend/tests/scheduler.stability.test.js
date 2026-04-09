import { describe, expect, test } from "@jest/globals";
import { SchedulerEngine } from "../src/services/scheduler/SchedulerEngine.js";

describe("scheduler stability", () => {
  test("reconstruit une preference stable a partir de l'historique existant", () => {
    const preferences = SchedulerEngine._construirePreferencesStabilite([
      {
        id_cours: 101,
        nom_groupe: "GADM-E1-1",
        id_professeur: 7,
        id_salle: 2,
        date: "2026-09-01",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
        est_groupe_special: 0,
      },
      {
        id_cours: 101,
        nom_groupe: "GADM-E1-1",
        id_professeur: 7,
        id_salle: 2,
        date: "2026-09-08",
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
        est_groupe_special: 0,
      },
      {
        id_cours: 101,
        nom_groupe: "GADM-E1-1",
        id_professeur: 7,
        id_salle: 3,
        date: "2026-09-15",
        heure_debut: "12:00:00",
        heure_fin: "15:00:00",
        est_groupe_special: 0,
      },
    ]);

    expect(
      SchedulerEngine._lirePreferenceStabilite(
        preferences,
        "GADM-E1-1",
        101,
        1
      )
    ).toMatchObject({
      jourSemaine: 2,
      heure_debut: "08:00:00",
      heure_fin: "11:00:00",
      id_professeur: 7,
      id_salle: 2,
    });
  });

  test("favorise un candidat conforme au motif habituel", () => {
    const scoreReference = SchedulerEngine._scoreCandidatSerie({
      groupe: { etudiants: Array.from({ length: 28 }, (_, index) => index + 1) },
      idGroupe: "GADM-E1-1",
      professeur: { id_professeur: 7 },
      salle: { id_salle: 2, capacite: 30 },
      jourSemaine: 2,
      creneau: { debut: "08:00:00", fin: "11:00:00" },
      slotIndex: 0,
      matrix: null,
      chargeSeriesParJour: new Map(),
      chargeSeriesParGroupeJour: new Map(),
      chargeSeriesParProfJour: new Map(),
      slotsParGroupeJour: new Map(),
      slotsParProfJour: new Map(),
      preferenceSerie: {
        jourSemaine: 2,
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
        id_professeur: 7,
        id_salle: 2,
      },
    });
    const scorePerturbe = SchedulerEngine._scoreCandidatSerie({
      groupe: { etudiants: Array.from({ length: 28 }, (_, index) => index + 1) },
      idGroupe: "GADM-E1-1",
      professeur: { id_professeur: 9 },
      salle: { id_salle: 5, capacite: 40 },
      jourSemaine: 5,
      creneau: { debut: "16:00:00", fin: "19:00:00" },
      slotIndex: 3,
      matrix: null,
      chargeSeriesParJour: new Map([[5, 3]]),
      chargeSeriesParGroupeJour: new Map(),
      chargeSeriesParProfJour: new Map(),
      slotsParGroupeJour: new Map(),
      slotsParProfJour: new Map(),
      preferenceSerie: {
        jourSemaine: 2,
        heure_debut: "08:00:00",
        heure_fin: "11:00:00",
        id_professeur: 7,
        id_salle: 2,
      },
      indexStrategie: 1,
      indexProfesseur: 2,
      indexCreneau: 3,
      indexSalle: 2,
    });

    expect(scoreReference).toBeGreaterThan(scorePerturbe);
  });

  test("penalise un groupe incomplet par rapport a la cible de sept cours", () => {
    const solution7 = [
      { id_groupe: 1, nom_groupe: "GADM-E1-1", id_cours: 1, date: "2026-09-01", heure_debut: "08:00:00", heure_fin: "11:00:00", est_groupe_special: false },
      { id_groupe: 1, nom_groupe: "GADM-E1-1", id_cours: 2, date: "2026-09-01", heure_debut: "12:00:00", heure_fin: "15:00:00", est_groupe_special: false },
      { id_groupe: 1, nom_groupe: "GADM-E1-1", id_cours: 3, date: "2026-09-02", heure_debut: "08:00:00", heure_fin: "11:00:00", est_groupe_special: false },
      { id_groupe: 1, nom_groupe: "GADM-E1-1", id_cours: 4, date: "2026-09-02", heure_debut: "12:00:00", heure_fin: "15:00:00", est_groupe_special: false },
      { id_groupe: 1, nom_groupe: "GADM-E1-1", id_cours: 5, date: "2026-09-03", heure_debut: "08:00:00", heure_fin: "11:00:00", est_groupe_special: false },
      { id_groupe: 1, nom_groupe: "GADM-E1-1", id_cours: 6, date: "2026-09-04", heure_debut: "08:00:00", heure_fin: "11:00:00", est_groupe_special: false },
      { id_groupe: 1, nom_groupe: "GADM-E1-1", id_cours: 7, date: "2026-09-04", heure_debut: "12:00:00", heure_fin: "15:00:00", est_groupe_special: false },
    ];
    const solution6 = solution7.slice(0, 6);

    const qualite7 = SchedulerEngine._calculerScoreQualite({
      solution: solution7,
      nonPlanifies: [],
      nbResolutionsManuelles: 0,
      preferencesStabilite: new Map(),
    });
    const qualite6 = SchedulerEngine._calculerScoreQualite({
      solution: solution6,
      nonPlanifies: [],
      nbResolutionsManuelles: 0,
      preferencesStabilite: new Map(),
    });

    expect(qualite7.groupes_sous_charge_hebdo).toBe(0);
    expect(qualite6.groupes_sous_charge_hebdo).toBe(1);
    expect(qualite7.score).toBeGreaterThan(qualite6.score);
  });
});
