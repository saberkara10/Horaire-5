/**
 * TESTS - Modele Professeurs
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des professeurs.
 */
import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import { MAX_COURSES_PER_PROGRAM_PER_PROFESSOR } from "../src/services/scheduler/AcademicCatalog.js";

const queryMock = jest.fn();
const connectionQueryMock = jest.fn();
const connectionMock = {
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
  query: connectionQueryMock,
};

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
    getConnection: jest.fn().mockResolvedValue(connectionMock),
  },
}));

const professeursModel = await import("../src/model/professeurs.model.js");

describe("Model professeurs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionMock.beginTransaction.mockResolvedValue(undefined);
    connectionMock.commit.mockResolvedValue(undefined);
    connectionMock.rollback.mockResolvedValue(undefined);
    connectionMock.release.mockResolvedValue(undefined);
  });

  test("recupererTousLesProfesseurs retourne la liste", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 1, matricule: "P001" }]]);

    const result = await professeursModel.recupererTousLesProfesseurs();

    expect(result).toHaveLength(1);
  });

  test("recupererCoursProfesseur retourne les cours assignes", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_cours: 1, code: "INF101" }]]);

    const result = await professeursModel.recupererCoursProfesseur(1);

    expect(result[0].code).toBe("INF101");
  });

  test("recupererIndexCoursProfesseurs retourne une map par professeur", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 1, id_cours: 3 }]]);

    const result = await professeursModel.recupererIndexCoursProfesseurs();

    expect(result.get(1).has(3)).toBe(true);
  });

  test("recupererProfesseurParNomPrenom retourne le professeur correspondant", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 7, nom: "Kara", prenom: "Saber" }]]);

    const result = await professeursModel.recupererProfesseurParNomPrenom(
      "Kara",
      "Saber"
    );

    expect(result).toMatchObject({ id_professeur: 7, nom: "Kara", prenom: "Saber" });
  });

  test("validerContrainteCoursProfesseur refuse un cours archive", async () => {
    queryMock.mockResolvedValueOnce([[
      {
        id_cours: 7,
        code: "CYB-01",
        nom: "AWS maitrise",
        programme: "Cybersecurite",
        archive: 1,
      },
    ]]);

    const result = await professeursModel.validerContrainteCoursProfesseur([7]);

    expect(result).toBe("Impossible d'assigner un cours archive a un professeur.");
  });

  test("validerContrainteCoursProfesseur refuse plus de 6 cours dans le meme programme", async () => {
    queryMock.mockResolvedValueOnce([[
      {
        id_cours: 4,
        code: "CYB101",
        nom: "Fondements reseautiques",
        programme: "Cybersecurite",
        archive: 0,
      },
      {
        id_cours: 5,
        code: "CYB102",
        nom: "Administration des systemes",
        programme: "Cybersecurite",
        archive: 0,
      },
      {
        id_cours: 6,
        code: "CYB103",
        nom: "Securite offensive",
        programme: "Cybersecurite",
        archive: 0,
      },
      {
        id_cours: 7,
        code: "CYB104",
        nom: "Pare-feux",
        programme: "Cybersecurite",
        archive: 0,
      },
      {
        id_cours: 8,
        code: "CYB105",
        nom: "Cloud",
        programme: "Cybersecurite",
        archive: 0,
      },
      {
        id_cours: 9,
        code: "CYB106",
        nom: "Audit",
        programme: "Cybersecurite",
        archive: 0,
      },
      {
        id_cours: 10,
        code: "CYB107",
        nom: "Projet integre",
        programme: "Cybersecurite",
        archive: 0,
      },
    ]]);

    const result = await professeursModel.validerContrainteCoursProfesseur([
      4, 5, 6, 7, 8, 9, 10,
    ]);

    expect(result).toBe(
      `Un professeur ne peut pas avoir plus de ${MAX_COURSES_PER_PROGRAM_PER_PROFESSOR} cours dans le meme programme.`
    );
  });

  test("remplacerCoursProfesseur remplace les liaisons", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_cours: 1, code: "INF101" }]]);

    const result = await professeursModel.remplacerCoursProfesseur(1, [1, 2]);

    expect(result).toHaveLength(1);
    expect(connectionMock.commit).toHaveBeenCalled();
  });

  test("ajouterProfesseur insere puis retourne le professeur ajoute", async () => {
    queryMock
      .mockResolvedValueOnce([{ insertId: 5 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 5, matricule: "P005" }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 5, matricule: "P005" }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 5, matricule: "P005" }]]);
    connectionQueryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const result = await professeursModel.ajouterProfesseur({
      matricule: "P005",
      nom: "Ali",
      prenom: "Test",
      specialite: "Programmation informatique",
      cours_ids: [1],
    });

    expect(result.id_professeur).toBe(5);
  });

  test("modifierProfesseur retourne le professeur modifie", async () => {
    queryMock
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_professeur: 1, specialite: "Java" }]]);

    const result = await professeursModel.modifierProfesseur(1, { specialite: "Java" });

    expect(result.specialite).toBe("Java");
  });

  test("fusionnerDoublonsProfesseurs fusionne les professeurs portant la meme identite", async () => {
    queryMock.mockImplementation(async (sql, params) => {
      if (sql.includes("LEFT JOIN affectation_cours ac")) {
        return [[
          {
            id_professeur: 1,
            matricule: "PROF001",
            nom: "Kara",
            prenom: "Saber",
            specialite: null,
            nombre_affectations: 2,
            nombre_cours: 2,
          },
          {
            id_professeur: 2,
            matricule: "AUTO-PROF-02",
            nom: "Kara",
            prenom: "Saber",
            specialite: "Analyse de donnees",
            nombre_affectations: 0,
            nombre_cours: 2,
          },
        ]];
      }

      return [[]];
    });

    const result = await professeursModel.fusionnerDoublonsProfesseurs();

    expect(result.groupesFusionnes).toBe(1);
    expect(result.professeursFusionnes).toBe(1);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE affectation_cours"),
      [1, 2]
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM professeurs"),
      [2]
    );
  });

  test("nettoyerAffectationsCoursArchivesProfesseurs retire les liaisons vers les cours archives", async () => {
    queryMock
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 2 }]);

    const result =
      await professeursModel.nettoyerAffectationsCoursArchivesProfesseurs();

    expect(result).toBe(2);
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("DELETE pc")
    );
  });

  test("supprimerProfesseur retourne true si suppression reussie", async () => {
    queryMock.mockImplementation(async (sql) => {
      if (sql.includes("CREATE TABLE IF NOT EXISTS disponibilites_professeurs")) {
        return [[]];
      }

      if (sql.includes("CREATE TABLE IF NOT EXISTS professeur_cours")) {
        return [[]];
      }

      if (sql.includes("DELETE FROM disponibilites_professeurs")) {
        return [{ affectedRows: 0 }];
      }

      if (sql.includes("DELETE FROM professeur_cours")) {
        return [{ affectedRows: 0 }];
      }

      if (sql.includes("DELETE FROM professeurs")) {
        return [{ affectedRows: 1 }];
      }

      return [[]];
    });

    const result = await professeursModel.supprimerProfesseur(1);

    expect(result).toBe(true);
  });
});
/**
 * TESTS - Modele Professeurs
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des professeurs.
 */
