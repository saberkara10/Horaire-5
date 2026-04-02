/**
 * TESTS - Modele Horaire
 *
 * Ce fichier couvre la generation,
 * la compatibilite et les validations horaires.
 */
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

  test("professeurEstCompatibleAvecCours rapproche les variantes de programme", () => {
    const map = new Map([[1, new Set([10])]]);

    expect(
      professeurEstCompatibleAvecCours(
        {
          id_professeur: 1,
          specialite: "Informatique",
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

  test("verifierDisponibiliteProfesseur retourne true pour une disponibilite du dimanche", async () => {
    recupererDisponibilitesProfesseursMock.mockResolvedValue(
      new Map([
        [
          2,
          [
            {
              id_professeur: 2,
              jour_semaine: 7,
              heure_debut: "08:00:00",
              heure_fin: "12:00:00",
            },
          ],
        ],
      ])
    );

    const disponible = await verifierDisponibiliteProfesseur(
      2,
      "2026-03-29",
      "09:00",
      "11:00"
    );

    expect(disponible).toBe(true);
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

  test("genererHoraireAutomatiquement cree un horaire groupe par groupe", async () => {
    connectionMock.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM cours")) {
        return [[
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
        ]];
      }

      if (sql.includes("FROM professeurs")) {
        return [[
          {
            id_professeur: 2,
            matricule: "P-001",
            nom: "Martin",
            prenom: "Lea",
            specialite: "Programmation informatique",
          },
        ]];
      }

      if (sql.includes("FROM salles")) {
        return [[
          {
            id_salle: 3,
            code: "LAB-01",
            type: "Laboratoire",
            capacite: 30,
          },
        ]];
      }

      if (
        sql.includes(
          "SELECT id_etudiant, id_groupes_etudiants, programme, etape, session, annee"
        )
      ) {
        return [[
          {
            id_etudiant: 10,
            id_groupes_etudiants: null,
            programme: "Programmation informatique",
            etape: 1,
            session: "Automne",
            annee: 2026,
          },
        ]];
      }

      if (sql.includes("INSERT INTO groupes_etudiants")) {
        return [{ insertId: 4 }];
      }

      if (sql.includes("UPDATE etudiants")) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes("FROM affectation_groupes ag")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("WHERE ac.id_professeur = ?")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("WHERE ac.id_salle = ?")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("INSERT INTO plages_horaires")) {
        return [{ insertId: 11 }];
      }

      if (sql.includes("INSERT INTO affectation_cours")) {
        return [{ insertId: 22 }];
      }

      if (sql.includes("INSERT INTO affectation_groupes")) {
        return [{ insertId: 33 }];
      }

      return [[]];
    });

    recupererDisponibilitesProfesseursMock.mockResolvedValue(new Map());
    recupererIndexCoursProfesseursMock.mockResolvedValue(
      new Map([[2, new Set([1])]])
    );

    const resultat = await genererHoraireAutomatiquement({
      programme: "Programmation informatique",
      etape: "1",
      session: "Automne",
      annee: 2026,
    });

    expect(resultat.affectations).toHaveLength(1);
    expect(resultat.affectations[0]).toMatchObject({
      id_affectation_cours: 22,
      groupes: "Programmation informatique - E1 - Automne 2026 - G1",
      effectif: 1,
    });
    expect(connectionMock.commit).toHaveBeenCalledTimes(1);
  });

  test("genererHoraireAutomatiquement peut generer a partir d'un samedi", async () => {
    connectionMock.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM cours")) {
        return [[
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
        ]];
      }

      if (sql.includes("FROM professeurs")) {
        return [[
          {
            id_professeur: 2,
            matricule: "P-001",
            nom: "Martin",
            prenom: "Lea",
            specialite: "Programmation informatique",
          },
        ]];
      }

      if (sql.includes("FROM salles")) {
        return [[
          {
            id_salle: 3,
            code: "LAB-01",
            type: "Laboratoire",
            capacite: 30,
          },
        ]];
      }

      if (
        sql.includes(
          "SELECT id_etudiant, id_groupes_etudiants, programme, etape, session, annee"
        )
      ) {
        return [[
          {
            id_etudiant: 10,
            id_groupes_etudiants: null,
            programme: "Programmation informatique",
            etape: 1,
            session: "Automne",
            annee: 2026,
          },
        ]];
      }

      if (sql.includes("INSERT INTO groupes_etudiants")) {
        return [{ insertId: 4 }];
      }

      if (sql.includes("UPDATE etudiants")) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes("FROM affectation_groupes ag")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("WHERE ac.id_professeur = ?")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("WHERE ac.id_salle = ?")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("INSERT INTO plages_horaires")) {
        return [{ insertId: 11 }];
      }

      if (sql.includes("INSERT INTO affectation_cours")) {
        return [{ insertId: 22 }];
      }

      if (sql.includes("INSERT INTO affectation_groupes")) {
        return [{ insertId: 33 }];
      }

      return [[]];
    });

    recupererDisponibilitesProfesseursMock.mockResolvedValue(new Map());
    recupererIndexCoursProfesseursMock.mockResolvedValue(
      new Map([[2, new Set([1])]])
    );

    const resultat = await genererHoraireAutomatiquement({
      programme: "Programmation informatique",
      etape: "1",
      session: "Automne",
      annee: 2026,
      dateDebut: "2026-03-28",
    });

    expect(resultat.affectations[0].date).toBe("2026-03-28");
  });
});
/**
 * TESTS - Modele Horaire
 *
 * Ce fichier couvre la generation,
 * la compatibilite et les validations horaires.
 */
