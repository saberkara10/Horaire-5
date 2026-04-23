import { afterEach, describe, expect, test } from "@jest/globals";
import { GroupFormer } from "../src/services/scheduler/GroupFormer.js";

function construireEtudiants(effectif, programme = "Programmation informatique", etape = 2) {
  return Array.from({ length: effectif }, (_, index) => ({
    id_etudiant: index + 1,
    matricule: `MAT${String(index + 1).padStart(4, "0")}`,
    nom: `Nom${index + 1}`,
    prenom: `Prenom${index + 1}`,
    programme,
    etape,
  }));
}

function construireReprises(effectif, idCours) {
  return new Map(
    Array.from({ length: effectif }, (_, index) => [
      1000 + index,
      [{ id: 5000 + index, id_cours: idCours }],
    ])
  );
}

describe("GroupFormer", () => {
  afterEach(() => {
    delete process.env.ENABLE_ONLINE_COURSES;
  });

  test("cree des groupes supplementaires quand les reprises augmentent la charge reelle du cours", () => {
    const etudiants = construireEtudiants(52);
    const cours = [
      {
        id_cours: 201,
        code: "INF201",
        programme: "Programmation informatique",
        etape_etude: "2",
        est_en_ligne: 0,
      },
      {
        id_cours: 202,
        code: "INF202",
        programme: "Programmation informatique",
        etape_etude: "2",
        est_en_ligne: 0,
      },
    ];

    const { groupesFormes } = GroupFormer.formerGroupes(
      etudiants,
      cours,
      construireReprises(12, 201)
    );

    expect(groupesFormes).toHaveLength(3);
    expect(groupesFormes.every((groupe) => groupe.taille_max === 30)).toBe(true);
    expect(groupesFormes.every((groupe) => groupe.etudiants.length <= 18)).toBe(true);

    const reprisesReservees = groupesFormes.reduce(
      (total, groupe) =>
        total + Number(groupe.reprises_reservees_par_cours?.["201"] || 0),
      0
    );
    expect(reprisesReservees).toBe(12);
    expect(
      groupesFormes.every(
        (groupe) => GroupFormer.lireEffectifCours(groupe, 201) <= 30
      )
    ).toBe(true);
    expect(
      groupesFormes.some(
        (groupe) => GroupFormer.lireEffectifCours(groupe, 201) > groupe.etudiants.length
      )
    ).toBe(true);
  });

  test("reserve aussi les reprises d'un cours en ligne quand la planification en ligne reste active", () => {
    const etudiants = construireEtudiants(26, "Programmation informatique", 1);
    const cours = [
      {
        id_cours: 101,
        code: "INF101",
        programme: "Programmation informatique",
        etape_etude: "1",
        est_en_ligne: 0,
      },
      {
        id_cours: 150,
        code: "INF150",
        programme: "Programmation informatique",
        etape_etude: "1",
        est_en_ligne: 1,
      },
    ];

    const { groupesFormes } = GroupFormer.formerGroupes(
      etudiants,
      cours,
      construireReprises(8, 150)
    );

    expect(groupesFormes).toHaveLength(2);
    const reprisesReservees = groupesFormes.reduce(
      (total, groupe) =>
        total + Number(groupe.reprises_reservees_par_cours?.["150"] || 0),
      0
    );
    expect(reprisesReservees).toBe(8);
    expect(
      groupesFormes.every(
        (groupe) => GroupFormer.lireEffectifProjeteMax(groupe) <= 30
      )
    ).toBe(true);
  });

  test("ignore les reprises d'un cours en ligne lorsque la planification en ligne est explicitement desactivee", () => {
    process.env.ENABLE_ONLINE_COURSES = "false";

    const etudiants = construireEtudiants(26, "Programmation informatique", 1);
    const cours = [
      {
        id_cours: 101,
        code: "INF101",
        programme: "Programmation informatique",
        etape_etude: "1",
        est_en_ligne: 0,
      },
      {
        id_cours: 150,
        code: "INF150",
        programme: "Programmation informatique",
        etape_etude: "1",
        est_en_ligne: 1,
      },
    ];

    const { groupesFormes } = GroupFormer.formerGroupes(
      etudiants,
      cours,
      construireReprises(8, 150)
    );

    expect(groupesFormes).toHaveLength(1);
    expect(GroupFormer.lireEffectifProjeteMax(groupesFormes[0])).toBe(26);
    expect(groupesFormes[0].reprises_reservees_par_cours?.["150"]).toBeUndefined();
  });
});
