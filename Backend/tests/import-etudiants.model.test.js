import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const getConnectionMock = jest.fn();
const assurerProgrammeReferenceMock = jest.fn(async (programme) => programme);

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    getConnection: getConnectionMock,
  },
}));

await jest.unstable_mockModule("../src/model/programmes.model.js", () => ({
  assurerProgrammeReference: assurerProgrammeReferenceMock,
}));

const {
  enregistrerEtudiantsImportes,
  reequilibrerCohortesEtudiants,
} = await import(
  "../src/model/import-etudiants.model.js"
);

function creerConnexionImport({
  groupesExistants = [],
  etudiantsExistants = [],
  sessionsDisponibles = null,
  coursCatalogueParCode = [],
} = {}) {
  let prochainIdGroupe =
    groupesExistants.reduce(
      (maximum, groupe) => Math.max(maximum, Number(groupe.id_groupes_etudiants || 0)),
      0
    ) + 1;
  let prochainIdEtudiant =
    etudiantsExistants.reduce(
      (maximum, etudiant) => Math.max(maximum, Number(etudiant.id_etudiant || 0)),
      0
    ) + 1;
  const groupes = groupesExistants.map((groupe) => ({
    ...groupe,
    id_groupes_etudiants: Number(groupe.id_groupes_etudiants),
    taille_max: Number(groupe.taille_max || 0),
    etape: Number(groupe.etape),
    id_session:
      groupe.id_session === null || groupe.id_session === undefined
        ? null
        : Number(groupe.id_session),
  }));
  const etudiants = etudiantsExistants.map((etudiant) => ({
    ...etudiant,
    id_etudiant: Number(etudiant.id_etudiant),
    etape: Number(etudiant.etape),
    id_groupes_etudiants:
      etudiant.id_groupes_etudiants === null ||
      etudiant.id_groupes_etudiants === undefined
        ? null
        : Number(etudiant.id_groupes_etudiants),
  }));
  const groupesCrees = [];
  const etudiantsCrees = [];
  const coursEchouesCrees = [];

  const connexion = {
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    query: jest.fn(async (sql, params = []) => {
      if (
        sql.includes("SELECT nom, date_debut") &&
        sql.includes("FROM sessions") &&
        sql.includes("WHERE active = TRUE")
      ) {
        if (!Array.isArray(sessionsDisponibles)) {
          const erreur = new Error("sessions absente");
          erreur.code = "ER_NO_SUCH_TABLE";
          throw erreur;
        }

        const sessionActive = sessionsDisponibles.find((session) => session.active);
        return [[sessionActive ? {
          nom: sessionActive.nom,
          date_debut: sessionActive.date_debut,
        } : undefined].filter(Boolean)];
      }

      if (
        sql.includes("SELECT id_session, nom, date_debut, active") &&
        sql.includes("FROM sessions")
      ) {
        if (!Array.isArray(sessionsDisponibles)) {
          const erreur = new Error("sessions absente");
          erreur.code = "ER_NO_SUCH_TABLE";
          throw erreur;
        }

        return [[...sessionsDisponibles]];
      }

      if (sql.includes("FROM sessions")) {
        const erreur = new Error("sessions absente");
        erreur.code = "ER_NO_SUCH_TABLE";
        throw erreur;
      }

      if (sql.includes("FROM salles")) {
        return [[
          { id_salle: 1, type: "Laboratoire", capacite: 28 },
          { id_salle: 2, type: "Salle de cours", capacite: 40 },
          { id_salle: 3, type: "Salle reseautique", capacite: 24 },
        ]];
      }

      if (sql.includes("FROM cours") && sql.includes("archive = 0")) {
        if (params[0] === "Programmation informatique") {
          return [[
            { id_cours: 1, type_salle: "Laboratoire", id_salle_reference: null },
            { id_cours: 2, type_salle: "Laboratoire", id_salle_reference: null },
            { id_cours: 3, type_salle: "Salle de cours", id_salle_reference: null },
          ]];
        }

        if (
          params[0] ===
          "Technologie des systemes informatiques - cybersecurite et reseautique"
        ) {
          return [[
            { id_cours: 4, type_salle: "Salle reseautique", id_salle_reference: null },
            { id_cours: 5, type_salle: "Laboratoire", id_salle_reference: null },
          ]];
        }

        if (params[0] === "Techniques en administration des affaires") {
          return [[
            { id_cours: 6, type_salle: "Salle de cours", id_salle_reference: null },
            { id_cours: 7, type_salle: "Salle de cours", id_salle_reference: null },
            { id_cours: 8, type_salle: "Salle de cours", id_salle_reference: null },
          ]];
        }

        return [[]];
      }

      if (
        sql.includes("SELECT id_etudiant, matricule") &&
        sql.includes("FROM etudiants") &&
        sql.includes("WHERE matricule IN")
      ) {
        return [[
          ...etudiants
            .filter((etudiant) => params.includes(etudiant.matricule))
            .map((etudiant) => ({
              id_etudiant: etudiant.id_etudiant,
              matricule: etudiant.matricule,
              nom: etudiant.nom,
              prenom: etudiant.prenom,
              programme: etudiant.programme,
              etape: etudiant.etape,
              session: etudiant.session,
              annee: etudiant.annee ?? null,
              id_groupes_etudiants: etudiant.id_groupes_etudiants ?? null,
            })),
        ]];
      }

      if (sql.includes("WHERE matricule IN")) {
        return [[
          ...etudiants
            .filter((etudiant) => params.includes(etudiant.matricule))
            .map((etudiant) => ({ matricule: etudiant.matricule })),
        ]];
      }

      if (
        sql.includes("SELECT id_cours, code, programme, etape_etude, archive") &&
        sql.includes("WHERE code IN")
      ) {
        return [[
          ...coursCatalogueParCode.filter((cours) =>
            params.includes(cours.code)
          ),
        ]];
      }

      if (
        sql.includes("FROM etudiants e") &&
        sql.includes("JOIN groupes_etudiants ge") &&
        sql.includes("COUNT(e.id_etudiant) AS effectif")
      ) {
        const [programme, etape, session] = params;
        const effectifsParGroupe = new Map();

        etudiants
          .filter(
            (etudiant) =>
              etudiant.programme === programme &&
              Number(etudiant.etape) === Number(etape) &&
              etudiant.session === session &&
              Number.isInteger(Number(etudiant.id_groupes_etudiants)) &&
              Number(etudiant.id_groupes_etudiants) > 0
          )
          .forEach((etudiant) => {
            const idGroupe = Number(etudiant.id_groupes_etudiants);
            effectifsParGroupe.set(idGroupe, (effectifsParGroupe.get(idGroupe) || 0) + 1);
          });

        return [[
          ...effectifsParGroupe.entries().map(([idGroupe, effectif]) => {
            const groupe = groupes.find(
              (candidat) => candidat.id_groupes_etudiants === idGroupe
            );

            return {
              id_groupes_etudiants: idGroupe,
              nom_groupe: groupe?.nom_groupe || `G${idGroupe}`,
              taille_max: groupe?.taille_max || 0,
              programme: groupe?.programme || null,
              etape: groupe?.etape || null,
              id_session: groupe?.id_session ?? null,
              effectif,
            };
          }),
        ]];
      }

      if (
        sql.includes("SELECT") &&
        sql.includes("FROM groupes_etudiants ge") &&
        sql.includes("WHERE ge.programme = ?")
      ) {
        const [programme, etape, idSession] = params;
        return [[
          ...groupes.filter(
            (groupe) =>
              groupe.programme === programme &&
              Number(groupe.etape) === Number(etape) &&
              (idSession === undefined
                ? groupe.id_session === null
                : Number(groupe.id_session) === Number(idSession))
          ),
        ]];
      }

      if (
        sql.includes("SELECT") &&
        sql.includes("FROM etudiants") &&
        sql.includes("WHERE programme = ?") &&
        sql.includes("ORDER BY matricule ASC")
      ) {
        const [programme, etape, session] = params;
        return [[
          ...etudiants.filter(
            (etudiant) =>
              etudiant.programme === programme &&
              Number(etudiant.etape) === Number(etape) &&
              etudiant.session === session
          ),
        ]];
      }

      if (sql.includes("SELECT DISTINCT programme, etape, session")) {
        const cohortes = new Map();

        etudiants.forEach((etudiant) => {
          const cle = `${etudiant.programme}|${etudiant.etape}|${etudiant.session}`;
          if (!cohortes.has(cle)) {
            cohortes.set(cle, {
              programme: etudiant.programme,
              etape: etudiant.etape,
              session: etudiant.session,
            });
          }
        });

        return [[...cohortes.values()]];
      }

      if (sql.includes("INSERT INTO groupes_etudiants")) {
        const groupe = {
          id_groupes_etudiants: prochainIdGroupe++,
          nom_groupe: params[0],
          taille_max: Number(params[1] || 0),
          programme: params[2] ?? null,
          etape: params[3] ?? null,
          id_session: params[4] ?? null,
        };
        groupes.push(groupe);
        groupesCrees.push(groupe);
        return [{ insertId: groupe.id_groupes_etudiants }];
      }

      if (sql.includes("UPDATE groupes_etudiants")) {
        const [nomGroupe, tailleMax, programme, etape, idSession, idGroupe] = params;
        const groupe = groupes.find(
          (candidat) => candidat.id_groupes_etudiants === Number(idGroupe)
        );

        if (groupe) {
          groupe.nom_groupe = nomGroupe;
          groupe.taille_max = Number(tailleMax || 0);
          groupe.programme = programme ?? null;
          groupe.etape = etape ?? null;
          groupe.id_session = idSession ?? null;
        }

        return [{ affectedRows: groupe ? 1 : 0 }];
      }

      if (sql.includes("UPDATE etudiants") && sql.includes("SET id_groupes_etudiants = ?")) {
        const [idGroupe, ...idsEtudiants] = params;

        etudiants.forEach((etudiant) => {
          if (idsEtudiants.includes(etudiant.id_etudiant)) {
            etudiant.id_groupes_etudiants = Number(idGroupe);
          }
        });

        return [{ affectedRows: idsEtudiants.length }];
      }

      if (
        sql.includes("UPDATE etudiants") &&
        sql.includes("SET nom = ?") &&
        sql.includes("WHERE id_etudiant = ?")
      ) {
        const [nom, prenom, programme, etape, session, annee, idEtudiant] = params;
        const etudiant = etudiants.find(
          (candidat) => candidat.id_etudiant === Number(idEtudiant)
        );

        if (etudiant) {
          etudiant.nom = nom;
          etudiant.prenom = prenom;
          etudiant.programme = programme;
          etudiant.etape = Number(etape);
          etudiant.session = session;
          etudiant.annee = Number(annee);

          if (sql.includes("id_groupes_etudiants = NULL")) {
            etudiant.id_groupes_etudiants = null;
          }
        }

        return [{ affectedRows: etudiant ? 1 : 0 }];
      }

      if (sql.includes("WHERE nom_groupe IN")) {
        return [[]];
      }

      if (sql.includes("SELECT id_groupes_etudiants, nom_groupe")) {
        return [[]];
      }

      if (sql.includes("INSERT INTO etudiants")) {
        etudiantsCrees.push(params);
        etudiants.push({
          id_etudiant: prochainIdEtudiant,
          matricule: params[0],
          nom: params[1],
          prenom: params[2],
          id_groupes_etudiants: params[3],
          programme: params[4],
          etape: Number(params[5]),
          session: params[6],
          annee: params[7],
        });
        return [{ insertId: prochainIdEtudiant++ }];
      }

      if (sql.includes("INSERT INTO cours_echoues")) {
        coursEchouesCrees.push({
          id_etudiant: params[0],
          id_cours: params[1],
          id_session: params[2],
          note_echec: params[3],
          statut: params[4],
        });
        return [{ insertId: coursEchouesCrees.length }];
      }

      throw new Error(`Requete non prise en charge dans le test: ${sql}`);
    }),
    groupes,
    etudiants,
    groupesCrees,
    etudiantsCrees,
    coursEchouesCrees,
  };

  return connexion;
}

