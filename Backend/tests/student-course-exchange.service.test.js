import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const queryMock = jest.fn();
const assurerSchemaSchedulerAcademiqueMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

await jest.unstable_mockModule("../src/services/academic-scheduler-schema.js", () => ({
  assurerSchemaSchedulerAcademique: assurerSchemaSchedulerAcademiqueMock,
}));

const service = await import(
  "../src/services/etudiants/student-course-exchange.service.js"
);

function creerReponseSeance({
  idAffectation,
  idCours = 4,
  codeCours = "POO",
  nomCours = "Programmation orientee objet",
  date,
  heureDebut,
  heureFin,
  groupe,
  idGroupe,
}) {
  return {
    id_affectation_cours: idAffectation,
    id_cours: idCours,
    code_cours: codeCours,
    nom_cours: nomCours,
    date,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    groupe_source: groupe,
    id_groupe_source: idGroupe,
    source_horaire: "groupe",
    est_reprise: 0,
    est_exception_individuelle: 0,
  };
}

function creerQueryHandler({ conflitEtudiantA = false } = {}) {
  return async (sql, params = []) => {
    const requete = String(sql);

    if (requete.includes("FROM sessions") && requete.includes("WHERE active = TRUE")) {
      return [[{ id_session: 8, nom: "Hiver" }]];
    }

    if (requete.includes("FROM sessions") && requete.includes("WHERE id_session = ?")) {
      return [[{ id_session: 8, nom: "Hiver" }]];
    }

    if (
      requete.includes("FROM etudiants e") &&
      requete.includes("groupe_principal") &&
      requete.includes("e.matricule")
    ) {
      const idEtudiant = Number(params[0]);
      if (idEtudiant === 1) {
        return [[
          {
            id_etudiant: 1,
            matricule: "E001",
            nom: "Test",
            prenom: "Saber",
            id_groupe_principal: 11,
            groupe_principal: "GPI-E4-2",
          },
        ]];
      }

      return [[
        {
          id_etudiant: 2,
          matricule: "E002",
          nom: "Test",
          prenom: "Rayane",
          id_groupe_principal: 22,
          groupe_principal: "GPI-E4-1",
        },
      ]];
    }

    if (
      requete.includes("FROM etudiants e") &&
      requete.includes("NOT EXISTS") &&
      requete.includes("JOIN affectation_groupes ag")
    ) {
      const idEtudiant = Number(params[0]);
      const exclusions = params.slice(2).map((value) => Number(value));
      const coursExclu = exclusions.includes(4);

      if (!coursExclu) {
        if (idEtudiant === 1) {
          return [[
            creerReponseSeance({
              idAffectation: 101,
              date: "2026-01-12",
              heureDebut: "08:00:00",
              heureFin: "11:00:00",
              groupe: "GPI-E4-2",
              idGroupe: 11,
            }),
          ]];
        }

        return [[
          creerReponseSeance({
            idAffectation: 202,
            date: "2026-01-16",
            heureDebut: "12:00:00",
            heureFin: "15:00:00",
            groupe: "GPI-E4-1",
            idGroupe: 22,
          }),
        ]];
      }

      if (conflitEtudiantA && idEtudiant === 1) {
        return [[
          creerReponseSeance({
            idAffectation: 303,
            idCours: 9,
            codeCours: "WEB",
            nomCours: "Developpement Web",
            date: "2026-01-16",
            heureDebut: "13:00:00",
            heureFin: "16:00:00",
            groupe: "GPI-E4-2",
            idGroupe: 11,
          }),
        ]];
      }

      return [[]];
    }

    if (requete.includes("FROM affectation_etudiants ae") && requete.includes("ae.source_type IN")) {
      return [[]];
    }

    if (requete.includes("INSERT INTO echanges_cours_etudiants")) {
      return [{ insertId: 55 }];
    }

    if (
      requete.includes("DELETE FROM affectation_etudiants") &&
      requete.includes("source_type = 'individuelle'")
    ) {
      return [{ affectedRows: 1 }];
    }

    if (
      requete.includes("INSERT INTO affectation_etudiants") &&
      requete.includes("id_echange_cours")
    ) {
      const idEtudiant = Number(params[0]);
      return [{ insertId: idEtudiant === 1 ? 501 : 502 }];
    }

    throw new Error(`Requete non mockee: ${requete}`);
  };
}

