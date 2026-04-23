import { afterEach, describe, expect, test } from "@jest/globals";
import { ConstraintMatrix } from "../src/services/scheduler/ConstraintMatrix.js";
import { SchedulerEngine } from "../src/services/scheduler/SchedulerEngine.js";

function construireContexte() {
  return {
    cours: {
      id_cours: 44,
      code: "PHY101",
      nom: "Physiologie appliquee",
      programme: "Soins infirmiers auxiliaires",
      est_en_ligne: 1,
      type_salle: "Laboratoire clinique",
    },
    groupe: {
      nomGroupe: "SIA-E1-1",
      etudiants: [1, 2, 3],
    },
    professeurs: [
      {
        id_professeur: 17,
        prenom: "Lea",
        nom: "Martin",
        cours_ids: [44],
        specialite: "Soins infirmiers auxiliaires",
      },
    ],
    datesParJourSemaine: new Map([[2, ["2026-10-06", "2026-10-13"]]]),
    creneaux: [{ debut: "08:00:00", fin: "11:00:00" }],
  };
}

describe("SchedulerEngine online toggle", () => {
  afterEach(() => {
    delete process.env.ENABLE_ONLINE_COURSES;
  });

  test("desactive le fallback en ligne quand le flag global est faux", () => {
    process.env.ENABLE_ONLINE_COURSES = "false";
    const { cours, groupe, professeurs, datesParJourSemaine, creneaux } = construireContexte();

    const resultat = SchedulerEngine._trouverSerieAssouplie({
      cours,
      groupe,
      idGroupe: 1,
      professeurs,
      salles: [],
      datesParJourSemaine,
      creneaux,
      matrix: new ConstraintMatrix(),
      dispParProf: new Map(),
      absencesParProf: new Map(),
      indispoParSalle: new Map(),
      chargeSeriesParProf: new Map(),
      chargeSeriesParJour: new Map(),
      chargeSeriesParGroupeJour: new Map(),
      chargeSeriesParProfJour: new Map(),
      slotsParGroupeJour: new Map(),
      slotsParProfJour: new Map(),
      effectifGroupe: groupe.etudiants.length,
    });

    expect(resultat).toBeNull();
  });

  test("planifie un cours explicitement en ligne par defaut", () => {
    const { cours, groupe, professeurs, datesParJourSemaine, creneaux } = construireContexte();

    const resultat = SchedulerEngine._trouverSerieAssouplie({
      cours,
      groupe,
      idGroupe: 1,
      professeurs,
      salles: [],
      datesParJourSemaine,
      creneaux,
      matrix: new ConstraintMatrix(),
      dispParProf: new Map(),
      absencesParProf: new Map(),
      indispoParSalle: new Map(),
      chargeSeriesParProf: new Map(),
      chargeSeriesParJour: new Map(),
      chargeSeriesParGroupeJour: new Map(),
      chargeSeriesParProfJour: new Map(),
      slotsParGroupeJour: new Map(),
      slotsParProfJour: new Map(),
      effectifGroupe: groupe.etudiants.length,
    });

    expect(resultat?.placements).toHaveLength(2);
    expect(resultat.placements.every((placement) => placement.est_en_ligne)).toBe(true);
  });

  test("autorise toujours un cours explicitement en ligne quand le flag est vrai", () => {
    process.env.ENABLE_ONLINE_COURSES = "true";
    const { cours, groupe, professeurs, datesParJourSemaine, creneaux } = construireContexte();

    const resultat = SchedulerEngine._trouverSerieAssouplie({
      cours,
      groupe,
      idGroupe: 1,
      professeurs,
      salles: [],
      datesParJourSemaine,
      creneaux,
      matrix: new ConstraintMatrix(),
      dispParProf: new Map(),
      absencesParProf: new Map(),
      indispoParSalle: new Map(),
      chargeSeriesParProf: new Map(),
      chargeSeriesParJour: new Map(),
      chargeSeriesParGroupeJour: new Map(),
      chargeSeriesParProfJour: new Map(),
      slotsParGroupeJour: new Map(),
      slotsParProfJour: new Map(),
      effectifGroupe: groupe.etudiants.length,
    });

    expect(resultat?.placements).toHaveLength(2);
    expect(resultat.placements.every((placement) => placement.est_en_ligne)).toBe(true);
  });
});
