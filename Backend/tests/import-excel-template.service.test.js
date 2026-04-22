import { describe, expect, test } from "@jest/globals";
import XLSX from "xlsx";

import { genererModeleImportExcel } from "../src/services/import-excel-template.service.js";

describe("import-excel-template.service", () => {
  test("genere un modele Excel exploitable pour le module cours", () => {
    const resultat = genererModeleImportExcel("cours");

    expect(resultat.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(resultat.filename).toBe("modele-import-cours.xlsx");
    expect(Buffer.isBuffer(resultat.buffer)).toBe(true);

    const workbook = XLSX.read(resultat.buffer, { type: "buffer" });

    expect(workbook.SheetNames).toEqual(["Cours", "Guide"]);
    expect(workbook.Sheets.Cours.A1.v).toBe("code");
    expect(workbook.Sheets.Cours.B1.v).toBe("nom");
    expect(workbook.Sheets.Guide.A1.v).toBe("Module");
    expect(workbook.Sheets.Guide.B1.v).toBe("Cours");
  });

  test("retourne une erreur 404 pour un module inconnu", () => {
    expect(() => genererModeleImportExcel("module-inconnu")).toThrow(
      "Module d'import inconnu."
    );

    try {
      genererModeleImportExcel("module-inconnu");
    } catch (error) {
      expect(error.status).toBe(404);
      expect(error.erreurs).toEqual([]);
    }
  });
});
