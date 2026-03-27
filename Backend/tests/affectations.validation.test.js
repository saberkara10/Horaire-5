import { describe, it, expect } from "@jest/globals";
import { validerAffectation } from "../src/validations/affectations.validation.js";

describe("validations affectations", () => {
  it("accepte une affectation valide", () => {
    expect(() =>
      validerAffectation({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        date: "2026-03-26",
        heure_debut: "08:00",
        heure_fin: "11:00",
        id_groupes: [1],
      })
    ).not.toThrow();
  });

  it("refuse si cours, professeur ou salle manquent", () => {
    expect(() =>
      validerAffectation({
        id_cours: null,
        id_professeur: 2,
        id_salle: 3,
        date: "2026-03-26",
        heure_debut: "08:00",
        heure_fin: "11:00",
        id_groupes: [1],
      })
    ).toThrow("Cours, professeur et salle obligatoires");
  });

  it("refuse si date ou heures manquent", () => {
    expect(() =>
      validerAffectation({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        date: "",
        heure_debut: "08:00",
        heure_fin: "11:00",
        id_groupes: [1],
      })
    ).toThrow("Date et heures obligatoires");
  });

  it("refuse si heure_fin est inférieure à heure_debut", () => {
    expect(() =>
      validerAffectation({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        date: "2026-03-26",
        heure_debut: "11:00",
        heure_fin: "08:00",
        id_groupes: [1],
      })
    ).toThrow("Heure fin doit etre superieure a heure debut");
  });

  it("refuse si heure_fin est égale à heure_debut", () => {
    expect(() =>
      validerAffectation({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        date: "2026-03-26",
        heure_debut: "08:00",
        heure_fin: "08:00",
        id_groupes: [1],
      })
    ).toThrow("Heure fin doit etre superieure a heure debut");
  });

  it("refuse si id_groupes est absent", () => {
    expect(() =>
      validerAffectation({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        date: "2026-03-26",
        heure_debut: "08:00",
        heure_fin: "11:00",
      })
    ).toThrow("Au moins un groupe obligatoire");
  });

  it("refuse si id_groupes n'est pas un tableau", () => {
    expect(() =>
      validerAffectation({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        date: "2026-03-26",
        heure_debut: "08:00",
        heure_fin: "11:00",
        id_groupes: 1,
      })
    ).toThrow("Au moins un groupe obligatoire");
  });

  it("refuse si id_groupes est vide", () => {
    expect(() =>
      validerAffectation({
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        date: "2026-03-26",
        heure_debut: "08:00",
        heure_fin: "11:00",
        id_groupes: [],
      })
    ).toThrow("Au moins un groupe obligatoire");
  });
});