import { afterEach, describe, expect, test } from "@jest/globals";
import { ConstraintMatrix } from "../src/services/scheduler/ConstraintMatrix.js";
import { FailedCourseEngine } from "../src/services/scheduler/FailedCourseEngine.js";

describe("FailedCourseEngine", () => {
  afterEach(() => {
    delete process.env.ENABLE_ONLINE_COURSES;
    delete process.env.FAILED_COURSE_RECOVERY_GROUP_THRESHOLD;
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

  test("bascule intelligemment un etudiant vers un groupe parallele quand le transfert debloque la reprise", () => {
    const matrix = new ConstraintMatrix();
    const idEtudiant = 901;

    matrix.reserverEtudiants([idEtudiant], "2026-09-08", "08:00:00", "11:00:00");
    matrix.reserverEtudiants([idEtudiant], "2026-09-15", "08:00:00", "11:00:00");

    const affectationsEtudiantGroupe = new Map([[idEtudiant, ["GPI-E4-1"]]]);
    const groupesFormes = [
      {
        nomGroupe: "GPI-E4-1",
        programme: "Programmation informatique",
        etape: 4,
        taille_max: 30,
        effectif_regulier: 24,
        effectif_projete_max: 24,
        charge_estimee_par_cours: { "410": 24 },
        etudiants: [idEtudiant],
      },
      {
        nomGroupe: "GPI-E4-2",
        programme: "Programmation informatique",
        etape: 4,
        taille_max: 30,
        effectif_regulier: 22,
        effectif_projete_max: 22,
        charge_estimee_par_cours: { "411": 22 },
        etudiants: [],
      },
      {
        nomGroupe: "GPI-E3-1",
        programme: "Programmation informatique",
        etape: 3,
        taille_max: 30,
        effectif_regulier: 20,
        effectif_projete_max: 20,
        charge_estimee_par_cours: { "501": 20 },
        etudiants: Array.from({ length: 20 }, (_, index) => index + 1000),
      },
    ];

    const resultat = FailedCourseEngine.rattacherCoursEchoues({
      echouesParEtudiant: new Map([
        [
          idEtudiant,
          [
            {
              id: 9401,
              id_etudiant: idEtudiant,
              id_cours: 501,
            },
          ],
        ],
      ]),
      cours: [
        {
          id_cours: 501,
          code: "INF307",
          nom: "Projet legacy",
          programme: "Programmation informatique",
          etape_etude: 3,
          type_salle: "Laboratoire",
          max_etudiants_par_groupe: 30,
          est_en_ligne: 0,
          sessions_par_semaine: 1,
        },
      ],
      etudiants: [
        {
          id_etudiant: idEtudiant,
          matricule: "MAT-901",
          nom: "Dupont",
          prenom: "Ariane",
        },
      ],
      groupesFormes,
      affectationsEtudiantGroupe,
      placementsPlanifies: [
        {
          id_cours: 410,
          code_cours: "INF410",
          nom_cours: "Architecture logicielle",
          id_groupe: 41,
          nom_groupe: "GPI-E4-1",
          id_professeur: 1,
          id_salle: 10,
          date: "2026-09-08",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 410,
          code_cours: "INF410",
          nom_cours: "Architecture logicielle",
          id_groupe: 41,
          nom_groupe: "GPI-E4-1",
          id_professeur: 1,
          id_salle: 10,
          date: "2026-09-15",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 411,
          code_cours: "INF411",
          nom_cours: "Performance applicative",
          id_groupe: 42,
          nom_groupe: "GPI-E4-2",
          id_professeur: 2,
          id_salle: 11,
          date: "2026-09-08",
          heure_debut: "13:00:00",
          heure_fin: "16:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 411,
          code_cours: "INF411",
          nom_cours: "Performance applicative",
          id_groupe: 42,
          nom_groupe: "GPI-E4-2",
          id_professeur: 2,
          id_salle: 11,
          date: "2026-09-15",
          heure_debut: "13:00:00",
          heure_fin: "16:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 501,
          code_cours: "INF307",
          nom_cours: "Projet legacy",
          id_groupe: 31,
          nom_groupe: "GPI-E3-1",
          id_professeur: 3,
          id_salle: 12,
          date: "2026-09-08",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 501,
          code_cours: "INF307",
          nom_cours: "Projet legacy",
          id_groupe: 31,
          nom_groupe: "GPI-E3-1",
          id_professeur: 3,
          id_salle: 12,
          date: "2026-09-15",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
      ],
      matrix,
      activerCoursEnLigne: false,
    });

    expect(resultat.conflits).toHaveLength(0);
    expect(resultat.affectations).toEqual([
      expect.objectContaining({
        id_cours_echoue: 9401,
        id_groupe: 31,
        nom_groupe: "GPI-E3-1",
      }),
    ]);
    expect(resultat.transfertsGlobaux).toEqual([
      expect.objectContaining({
        id_etudiant: idEtudiant,
        groupe_source: "GPI-E4-1",
        groupe_cible: "GPI-E4-2",
      }),
    ]);
    expect(affectationsEtudiantGroupe.get(idEtudiant)).toEqual(["GPI-E4-2"]);
  });

  test("utilise en dernier recours un deplacement cible de cours regulier vers un groupe frere", () => {
    const matrix = new ConstraintMatrix();
    const idEtudiant = 9901;

    matrix.reserverEtudiants([idEtudiant], "2026-09-07", "08:00:00", "11:00:00");
    matrix.reserverEtudiants([idEtudiant], "2026-09-14", "08:00:00", "11:00:00");
    matrix.reserverEtudiants([idEtudiant], "2026-09-08", "08:00:00", "11:00:00");
    matrix.reserverEtudiants([idEtudiant], "2026-09-15", "08:00:00", "11:00:00");

    const affectationsEtudiantGroupe = new Map([[idEtudiant, ["GPI-E2-1"]]]);
    const groupesFormes = [
      {
        nomGroupe: "GPI-E2-1",
        programme: "Programmation informatique",
        etape: 2,
        taille_max: 30,
        effectif_regulier: 20,
        effectif_projete_max: 20,
        charge_estimee_par_cours: { "210": 20, "220": 20 },
        etudiants: [idEtudiant],
      },
      {
        nomGroupe: "GPI-E2-2",
        programme: "Programmation informatique",
        etape: 2,
        taille_max: 30,
        effectif_regulier: 18,
        effectif_projete_max: 18,
        charge_estimee_par_cours: { "210": 18, "220": 18 },
        etudiants: Array.from({ length: 18 }, (_, index) => index + 200),
      },
      {
        nomGroupe: "GPI-E1-1",
        programme: "Programmation informatique",
        etape: 1,
        taille_max: 30,
        effectif_regulier: 16,
        effectif_projete_max: 16,
        charge_estimee_par_cours: { "999": 16 },
        etudiants: Array.from({ length: 16 }, (_, index) => index + 500),
      },
    ];

    const resultat = FailedCourseEngine.rattacherCoursEchoues({
      echouesParEtudiant: new Map([
        [
          idEtudiant,
          [
            {
              id: 99001,
              id_etudiant: idEtudiant,
              id_cours: 999,
            },
          ],
        ],
      ]),
      cours: [
        {
          id_cours: 999,
          code: "MAT999",
          nom: "Atelier de reprise",
          programme: "Programmation informatique",
          etape_etude: 1,
          type_salle: "Laboratoire",
          max_etudiants_par_groupe: 30,
          est_en_ligne: 0,
          sessions_par_semaine: 1,
        },
      ],
      etudiants: [
        {
          id_etudiant: idEtudiant,
          matricule: "MAT-9901",
          nom: "Tremblay",
          prenom: "Nora",
        },
      ],
      groupesFormes,
      affectationsEtudiantGroupe,
      placementsPlanifies: [
        {
          id_cours: 210,
          code_cours: "INF210",
          nom_cours: "Algorithmique",
          id_groupe: 201,
          nom_groupe: "GPI-E2-1",
          id_professeur: 1,
          id_salle: 11,
          date: "2026-09-07",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 210,
          code_cours: "INF210",
          nom_cours: "Algorithmique",
          id_groupe: 201,
          nom_groupe: "GPI-E2-1",
          id_professeur: 1,
          id_salle: 11,
          date: "2026-09-14",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 220,
          code_cours: "INF220",
          nom_cours: "Modelisation",
          id_groupe: 201,
          nom_groupe: "GPI-E2-1",
          id_professeur: 2,
          id_salle: 12,
          date: "2026-09-08",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 220,
          code_cours: "INF220",
          nom_cours: "Modelisation",
          id_groupe: 201,
          nom_groupe: "GPI-E2-1",
          id_professeur: 2,
          id_salle: 12,
          date: "2026-09-15",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 210,
          code_cours: "INF210",
          nom_cours: "Algorithmique",
          id_groupe: 202,
          nom_groupe: "GPI-E2-2",
          id_professeur: 3,
          id_salle: 13,
          date: "2026-09-07",
          heure_debut: "13:00:00",
          heure_fin: "16:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 210,
          code_cours: "INF210",
          nom_cours: "Algorithmique",
          id_groupe: 202,
          nom_groupe: "GPI-E2-2",
          id_professeur: 3,
          id_salle: 13,
          date: "2026-09-14",
          heure_debut: "13:00:00",
          heure_fin: "16:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 220,
          code_cours: "INF220",
          nom_cours: "Modelisation",
          id_groupe: 202,
          nom_groupe: "GPI-E2-2",
          id_professeur: 4,
          id_salle: 14,
          date: "2026-09-07",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 220,
          code_cours: "INF220",
          nom_cours: "Modelisation",
          id_groupe: 202,
          nom_groupe: "GPI-E2-2",
          id_professeur: 4,
          id_salle: 14,
          date: "2026-09-14",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 999,
          code_cours: "MAT999",
          nom_cours: "Atelier de reprise",
          id_groupe: 101,
          nom_groupe: "GPI-E1-1",
          id_professeur: 5,
          id_salle: 15,
          date: "2026-09-07",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
        {
          id_cours: 999,
          code_cours: "MAT999",
          nom_cours: "Atelier de reprise",
          id_groupe: 101,
          nom_groupe: "GPI-E1-1",
          id_professeur: 5,
          id_salle: 15,
          date: "2026-09-14",
          heure_debut: "08:00:00",
          heure_fin: "11:00:00",
          est_en_ligne: false,
        },
      ],
      matrix,
      salles: [
        { id_salle: 11, code: "LAB-11", type: "Laboratoire", capacite: 30 },
        { id_salle: 12, code: "LAB-12", type: "Laboratoire", capacite: 30 },
        { id_salle: 13, code: "LAB-13", type: "Laboratoire", capacite: 30 },
        { id_salle: 14, code: "LAB-14", type: "Laboratoire", capacite: 30 },
        { id_salle: 15, code: "LAB-15", type: "Laboratoire", capacite: 30 },
      ],
      activerCoursEnLigne: false,
    });

    expect(resultat.conflits).toHaveLength(0);
    expect(resultat.transfertsGlobaux).toHaveLength(0);
    expect(resultat.affectations).toEqual([
      expect.objectContaining({
        id_cours_echoue: 99001,
        id_groupe: 101,
        nom_groupe: "GPI-E1-1",
      }),
    ]);
    expect(resultat.affectationsIndividuelles).toEqual([
      expect.objectContaining({
        id_etudiant: idEtudiant,
        id_cours: 210,
        id_groupe: 202,
        nom_groupe: "GPI-E2-2",
        source_type: "individuelle",
      }),
    ]);
    expect(resultat.stats.cours_reguliers_deplaces).toBe(1);
    expect(
      resultat.debug.etudiants[0]?.cours_reguliers_deplaces?.map((item) => item.code_cours)
    ).toEqual(["INF210"]);
    expect(affectationsEtudiantGroupe.get(idEtudiant)).toEqual(["GPI-E2-1"]);
  });

  test("cree automatiquement un groupe de reprise dedie quand le seuil est atteint", () => {
    const matrix = new ConstraintMatrix();
    const etudiants = Array.from({ length: 10 }, (_, index) => ({
      id_etudiant: 950 + index,
      matricule: `MAT-${950 + index}`,
      nom: `Nom${index}`,
      prenom: `Prenom${index}`,
    }));
    const affectationsEtudiantGroupe = new Map(
      etudiants.map((etudiant) => [etudiant.id_etudiant, ["GPI-E4-1"]])
    );

    const resultat = FailedCourseEngine.rattacherCoursEchoues({
      echouesParEtudiant: new Map(
        etudiants.map((etudiant, index) => [
          etudiant.id_etudiant,
          index === 0
            ? [
                {
                  id: 9600 + index,
                  id_etudiant: etudiant.id_etudiant,
                  id_cours: 777,
                },
                {
                  id: 9800 + index,
                  id_etudiant: etudiant.id_etudiant,
                  id_cours: 777,
                },
              ]
            : [
                {
                  id: 9600 + index,
                  id_etudiant: etudiant.id_etudiant,
                  id_cours: 777,
                },
              ],
        ])
      ),
      cours: [
        {
          id_cours: 777,
          code: "INF777",
          nom: "Reprise avancee",
          programme: "Programmation informatique",
          etape_etude: 3,
          type_salle: "Laboratoire",
          max_etudiants_par_groupe: 30,
          est_en_ligne: 0,
          sessions_par_semaine: 1,
          cours_ids: [777],
        },
      ],
      etudiants,
      groupesFormes: [
        {
          nomGroupe: "GPI-E4-1",
          programme: "Programmation informatique",
          etape: 4,
          taille_max: 30,
          effectif_regulier: 25,
          effectif_projete_max: 25,
          charge_estimee_par_cours: {},
          etudiants: etudiants.map((etudiant) => etudiant.id_etudiant),
        },
      ],
      affectationsEtudiantGroupe,
      placementsPlanifies: [],
      matrix,
      professeurs: [
        {
          id_professeur: 71,
          matricule: "P-71",
          nom: "Martin",
          prenom: "Lina",
          cours_ids: [777],
        },
      ],
      salles: [
        {
          id_salle: 81,
          code: "LAB-81",
          type: "Laboratoire",
          capacite: 20,
        },
      ],
      datesParJourSemaine: new Map([[2, ["2026-09-08", "2026-09-15"]]]),
      dispParProf: new Map(),
      absencesParProf: new Map(),
      indispoParSalle: new Map(),
      activerCoursEnLigne: false,
    });

    expect(resultat.conflits).toHaveLength(0);
    expect(resultat.groupesGeneres).toHaveLength(1);
    expect(resultat.placementsGeneres).not.toHaveLength(0);
    expect(resultat.affectations).toHaveLength(10);
    expect(resultat.affectations.every((item) => item.niveau_resolution === "GROUPE_REPRISE")).toBe(true);
    expect(resultat.groupesGeneres[0]).toEqual(
      expect.objectContaining({
        nomGroupe: "REPRISE-INF777-01",
        est_groupe_reprise: true,
        etudiants: etudiants.map((etudiant) => etudiant.id_etudiant),
        etudiants_en_reprise: etudiants.map((etudiant) => etudiant.id_etudiant),
      })
    );
  });

  test("ne cree pas de groupe de reprise sous le seuil et reste sur la logique individuelle", () => {
    const matrix = new ConstraintMatrix();
    const etudiants = Array.from({ length: 9 }, (_, index) => ({
      id_etudiant: 1200 + index,
      matricule: `MAT-${1200 + index}`,
      nom: `Nom${index}`,
      prenom: `Prenom${index}`,
    }));

    const resultat = FailedCourseEngine.rattacherCoursEchoues({
      echouesParEtudiant: new Map(
        etudiants.map((etudiant, index) => [
          etudiant.id_etudiant,
          [
            {
              id: 1300 + index,
              id_etudiant: etudiant.id_etudiant,
              id_cours: 888,
            },
          ],
        ])
      ),
      cours: [
        {
          id_cours: 888,
          code: "INF888",
          nom: "Recuperation ciblee",
          programme: "Programmation informatique",
          etape_etude: 4,
          type_salle: "Laboratoire",
          max_etudiants_par_groupe: 30,
          est_en_ligne: 0,
          sessions_par_semaine: 1,
          cours_ids: [888],
        },
      ],
      etudiants,
      groupesFormes: [
        {
          nomGroupe: "GPI-E4-1",
          programme: "Programmation informatique",
          etape: 4,
          taille_max: 30,
          effectif_regulier: 25,
          effectif_projete_max: 25,
          charge_estimee_par_cours: {},
          etudiants: etudiants.map((etudiant) => etudiant.id_etudiant),
        },
      ],
      affectationsEtudiantGroupe: new Map(
        etudiants.map((etudiant) => [etudiant.id_etudiant, ["GPI-E4-1"]])
      ),
      placementsPlanifies: [],
      matrix,
      activerCoursEnLigne: false,
    });

    expect(resultat.groupesGeneres).toHaveLength(0);
    expect(resultat.placementsGeneres).toHaveLength(0);
    expect(resultat.affectations).toHaveLength(0);
    expect(resultat.conflits).toHaveLength(9);
    expect(
      resultat.conflits.every(
        (item) => item.tentative_groupe_reprise?.resultat === "NON_TENTEE"
      )
    ).toBe(true);
  });
});
