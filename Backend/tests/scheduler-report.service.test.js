import { describe, expect, jest, test } from "@jest/globals";
import { SchedulerReportService } from "../src/services/scheduler/SchedulerReportService.js";

function createExecutorWithReport(details) {
  return {
    query: jest.fn(async (sql) => {
      if (sql.includes("FROM rapports_generation")) {
        return [[
          {
            id: 1,
            id_session: 1,
            genere_par: 7,
            date_generation: "2026-09-10T10:00:00.000Z",
            score_qualite: 90,
            nb_cours_planifies: 12,
            nb_cours_non_planifies: 1,
            nb_cours_echoues_traites: 0,
            nb_cours_en_ligne_generes: 0,
            nb_groupes_speciaux: 0,
            nb_resolutions_manuelles: 0,
            details: JSON.stringify(details),
            session_nom: "Automne 2026",
            generateur_nom: "Durand",
            generateur_prenom: "Alice",
          },
        ]];
      }

      throw new Error(`Requete non prise en charge: ${sql}`);
    }),
  };
}

describe("SchedulerReportService", () => {
  test("continue d'exposer details.scoring_v1 et enrichit le resume scoring", async () => {
    const executor = createExecutorWithReport({
      non_planifies: [],
      details: {
        scoring_v1: {
          version: "v1",
          readOnly: true,
          modes: {
            equilibre: {
              mode: "equilibre",
              scoreGlobal: 82,
              scoreEtudiant: 80,
              scoreProfesseur: 79,
              scoreGroupe: 86,
            },
          },
          metrics: {
            pausesEtudiantsRespectees: 2,
            pausesEtudiantsManquees: 0,
            pausesProfesseursRespectees: 3,
            pausesProfesseursManquees: 1,
            pausesGroupesRespectees: 2,
            pausesGroupesManquees: 0,
            nbCoursNonPlanifies: 1,
            nbConflitsEvites: 4,
          },
        },
      },
    });

    const report = await SchedulerReportService.lireRapport(1, executor);

    expect(report.details_bruts.details.scoring_v1).toBeDefined();
    expect(report.resume_scoring_v1.modes.equilibre.scoreGroupe).toBe(86);
    expect(report.resume_scoring_v1.metrics.nbCoursNonPlanifies).toBe(1);
    expect(report.resume_scoring_v1.metrics.nbConflitsEvites).toBe(4);
  });

  test("lit un ancien rapport sans nouveaux champs sans casser la lecture", async () => {
    const executor = createExecutorWithReport({
      scoring_v1: {
        version: "v1",
        readOnly: true,
        modes: {
          equilibre: {
            mode: "equilibre",
            scoreGlobal: 74,
            scoreEtudiant: 76,
            scoreProfesseur: 72,
          },
        },
        details: {
          etudiant: {
            totals: {
              dynamicBreaksRespected: 1,
              dynamicBreaksMissed: 0,
            },
          },
          professeur: {
            totals: {
              pauseRespectedCount: 1,
              pauseMissedCount: 0,
            },
          },
        },
      },
    });

    const report = await SchedulerReportService.lireRapport(1, executor);

    expect(report.details_bruts.details.scoring_v1).toBeDefined();
    expect(report.resume_scoring_v1.modes.equilibre.scoreGroupe).toBe(0);
    expect(report.resume_scoring_v1.metrics.pausesEtudiantsRespectees).toBe(1);
    expect(report.resume_scoring_v1.metrics.pausesGroupesRespectees).toBe(0);
  });
});
