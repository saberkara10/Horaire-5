import { jest } from "@jest/globals";

const queryMock = jest.fn();
const poolMock = {
  query: queryMock,
  getConnection: jest.fn(),
};

const recupererDisponibilitesProfesseursMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: poolMock,
}));

await jest.unstable_mockModule("../src/model/professeurs.model.js", () => ({
  recupererDisponibilitesProfesseurs: recupererDisponibilitesProfesseursMock,
}));

const {
  creerAffectationValidee,
  professeurEstCompatibleAvecCours,
  salleEstCompatibleAvecCours,
  verifierDisponibiliteProfesseur,
} = await import("../src/model/horaire.js");

describe("Tests modele Horaire", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("professeurEstCompatibleAvecCours retourne true quand la specialite correspond au programme", () => {
    expect(
      professeurEstCompatibleAvecCours(
        {
          id_professeur: 1,
          specialite: "Informatique",
        },
        {
          id_cours: 1,
          code: "INF101",
          nom: "Programmation",
          programme: "Informatique",
        }
      )
    ).toBe(true);
  });

  test("professeurEstCompatibleAvecCours retourne false quand aucune correspondance n'existe", () => {
    expect(
      professeurEstCompatibleAvecCours(
        {
          id_professeur: 1,
          specialite: "Maths",
        },
        {
          id_cours: 1,
          code: "INF101",
          nom: "Programmation",
          programme: "Informatique",
        }
      )
    ).toBe(false);
  });

  test("salleEstCompatibleAvecCours retourne true quand le type correspond", () => {
    expect(
      salleEstCompatibleAvecCours(
        {
          id_salle: 3,
          type: "Laboratoire",
        },
        {
          id_cours: 1,
          type_salle: "laboratoire",
        }
      )
    ).toBe(true);
  });

  test("verifierDisponibiliteProfesseur retourne false quand le professeur n'est pas disponible sur le creneau", async () => {
    recupererDisponibilitesProfesseursMock.mockResolvedValue(
      new Map([
        [
          2,
          [
            {
              id_professeur: 2,
              jour_semaine: 1,
              heure_debut: "08:00:00",
              heure_fin: "10:00:00",
            },
          ],
        ],
      ])
    );

    const disponible = await verifierDisponibiliteProfesseur(
      2,
      "2026-03-23",
      "10:00",
      "12:00"
    );

    expect(disponible).toBe(false);
  });

  test("creerAffectationValidee rejette un professeur non compatible", async () => {
    queryMock
      .mockResolvedValueOnce([
        [
          {
            id_cours: 1,
            code: "INF101",
            nom: "Programmation",
            programme: "Informatique",
            type_salle: "Laboratoire",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id_professeur: 2,
            matricule: "MAT002",
            nom: "Martin",
            prenom: "Lea",
            specialite: "Comptabilite",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id_salle: 3,
            code: "LAB-01",
            type: "Laboratoire",
            capacite: 24,
          },
        ],
      ]);

    await expect(
      creerAffectationValidee({
        idCours: 1,
        idProfesseur: 2,
        idSalle: 3,
        date: "2026-03-23",
        heureDebut: "08:00",
        heureFin: "10:00",
      })
    ).rejects.toMatchObject({
      message: "Professeur non compatible avec ce cours.",
      statusCode: 409,
    });
  });

  test("creerAffectationValidee rejette un professeur indisponible", async () => {
    queryMock
      .mockResolvedValueOnce([
        [
          {
            id_cours: 1,
            code: "INF101",
            nom: "Programmation",
            programme: "Informatique",
            type_salle: "Laboratoire",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id_professeur: 2,
            matricule: "MAT002",
            nom: "Martin",
            prenom: "Lea",
            specialite: "Informatique",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id_salle: 3,
            code: "LAB-01",
            type: "Laboratoire",
            capacite: 24,
          },
        ],
      ]);

    recupererDisponibilitesProfesseursMock.mockResolvedValue(
      new Map([
        [
          2,
          [
            {
              id_professeur: 2,
              jour_semaine: 1,
              heure_debut: "13:00:00",
              heure_fin: "15:00:00",
            },
          ],
        ],
      ])
    );

    await expect(
      creerAffectationValidee({
        idCours: 1,
        idProfesseur: 2,
        idSalle: 3,
        date: "2026-03-23",
        heureDebut: "08:00",
        heureFin: "10:00",
      })
    ).rejects.toMatchObject({
      message: "Professeur indisponible sur ce creneau.",
      statusCode: 409,
    });
  });

  test("creerAffectationValidee cree une affectation quand le contexte est valide", async () => {
    queryMock
      .mockResolvedValueOnce([
        [
          {
            id_cours: 1,
            code: "INF101",
            nom: "Programmation",
            programme: "Informatique",
            type_salle: "Laboratoire",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id_professeur: 2,
            matricule: "MAT002",
            nom: "Martin",
            prenom: "Lea",
            specialite: "Informatique",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id_salle: 3,
            code: "LAB-01",
            type: "Laboratoire",
            capacite: 24,
          },
        ],
      ])
      .mockResolvedValueOnce([[{ conflits: 0 }]])
      .mockResolvedValueOnce([[{ conflits: 0 }]])
      .mockResolvedValueOnce([{ insertId: 11 }])
      .mockResolvedValueOnce([{ insertId: 22 }]);

    recupererDisponibilitesProfesseursMock.mockResolvedValue(
      new Map([
        [
          2,
          [
            {
              id_professeur: 2,
              jour_semaine: 1,
              heure_debut: "08:00:00",
              heure_fin: "12:00:00",
            },
          ],
        ],
      ])
    );

    const resultat = await creerAffectationValidee({
      idCours: 1,
      idProfesseur: 2,
      idSalle: 3,
      date: "2026-03-23",
      heureDebut: "08:00",
      heureFin: "10:00",
    });

    expect(resultat).toEqual({
      id_affectation_cours: 22,
      id_plage_horaires: 11,
    });
  });
});
