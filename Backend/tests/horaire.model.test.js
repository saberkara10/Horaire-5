import { jest } from "@jest/globals";

const queryMock = jest.fn();
const poolMock = {
  query: queryMock,
  getConnection: jest.fn(),
};

const recupererDisponibilitesProfesseursMock = jest.fn();
const recupererIndexCoursProfesseursMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: poolMock,
}));

await jest.unstable_mockModule("../src/model/professeurs.model.js", () => ({
  recupererDisponibilitesProfesseurs: recupererDisponibilitesProfesseursMock,
  recupererIndexCoursProfesseurs: recupererIndexCoursProfesseursMock,
}));

const {
  creerAffectationValidee,
  genererHoraireAutomatiquement,
  professeurEstCompatibleAvecCours,
  salleEstCompatibleAvecCours,
  verifierDisponibiliteProfesseur,
} = await import("../src/model/horaire.js");

describe("Tests modele Horaire", () => {
  const connectionMock = {
    query: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    poolMock.getConnection.mockResolvedValue(connectionMock);
    connectionMock.beginTransaction.mockResolvedValue(undefined);
    connectionMock.commit.mockResolvedValue(undefined);
    connectionMock.rollback.mockResolvedValue(undefined);
    connectionMock.release.mockResolvedValue(undefined);
  });

  test("professeurEstCompatibleAvecCours retourne true quand le cours est assigne", () => {
    const map = new Map([[1, new Set([10])]]);

    expect(
      professeurEstCompatibleAvecCours(
        {
          id_professeur: 1,
          specialite: "Programmation informatique",
        },
        {
          id_cours: 10,
          programme: "Programmation informatique",
        },
        map
      )
    ).toBe(true);
  });

  test("professeurEstCompatibleAvecCours retourne false quand le cours n'est pas assigne", () => {
    const map = new Map([[1, new Set([99])]]);

    expect(
      professeurEstCompatibleAvecCours(
        {
          id_professeur: 1,
          specialite: "Programmation informatique",
        },
        {
          id_cours: 10,
          programme: "Programmation informatique",
        },
        map
      )
    ).toBe(false);
  });

  test("salleEstCompatibleAvecCours retourne true quand l'id de salle correspond", () => {
    expect(
      salleEstCompatibleAvecCours(
        {
          id_salle: 3,
          type: "Laboratoire",
        },
        {
          id_cours: 1,
          type_salle: "Laboratoire",
          id_salle_reference: 3,
        }
      )
    ).toBe(true);
  });

  test("verifierDisponibiliteProfesseur retourne false quand le professeur n'est pas disponible", async () => {
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
      .mockResolvedValueOnce([[
        {
          id_cours: 1,
          code: "INF101",
          nom: "Programmation",
          programme: "Programmation informatique",
          type_salle: "Laboratoire",
          id_salle_reference: 3,
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_professeur: 2,
          matricule: "MAT002",
          nom: "Martin",
          prenom: "Lea",
          specialite: "Comptabilite et gestion",
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_salle: 3,
          code: "LAB-01",
          type: "Laboratoire",
          capacite: 24,
        },
      ]]);
    recupererIndexCoursProfesseursMock.mockResolvedValue(new Map());

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

  test("creerAffectationValidee cree une affectation quand le contexte est valide", async () => {
    queryMock
      .mockResolvedValueOnce([[
        {
          id_cours: 1,
          code: "INF101",
          nom: "Programmation",
          programme: "Programmation informatique",
          type_salle: "Laboratoire",
          id_salle_reference: 3,
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_professeur: 2,
          matricule: "MAT002",
          nom: "Martin",
          prenom: "Lea",
          specialite: "Programmation informatique",
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_salle: 3,
          code: "LAB-01",
          type: "Laboratoire",
          capacite: 24,
        },
      ]])
      .mockResolvedValueOnce([[{ conflits: 0 }]])
      .mockResolvedValueOnce([[{ conflits: 0 }]])
      .mockResolvedValueOnce([{ insertId: 11 }])
      .mockResolvedValueOnce([{ insertId: 22 }]);

    recupererIndexCoursProfesseursMock.mockResolvedValue(
      new Map([[2, new Set([1])]])
    );
    recupererDisponibilitesProfesseursMock.mockResolvedValue(new Map());

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

  test("genererHoraireAutomatiquement lie les groupes compatibles a l'affectation creee", async () => {
    connectionMock.query
      .mockResolvedValueOnce([[
        {
          id_cours: 1,
          code: "INF101",
          nom: "Programmation",
          duree: 2,
          programme: "Programmation informatique",
          etape_etude: "1",
          type_salle: "Laboratoire",
          id_salle_reference: 3,
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_professeur: 2,
          matricule: "P-001",
          nom: "Martin",
          prenom: "Lea",
          specialite: "Programmation informatique",
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_salle: 3,
          code: "LAB-01",
          type: "Laboratoire",
          capacite: 30,
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_groupes_etudiants: 4,
          nom_groupe: "A1",
          programme: "Programmation informatique",
          etape: 1,
          effectif: 22,
        },
      ]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ conflits: 0 }]])
      .mockResolvedValueOnce([[{ conflits: 0 }]])
      .mockResolvedValueOnce([[
        {
          id_cours: 1,
          code: "INF101",
          nom: "Programmation",
          programme: "Programmation informatique",
          type_salle: "Laboratoire",
          id_salle_reference: 3,
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_professeur: 2,
          matricule: "P-001",
          nom: "Martin",
          prenom: "Lea",
          specialite: "Programmation informatique",
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_salle: 3,
          code: "LAB-01",
          type: "Laboratoire",
          capacite: 30,
        },
      ]])
      .mockResolvedValueOnce([[{ conflits: 0 }]])
      .mockResolvedValueOnce([[{ conflits: 0 }]])
      .mockResolvedValueOnce([{ insertId: 11 }])
      .mockResolvedValueOnce([{ insertId: 22 }])
      .mockResolvedValueOnce([{ insertId: 33 }]);

    recupererDisponibilitesProfesseursMock.mockResolvedValue(new Map());
    recupererIndexCoursProfesseursMock.mockResolvedValue(
      new Map([[2, new Set([1])]])
    );

    const resultat = await genererHoraireAutomatiquement();

    expect(resultat.affectations).toHaveLength(1);
    expect(resultat.affectations[0]).toMatchObject({
      id_affectation_cours: 22,
      groupes: "A1",
      effectif: 22,
    });
    expect(connectionMock.commit).toHaveBeenCalledTimes(1);
  });
});
