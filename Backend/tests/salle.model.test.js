/**
 * TESTS - Modele Salles
 *
 * Ce fichier couvre :
 * - le CRUD historique des salles ;
 * - la nouvelle reconstitution d'occupation hebdomadaire ;
 * - les indicateurs metier et le resume dynamique "maintenant / prochain".
 */
import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

const queryMock = jest.fn();

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

const salleModel = await import("../src/model/salle.js");

describe("model salle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("getAllSalles retourne la liste des salles", async () => {
    queryMock.mockResolvedValue([
      [{ id_salle: 1, code: "A101", type: "LAB", capacite: 30 }],
    ]);

    const result = await salleModel.getAllSalles();

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("A101");
  });

  test("getSalleById retourne une salle", async () => {
    queryMock.mockResolvedValue([
      [{ id_salle: 1, code: "A101", type: "LAB", capacite: 30 }],
    ]);

    const result = await salleModel.getSalleById(1);

    expect(result.id_salle).toBe(1);
    expect(result.code).toBe("A101");
  });

  test("getSalleById retourne undefined si absente", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await salleModel.getSalleById(999);

    expect(result).toBeUndefined();
  });

  test("getSalleByCode retourne une salle", async () => {
    queryMock.mockResolvedValue([
      [{ id_salle: 1, code: "A101", type: "LAB", capacite: 30 }],
    ]);

    const result = await salleModel.getSalleByCode("A101");

    expect(result.code).toBe("A101");
  });

  test("getSalleByCode retourne undefined si absente", async () => {
    queryMock.mockResolvedValue([[]]);

    const result = await salleModel.getSalleByCode("Z999");

    expect(result).toBeUndefined();
  });

  test("addSalle retourne le resultat SQL", async () => {
    queryMock.mockResolvedValue([{ insertId: 5, affectedRows: 1 }]);

    const result = await salleModel.addSalle("B201", "LAB", 25);

    expect(result.insertId).toBe(5);
    expect(result.affectedRows).toBe(1);
  });

  test("modifySalle retourne le resultat SQL", async () => {
    queryMock.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await salleModel.modifySalle(1, "LAB", 40);

    expect(result.affectedRows).toBe(1);
  });

  test("deleteSalle retourne le resultat SQL", async () => {
    queryMock.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await salleModel.deleteSalle(1);

    expect(result.affectedRows).toBe(1);
  });

  test("recupererOccupationSalle retourne l'occupation, les creneaux libres et le resume temps reel", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-23T09:30:00"));
    queryMock
      .mockResolvedValueOnce([
        [{ id_salle: 1, code: "B201", type: "Classe", capacite: 30 }],
      ])
      .mockResolvedValueOnce([
        [
          {
            id_session: 3,
            nom: "Automne 2026",
            date_debut: "2026-03-16",
            date_fin: "2026-05-31",
            active: 1,
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id_affectation_cours: 10,
            id_cours: 5,
            code_cours: "INF301",
            nom_cours: "Reseaux",
            programme_cours: "Informatique",
            etape_etude: "3",
            type_cours: "Classe",
            id_professeur: 8,
            nom_professeur: "Dupont",
            prenom_professeur: "Ali",
            id_salle: 1,
            code_salle: "B201",
            type_salle: "Classe",
            capacite_salle: 30,
            id_plage_horaires: 40,
            date: "2026-03-23",
            heure_debut: "08:00:00",
            heure_fin: "10:00:00",
            id_groupes_etudiants: 12,
            nom_groupe: "INF-A1",
            programme_groupe: "Informatique",
            etape_groupe: "3",
            effectif_groupe: 24,
            est_groupe_special: 0,
          },
          {
            id_affectation_cours: 11,
            id_cours: 6,
            code_cours: "INF350",
            nom_cours: "Securite",
            programme_cours: "Informatique",
            etape_etude: "3",
            type_cours: "Classe",
            id_professeur: 9,
            nom_professeur: "Ndiaye",
            prenom_professeur: "Maya",
            id_salle: 1,
            code_salle: "B201",
            type_salle: "Classe",
            capacite_salle: 30,
            id_plage_horaires: 41,
            date: "2026-03-23",
            heure_debut: "13:00:00",
            heure_fin: "15:00:00",
            id_groupes_etudiants: 13,
            nom_groupe: "INF-A2",
            programme_groupe: "Informatique",
            etape_groupe: "3",
            effectif_groupe: 20,
            est_groupe_special: 0,
          },
        ],
      ]);

    const result = await salleModel.recupererOccupationSalle(1, {
      id_session: 3,
      date_reference: "2026-03-23",
    });

    expect(result.salle).toMatchObject({
      id_salle: 1,
      code: "B201",
      type: "Classe",
    });
    expect(result.session).toMatchObject({
      id_session: 3,
      nom: "Automne 2026",
    });
    expect(result.occupations).toHaveLength(2);
    expect(result.occupations[0]).toMatchObject({
      groupes: "INF-A1",
      code_cours: "INF301",
      nom_professeur: "Dupont",
      prenom_professeur: "Ali",
      effectif_total: 24,
      statut: "occupee",
    });
    expect(result.vue_hebdomadaire).toMatchObject({
      date_reference: "2026-03-23",
      debut_semaine: "2026-03-23",
      fin_semaine: "2026-03-29",
    });
    expect(
      result.vue_hebdomadaire.jours[0].creneaux.some(
        (creneau) => creneau.statut === "libre"
      )
    ).toBe(true);
    expect(result.resume).toMatchObject({
      creneaux_occupes: 2,
      creneaux_libres: 8,
      volume_horaire_occupe_minutes: 240,
      taux_occupation_pourcentage: 4,
    });
    expect(result.temps_reel).toMatchObject({
      statut: "occupee",
      occupee_maintenant: true,
      disponibilite_restante_aujourdhui_minutes: 660,
    });
    expect(result.temps_reel.occupation_actuelle).toMatchObject({
      code_cours: "INF301",
      groupes: "INF-A1",
    });
    expect(result.temps_reel.prochain_creneau).toMatchObject({
      code_cours: "INF350",
      groupes: "INF-A2",
    });
  });

  test("recupererOccupationSalle signale l'absence de session active", async () => {
    queryMock
      .mockResolvedValueOnce([
        [{ id_salle: 1, code: "B201", type: "Classe", capacite: 30 }],
      ])
      .mockResolvedValueOnce([[]]);

    await expect(salleModel.recupererOccupationSalle(1)).rejects.toMatchObject({
      message: "Aucune session active n'est disponible.",
      statusCode: 409,
    });
  });
});
