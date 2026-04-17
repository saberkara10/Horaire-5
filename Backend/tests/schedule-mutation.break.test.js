import { describe, expect, test } from "@jest/globals";
import { ScheduleMutationValidator } from "../src/services/scheduler/planning/ScheduleMutationValidator.js";

function buildSnapshot() {
  const placements = [
    {
      id_affectation_cours: 1,
      id_cours: 1,
      id_professeur: 2,
      id_salle: 3,
      id_groupe: 4,
      date: "2026-03-23",
      heure_debut: "08:00",
      heure_fin: "11:00",
    },
    {
      id_affectation_cours: 2,
      id_cours: 1,
      id_professeur: 2,
      id_salle: 3,
      id_groupe: 4,
      date: "2026-03-23",
      heure_debut: "11:00",
      heure_fin: "14:00",
    },
    {
      id_affectation_cours: 3,
      id_cours: 1,
      id_professeur: 2,
      id_salle: 3,
      id_groupe: 4,
      date: "2026-03-23",
      heure_debut: "18:00",
      heure_fin: "20:00",
    },
  ];

  return {
    session: {
      date_debut: "2026-03-01",
      date_fin: "2026-06-30",
    },
    dispParProf: new Map(),
    absencesParProf: new Map(),
    indispoParSalle: new Map(),
    clonePlacements: () => placements.map((placement) => ({ ...placement })),
    getCourse: () => ({
      id_cours: 1,
      est_en_ligne: false,
      type_salle: "Laboratoire",
      programme: "Programmation informatique",
    }),
    getProfessor: () => ({
      id_professeur: 2,
      specialite: "Programmation informatique",
      cours_ids: [1],
    }),
    getGroup: () => ({
      id_groupes_etudiants: 4,
      programme: "Programmation informatique",
      etape: "1",
    }),
    getRoom: () => ({
      id_salle: 3,
      type: "Laboratoire",
      capacite: 30,
    }),
    getParticipantsForAssignment: () => [201],
    cloneConstraintMatrix: () => ({
      liberer: () => {},
      profPeutEnseignerCours: () => true,
      profPeutPrendreGroupe: () => true,
      profPeutAjouterSeanceSemaine: () => true,
      groupePeutAjouterSeanceSemaine: () => true,
      salleLibre: () => true,
      profLibre: () => true,
      groupeLibre: () => true,
      etudiantsLibres: () => true,
    }),
  };
}

describe("ScheduleMutationValidator break constraint", () => {
  test("remonte un diagnostic explicite quand le 3e cours est trop proche du 2e", () => {
    const snapshot = buildSnapshot();
    const validation = ScheduleMutationValidator.validate({
      snapshot,
      originalPlacement: {
        id_affectation_cours: 3,
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        id_groupe: 4,
        date: "2026-03-24",
        heure_debut: "18:00",
        heure_fin: "20:00",
      },
      proposedPlacement: {
        id_affectation_cours: 3,
        id_cours: 1,
        id_professeur: 2,
        id_salle: 3,
        id_groupe: 4,
        date: "2026-03-23",
        heure_debut: "14:30",
        heure_fin: "17:30",
      },
    });

    expect(validation.feasible).toBe(false);
    expect(validation.reasons.some((reason) => reason.code === "BREAK_AFTER_TWO_CONSECUTIVE_REQUIRED")).toBe(true);
    expect(
      validation.reasons.some(
        (reason) =>
          reason.details?.resource_type === "etudiant" &&
          reason.details?.resource_id === 201 &&
          reason.details?.gap_minutes === 30
      )
    ).toBe(true);
  });
});
