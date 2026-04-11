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
  updateAffectationValidee,
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

  test("salleEstCompatibleAvecCours retourne true pour une salle du meme type meme si la salle de reference differe", () => {
    expect(
      salleEstCompatibleAvecCours(
        {
          id_salle: 8,
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

  test("salleEstCompatibleAvecCours retourne false si le type reel ne correspond pas", () => {
    expect(
      salleEstCompatibleAvecCours(
        {
          id_salle: 3,
          type: "Salle de cours",
        },
        {
          id_cours: 1,
          type_salle: "Laboratoire",
          id_salle_reference: 3,
        }
      )
    ).toBe(false);
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
    connectionMock.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM cours")) {
        return [[
          {
            id_cours: 1,
            code: "INF101",
            nom: "Programmation",
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
            matricule: "MAT002",
            nom: "Martin",
            prenom: "Lea",
            specialite: "Comptabilite et gestion",
          },
        ]];
      }

      if (sql.includes("FROM salles")) {
        return [[
          {
            id_salle: 3,
            code: "LAB-01",
            type: "Laboratoire",
            capacite: 24,
          },
        ]];
      }

      return [[]];
    });
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

  test("creerAffectationValidee cree une affectation et lie le groupe quand le contexte est valide", async () => {
    connectionMock.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM cours")) {
        return [[
          {
            id_cours: 1,
            code: "INF101",
            nom: "Programmation",
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
            matricule: "MAT002",
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
            capacite: 24,
          },
        ]];
      }

      if (sql.includes("FROM groupes_etudiants ge")) {
        return [[
          {
            id_groupes_etudiants: 4,
            nom_groupe: "Programmation informatique - E1 - Automne - G1",
            programme: "Programmation informatique",
            etape: "1",
            session: "Automne",
            effectif: 24,
          },
        ]];
      }

      if (sql.includes("FROM affectation_groupes ag")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("WHERE ac.id_salle = ?")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("WHERE ac.id_professeur = ?")) {
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

    recupererIndexCoursProfesseursMock.mockResolvedValue(
      new Map([[2, new Set([1])]])
    );
    recupererDisponibilitesProfesseursMock.mockResolvedValue(new Map());

    const resultat = await creerAffectationValidee({
        idCours: 1,
        idProfesseur: 2,
        idSalle: 3,
        idGroupeEtudiants: 4,
        date: "2026-03-23",
        heureDebut: "08:00",
        heureFin: "10:00",
      });

    expect(resultat).toEqual({
      id_affectation_cours: 22,
      id_plage_horaires: 11,
    });
    expect(connectionMock.commit).toHaveBeenCalledTimes(1);
    expect(connectionMock.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO affectation_groupes"),
      [4, 22]
    );
  });

  test("creerAffectationValidee rejette un groupe deja occupe sur le meme creneau", async () => {
    connectionMock.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM cours")) {
        return [[
          {
            id_cours: 1,
            code: "INF101",
            nom: "Programmation",
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
            matricule: "MAT002",
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
            capacite: 24,
          },
        ]];
      }

      if (sql.includes("FROM groupes_etudiants ge")) {
        return [[
          {
            id_groupes_etudiants: 4,
            nom_groupe: "Programmation informatique - E1 - Automne - G1",
            programme: "Programmation informatique",
            etape: "1",
            session: "Automne",
            effectif: 24,
          },
        ]];
      }

      if (sql.includes("FROM affectation_groupes ag")) {
        return [[{ conflits: 1 }]];
      }

      if (sql.includes("WHERE ac.id_salle = ?")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("WHERE ac.id_professeur = ?")) {
        return [[{ conflits: 0 }]];
      }

      return [[]];
    });

    recupererIndexCoursProfesseursMock.mockResolvedValue(
      new Map([[2, new Set([1])]])
    );
    recupererDisponibilitesProfesseursMock.mockResolvedValue(new Map());

    await expect(
      creerAffectationValidee({
        idCours: 1,
        idProfesseur: 2,
        idSalle: 3,
        idGroupeEtudiants: 4,
        date: "2026-03-23",
        heureDebut: "08:00",
        heureFin: "10:00",
      })
    ).rejects.toMatchObject({
      message: "Groupe deja occupe sur ce creneau.",
      statusCode: 409,
    });
  });

  test("updateAffectationValidee remplace le groupe et met a jour l'affectation", async () => {
    let groupeActuel = 4;
    let libelleGroupeActuel = "Programmation informatique - E1 - Automne - G1";

    connectionMock.query.mockImplementation(async (sql, params = []) => {
      if (
        sql.includes("WHERE ac.id_affectation_cours = ?") &&
        sql.includes("GROUP_CONCAT")
      ) {
        return [[
          {
            id_affectation_cours: 9,
            id_cours: 1,
            id_professeur: 2,
            id_salle: 3,
            id_plage_horaires: 11,
            date: "2026-03-23",
            heure_debut: "08:00:00",
            heure_fin: "10:00:00",
            id_groupes_etudiants: groupeActuel,
            groupes: libelleGroupeActuel,
          },
        ]];
      }

      if (sql.includes("FROM cours")) {
        return [[
          {
            id_cours: 1,
            code: "INF101",
            nom: "Programmation",
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
            matricule: "MAT002",
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

      if (sql.includes("FROM groupes_etudiants ge")) {
        return [[
          {
            id_groupes_etudiants: 6,
            nom_groupe: "Programmation informatique - E1 - Automne - G2",
            programme: "Programmation informatique",
            etape: "1",
            session: "Automne",
            effectif: 22,
          },
        ]];
      }

      if (sql.includes("WHERE ac.id_salle = ?")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("WHERE ac.id_professeur = ?")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("FROM affectation_groupes ag")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("UPDATE plages_horaires")) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes("UPDATE affectation_cours")) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes("DELETE FROM affectation_groupes")) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes("INSERT INTO affectation_groupes")) {
        groupeActuel = 6;
        libelleGroupeActuel = "Programmation informatique - E1 - Automne - G2";
        return [{ insertId: 44 }];
      }

      throw new Error(`SQL non simule: ${sql} / ${JSON.stringify(params)}`);
    });

    recupererIndexCoursProfesseursMock.mockResolvedValue(
      new Map([[2, new Set([1])]])
    );
    recupererDisponibilitesProfesseursMock.mockResolvedValue(new Map());

    const resultat = await updateAffectationValidee(9, {
      idCours: 1,
      idProfesseur: 2,
      idSalle: 3,
      idGroupeEtudiants: 6,
      date: "2026-03-24",
      heureDebut: "10:00",
      heureFin: "12:00",
    });

    expect(resultat).toMatchObject({
      id_affectation_cours: 9,
      id_groupes_etudiants: 6,
      groupes: "Programmation informatique - E1 - Automne - G2",
    });
    expect(connectionMock.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM affectation_groupes"),
      [9]
    );
    expect(connectionMock.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO affectation_groupes"),
      [6, 9]
    );
  });

  test("updateAffectationValidee rejette un groupe deja occupe sur le meme creneau", async () => {
    connectionMock.query.mockImplementation(async (sql, params = []) => {
      if (
        sql.includes("WHERE ac.id_affectation_cours = ?") &&
        sql.includes("GROUP_CONCAT")
      ) {
        return [[
          {
            id_affectation_cours: 9,
            id_cours: 1,
            id_professeur: 2,
            id_salle: 3,
            id_plage_horaires: 11,
            date: "2026-03-23",
            heure_debut: "08:00:00",
            heure_fin: "10:00:00",
            id_groupes_etudiants: 4,
            groupes: "Programmation informatique - E1 - Automne - G1",
          },
        ]];
      }

      if (sql.includes("FROM cours")) {
        return [[
          {
            id_cours: 1,
            code: "INF101",
            nom: "Programmation",
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
            matricule: "MAT002",
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

      if (sql.includes("FROM groupes_etudiants ge")) {
        return [[
          {
            id_groupes_etudiants: 6,
            nom_groupe: "Programmation informatique - E1 - Automne - G2",
            programme: "Programmation informatique",
            etape: "1",
            session: "Automne",
            effectif: 22,
          },
        ]];
      }

      if (sql.includes("WHERE ac.id_salle = ?")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("WHERE ac.id_professeur = ?")) {
        return [[{ conflits: 0 }]];
      }

      if (sql.includes("FROM affectation_groupes ag")) {
        return [[{ conflits: 1 }]];
      }

      throw new Error(`SQL non simule: ${sql} / ${JSON.stringify(params)}`);
    });

    recupererIndexCoursProfesseursMock.mockResolvedValue(
      new Map([[2, new Set([1])]])
    );
    recupererDisponibilitesProfesseursMock.mockResolvedValue(new Map());

    await expect(
      updateAffectationValidee(9, {
        idCours: 1,
        idProfesseur: 2,
        idSalle: 3,
        idGroupeEtudiants: 6,
        date: "2026-03-24",
        heureDebut: "10:00",
        heureFin: "12:00",
      })
    ).rejects.toMatchObject({
      message: "Groupe deja occupe sur ce creneau.",
      statusCode: 409,
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
          "SELECT id_etudiant, id_groupes_etudiants, programme, etape, session"
        )
      ) {
        return [[
          {
            id_etudiant: 10,
            id_groupes_etudiants: null,
            programme: "Programmation informatique",
            etape: 1,
            session: "Automne",
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
    });

    expect(resultat.affectations).toHaveLength(1);
    expect(resultat.affectations[0]).toMatchObject({
      id_affectation_cours: 22,
      groupes: "Programmation informatique - E1 - Automne - G1",
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
          "SELECT id_etudiant, id_groupes_etudiants, programme, etape, session"
        )
      ) {
        return [[
          {
            id_etudiant: 10,
            id_groupes_etudiants: null,
            programme: "Programmation informatique",
            etape: 1,
            session: "Automne",
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
