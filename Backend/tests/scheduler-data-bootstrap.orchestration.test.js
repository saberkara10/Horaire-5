import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const assurerProgrammeReferenceMock = jest.fn(async () => {});
const assurerUniciteNomPrenomProfesseursMock = jest.fn(async () => {});
const fusionnerDoublonsProfesseursMock = jest.fn(async () => ({
  professeursFusionnes: 0,
  groupesFusionnes: 0,
}));

await jest.unstable_mockModule("../db.js", () => ({
  default: {},
}));

await jest.unstable_mockModule("../src/model/programmes.model.js", () => ({
  assurerProgrammeReference: assurerProgrammeReferenceMock,
}));

await jest.unstable_mockModule("../src/model/professeurs.model.js", () => ({
  assurerUniciteNomPrenomProfesseurs: assurerUniciteNomPrenomProfesseursMock,
  fusionnerDoublonsProfesseurs: fusionnerDoublonsProfesseursMock,
  nettoyerAffectationsCoursArchivesProfesseurs: jest.fn(async () => 0),
}));

const { SchedulerDataBootstrap } = await import(
  "../src/services/scheduler/SchedulerDataBootstrap.js"
);

describe("SchedulerDataBootstrap orchestration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("_ensureSession reutilise la session active existante", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue([
        [
          {
            id_session: 3,
            nom: "Automne 2026",
            date_debut: "2026-09-01",
            date_fin: "2026-12-31",
          },
        ],
      ]),
    };
    const report = { created: { sessions: 0 }, details: [] };

    const session = await SchedulerDataBootstrap._ensureSession(executor, report);

    expect(session.id_session).toBe(3);
    expect(report.created.sessions).toBe(0);
    expect(executor.query).toHaveBeenCalledTimes(1);
  });

  test("_ensureSession cree une session active par defaut si aucune n'existe", async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 8 }]),
    };
    const report = { created: { sessions: 0 }, details: [] };

    const session = await SchedulerDataBootstrap._ensureSession(executor, report);

    expect(session).toMatchObject({
      id_session: 8,
      nom: "Automne 2026",
      date_debut: "2026-09-01",
    });
    expect(report.created.sessions).toBe(1);
    expect(report.details[0]).toContain("Session active");
  });

  test("_ensureProgramReferences incremente le rapport pour les programmes ajoutes", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue([[]]),
    };
    const report = {
      created: { programmes_reference: 0 },
      details: [],
    };

    await SchedulerDataBootstrap._ensureProgramReferences(executor, report);

    expect(report.created.programmes_reference).toBeGreaterThan(0);
    expect(report.details[0]).toContain("programme(s) de reference");
    expect(assurerProgrammeReferenceMock).toHaveBeenCalled();
  });

  test("_ensureRooms cree toutes les salles absentes", async () => {
    const executor = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes("SELECT id_salle, type, capacite")) {
          return [[]];
        }

        if (String(sql).includes("INSERT INTO salles")) {
          return [{ insertId: 1 }];
        }

        throw new Error(`SQL inattendu: ${sql}`);
      }),
    };
    const report = {
      created: { salles: 0 },
      updated: { salles: 0 },
    };

    await SchedulerDataBootstrap._ensureRooms(executor, report);

    expect(report.created.salles).toBeGreaterThan(0);
    expect(report.updated.salles).toBe(0);
  });

  test("_ensureCourses cree les cours absents", async () => {
    const executor = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes("SELECT id_cours")) {
          return [[]];
        }

        if (String(sql).includes("INSERT INTO cours")) {
          return [{ insertId: 1 }];
        }

        throw new Error(`SQL inattendu: ${sql}`);
      }),
    };
    const report = {
      created: { cours: 0 },
      updated: { cours: 0 },
    };

    await SchedulerDataBootstrap._ensureCourses(
      executor,
      [{ id_salle: 5, code: "LAB201", type: "Laboratoire", capacite: 30 }],
      report
    );

    expect(report.created.cours).toBeGreaterThan(0);
    expect(report.updated.cours).toBe(0);
  });

  test("_ensureProfesseurs cree puis met a jour selon matricule ou identite", async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([[{ id_professeur: 9 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]),
    };
    const report = {
      created: { professeurs: 0 },
      updated: { professeurs: 0 },
    };

    await SchedulerDataBootstrap._ensureProfesseurs(
      executor,
      [
        {
          matricule: "AUTO-P-1",
          nom: "Diallo",
          prenom: "Aya",
          specialite: "INF",
        },
        {
          matricule: "AUTO-P-2",
          nom: "Benali",
          prenom: "Youssef",
          specialite: "INF",
        },
      ],
      report
    );

    expect(report.created.professeurs).toBe(1);
    expect(report.updated.professeurs).toBe(1);
  });

  test("_cleanupBootstrapProfesseurs supprime les professeurs bootstrap obsoletes", async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          [
            { id_professeur: 10, matricule: "AUTO-OLD-1" },
            { id_professeur: 11, matricule: "AUTO-KEEP-1" },
          ],
        ])
        .mockResolvedValueOnce([
          [{ id_affectation_cours: 7, id_plage_horaires: 8 }],
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }]),
    };
    const report = {
      cleaned: { professeurs: 0 },
      details: [],
    };

    await SchedulerDataBootstrap._cleanupBootstrapProfesseurs(
      executor,
      [{ matricule: "AUTO-KEEP-1" }],
      report
    );

    expect(report.cleaned.professeurs).toBe(1);
    expect(report.details[0]).toContain("bootstrap obsoletes");
  });

  test("_ensureProfessorAssignments remplace les affectations d'un professeur bootstrap", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
    };
    const report = {
      created: { professeur_cours: 0 },
    };

    await SchedulerDataBootstrap._ensureProfessorAssignments(
      executor,
      [
        { id_cours: 1, code: "INF101" },
        { id_cours: 2, code: "INF102" },
      ],
      [{ id_professeur: 10, nom: "Diallo", prenom: "Aya" }],
      [
        {
          nom: "Diallo",
          prenom: "Aya",
          assignedCourseCodes: ["INF101", "INCONNU"],
        },
      ],
      report
    );

    expect(report.created.professeur_cours).toBe(1);
    expect(executor.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM professeur_cours"),
      [10]
    );
  });

  test("_ensureProfessorAvailability injecte les disponibilites si aucune n'existe", async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValue([{ insertId: 1 }]),
    };
    const report = {
      created: { disponibilites: 0 },
    };

    await SchedulerDataBootstrap._ensureProfessorAvailability(
      executor,
      [{ id_professeur: 10, nom: "Diallo", prenom: "Aya" }],
      [{ nom: "Diallo", prenom: "Aya" }],
      { date_debut: "2026-09-01", date_fin: "2026-12-31" },
      report
    );

    expect(report.created.disponibilites).toBeGreaterThan(0);
  });

  test("_ensureBootstrapGroup reutilise un groupe source existant", async () => {
    const report = { created: { groupes_sources: 0 }, details: [] };
    const programme = "Programmation informatique";
    const nomAttendu = `SRC-${programme.slice(0, 24)}-E1`;

    const id = await SchedulerDataBootstrap._ensureBootstrapGroup(
      { query: jest.fn() },
      [
        {
          id_groupes_etudiants: 77,
          nom_groupe: nomAttendu,
          id_session: 4,
        },
      ],
      { id_session: 4 },
      { programme, etape: 1 },
      report
    );

    expect(id).toBe(77);
    expect(report.created.groupes_sources).toBe(0);
  });

  test("_ensureRooms cree ou met a jour les salles du catalogue", async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([[{ id_salle: 9, type: "Classe", capacite: 10 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]),
    };
    const report = {
      created: { salles: 0 },
      updated: { salles: 0 },
    };

    const firstRoom = { code: "A-101", type: "Classe", capacite: 30 };
    const secondRoom = { code: "B-202", type: "Laboratoire", capacite: 24 };
    const roomCatalogSpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureRooms")
      .mockImplementationOnce(async (_executor, currentReport) => {
        for (const room of [firstRoom, secondRoom]) {
          const [existing] = await _executor.query(
            `SELECT id_salle, type, capacite
         FROM salles
         WHERE code = ?
         LIMIT 1`,
            [room.code]
          );

          if (existing.length === 0) {
            await _executor.query(
              `INSERT INTO salles (code, type, capacite)
           VALUES (?, ?, ?)`,
              [room.code, room.type, room.capacite]
            );
            currentReport.created.salles += 1;
          } else {
            await _executor.query(
              `UPDATE salles
         SET type = ?, capacite = ?
         WHERE id_salle = ?`,
              [room.type, room.capacite, existing[0].id_salle]
            );
            currentReport.updated.salles += 1;
          }
        }
      });

    try {
      await SchedulerDataBootstrap._ensureRooms(executor, report);
    } finally {
      roomCatalogSpy.mockRestore();
    }

    expect(report.created.salles).toBe(1);
    expect(report.updated.salles).toBe(1);
  });

  test("_mergeDuplicateProfesseurs ajoute un detail quand une fusion a eu lieu", async () => {
    fusionnerDoublonsProfesseursMock.mockResolvedValueOnce({
      professeursFusionnes: 3,
      groupesFusionnes: 2,
    });
    const report = {
      cleaned: { professeurs: 0 },
      details: [],
    };

    await SchedulerDataBootstrap._mergeDuplicateProfesseurs({}, report);

    expect(report.cleaned.professeurs).toBe(3);
    expect(report.details[0]).toContain("3 professeur(s) dupliques fusionne(s)");
  });

  test("ensureOperationalDataset orchestre le bootstrap complet et enrichit le rapport", async () => {
    const executor = {};
    const session = {
      id_session: 4,
      nom: "Automne 2026",
      date_debut: "2026-09-01",
      date_fin: "2026-12-31",
    };
    const requiredGroupsByProgram = new Map([["Programmation informatique|1", 5]]);

    const ensureSessionSpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureSession")
      .mockResolvedValue(session);
    const ensureProfessorCourseTableSpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureProfessorCourseTable")
      .mockResolvedValue();
    const ensureProfessorAvailabilityTableSpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureProfessorAvailabilityTable")
      .mockResolvedValue();
    const ensureProgramReferencesSpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureProgramReferences")
      .mockResolvedValue();
    const ensureRoomsSpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureRooms")
      .mockResolvedValue();
    const loadSallesSpy = jest
      .spyOn(SchedulerDataBootstrap, "_loadSalles")
      .mockResolvedValue([{ id_salle: 1, code: "A-101", type: "Classe", capacite: 30 }]);
    const ensureCoursesSpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureCourses")
      .mockResolvedValue();
    const loadEtudiantsSpy = jest
      .spyOn(SchedulerDataBootstrap, "_loadEtudiants")
      .mockResolvedValueOnce([{ id_etudiant: 1, programme: "INF", etape: 1, session: "Automne" }])
      .mockResolvedValueOnce([{ id_etudiant: 1, programme: "INF", etape: 1, session: "Automne" }]);
    const loadGroupesSpy = jest
      .spyOn(SchedulerDataBootstrap, "_loadGroupes")
      .mockResolvedValueOnce([{ id_groupes_etudiants: 1, nom_groupe: "G-INF-01" }])
      .mockResolvedValueOnce([{ id_groupes_etudiants: 1, nom_groupe: "G-INF-01" }]);
    const buildRequiredGroupsSpy = jest
      .spyOn(SchedulerDataBootstrap, "_buildRequiredGroupsByProgram")
      .mockReturnValue(requiredGroupsByProgram);
    const peutInjecterSpy = jest
      .spyOn(SchedulerDataBootstrap, "_peutInjecterEtudiantsBootstrap")
      .mockReturnValue(false);
    const mergeDuplicateSpy = jest
      .spyOn(SchedulerDataBootstrap, "_mergeDuplicateProfesseurs")
      .mockResolvedValue();
    const loadProfesseursSpy = jest
      .spyOn(SchedulerDataBootstrap, "_loadProfesseurs")
      .mockResolvedValueOnce([{ id_professeur: 1, matricule: "P-1" }])
      .mockResolvedValueOnce([{ id_professeur: 1, matricule: "P-1" }]);
    const loadReserveSpy = jest
      .spyOn(SchedulerDataBootstrap, "_loadReserveCourseDemands")
      .mockResolvedValue([{ code: "INF101", programme: "Programmation informatique", load: 1 }]);
    const cleanupBootstrapSpy = jest
      .spyOn(SchedulerDataBootstrap, "_cleanupBootstrapProfesseurs")
      .mockResolvedValue();
    const ensureProfesseursSpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureProfesseurs")
      .mockResolvedValue();
    const loadCoursSpy = jest
      .spyOn(SchedulerDataBootstrap, "_loadCours")
      .mockResolvedValue([{ id_cours: 1, code: "INF101" }]);
    const ensureProfessorAssignmentsSpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureProfessorAssignments")
      .mockResolvedValue();
    const ensureProfessorAvailabilitySpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureProfessorAvailability")
      .mockResolvedValue();
    const ensureStudentsForTargetsSpy = jest
      .spyOn(SchedulerDataBootstrap, "_ensureStudentsForTargets")
      .mockResolvedValue();
    const archiveSurplusCoursesSpy = jest
      .spyOn(SchedulerDataBootstrap, "_archiveSurplusCourses")
      .mockResolvedValue();
    const cleanupArchivedProfessorCoursesSpy = jest
      .spyOn(SchedulerDataBootstrap, "_cleanupArchivedProfessorCourses")
      .mockResolvedValue();
    const cleanupUnusedProgramReferencesSpy = jest
      .spyOn(SchedulerDataBootstrap, "_cleanupUnusedProgramReferences")
      .mockResolvedValue();

    try {
      const report = await SchedulerDataBootstrap.ensureOperationalDataset({
        executor,
      });

      expect(ensureSessionSpy).toHaveBeenCalledWith(executor, expect.any(Object));
      expect(ensureProfessorCourseTableSpy).toHaveBeenCalledWith(executor);
      expect(ensureProfessorAvailabilityTableSpy).toHaveBeenCalledWith(executor);
      expect(ensureProgramReferencesSpy).toHaveBeenCalled();
      expect(ensureRoomsSpy).toHaveBeenCalled();
      expect(ensureCoursesSpy).toHaveBeenCalled();
      expect(buildRequiredGroupsSpy).toHaveBeenCalled();
      expect(mergeDuplicateSpy).toHaveBeenCalled();
      expect(cleanupBootstrapSpy).toHaveBeenCalled();
      expect(ensureProfesseursSpy).toHaveBeenCalled();
      expect(assurerUniciteNomPrenomProfesseursMock).toHaveBeenCalledWith(executor);
      expect(ensureProfessorAssignmentsSpy).toHaveBeenCalled();
      expect(ensureProfessorAvailabilitySpy).toHaveBeenCalled();
      expect(ensureStudentsForTargetsSpy).toHaveBeenCalledWith(
        executor,
        expect.any(Array),
        expect.any(Array),
        session,
        expect.objectContaining({ saison: "Automne", annee: 2026 }),
        expect.any(Object),
        { allowSyntheticStudents: false }
      );
      expect(archiveSurplusCoursesSpy).toHaveBeenCalled();
      expect(cleanupArchivedProfessorCoursesSpy).toHaveBeenCalled();
      expect(cleanupUnusedProgramReferencesSpy).toHaveBeenCalled();
      expect(report.details.some((detail) => detail.includes("Jeu d'etudiants existant detecte"))).toBe(true);
      expect(report.details.some((detail) => detail.includes("Reserve professeurs derivee du dernier rapport"))).toBe(true);
    } finally {
      ensureSessionSpy.mockRestore();
      ensureProfessorCourseTableSpy.mockRestore();
      ensureProfessorAvailabilityTableSpy.mockRestore();
      ensureProgramReferencesSpy.mockRestore();
      ensureRoomsSpy.mockRestore();
      loadSallesSpy.mockRestore();
      ensureCoursesSpy.mockRestore();
      loadEtudiantsSpy.mockRestore();
      loadGroupesSpy.mockRestore();
      buildRequiredGroupsSpy.mockRestore();
      peutInjecterSpy.mockRestore();
      mergeDuplicateSpy.mockRestore();
      loadProfesseursSpy.mockRestore();
      loadReserveSpy.mockRestore();
      cleanupBootstrapSpy.mockRestore();
      ensureProfesseursSpy.mockRestore();
      loadCoursSpy.mockRestore();
      ensureProfessorAssignmentsSpy.mockRestore();
      ensureProfessorAvailabilitySpy.mockRestore();
      ensureStudentsForTargetsSpy.mockRestore();
      archiveSurplusCoursesSpy.mockRestore();
      cleanupArchivedProfessorCoursesSpy.mockRestore();
      cleanupUnusedProgramReferencesSpy.mockRestore();
    }
  });
});
