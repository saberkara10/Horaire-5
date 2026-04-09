/**
 * TESTS - Modele Disponibilites Professeurs
 *
 * Ce fichier couvre la lecture et la mise a jour
 * des disponibilites des professeurs.
 */
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const queryMock = jest.fn();
const connectionMock = {
  beginTransaction: jest.fn(),
  query: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};
const replanifierSeancesImpacteesParDisponibilitesMock = jest.fn();
const enregistrerJournalReplanificationDisponibilitesMock = jest.fn();
const recupererJournalReplanificationDisponibilitesMock = jest.fn();
const sessionActiveMock = {
  id_session: 1,
  nom: "Automne 2026",
  date_debut: "2026-08-24",
  date_fin: "2026-12-18",
};

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
    getConnection: jest.fn().mockResolvedValue(connectionMock),
  },
}));

await jest.unstable_mockModule(
  "../src/services/professeurs/availability-rescheduler.js",
  () => ({
    replanifierSeancesImpacteesParDisponibilites:
      replanifierSeancesImpacteesParDisponibilitesMock,
  })
);

await jest.unstable_mockModule(
  "../src/services/professeurs/availability-replanning-journal.js",
  () => ({
    enregistrerJournalReplanificationDisponibilites:
      enregistrerJournalReplanificationDisponibilitesMock,
    recupererJournalReplanificationDisponibilites:
      recupererJournalReplanificationDisponibilitesMock,
  })
);

const {
  recupererDisponibilitesProfesseur,
  recupererDisponibilitesProfesseurs,
  recupererJournalDisponibilitesProfesseur,
  remplacerDisponibilitesProfesseur,
} = await import("../src/model/professeurs.model.js");

