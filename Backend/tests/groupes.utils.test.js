import { describe, expect, test } from "@jest/globals";
import {
  calculerTaillesGroupesEquilibres,
  determinerCapaciteMaximaleGroupeCohorte,
} from "../src/utils/groupes.js";

describe("utils groupes", () => {
  test("calcule des groupes equilibres sans depasser la capacite maximale", () => {
    expect(calculerTaillesGroupesEquilibres(56, 28)).toEqual([28, 28]);
    expect(calculerTaillesGroupesEquilibres(48, 24)).toEqual([24, 24]);
    expect(calculerTaillesGroupesEquilibres(54, 24)).toEqual([18, 18, 18]);
  });

  test("deduit une capacite faisable a partir des salles compatibles des cours", () => {
    const salles = [
      { id_salle: 1, type: "Laboratoire", capacite: 28 },
      { id_salle: 2, type: "Salle de cours", capacite: 40 },
      { id_salle: 3, type: "Salle reseautique", capacite: 24 },
    ];

    const capaciteProgrammation = determinerCapaciteMaximaleGroupeCohorte(
      [
        { type_salle: "Laboratoire", id_salle_reference: null },
        { type_salle: "Salle de cours", id_salle_reference: null },
      ],
      salles
    );

    const capaciteReseautique = determinerCapaciteMaximaleGroupeCohorte(
      [
        { type_salle: "Salle reseautique", id_salle_reference: null },
        { type_salle: "Laboratoire", id_salle_reference: null },
      ],
      salles
    );

    expect(capaciteProgrammation).toBe(28);
    expect(capaciteReseautique).toBe(24);
  });
});
