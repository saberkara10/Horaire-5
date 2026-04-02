/**
 * TESTS - Utils Programmes
 *
 * Ce fichier couvre la normalisation
 * des noms de programme.
 */
import { describe, expect, test } from "@jest/globals";
import {
  PROGRAMMES_OFFICIELS,
  normaliserTexte,
  normaliserNomProgramme,
  programmesCorrespondent,
} from "../src/utils/programmes.js";

describe("Utils programmes", () => {
  test("normaliserTexte nettoie accents, espaces et casse", () => {
    expect(normaliserTexte("  Développement   Web  ")).toBe("developpement web");
  });

  test("normaliserNomProgramme reconnait les alias techniques", () => {
    expect(normaliserNomProgramme("dev web")).toBe(PROGRAMMES_OFFICIELS.web);
    expect(normaliserNomProgramme("PI")).toBe(PROGRAMMES_OFFICIELS.informatique);
    expect(normaliserNomProgramme("Reseaux")).toBe(PROGRAMMES_OFFICIELS.reseautique);
    expect(normaliserNomProgramme("IA")).toBe(PROGRAMMES_OFFICIELS.ia);
  });

  test("normaliserNomProgramme reconnait les familles administratives", () => {
    expect(normaliserNomProgramme("Commerce international")).toBe(
      PROGRAMMES_OFFICIELS.administration
    );
    expect(normaliserNomProgramme("gestion financiere")).toBe(
      PROGRAMMES_OFFICIELS.comptabilite
    );
    expect(normaliserNomProgramme("logistique")).toBe(
      PROGRAMMES_OFFICIELS.chaine
    );
    expect(normaliserNomProgramme("marketing")).toBe(
      PROGRAMMES_OFFICIELS.marketing
    );
  });

  test("normaliserNomProgramme reconnait les autres programmes officiels", () => {
    expect(normaliserNomProgramme("Design graphique")).toBe(
      PROGRAMMES_OFFICIELS.design
    );
    expect(normaliserNomProgramme("multimedia")).toBe(
      PROGRAMMES_OFFICIELS.multimedia
    );
    expect(normaliserNomProgramme("Travail social")).toBe(
      PROGRAMMES_OFFICIELS.social
    );
    expect(normaliserNomProgramme("Soins infirmiers auxiliaires")).toBe(
      PROGRAMMES_OFFICIELS.soins
    );
    expect(normaliserNomProgramme("Techniques de laboratoire")).toBe(
      PROGRAMMES_OFFICIELS.laboratoire
    );
    expect(normaliserNomProgramme("Gestion hoteliere")).toBe(
      PROGRAMMES_OFFICIELS.hotelier
    );
    expect(normaliserNomProgramme("Techniques juridiques")).toBe(
      PROGRAMMES_OFFICIELS.juridique
    );
    expect(normaliserNomProgramme("Education en services a l'enfance")).toBe(
      PROGRAMMES_OFFICIELS.enfance
    );
  });

  test("normaliserNomProgramme conserve la valeur brute si aucun alias ne correspond", () => {
    expect(normaliserNomProgramme("Programme libre")).toBe("Programme libre");
    expect(normaliserNomProgramme("")).toBe("");
  });

  test("programmesCorrespondent compare apres normalisation", () => {
    expect(programmesCorrespondent("Commerce", "Techniques en administration des affaires")).toBe(true);
    expect(programmesCorrespondent("Informatique", "Programmation informatique")).toBe(true);
    expect(programmesCorrespondent("Programme libre", "Programme libre")).toBe(true);
    expect(programmesCorrespondent("Programme libre", "Autre")).toBe(false);
    expect(programmesCorrespondent("", "Commerce")).toBe(false);
  });
});
