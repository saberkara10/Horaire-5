/**
 * TESTS - Modele Groupes
 *
 * Ce fichier couvre la lecture
 * des groupes et de leurs horaires.
 */
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

const groupesModel = await import("../src/model/groupes.model.js");

describe("Modele groupes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("recupererGroupes retourne la liste simple si details=false", async () => {
    queryMock.mockResolvedValueOnce([[{ id_groupes_etudiants: 1, nom_groupe: "G1" }]]);

    const result = await groupesModel.recupererGroupes();

    expect(result).toEqual([{ id_groupes_etudiants: 1, nom_groupe: "G1" }]);
    expect(queryMock.mock.calls[0][0]).toContain("FROM groupes_etudiants");
  });

  test("recupererGroupes retourne les details si demandes", async () => {
    queryMock.mockResolvedValueOnce([[
      {
        id_groupes_etudiants: 2,
        nom_groupe: "INFO-E1-AUT-2026-G1",
        programme: "Programmation informatique",
        etape: 1,
        session: "Automne",
        annee: 2026,
        effectif: 24,
      },
    ]]);

    const result = await groupesModel.recupererGroupes(true);

    expect(result[0].programme).toBe("Programmation informatique");
    expect(queryMock.mock.calls[0][0]).toContain("COUNT(e.id_etudiant) AS effectif");
  });

  test("recupererGroupeParId retourne le groupe trouve", async () => {
    queryMock.mockResolvedValueOnce([[
      { id_groupes_etudiants: 3, nom_groupe: "G3", effectif: 18 },
    ]]);

    const result = await groupesModel.recupererGroupeParId(3);

    expect(result).toEqual({ id_groupes_etudiants: 3, nom_groupe: "G3", effectif: 18 });
  });

  test("recupererGroupeParId retourne null si absent", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    const result = await groupesModel.recupererGroupeParId(99);

    expect(result).toBeNull();
  });

  test("recupererHoraireGroupe retourne les seances", async () => {
    queryMock.mockResolvedValueOnce([[
      { id_affectation_cours: 10, code_cours: "INF101" },
    ]]);

    const result = await groupesModel.recupererHoraireGroupe(1);

    expect(result).toEqual([{ id_affectation_cours: 10, code_cours: "INF101" }]);
    expect(queryMock.mock.calls[0][0]).toContain("FROM affectation_groupes ag");
  });

  test("recupererPlanningCompletGroupe assemble groupe et horaire", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id_groupes_etudiants: 7, nom_groupe: "G7" }]])
      .mockResolvedValueOnce([[{ id_affectation_cours: 45, code_cours: "MAT100" }]]);

    const result = await groupesModel.recupererPlanningCompletGroupe(7);

    expect(result).toEqual({
      groupe: { id_groupes_etudiants: 7, nom_groupe: "G7" },
      horaire: [{ id_affectation_cours: 45, code_cours: "MAT100" }],
    });
  });

  test("recupererPlanningCompletGroupe retourne null si groupe introuvable", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    const result = await groupesModel.recupererPlanningCompletGroupe(7);

    expect(result).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
