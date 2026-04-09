import { afterEach, describe, expect, test } from "@jest/globals";
import { ConstraintMatrix } from "../src/services/scheduler/ConstraintMatrix.js";
import { FailedCourseEngine } from "../src/services/scheduler/FailedCourseEngine.js";

describe("FailedCourseEngine", () => {
  afterEach(() => {
    delete process.env.ENABLE_ONLINE_COURSES;
  });

  test("rattache un cours echoue a un groupe reel compatible et stable", () => {
    const matrix = new ConstraintMatrix();
    const idEtudiant = 501;

    matrix.reserverEtudiants([idEtudiant], "2026-09-07", "08:00:00", "11:00:00");
    matrix.reserverEtudiants([idEtudiant], "2026-09-14", "08:00:00", "11:00:00");

    const resultat = FailedCourseEngine.rattacherCoursEchoues({
      echouesParEtudiant: new Map([
        [
          idEtudiant,
          [
            {
              id: 9001,
              id_etudiant: idEtudiant,
              id_cours: 77,
            },
          ],
        ],
      ]),
      cours: [
        {
          id_cours: 77,
          code: "INF107",
          nom: "Projet integre en programmation I",
          max_etudiants_par_groupe: 24,
          est_en_ligne: 0,
        },
      ],
      groupesFormes: [
        { nomGroupe: "GPI-E1-1", etudiants: Array.from({ length: 20 }, (_, index) => index + 1) },
        { nomGroupe: "GPI-E1-2", etudiants: Array.from({ length: 18 }, (_, index) => index + 101) },
      ],
      placementsPlanifies: [
        {
          id_cours: 77,
          code_cours: "INF107",
          nom_cours: "Projet integre en programmation I",
          id_groupe: 10,
          nom_groupe: "GPI-E1-1",
          date: "2026-09-07",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 77,
          code_cours: "INF107",
          nom_cours: "Projet integre en programmation I",
          id_groupe: 10,
          nom_groupe: "GPI-E1-1",
          date: "2026-09-14",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 77,
          code_cours: "INF107",
          nom_cours: "Projet integre en programmation I",
          id_groupe: 11,
          nom_groupe: "GPI-E1-2",
          date: "2026-09-08",
          heure_debut: "14:00:00",
          heure_fin: "17:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 77,
          code_cours: "INF107",
          nom_cours: "Projet integre en programmation I",
          id_groupe: 11,
          nom_groupe: "GPI-E1-2",
          date: "2026-09-15",
          heure_debut: "14:00:00",
          heure_fin: "17:00:00",
          est_en_ligne: false,
        },
      ],
      matrix,
      activerCoursEnLigne: false,
    });

    expect(resultat.conflits).toHaveLength(0);
    expect(resultat.affectations).toEqual([
      expect.objectContaining({
        id_cours_echoue: 9001,
        id_etudiant: idEtudiant,
        id_cours: 77,
        id_groupe: 11,
        nom_groupe: "GPI-E1-2",
        nb_seances: 2,
      }),
    ]);
    expect(matrix.etudiantsLibres([idEtudiant], "2026-09-08", "14:00:00", "17:00:00")).toBe(false);
  });

  test("remonte un conflit explicite quand aucun groupe reel n'est compatible", () => {
    const matrix = new ConstraintMatrix();
    const idEtudiant = 601;

    matrix.reserverEtudiants([idEtudiant], "2026-10-06", "08:00:00", "11:00:00");
    matrix.reserverEtudiants([idEtudiant], "2026-10-13", "08:00:00", "11:00:00");

    const resultat = FailedCourseEngine.rattacherCoursEchoues({
      echouesParEtudiant: new Map([
        [
          idEtudiant,
          [
            {
              id: 9101,
              id_etudiant: idEtudiant,
              id_cours: 88,
            },
          ],
        ],
      ]),
      cours: [
        {
          id_cours: 88,
          code: "SIA205",
          nom: "Collecte et interpretation des donnees cliniques",
          max_etudiants_par_groupe: 16,
          est_en_ligne: 0,
        },
      ],
      groupesFormes: [{ nomGroupe: "SIA-E2-1", etudiants: Array.from({ length: 12 }, (_, index) => index + 1) }],
      placementsPlanifies: [
        {
          id_cours: 88,
          code_cours: "SIA205",
          nom_cours: "Collecte et interpretation des donnees cliniques",
          id_groupe: 21,
          nom_groupe: "SIA-E2-1",
          date: "2026-10-06",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 88,
          code_cours: "SIA205",
          nom_cours: "Collecte et interpretation des donnees cliniques",
          id_groupe: 21,
          nom_groupe: "SIA-E2-1",
          date: "2026-10-13",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
      ],
      matrix,
      activerCoursEnLigne: false,
    });

    expect(resultat.affectations).toHaveLength(0);
    expect(resultat.conflits).toEqual([
      expect.objectContaining({
        id_cours_echoue: 9101,
        raison_code: "CONFLIT_HORAIRE",
      }),
    ]);
    expect(resultat.conflits[0].raison).toContain("Aucun groupe compatible");
  });

  test("respecte le flag de reactivation des cours en ligne", () => {
    const demande = {
      echouesParEtudiant: new Map([
        [
          701,
          [
            {
              id: 9201,
              id_etudiant: 701,
              id_cours: 99,
            },
          ],
        ],
      ]),
      cours: [
        {
          id_cours: 99,
          code: "WEB301",
          nom: "Integration distante",
          max_etudiants_par_groupe: 18,
          est_en_ligne: 1,
        },
      ],
      groupesFormes: [{ nomGroupe: "WEB-E3-1", etudiants: Array.from({ length: 10 }, (_, index) => index + 1) }],
      placementsPlanifies: [
        {
          id_cours: 99,
          code_cours: "WEB301",
          nom_cours: "Integration distante",
          id_groupe: 31,
          nom_groupe: "WEB-E3-1",
          date: "2026-11-03",
          heure_debut: "12:00:00",
          heure_fin: "15:00:00",
          est_en_ligne: true,
        },
      ],
      matrix: new ConstraintMatrix(),
    };

    const resultatDesactive = FailedCourseEngine.rattacherCoursEchoues({
      ...demande,
      activerCoursEnLigne: false,
    });
    const resultatActive = FailedCourseEngine.rattacherCoursEchoues({
      ...demande,
      activerCoursEnLigne: true,
    });

    expect(resultatDesactive.affectations).toHaveLength(0);
    expect(resultatDesactive.conflits).toEqual([
      expect.objectContaining({
        id_cours_echoue: 9201,
        raison_code: "COURS_EN_LIGNE_DESACTIVE",
      }),
    ]);
    expect(resultatActive.conflits).toHaveLength(0);
    expect(resultatActive.affectations).toEqual([
      expect.objectContaining({
        id_cours_echoue: 9201,
        id_groupe: 31,
        nom_groupe: "WEB-E3-1",
      }),
    ]);
  });

  test("autorise un rattachement jusqu'a la capacite operationnelle de 30 meme si le catalogue historique indique 28", () => {
    const resultat = FailedCourseEngine.rattacherCoursEchoues({
      echouesParEtudiant: new Map([
        [
          801,
          [
            {
              id: 9301,
              id_etudiant: 801,
              id_cours: 111,
            },
          ],
        ],
      ]),
      cours: [
        {
          id_cours: 111,
          code: "INF201",
          nom: "Programmation orientee objet",
          max_etudiants_par_groupe: 28,
          est_en_ligne: 0,
        },
      ],
      groupesFormes: [
        {
          nomGroupe: "GPI-E2-1",
          etudiants: Array.from({ length: 28 }, (_, index) => index + 1),
        },
      ],
      placementsPlanifies: [
        {
          id_cours: 111,
          code_cours: "INF201",
          nom_cours: "Programmation orientee objet",
          id_groupe: 41,
          nom_groupe: "GPI-E2-1",
          date: "2026-09-10",
          heure_debut: "11:00:00",
          heure_fin: "14:00:00",
          est_en_ligne: false,
        },
      ],
      matrix: new ConstraintMatrix(),
      activerCoursEnLigne: false,
    });

    expect(resultat.conflits).toHaveLength(0);
    expect(resultat.affectations).toEqual([
      expect.objectContaining({
        id_cours_echoue: 9301,
        id_groupe: 41,
        nom_groupe: "GPI-E2-1",
      }),
    ]);
  });
});
