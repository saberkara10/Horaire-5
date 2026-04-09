import { describe, expect, test } from "@jest/globals";
import {
  calculerFenetreApplicationDisponibilites,
  DATE_DEBUT_DISPONIBILITE_DEFAUT,
  DATE_FIN_DISPONIBILITE_DEFAUT,
} from "../src/services/professeurs/availability-temporal.js";

const sessionActiveMock = {
  id_session: 1,
  nom: "Automne 2026",
  date_debut: "2026-08-24",
  date_fin: "2026-12-18",
};

describe("availability-temporal", () => {
  test("calcule une portee permanente avec un impact borne a la session active", () => {
    const resultat = calculerFenetreApplicationDisponibilites(sessionActiveMock, {
      semaine_cible: 4,
      mode_application: "permanente",
    });

    expect(resultat).toMatchObject({
      numero_semaine: 4,
      mode_application: "permanente",
      date_debut_effet: DATE_DEBUT_DISPONIBILITE_DEFAUT,
      date_fin_effet: DATE_FIN_DISPONIBILITE_DEFAUT,
      date_debut_impact: "2026-08-24",
      date_fin_impact: "2026-12-18",
    });
  });

  test("calcule une portee a partir d'une date avec impact jusqu'a la fin de session", () => {
    const resultat = calculerFenetreApplicationDisponibilites(sessionActiveMock, {
      mode_application: "a_partir_date",
      date_debut_effet: "2026-10-05",
    });

    expect(resultat).toMatchObject({
      mode_application: "a_partir_date",
      date_debut_effet: "2026-10-05",
      date_fin_effet: "2026-12-18",
      date_debut_impact: "2026-10-05",
      date_fin_impact: "2026-12-18",
    });
    expect(resultat.numero_semaine).toBeGreaterThanOrEqual(1);
  });

  test("calcule une plage de dates et borne l'impact a la session active", () => {
    const resultat = calculerFenetreApplicationDisponibilites(sessionActiveMock, {
      mode_application: "plage_dates",
      date_debut_effet: "2026-08-10",
      date_fin_effet: "2026-09-05",
    });

    expect(resultat).toMatchObject({
      mode_application: "plage_dates",
      date_debut_effet: "2026-08-10",
      date_fin_effet: "2026-09-05",
      date_debut_impact: "2026-08-24",
      date_fin_impact: "2026-09-05",
    });
    expect(resultat.numero_semaine).toBe(1);
  });
});
