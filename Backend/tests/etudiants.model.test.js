/**
 * TESTS - Modele Etudiants
 *
 * Ce fichier couvre les operations principales
 * du modele de gestion des etudiants.
 */
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const queryMock = jest.fn();
const getConnectionMock = jest.fn();
const enregistrerEtudiantsImportesMock = jest.fn();
const genererRapportDebugMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
    getConnection: getConnectionMock,
  },
}));

await jest.unstable_mockModule("../src/model/import-etudiants.model.js", () => ({
  enregistrerEtudiantsImportes: enregistrerEtudiantsImportesMock,
}));

await jest.unstable_mockModule("../src/services/scheduler/FailedCourseDebugService.js", () => ({
  FailedCourseDebugService: {
    genererRapport: genererRapportDebugMock,
  },
}));

const etudiantsModel = await import("../src/model/etudiants.model.js");

describe("Model etudiants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    genererRapportDebugMock.mockResolvedValue({ diagnostics: [] });
  });

  test("recupererEtudiantParId retourne un etudiant", async () => {
    queryMock.mockResolvedValue([[{ id_etudiant: 1, groupe: "INF - E1 - G1" }]]);

    const result = await etudiantsModel.recupererEtudiantParId(1);

    expect(result.id_etudiant).toBe(1);
    expect(queryMock.mock.calls[0][0]).toContain(
      "CAST(e.etape AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_general_ci"
    );
  });

  test("recupererEtudiantParId retourne null si absent", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await etudiantsModel.recupererEtudiantParId(999);

    expect(result).toBeNull();
  });

  test("recupererTousLesEtudiants retourne la liste", async () => {
    queryMock.mockResolvedValue([[{ id_etudiant: 1, matricule: "E001" }]]);

    const result = await etudiantsModel.recupererTousLesEtudiants();

    expect(result).toHaveLength(1);
    expect(result[0].matricule).toBe("E001");
    expect(queryMock.mock.calls[0][0]).toContain(
      "CAST(e.etape AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_general_ci"
    );
  });

  test("matriculeExiste retourne true si le matricule existe", async () => {
    queryMock.mockResolvedValue([[{ count: 1 }]]);

    const result = await etudiantsModel.matriculeExiste("E001");

    expect(result).toBe(true);
  });

  test("matriculeExiste retourne false si le matricule n'existe pas", async () => {
    queryMock.mockResolvedValue([[{ count: 0 }]]);

    const result = await etudiantsModel.matriculeExiste("E009");

    expect(result).toBe(false);
  });

  test("recupererHoraireCompletEtudiant fusionne tronc commun et reprises", async () => {
    queryMock
      .mockResolvedValueOnce([[
        {
          id_etudiant: 1,
          matricule: "E001",
          nom: "Ali",
          prenom: "Test",
          id_groupe_principal: 7,
          groupe: "INF-E2-1",
          programme: "Programmation informatique",
          etape: 2,
          session: "Hiver",
          nb_reprises: 1,
          nb_cours_normaux: 7,
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_affectation_cours: 11,
          id_cours: 101,
          code_cours: "INF201",
          nom_cours: "Programmation orientee objet",
          date: "2026-01-12",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          groupe_source: "INF-E2-1",
          est_reprise: 0,
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id_affectation_cours: 31,
          id_cours: 7,
          code_cours: "INF107",
          nom_cours: "Projet integre en programmation I",
          date: "2026-01-13",
          heure_debut: "14:00:00",
          heure_fin: "17:00:00",
          groupe_source: "INF-E1-2",
          est_reprise: 1,
          statut_reprise: "planifie",
          note_echec: 53,
          id_cours_echoue: 9001,
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id: 9001,
          statut: "planifie",
          note_echec: 53,
          id_cours: 7,
          code_cours: "INF107",
          nom_cours: "Projet integre en programmation I",
          etape_etude: "1",
          id_groupe_reprise: 44,
          groupe_reprise: "INF-E1-2",
        },
      ]]);

    const result = await etudiantsModel.recupererHoraireCompletEtudiant(1);

    expect(result.etudiant.charge_cible).toBe(8);
    expect(result.horaire).toHaveLength(2);
    expect(result.horaire_groupe).toHaveLength(1);
    expect(result.horaire_reprises).toHaveLength(1);
    expect(result.horaire_reprises[0]).toMatchObject({
      est_reprise: true,
      source_horaire: "reprise",
      groupe_source: "INF-E1-2",
    });
    expect(result.reprises[0]).toMatchObject({
      code_cours: "INF107",
      groupe_reprise: "INF-E1-2",
      statut: "planifie",
    });
    expect(result.resume).toMatchObject({
      cours_normaux: 1,
      cours_reprises: 1,
      cours_total: 2,
      nb_reprises: 1,
      nb_reprises_planifiees: 1,
      nb_reprises_en_attente: 0,
      charge_cible: 8,
    });
    expect(result.diagnostic_reprises).toEqual([]);
  });

  test("importerEtudiants refuse des donnees invalides avant persistence", async () => {
    const result = await etudiantsModel.importerEtudiants([
      {
        matricule: "",
        nom: "Ali",
        prenom: "Test",
        programme: "INF",
        etape: 1,
        session: "Automne",
      },
    ]);

    expect(result.succes).toBe(false);
    expect(result.message).toBe("Import impossible.");
    expect(enregistrerEtudiantsImportesMock).not.toHaveBeenCalled();
  });

  test("importerEtudiants delegue la persistence avec programme normalise", async () => {
    enregistrerEtudiantsImportesMock.mockResolvedValue({
      nombreImportes: 1,
      cohorteUtilisee: {
        session: "Hiver",
      },
    });

    const result = await etudiantsModel.importerEtudiants([
      {
        matricule: "E001",
        nom: "Ali",
        prenom: "Test",
        programme: "INF",
        etape: 1,
      },
    ]);

    expect(result).toEqual({
      succes: true,
      message: "Import termine avec succes.",
      nombreImportes: 1,
      cohorteUtilisee: {
        session: "Hiver",
      },
    });
    expect(enregistrerEtudiantsImportesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        matricule: "E001",
        programme: "Programmation informatique",
        etape: 1,
        numeroLigne: 2,
      }),
    ]);
  });

  test("importerEtudiants retourne les erreurs de persistence sans lever", async () => {
    enregistrerEtudiantsImportesMock.mockResolvedValue({
      erreurs: [
        "Ligne 2 : l'etudiant au matricule E001 est deja present dans la base de donnees.",
      ],
    });

    const result = await etudiantsModel.importerEtudiants([
      {
        matricule: "E001",
        nom: "Ali",
        prenom: "Test",
        programme: "INF",
        etape: 1,
      },
    ]);

    expect(result).toEqual({
      succes: false,
      message: "Import impossible.",
      erreurs: [
        "Ligne 2 : l'etudiant au matricule E001 est deja present dans la base de donnees.",
      ],
    });
  });

  test("importerEtudiants relance si la persistence echoue brutalement", async () => {
    enregistrerEtudiantsImportesMock.mockRejectedValue(new Error("DB error"));

    await expect(
      etudiantsModel.importerEtudiants([
        {
          matricule: "E001",
          nom: "Ali",
          prenom: "Test",
          programme: "INF",
          etape: 1,
        },
      ])
    ).rejects.toThrow("DB error");
  });
});
