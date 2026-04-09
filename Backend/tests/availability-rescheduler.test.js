import { describe, expect, test } from "@jest/globals";
import {
  calculerDateFinRecherche,
  maximumHebdomadairePourCible,
} from "../src/services/professeurs/availability-rescheduler.js";

describe("availability-rescheduler", () => {
  test("etend la recherche au-dela de la fin de session pour couvrir le rattrapage", () => {
    expect(calculerDateFinRecherche("2026-11-27", "2026-12-18")).toBe(
      "2027-01-15"
    );
  });

  test("utilise une fenetre de secours quand la fin de session est absente", () => {
    expect(calculerDateFinRecherche("2026-11-27", null)).toBe("2027-01-22");
  });

  test("autorise une 8e seance seulement sur une semaine de rattrapage", () => {
    expect(maximumHebdomadairePourCible("2026-09-08", "2026-09-10")).toBe(7);
    expect(maximumHebdomadairePourCible("2026-09-08", "2026-09-15")).toBe(8);
  });
});
