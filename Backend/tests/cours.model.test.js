/**
 * TESTS - Modele Cours
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des cours.
 */
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

const coursModel = await import("../src/model/cours.model.js");

describe("Model cours", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("recupererTousLesCours retourne la liste", async () => {
    queryMock.mockResolvedValue([[{ id_cours: 1, code: "INF101" }]]);

    const result = await coursModel.recupererTousLesCours();

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("INF101");
  });

  test("recupererCoursParId retourne un cours", async () => {
    queryMock.mockResolvedValue([[{ id_cours: 1, code: "INF101" }]]);

    const result = await coursModel.recupererCoursParId(1);

    expect(result.id_cours).toBe(1);
  });

  test("recupererCoursParCode retourne null si absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await coursModel.recupererCoursParCode("XXX");

    expect(result).toBeNull();
  });

  test("ajouterCours insere puis retourne le cours ajoute", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id_salle: 4, code: "B204", type: "Laboratoire" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 5 }])
      .mockResolvedValueOnce([[{ id_cours: 5, code: "INF200", id_salle_reference: 4 }]]);

    const result = await coursModel.ajouterCours({
      code: "INF200",
      nom: "Algo",
      duree: 2,
      programme: "Programmation informatique",
      etape_etude: 2,
      id_salle_reference: 4,
    });

    expect(result.id_cours).toBe(5);
    expect(queryMock).toHaveBeenCalledTimes(4);
  });

  test("modifierCours met a jour la salle de reference", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id_salle: 8, code: "A101", type: "Salle de cours" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id_cours: 1, id_salle_reference: 8 }]]);

    const result = await coursModel.modifierCours(1, { id_salle_reference: 8 });

    expect(result.id_salle_reference).toBe(8);
  });

  test("coursEstDejaAffecte retourne true si affecte", async () => {
    queryMock.mockResolvedValue([[{ 1: 1 }]]);

    const result = await coursModel.coursEstDejaAffecte(1);

    expect(result).toBe(true);
  });

  test("supprimerCours retourne false si rien supprime", async () => {
    queryMock.mockResolvedValue([{ affectedRows: 0 }]);

    const result = await coursModel.supprimerCours(999);

    expect(result).toBe(false);
  });

  test("salleExisteParId retourne true si la salle existe", async () => {
    queryMock.mockResolvedValue([[{ id_salle: 2, code: "A100" }]]);

    const result = await coursModel.salleExisteParId(2);

    expect(result).toBe(true);
  });
});
/**
 * TESTS - Modele Cours
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des cours.
 */