describe("student-course-exchange.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assurerSchemaSchedulerAcademiqueMock.mockResolvedValue();
  });

  test("previsualiserEchangeCoursEtudiants bloque l'echange si un conflit est detecte", async () => {
    queryMock.mockImplementation(creerQueryHandler({ conflitEtudiantA: true }));

    const resultat = await service.previsualiserEchangeCoursEtudiants(
      {
        idEtudiantA: 1,
        idEtudiantB: 2,
        idCours: 4,
      },
      { query: queryMock }
    );

    expect(resultat.echange_possible).toBe(false);
    expect(resultat.etudiant_a.conflits).toHaveLength(1);
    expect(resultat.blocages).toContain("Saber n'est pas libre sur la section recue.");
  });

  test("executerEchangeCoursEtudiants persiste deux affectations individuelles ciblees", async () => {
    queryMock.mockImplementation(creerQueryHandler());

    const resultat = await service.executerEchangeCoursEtudiants(
      {
        idEtudiantA: 1,
        idEtudiantB: 2,
        idCours: 4,
      },
      { query: queryMock }
    );

    expect(resultat.id_echange_cours).toBe(55);
    expect(resultat.etudiants_impactes).toEqual([1, 2]);
    expect(resultat.groupes_impactes).toEqual([11, 22]);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO echanges_cours_etudiants"),
      [8, 4, 1, 11, 22, 2, 22, 11]
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM affectation_etudiants"),
      [1, 4, 8]
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM affectation_etudiants"),
      [2, 4, 8]
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO affectation_etudiants"),
      [1, 22, 4, 8, 55]
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO affectation_etudiants"),
      [2, 11, 4, 8, 55]
    );
  });

  test("recupererSeancesEffectivesEtudiant reconstruit l'horaire sans doublon apres echange", async () => {
    queryMock.mockImplementation(async (sql, params = []) => {
      const requete = String(sql);

      if (requete.includes("FROM sessions") && requete.includes("WHERE active = TRUE")) {
        return [[{ id_session: 8, nom: "Hiver" }]];
      }

      if (
        requete.includes("FROM etudiants e") &&
        requete.includes("NOT EXISTS") &&
        requete.includes("JOIN affectation_groupes ag")
      ) {
        return [[
          creerReponseSeance({
            idAffectation: 901,
            idCours: 8,
            codeCours: "WEB201",
            nomCours: "Developpement Web",
            date: "2026-01-13",
            heureDebut: "09:00:00",
            heureFin: "12:00:00",
            groupe: "GPI-E4-2",
            idGroupe: 11,
          }),
        ]];
      }

      if (requete.includes("FROM affectation_etudiants ae") && requete.includes("ae.source_type IN")) {
        return [[
          {
            id_affectation_cours: 902,
            id_cours: 4,
            code_cours: "POO",
            nom_cours: "Programmation orientee objet",
            date: "2026-01-16",
            heure_debut: "12:00:00",
            heure_fin: "15:00:00",
            groupe_source: "GPI-E4-1",
            id_groupe_source: 22,
            source_horaire: "individuelle",
            est_reprise: 0,
            est_exception_individuelle: 1,
            id_echange_cours: 55,
            type_exception: "echange_cours",
            etudiant_echange: "Rayane Test",
          },
          {
            id_affectation_cours: 903,
            id_cours: 6,
            code_cours: "MAT",
            nom_cours: "Mathematiques",
            date: "2026-01-14",
            heure_debut: "17:00:00",
            heure_fin: "20:00:00",
            groupe_source: "GPI-E4-3",
            id_groupe_source: 33,
            source_horaire: "reprise",
            est_reprise: 1,
            est_exception_individuelle: 0,
            id_cours_echoue: 777,
            type_exception: "reprise",
          },
        ]];
      }

      throw new Error(`Requete non mockee: ${requete}`);
    });

    const resultat = await service.recupererSeancesEffectivesEtudiant(
      1,
      { inclureReprises: true },
      { query: queryMock }
    );

    expect(resultat).toHaveLength(3);
    expect(resultat.filter((seance) => seance.code_cours === "POO")).toHaveLength(1);
    expect(
      resultat.some(
        (seance) =>
          seance.code_cours === "POO" &&
          seance.source_horaire === "individuelle" &&
          seance.date === "2026-01-16"
      )
    ).toBe(true);
    expect(
      resultat.some(
        (seance) =>
          seance.code_cours === "WEB201" &&
          seance.source_horaire === "groupe"
      )
    ).toBe(true);
    expect(
      resultat.some(
        (seance) =>
          seance.code_cours === "MAT" &&
          seance.source_horaire === "reprise"
      )
    ).toBe(true);
  });
});