describe("Model professeurs disponibilites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionMock.beginTransaction.mockResolvedValue(undefined);
    connectionMock.commit.mockResolvedValue(undefined);
    connectionMock.rollback.mockResolvedValue(undefined);
    connectionMock.release.mockResolvedValue(undefined);
    queryMock.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      return [[]];
    });
    connectionMock.query.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      return [[]];
    });
    replanifierSeancesImpacteesParDisponibilitesMock.mockResolvedValue({
      statut: "aucun-impact",
      message:
        "Les disponibilites du professeur ont ete mises a jour avec succes. Aucun cours planifie n'a ete impacte.",
      seances_concernees: 0,
      seances_deplacees: [],
      seances_non_replanifiees: [],
      resume: {
        seances_concernees: 0,
        seances_replanifiees: 0,
        seances_replanifiees_meme_semaine: 0,
        seances_reportees_semaines_suivantes: 0,
        seances_non_replanifiees: 0,
      },
      groupes_impactes: [],
      salles_impactees: [],
    });
    enregistrerJournalReplanificationDisponibilitesMock.mockResolvedValue(undefined);
    recupererJournalReplanificationDisponibilitesMock.mockResolvedValue([]);
  });

  test("recupererDisponibilitesProfesseur retourne les disponibilites du professeur", async () => {
    queryMock.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [[
          {
            id_disponibilite_professeur: 1,
            id_professeur: 7,
            jour_semaine: 1,
            heure_debut: "08:00:00",
            heure_fin: "10:00:00",
            date_debut_effet: "2026-08-24",
            date_fin_effet: "2026-12-18",
          },
        ]];
      }

      return [[]];
    });

    const resultat = await recupererDisponibilitesProfesseur(7);

    expect(resultat).toHaveLength(1);
    expect(resultat[0]).toMatchObject({
      id_professeur: 7,
      jour_semaine: 1,
      date_debut_effet: "2026-08-24",
    });
  });

  test("recupererDisponibilitesProfesseurs groupe les disponibilites par professeur", async () => {
    queryMock.mockImplementation(async (sql) => {
      if (String(sql).includes("SELECT id_professeur,")) {
        return [[
          {
            id_professeur: 2,
            jour_semaine: 1,
            heure_debut: "08:00:00",
            heure_fin: "10:00:00",
            date_debut_effet: "2026-08-24",
            date_fin_effet: "2026-09-27",
          },
          {
            id_professeur: 2,
            jour_semaine: 3,
            heure_debut: "14:00:00",
            heure_fin: "16:00:00",
            date_debut_effet: "2026-08-24",
            date_fin_effet: "2026-09-27",
          },
          {
            id_professeur: 5,
            jour_semaine: 2,
            heure_debut: "10:00:00",
            heure_fin: "12:00:00",
            date_debut_effet: "2026-08-24",
            date_fin_effet: "2026-09-27",
          },
        ]];
      }

      return [[]];
    });

    const resultat = await recupererDisponibilitesProfesseurs();

    expect(resultat.get(2)).toHaveLength(2);
    expect(resultat.get(5)).toHaveLength(1);
  });

  test("recupererJournalDisponibilitesProfesseur relit le journal structure du professeur", async () => {
    recupererJournalReplanificationDisponibilitesMock.mockResolvedValue([
      {
        id_journal_replanification: 15,
        id_professeur: 3,
        statut: "PARTIEL",
      },
    ]);

    const resultat = await recupererJournalDisponibilitesProfesseur(3, {
      limit: 5,
    });

    expect(recupererJournalReplanificationDisponibilitesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.any(Function),
        getConnection: expect.any(Function),
      }),
      3,
      { limit: 5 }
    );
    expect(resultat).toEqual([
      {
        id_journal_replanification: 15,
        id_professeur: 3,
        statut: "PARTIEL",
      },
    ]);
  });

  test("remplacerDisponibilitesProfesseur remplace et normalise les heures", async () => {
    let disponibilitesInserees = [];

    connectionMock.query.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [disponibilitesInserees];
      }

      if (String(sql).includes("INSERT INTO disponibilites_professeurs")) {
        disponibilitesInserees = [
          {
            id_disponibilite_professeur: 9,
            id_professeur: 3,
            jour_semaine: 2,
            heure_debut: "09:30:00",
            heure_fin: "11:00:00",
            date_debut_effet: "2026-08-24",
            date_fin_effet: "2026-12-18",
          },
        ];
        return [[]];
      }

      return [[]];
    });

    queryMock.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [[
          {
            id_disponibilite_professeur: 9,
            id_professeur: 3,
            jour_semaine: 2,
            heure_debut: "09:30:00",
            heure_fin: "11:00:00",
            date_debut_effet: "2026-08-24",
            date_fin_effet: "2026-12-18",
          },
        ]];
      }

      return [[]];
    });

    const resultat = await remplacerDisponibilitesProfesseur(3, [
      {
        jour_semaine: 2,
        heure_debut: "09:30",
        heure_fin: "11:00",
      },
    ], {
      semaine_cible: 1,
      mode_application: "semaine_et_suivantes",
    });

    expect(connectionMock.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connectionMock.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO disponibilites_professeurs"),
      [3, 2, "09:30:00", "11:00:00", "2026-08-24", "2026-12-18"]
    );
    expect(replanifierSeancesImpacteesParDisponibilitesMock).toHaveBeenCalledWith(
      3,
      expect.arrayContaining([
        expect.objectContaining({
          jour_semaine: 2,
          heure_debut: "09:30:00",
          heure_fin: "11:00:00",
        }),
      ]),
      connectionMock,
      {
        dateDebutImpact: "2026-08-24",
        dateFinImpact: "2026-12-18",
        modeApplication: "semaine_et_suivantes",
      }
    );
    expect(connectionMock.commit).toHaveBeenCalledTimes(1);
    expect(connectionMock.release).toHaveBeenCalledTimes(1);
    expect(enregistrerJournalReplanificationDisponibilitesMock).toHaveBeenCalledWith(
      connectionMock,
      expect.objectContaining({
        id_professeur: 3,
        statut: "AUCUN_IMPACT",
      })
    );
    expect(resultat.disponibilites[0].heure_debut).toBe("09:30:00");
    expect(resultat.semaine_reference.numero_semaine).toBe(1);
    expect(resultat.replanification.seances_concernees).toBe(0);
    expect(resultat.synchronisation.id_professeur).toBe(3);
  });

  test("remplacerDisponibilitesProfesseur applique une portee permanente et recalcule toute la session active", async () => {
    let disponibilitesInserees = [];

    connectionMock.query.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [disponibilitesInserees];
      }

      if (String(sql).includes("INSERT INTO disponibilites_professeurs")) {
        disponibilitesInserees = [
          {
            id_disponibilite_professeur: 11,
            id_professeur: 3,
            jour_semaine: 1,
            heure_debut: "08:00:00",
            heure_fin: "12:00:00",
            date_debut_effet: "2000-01-01",
            date_fin_effet: "2099-12-31",
          },
        ];
        return [[]];
      }

      return [[]];
    });

    queryMock.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [[
          {
            id_disponibilite_professeur: 11,
            id_professeur: 3,
            jour_semaine: 1,
            heure_debut: "08:00:00",
            heure_fin: "12:00:00",
            date_debut_effet: "2000-01-01",
            date_fin_effet: "2099-12-31",
          },
        ]];
      }

      return [[]];
    });

    const resultat = await remplacerDisponibilitesProfesseur(3, [
      {
        jour_semaine: 1,
        heure_debut: "08:00",
        heure_fin: "12:00",
      },
    ], {
      semaine_cible: 4,
      mode_application: "permanente",
    });

    expect(connectionMock.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO disponibilites_professeurs"),
      [3, 1, "08:00:00", "12:00:00", "2000-01-01", "2099-12-31"]
    );
    expect(replanifierSeancesImpacteesParDisponibilitesMock).toHaveBeenCalledWith(
      3,
      expect.any(Array),
      connectionMock,
      {
        dateDebutImpact: "2026-08-24",
        dateFinImpact: "2026-12-18",
        modeApplication: "permanente",
      }
    );
    expect(resultat.semaine_reference.numero_semaine).toBe(4);
  });

  test("remplacerDisponibilitesProfesseur conserve la sauvegarde si la replanification est partielle", async () => {
    let disponibilitesInserees = [];

    connectionMock.query.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [disponibilitesInserees];
      }

      if (String(sql).includes("INSERT INTO disponibilites_professeurs")) {
        disponibilitesInserees = [
          {
            id_disponibilite_professeur: 12,
            id_professeur: 3,
            jour_semaine: 2,
            heure_debut: "13:00:00",
            heure_fin: "17:00:00",
            date_debut_effet: "2026-09-07",
            date_fin_effet: "2026-09-13",
          },
        ];
        return [[]];
      }

      return [[]];
    });

    queryMock.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [[
          {
            id_disponibilite_professeur: 12,
            id_professeur: 3,
            jour_semaine: 2,
            heure_debut: "13:00:00",
            heure_fin: "17:00:00",
            date_debut_effet: "2026-09-07",
            date_fin_effet: "2026-09-13",
          },
        ]];
      }

      return [[]];
    });

    replanifierSeancesImpacteesParDisponibilitesMock.mockResolvedValue({
      statut: "partiel",
      message:
        "1 seance a ete deplacee et 1 seance sans solution a ete retiree de l'horaire valide.",
      seances_concernees: 2,
      seances_deplacees: [
        {
          id_affectation_cours: 44,
        },
      ],
      seances_non_replanifiees: [
        {
          id_affectation_cours: 45,
          action_finale: "retiree_de_l_horaire",
        },
      ],
      resume: {
        seances_concernees: 2,
        seances_replanifiees: 1,
        seances_replanifiees_meme_semaine: 1,
        seances_reportees_semaines_suivantes: 0,
        seances_non_replanifiees: 1,
      },
      groupes_impactes: [7],
      salles_impactees: [9],
      professeurs_impactes: [3],
      etudiants_impactes: [{ id_etudiant: 90 }],
      etudiants_reprises_impactes: [{ id_etudiant: 91 }],
      fenetre_impact: {
        date_debut: "2026-09-07",
        date_fin: "2026-09-13",
      },
    });

    const resultat = await remplacerDisponibilitesProfesseur(3, [
      {
        jour_semaine: 2,
        heure_debut: "13:00",
        heure_fin: "17:00",
      },
    ], {
      semaine_cible: 3,
      mode_application: "semaine_unique",
    });

    expect(connectionMock.commit).toHaveBeenCalledTimes(1);
    expect(connectionMock.rollback).not.toHaveBeenCalled();
    expect(resultat.replanification.statut).toBe("partiel");
    expect(resultat.synchronisation.groupes_impactes).toEqual([7]);
    expect(resultat.synchronisation.etudiants_impactes).toEqual([90]);
    expect(resultat.synchronisation.etudiants_reprises_impactes).toEqual([91]);
    expect(enregistrerJournalReplanificationDisponibilitesMock).toHaveBeenCalledWith(
      connectionMock,
      expect.objectContaining({
        id_professeur: 3,
        statut: "PARTIEL",
      })
    );
  });

  test("remplacerDisponibilitesProfesseur rollback si une insertion echoue", async () => {
    connectionMock.query.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("INSERT INTO disponibilites_professeurs")) {
        throw new Error("DB error");
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [[]];
      }

      return [[]];
    });

    await expect(
      remplacerDisponibilitesProfesseur(3, [
        {
          jour_semaine: 2,
          heure_debut: "09:30",
          heure_fin: "11:00",
        },
      ], {
        semaine_cible: 1,
      })
    ).rejects.toThrow("DB error");

    expect(connectionMock.rollback).toHaveBeenCalledTimes(1);
    expect(connectionMock.release).toHaveBeenCalledTimes(1);
  });

  test("remplacerDisponibilitesProfesseur conserve aussi les disponibilites du week-end", async () => {
    let disponibilitesInserees = [];

    connectionMock.query.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [disponibilitesInserees];
      }

      if (String(sql).includes("INSERT INTO disponibilites_professeurs")) {
        disponibilitesInserees = [
          {
            id_disponibilite_professeur: 10,
            id_professeur: 3,
            jour_semaine: 7,
            heure_debut: "13:00:00",
            heure_fin: "15:00:00",
            date_debut_effet: "2026-08-24",
            date_fin_effet: "2026-12-18",
          },
        ];
        return [[]];
      }

      return [[]];
    });

    queryMock.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [[
          {
            id_disponibilite_professeur: 10,
            id_professeur: 3,
            jour_semaine: 7,
            heure_debut: "13:00:00",
            heure_fin: "15:00:00",
            date_debut_effet: "2026-08-24",
            date_fin_effet: "2026-12-18",
          },
        ]];
      }

      return [[]];
    });

    const resultat = await remplacerDisponibilitesProfesseur(3, [
      {
        jour_semaine: 7,
        heure_debut: "13:00",
        heure_fin: "15:00",
      },
    ], {
      semaine_cible: 1,
    });

    expect(connectionMock.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO disponibilites_professeurs"),
      [3, 7, "13:00:00", "15:00:00", "2026-08-24", "2026-12-18"]
    );
    expect(resultat.disponibilites[0].jour_semaine).toBe(7);
  });

  test("remplacerDisponibilitesProfesseur rollback si la replanification echoue", async () => {
    connectionMock.query.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM sessions")) {
        return [[sessionActiveMock]];
      }

      if (String(sql).includes("SELECT id_disponibilite_professeur")) {
        return [[]];
      }

      return [[]];
    });

    replanifierSeancesImpacteesParDisponibilitesMock.mockRejectedValue({
      message:
        "Impossible de finaliser automatiquement la mise a jour des disponibilites: 1 seance(s) reste(nt) sans creneau compatible dans la fenetre de rattrapage automatique.",
      statusCode: 409,
      details: [
        {
          id_affectation_cours: 42,
        },
      ],
    });

    await expect(
      remplacerDisponibilitesProfesseur(3, [
        {
          jour_semaine: 2,
          heure_debut: "09:30",
          heure_fin: "11:00",
        },
      ], {
        semaine_cible: 1,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(connectionMock.rollback).toHaveBeenCalledTimes(1);
    expect(connectionMock.commit).not.toHaveBeenCalled();
    expect(enregistrerJournalReplanificationDisponibilitesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.any(Function),
        getConnection: expect.any(Function),
      }),
      expect.objectContaining({
        id_professeur: 3,
        statut: "ECHEC",
      })
    );
  });
});
/**
 * TESTS - Modele Disponibilites Professeurs
 *
 * Ce fichier couvre la lecture et la mise a jour
 * des disponibilites des professeurs.
 */
