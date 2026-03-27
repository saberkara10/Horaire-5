import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();
const connectionMock = {
  beginTransaction: jest.fn(),
  query: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
    getConnection: jest.fn().mockResolvedValue(connectionMock),
  },
}));

const {
  recupererDisponibilitesProfesseur,
  recupererDisponibilitesProfesseurs,
  remplacerDisponibilitesProfesseur,
} = await import("../src/model/professeurs.model.js");

describe("Model professeurs disponibilites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionMock.beginTransaction.mockResolvedValue(undefined);
    connectionMock.commit.mockResolvedValue(undefined);
    connectionMock.rollback.mockResolvedValue(undefined);
    connectionMock.release.mockResolvedValue(undefined);
  });

  test("recupererDisponibilitesProfesseur retourne les disponibilites du professeur", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[
        {
          id_disponibilite_professeur: 1,
          id_professeur: 7,
          jour_semaine: 1,
          heure_debut: "08:00:00",
          heure_fin: "10:00:00",
        },
      ]]);

    const resultat = await recupererDisponibilitesProfesseur(7);

    expect(resultat).toHaveLength(1);
    expect(resultat[0]).toMatchObject({
      id_professeur: 7,
      jour_semaine: 1,
    });
  });

  test("recupererDisponibilitesProfesseurs groupe les disponibilites par professeur", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[
        {
          id_professeur: 2,
          jour_semaine: 1,
          heure_debut: "08:00:00",
          heure_fin: "10:00:00",
        },
        {
          id_professeur: 2,
          jour_semaine: 3,
          heure_debut: "14:00:00",
          heure_fin: "16:00:00",
        },
        {
          id_professeur: 5,
          jour_semaine: 2,
          heure_debut: "10:00:00",
          heure_fin: "12:00:00",
        },
      ]]);

    const resultat = await recupererDisponibilitesProfesseurs();

    expect(resultat.get(2)).toHaveLength(2);
    expect(resultat.get(5)).toHaveLength(1);
  });

  test("remplacerDisponibilitesProfesseur remplace et normalise les heures", async () => {
    connectionMock.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[
        {
          id_disponibilite_professeur: 9,
          id_professeur: 3,
          jour_semaine: 2,
          heure_debut: "09:30:00",
          heure_fin: "11:00:00",
        },
      ]]);

    const resultat = await remplacerDisponibilitesProfesseur(3, [
      {
        jour_semaine: 2,
        heure_debut: "09:30",
        heure_fin: "11:00",
      },
    ]);

    expect(connectionMock.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connectionMock.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO disponibilites_professeurs"),
      [3, 2, "09:30:00", "11:00:00"]
    );
    expect(connectionMock.commit).toHaveBeenCalledTimes(1);
    expect(connectionMock.release).toHaveBeenCalledTimes(1);
    expect(resultat[0].heure_debut).toBe("09:30:00");
  });

  test("remplacerDisponibilitesProfesseur rollback si une insertion echoue", async () => {
    connectionMock.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockRejectedValueOnce(new Error("DB error"));

    await expect(
      remplacerDisponibilitesProfesseur(3, [
        {
          jour_semaine: 2,
          heure_debut: "09:30",
          heure_fin: "11:00",
        },
      ])
    ).rejects.toThrow("DB error");

    expect(connectionMock.rollback).toHaveBeenCalledTimes(1);
    expect(connectionMock.release).toHaveBeenCalledTimes(1);
  });
});