describe("model import-etudiants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("cree automatiquement des groupes equilibres lors de l'import", async () => {
    const connexion = creerConnexionImport();
    getConnectionMock.mockResolvedValue(connexion);

    const etudiants = Array.from({ length: 56 }, (_, index) => ({
      numeroLigne: index + 2,
      matricule: `ETU${String(index + 1).padStart(4, "0")}`,
      nom: `Nom${index + 1}`,
      prenom: `Prenom${index + 1}`,
      programme: "Programmation informatique",
      etape: 1,
      session: "Automne",
    }));

    const resultat = await enregistrerEtudiantsImportes(etudiants);

    expect(resultat.nombreImportes).toBe(56);
    expect(assurerProgrammeReferenceMock).toHaveBeenCalledTimes(1);
    expect(connexion.groupesCrees).toHaveLength(2);
    expect(connexion.groupesCrees[0].nom_groupe).toContain(
      "Programmation informatique - E1 - Automne - G1"
    );
    expect(connexion.groupesCrees[1].nom_groupe).toContain(
      "Programmation informatique - E1 - Automne - G2"
    );

    const effectifsParGroupe = connexion.etudiants.reduce((compteur, etudiant) => {
      const idGroupe = etudiant.id_groupes_etudiants;
      compteur.set(idGroupe, (compteur.get(idGroupe) || 0) + 1);
      return compteur;
    }, new Map());

    expect([...effectifsParGroupe.values()].sort((a, b) => a - b)).toEqual([28, 28]);
    expect(connexion.commit).toHaveBeenCalled();
    expect(connexion.release).toHaveBeenCalled();
  });

  test("respecte la capacite maximale des salles pour une cohorte reseautique", async () => {
    const connexion = creerConnexionImport();
    getConnectionMock.mockResolvedValue(connexion);

    const etudiants = Array.from({ length: 48 }, (_, index) => ({
      numeroLigne: index + 2,
      matricule: `CYB${String(index + 1).padStart(4, "0")}`,
      nom: `Nom${index + 1}`,
      prenom: `Prenom${index + 1}`,
      programme:
        "Technologie des systemes informatiques - cybersecurite et reseautique",
      etape: 1,
      session: "Hiver",
    }));

    const resultat = await enregistrerEtudiantsImportes(etudiants);

    expect(resultat.nombreImportes).toBe(48);
    expect(connexion.groupesCrees).toHaveLength(2);

    const effectifsParGroupe = connexion.etudiants.reduce((compteur, etudiant) => {
      const idGroupe = etudiant.id_groupes_etudiants;
      compteur.set(idGroupe, (compteur.get(idGroupe) || 0) + 1);
      return compteur;
    }, new Map());

    expect([...effectifsParGroupe.values()].sort((a, b) => a - b)).toEqual([24, 24]);
  });

  test("enregistre les cours echoues a reprendre pour la session courante sans changer le schema", async () => {
    const connexion = creerConnexionImport({
      sessionsDisponibles: [
        {
          id_session: 1,
          nom: "Automne 2026",
          date_debut: "2026-08-25",
          active: 1,
        },
      ],
      coursCatalogueParCode: [
        {
          id_cours: 1,
          code: "INF101",
          programme: "Programmation informatique",
          etape_etude: "1",
          archive: 0,
        },
      ],
    });
    getConnectionMock.mockResolvedValue(connexion);

    const etudiants = [
      {
        numeroLigne: 2,
        matricule: "INF9001",
        nom: "Roy",
        prenom: "Nadia",
        programme: "Programmation informatique",
        etape: 2,
        session: "Automne",
      },
    ];

    const resultat = await enregistrerEtudiantsImportes(etudiants, {
      coursEchoues: [
        {
          numeroLigne: 2,
          matricule: "INF9001",
          code_cours: "INF101",
          session: "Automne",
          note_echec: 52.5,
          statut: "a_reprendre",
        },
      ],
    });

    expect(resultat.nombreImportes).toBe(1);
    expect(resultat.nombreCoursEchouesImportes).toBe(1);
    expect(connexion.coursEchouesCrees).toEqual([
      {
        id_etudiant: 1,
        id_cours: 1,
        id_session: 1,
        note_echec: 52.5,
        statut: "a_reprendre",
      },
    ]);
  });

  test("reconnait une session generique grace a sa date de debut", async () => {
    const connexion = creerConnexionImport({
      sessionsDisponibles: [
        {
          id_session: 1,
          nom: "Session initiale",
          date_debut: "2026-08-25",
          active: 1,
        },
      ],
    });
    getConnectionMock.mockResolvedValue(connexion);

    const resultat = await enregistrerEtudiantsImportes([
      {
        numeroLigne: 2,
        matricule: "INF9001",
        nom: "Roy",
        prenom: "Nadia",
        programme: "Programmation informatique",
        etape: 1,
        session: "Automne",
      },
    ]);

    expect(resultat).toMatchObject({
      nombreImportes: 1,
      nombreEtudiantsIgnores: 0,
      nombreCohortesIgnorees: 0,
    });
    expect(connexion.groupesCrees[0].id_session).toBe(1);
  });

  test("met a jour les etudiants existants et importe leurs cours echoues sans bloquer sur le matricule", async () => {
    const connexion = creerConnexionImport({
      etudiantsExistants: [
        {
          id_etudiant: 1,
          matricule: "INF9001",
          nom: "Roy",
          prenom: "Nadia",
          programme: "Programmation informatique",
          etape: 2,
          session: "Automne",
          annee: 2026,
          id_groupes_etudiants: 12,
        },
      ],
      groupesExistants: [
        {
          id_groupes_etudiants: 12,
          nom_groupe: "Programmation informatique - E2 - Automne - G1",
          taille_max: 28,
          programme: "Programmation informatique",
          etape: 2,
          id_session: 1,
        },
      ],
      sessionsDisponibles: [
        {
          id_session: 1,
          nom: "Automne 2026",
          date_debut: "2026-08-25",
          active: 1,
        },
      ],
      coursCatalogueParCode: [
        {
          id_cours: 1,
          code: "INF101",
          programme: "Programmation informatique",
          etape_etude: "1",
          archive: 0,
        },
      ],
    });
    getConnectionMock.mockResolvedValue(connexion);

    const resultat = await enregistrerEtudiantsImportes(
      [
        {
          numeroLigne: 2,
          matricule: "INF9001",
          nom: "Roy",
          prenom: "Nadia",
          programme: "Programmation informatique",
          etape: 2,
          session: "Automne",
        },
      ],
      {
        coursEchoues: [
          {
            numeroLigne: 2,
            matricule: "INF9001",
            code_cours: "INF101",
            session: "Automne 2026",
            note_echec: 52.5,
            statut: "a_reprendre",
          },
        ],
      }
    );

    expect(resultat).toMatchObject({
      nombreImportes: 0,
      nombreMisAJour: 1,
      nombreCoursEchouesImportes: 1,
    });
    expect(connexion.etudiants).toHaveLength(1);
    expect(connexion.coursEchouesCrees).toEqual([
      {
        id_etudiant: 1,
        id_cours: 1,
        id_session: 1,
        note_echec: 52.5,
        statut: "a_reprendre",
      },
    ]);
  });

  test("ignore automatiquement les cohortes non exploitables au lieu d'importer des etudiants inutilisables", async () => {
    const connexion = creerConnexionImport({
      sessionsDisponibles: [
        {
          id_session: 1,
          nom: "Automne 2026",
          date_debut: "2026-08-25",
          active: 1,
        },
      ],
      coursCatalogueParCode: [
        {
          id_cours: 1,
          code: "INF101",
          programme: "Programmation informatique",
          etape_etude: "1",
          archive: 0,
        },
      ],
    });
    getConnectionMock.mockResolvedValue(connexion);

    const resultat = await enregistrerEtudiantsImportes(
      [
        {
          numeroLigne: 2,
          matricule: "INF9001",
          nom: "Roy",
          prenom: "Nadia",
          programme: "Programmation informatique",
          etape: 1,
          session: "Automne",
        },
        {
          numeroLigne: 3,
          matricule: "BIO9001",
          nom: "Martin",
          prenom: "Lea",
          programme: "Biologie appliquee",
          etape: 5,
          session: "Ete",
        },
      ],
      {
        coursEchoues: [
          {
            numeroLigne: 3,
            matricule: "BIO9001",
            code_cours: "BIO501",
            session: "Ete",
            note_echec: 45,
            statut: "a_reprendre",
          },
        ],
      }
    );

    expect(resultat).toMatchObject({
      nombreImportes: 1,
      nombreEtudiantsIgnores: 1,
      nombreCohortesIgnorees: 1,
    });
    expect(connexion.etudiants.map((etudiant) => etudiant.matricule)).toEqual(["INF9001"]);
    expect(connexion.coursEchouesCrees).toHaveLength(0);
  });

  test("repartit un petit surplus sur les groupes existants sans creer un groupe en plus", async () => {
    const connexion = creerConnexionImport({
      groupesExistants: [
        {
          id_groupes_etudiants: 10,
          nom_groupe: "Techniques en administration des affaires - E1 - Printemps - G1",
          taille_max: 28,
          programme: "Techniques en administration des affaires",
          etape: 1,
          id_session: null,
        },
        {
          id_groupes_etudiants: 11,
          nom_groupe: "Techniques en administration des affaires - E1 - Printemps - G2",
          taille_max: 28,
          programme: "Techniques en administration des affaires",
          etape: 1,
          id_session: null,
        },
        {
          id_groupes_etudiants: 12,
          nom_groupe: "Techniques en administration des affaires - E1 - Printemps - G3",
          taille_max: 28,
          programme: "Techniques en administration des affaires",
          etape: 1,
          id_session: null,
        },
        {
          id_groupes_etudiants: 13,
          nom_groupe: "Techniques en administration des affaires - E1 - Printemps - G4",
          taille_max: 28,
          programme: "Techniques en administration des affaires",
          etape: 1,
          id_session: null,
        },
      ],
      etudiantsExistants: Array.from({ length: 112 }, (_, index) => ({
        id_etudiant: index + 1,
        matricule: `ADM${String(index + 1).padStart(4, "0")}`,
        nom: `Nom${index + 1}`,
        prenom: `Prenom${index + 1}`,
        id_groupes_etudiants: 10 + (index % 4),
        programme: "Techniques en administration des affaires",
        etape: 1,
        session: "Printemps",
      })),
    });
    getConnectionMock.mockResolvedValue(connexion);

    const surplus = Array.from({ length: 5 }, (_, index) => ({
      numeroLigne: index + 2,
      matricule: `NOUV${String(index + 1).padStart(4, "0")}`,
      nom: `Ajout${index + 1}`,
      prenom: `Etu${index + 1}`,
      programme: "Techniques en administration des affaires",
      etape: 1,
      session: "Printemps",
    }));

    const resultat = await enregistrerEtudiantsImportes(surplus);

    expect(resultat.nombreImportes).toBe(5);
    expect(connexion.groupesCrees).toHaveLength(0);

    const effectifsParGroupe = connexion.etudiants.reduce((compteur, etudiant) => {
      const idGroupe = etudiant.id_groupes_etudiants;
      compteur.set(idGroupe, (compteur.get(idGroupe) || 0) + 1);
      return compteur;
    }, new Map());

    expect([...effectifsParGroupe.values()].sort((a, b) => a - b)).toEqual([29, 29, 29, 30]);
  });

  test("reequilibre toutes les cohortes existantes deja importees", async () => {
    const connexion = creerConnexionImport({
      groupesExistants: [
        {
          id_groupes_etudiants: 101,
          nom_groupe: "SRC-Techniques en administra-E1",
          taille_max: 28,
          programme: "Techniques en administration des affaires",
          etape: 1,
          id_session: null,
        },
      ],
      etudiantsExistants: Array.from({ length: 112 }, (_, index) => ({
        id_etudiant: index + 1,
        matricule: `SRC${String(index + 1).padStart(4, "0")}`,
        nom: `Nom${index + 1}`,
        prenom: `Prenom${index + 1}`,
        id_groupes_etudiants: index < 85 ? 101 : null,
        programme: "Techniques en administration des affaires",
        etape: 1,
        session: "Printemps",
      })),
    });
    getConnectionMock.mockResolvedValue(connexion);

    const resultat = await reequilibrerCohortesEtudiants([
      {
        programme: "Techniques en administration des affaires",
        etape: 1,
        session: "Printemps",
      },
    ]);

    expect(resultat.cohortes).toBe(1);
    expect(connexion.groupesCrees).toHaveLength(3);

    const effectifsParGroupe = connexion.etudiants.reduce((compteur, etudiant) => {
      const idGroupe = etudiant.id_groupes_etudiants;
      compteur.set(idGroupe, (compteur.get(idGroupe) || 0) + 1);
      return compteur;
    }, new Map());

    expect([...effectifsParGroupe.values()].sort((a, b) => a - b)).toEqual([28, 28, 28, 28]);
    expect(
      connexion.etudiants.every(
        (etudiant) => Number.isInteger(Number(etudiant.id_groupes_etudiants))
      )
    ).toBe(true);
  });
});
