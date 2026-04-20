import { describe, expect, it } from "@jest/globals";

import {
  TYPES_SALLES,
  capaciteMaximalePourType,
  capaciteSalleValidePourType,
  messageCapaciteSalle,
  typeSalleValide,
} from "../src/utils/salles.js";

describe("utils salles", () => {
  it("valide un type connu", () => {
    expect(typeSalleValide("Salle standard")).toBe(true);
    expect(typeSalleValide(" Salle standard ")).toBe(true);
  });

  it("refuse un type inconnu", () => {
    expect(typeSalleValide("Salle mystere")).toBe(false);
    expect(typeSalleValide("")).toBe(false);
  });

  it("retourne 50 pour les types a grande capacite", () => {
    expect(capaciteMaximalePourType("Salle de conference")).toBe(50);
    expect(capaciteMaximalePourType("Amphitheatre")).toBe(50);
  });

  it("retourne 30 pour les autres types", () => {
    expect(capaciteMaximalePourType("Salle standard")).toBe(30);
    expect(capaciteMaximalePourType("Type inconnu")).toBe(30);
  });

  it("valide une capacite coherente avec le type", () => {
    expect(capaciteSalleValidePourType("Salle standard", 30)).toBe(true);
    expect(capaciteSalleValidePourType("Amphitheatre", 50)).toBe(true);
  });

  it("refuse une capacite incoherente ou invalide", () => {
    expect(capaciteSalleValidePourType("Salle standard", 31)).toBe(false);
    expect(capaciteSalleValidePourType("Amphitheatre", 51)).toBe(false);
    expect(capaciteSalleValidePourType("Salle standard", 0)).toBe(false);
    expect(capaciteSalleValidePourType("Salle standard", "abc")).toBe(false);
  });

  it("genere un message de capacite explicite", () => {
    expect(messageCapaciteSalle("Salle standard")).toBe(
      "Capacite invalide pour ce type de salle (maximum 30)."
    );
    expect(messageCapaciteSalle("Salle de conference")).toBe(
      "Capacite invalide pour ce type de salle (maximum 50)."
    );
  });

  it("expose une liste de types de salles non vide", () => {
    expect(Array.isArray(TYPES_SALLES)).toBe(true);
    expect(TYPES_SALLES.length).toBeGreaterThan(0);
  });
});
