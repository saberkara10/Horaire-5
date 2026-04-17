import { describe, expect, jest, test } from "@jest/globals";
import {
  calculerDateFinRecherche,
  maximumHebdomadairePourCible,
  replanifierSeancesImpacteesParDisponibilites,
} from "../src/services/professeurs/availability-rescheduler.js";

describe("availability-rescheduler", () => {
  test("etend la recherche au-dela de la fin de session pour couvrir le rattrapage", () => {
    expect(calculerDateFinRecherche("2026-11-27", "2026-12-18")).toBe(
      "2027-01-15"
    );
  });

  test("utilise une fenetre de secours quand la fin de session est absente", () => {
    expect(calculerDateFinRecherche("2026-11-27", null)).toBe("2027-01-22");
  });

  test("autorise une 8e seance seulement sur une semaine de rattrapage", () => {
    expect(maximumHebdomadairePourCible("2026-09-08", "2026-09-10")).toBe(7);
    expect(maximumHebdomadairePourCible("2026-09-08", "2026-09-15")).toBe(8);
  });

  test("rejette un deplacement qui creerait un 3e cours consecutif sans pause suffisante pour un etudiant reel", async () => {
    const queryMock = jest.fn(async (sql, params = []) => {
      const texte = String(sql);

      if (texte.includes("FROM sessions") && texte.includes("active = TRUE")) {
        return [[
          {
            id_session: 1,
            nom: "Automne 2026",
            date_debut: "2026-08-24",
            date_fin: "2026-12-18",
          },
        ]];
      }

      if (texte.includes("FROM salles") && texte.includes("ORDER BY capacite ASC")) {
        return [[
          {
            id_salle: 1,
            code: "A101",
            type: "amphi",
            capacite: 40,
          },
        ]];
      }

      if (texte.includes("FROM absences_professeurs")) {
        return [[]];
      }

      if (texte.includes("FROM salles_indisponibles")) {
        return [[]];
      }

      if (
        texte.includes("FROM affectation_cours ac") &&
        texte.includes("GROUP_CONCAT(DISTINCT ge.nom_groupe")
      ) {
        return [[
          {
            id_affectation_cours: 10,
            id_cours: 1,
            id_salle: 1,
            id_plage_horaires: 20,
            code_cours: "INF101",
            nom_cours: "Programmation",
            duree: 3,
            programme: "Programmation informatique",
            etape_etude: "1",
            type_salle: "amphi",
            id_salle_reference: 1,
            code_salle: "A101",
            date: "2026-10-05",
            heure_debut: "12:00:00",
            heure_fin: "15:00:00",
            groupes: "G1",
          },
        ]];
      }

      if (
        texte.includes("SELECT ge.id_groupes_etudiants") &&
        texte.includes("COUNT(e.id_etudiant) AS effectif")
      ) {
        return [[
          {
            id_groupes_etudiants: 4,
            nom_groupe: "G1",
            taille_max: 30,
            programme: "Programmation informatique",
            etape: "1",
            effectif: 20,
          },
        ]];
      }

      if (
        texte.includes("SELECT e.id_etudiant,") &&
        texte.includes("id_groupe_principal") &&
        !texte.includes("JOIN affectation_groupes ag")
      ) {
        return [[
          {
            id_etudiant: 101,
            matricule: "E101",
            nom: "Alpha",
            prenom: "Ada",
            id_groupe_principal: 4,
            groupe_principal: "G1",
            type_impact: "regulier",
          },
        ]];
      }

      if (
        texte.includes("FROM affectation_etudiants ae") &&
        texte.includes("id_cours_echoue")
      ) {
        return [[
          {
            id_etudiant: 102,
            matricule: "E102",
            nom: "Beta",
            prenom: "Nora",
            id_groupe_principal: 4,
            groupe_principal: "G1",
            id_cours_echoue: 88,
            id_echange_cours: null,
            type_impact: "reprise",
          },
        ]];
      }

      if (
        texte.includes("FROM etudiants e") &&
        texte.includes("JOIN affectation_groupes ag") &&
        texte.includes("ae.source_type IN ('reprise', 'individuelle')")
      ) {
        expect(params).toEqual(expect.arrayContaining([101, 102]));
        const candidateDate = params[2];
        return [[
          {
            id_etudiant: 101,
            id_affectation_cours: 20,
            date: candidateDate,
            heure_debut: "08:00:00",
            heure_fin: "11:00:00",
          },
          {
            id_etudiant: 101,
            id_affectation_cours: 21,
            date: candidateDate,
            heure_debut: "11:00:00",
            heure_fin: "14:00:00",
          },
        ]];
      }

      if (
        texte.includes("COUNT(*) AS conflits") &&
        texte.includes("WHERE ac.id_professeur = ?")
      ) {
        return [[{ conflits: 0 }]];
      }

      if (
        texte.includes("COUNT(DISTINCT ac.id_affectation_cours) AS conflits") &&
        texte.includes("WHERE ag.id_groupes_etudiants IN")
      ) {
        return [[{ conflits: 0 }]];
      }

      if (
        texte.includes("COUNT(DISTINCT ac.id_affectation_cours) AS total") &&
        texte.includes("GROUP BY ag.id_groupes_etudiants")
      ) {
        return [[{ id_groupes_etudiants: 4, total: 0 }]];
      }

      if (
        texte.includes("SELECT COUNT(*) AS conflits") &&
        texte.includes("WHERE ac.id_salle = ?")
      ) {
        return [[{ conflits: 0 }]];
      }

      if (texte.includes("DELETE FROM affectation_groupes")) {
        return [[{ affectedRows: 1 }]];
      }

      if (texte.includes("DELETE FROM affectation_cours")) {
        return [[{ affectedRows: 1 }]];
      }

      if (texte.includes("DELETE FROM plages_horaires")) {
        return [[{ affectedRows: 1 }]];
      }

      if (texte.includes("UPDATE plages_horaires")) {
        return [[{ affectedRows: 1 }]];
      }

      if (texte.includes("UPDATE affectation_cours")) {
        return [[{ affectedRows: 1 }]];
      }

      return [[]];
    });

    const connection = { query: queryMock };

    const resultat = await replanifierSeancesImpacteesParDisponibilites(
      2,
      [
        {
          jour_semaine: 1,
          date_debut: "2026-10-05",
          date_fin: "2026-10-05",
          heure_debut: "14:00:00",
          heure_fin: "17:00:00",
        },
      ],
      connection,
      {
        dateDebutImpact: "2026-10-05",
        dateFinImpact: "2026-10-05",
      }
    );

    expect(resultat.statut).toBe("echec");
    expect(resultat.seances_non_replanifiees).toHaveLength(1);
    expect(resultat.seances_non_replanifiees[0].raison).toMatch(/pause/i);

    const requeteEtudiants = queryMock.mock.calls.find(
      ([sql]) =>
        String(sql).includes("FROM etudiants e") &&
        String(sql).includes("JOIN affectation_groupes ag") &&
        String(sql).includes("ae.source_type IN ('reprise', 'individuelle')")
    );

    expect(requeteEtudiants).toBeDefined();
  });
});
