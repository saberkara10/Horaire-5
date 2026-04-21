/**
 * Generation des modeles Excel telechargeables pour les imports CRUD.
 */

import XLSX from "xlsx";
import { creerErreurImportExcel } from "./import-excel.shared.js";
import { recupererDefinitionImportExcel } from "./import-excel.definitions.js";

const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function definirLargeursColonnes(columns = []) {
  return columns.map((colonne) => ({
    wch: Math.max(
      String(colonne.key || "").length + 4,
      String(colonne.example || "").length + 4,
      18
    ),
  }));
}

function construireFeuilleModele(definition) {
  const entetes = definition.columns.map((colonne) => colonne.key);
  const lignes = [
    entetes,
    ...definition.exampleRows.map((ligne) =>
      definition.columns.map((colonne) => ligne[colonne.key] ?? "")
    ),
  ];

  const feuille = XLSX.utils.aoa_to_sheet(lignes);
  feuille["!cols"] = definirLargeursColonnes(definition.columns);
  return feuille;
}

function construireFeuilleGuide(definition) {
  const lignes = [
    ["Module", definition.moduleLabel],
    [
      "Strategie d'import",
      "Import partiel : chaque ligne valide est creee ou mise a jour. Les lignes en erreur sont rejetees et listees dans le resume.",
    ],
    ["Feuille recommandee", definition.sheetName],
    [""],
    ["Colonne", "Obligatoire", "Description", "Exemple"],
    ...definition.columns.map((colonne) => [
      colonne.key,
      colonne.required ? "Oui" : "Non",
      colonne.description,
      colonne.example || "",
    ]),
    [""],
    ["Notes", ""],
    ...definition.notes.map((note) => [note, ""]),
  ];

  const feuille = XLSX.utils.aoa_to_sheet(lignes);
  feuille["!cols"] = [{ wch: 42 }, { wch: 16 }, { wch: 92 }, { wch: 26 }];
  return feuille;
}

export function genererModeleImportExcel(moduleKey) {
  const definition = recupererDefinitionImportExcel(moduleKey);

  if (!definition) {
    throw creerErreurImportExcel("Module d'import inconnu.", [], 404);
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    construireFeuilleModele(definition),
    definition.sheetName
  );
  XLSX.utils.book_append_sheet(
    workbook,
    construireFeuilleGuide(definition),
    "Guide"
  );

  return {
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    contentType: MIME_XLSX,
    filename: definition.filename,
  };
}
