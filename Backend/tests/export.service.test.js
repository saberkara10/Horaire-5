import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import {
  genererExcelEtudiant,
  genererExcelGroupe,
  genererExcelProfesseur,
  genererPDFEtudiant,
  genererPDFGroupe,
  genererPDFProfesseur,
} from "../src/services/ExportService.js";

const groupe = {
  nom_groupe: "GAD-E1-1",
  programme: "Gestion",
  etape: 1,
  session: "Hiver",
  annee: 2026,
  effectif: 28,
};

const professeur = {
  prenom: "Marc",
  nom: "Tremblay",
  matricule: "P-102",
  specialite: "Gestion",
  programmes_assignes: "Gestion",
  session: "Hiver",
  annee: 2026,
};

const etudiant = {
  prenom: "Saber",
  nom: "Kara",
  matricule: "E-501",
  programme: "Gestion",
  etape: 1,
  groupe: "GAD-E1-1",
  session: "Hiver",
  annee: 2026,
};

const horaireGroupe = [
  {
    id_affectation_cours: 1,
    id_plage_horaires: 11,
    code_cours: "INF101",
    nom_cours: "Programmation",
    nom_professeur: "Tremblay",
    prenom_professeur: "Marc",
    code_salle: "A-201",
    type_salle: "Laboratoire",
    date: "2026-01-12",
    heure_debut: "08:00",
    heure_fin: "10:00",
  },
  {
    id_affectation_cours: 2,
    id_plage_horaires: 12,
    code_cours: "ADM110",
    nom_cours: "Comptabilite",
    nom_professeur: "Rousseau",
    prenom_professeur: "Anne",
    code_salle: "B-104",
    type_salle: "Classe",
    date: "2026-01-13",
    heure_debut: "13:00",
    heure_fin: "15:00",
  },
];

const horaireProfesseur = [
  {
    id_affectation_cours: 1,
    id_plage_horaires: 11,
    code_cours: "INF101",
    nom_cours: "Programmation",
    groupes: "GAD-E1-1",
    code_salle: "A-201",
    type_salle: "Laboratoire",
    etape_etude: "1",
    date: "2026-01-12",
    heure_debut: "08:00",
    heure_fin: "10:00",
  },
  {
    id_affectation_cours: 3,
    id_plage_horaires: 13,
    code_cours: "INF220",
    nom_cours: "Analyse",
    groupes: "GAD-E2-1",
    code_salle: "C-310",
    type_salle: "Classe",
    etape_etude: "2",
    date: "2026-01-14",
    heure_debut: "10:00",
    heure_fin: "12:00",
  },
];

const horaireEtudiantFusionne = [
  {
    id_affectation_cours: 1,
    id_plage_horaires: 11,
    id_cours: 101,
    code_cours: "INF101",
    nom_cours: "Programmation",
    nom_professeur: "Tremblay",
    prenom_professeur: "Marc",
    code_salle: "A-201",
    type_salle: "Laboratoire",
    date: "2026-01-12",
    heure_debut: "08:00",
    heure_fin: "10:00",
    est_reprise: false,
    source_horaire: "groupe",
    groupe_source: "GAD-E1-1",
  },
  {
    id_affectation_cours: 4,
    id_plage_horaires: 14,
    id_cours: 202,
    code_cours: "MAT201",
    nom_cours: "Statistiques",
    nom_professeur: "Lefebvre",
    prenom_professeur: "Julie",
    code_salle: "D-120",
    type_salle: "Classe",
    date: "2026-01-15",
    heure_debut: "14:00",
    heure_fin: "16:00",
    est_reprise: true,
    source_horaire: "reprise",
    groupe_source: "GAD-E1-2",
    statut_reprise: "planifie",
    note_echec: 52,
  },
  {
    id_affectation_cours: 5,
    id_plage_horaires: 15,
    id_cours: 203,
    code_cours: "POO302",
    nom_cours: "Programmation objet avancee",
    nom_professeur: "Nguyen",
    prenom_professeur: "Hoa",
    code_salle: "L-220",
    type_salle: "Laboratoire",
    date: "2026-01-16",
    heure_debut: "12:00",
    heure_fin: "15:00",
    est_reprise: false,
    source_horaire: "individuelle",
    groupe_source: "GAD-E1-3",
  },
];

const horaireEtudiantReprises = horaireEtudiantFusionne.filter((seance) => seance.est_reprise);

const reprises = [
  {
    code_cours: "MAT201",
    nom_cours: "Statistiques",
    etape_etude: "1",
    statut: "planifie",
    note_echec: 52,
    groupe_reprise: "GAD-E1-2",
  },
  {
    code_cours: "COM300",
    nom_cours: "Communication",
    etape_etude: "1",
    statut: "a_reprendre",
    note_echec: 48,
    groupe_reprise: null,
  },
];

const horaireEtudiantLong = [
  {
    id_affectation_cours: 11,
    id_plage_horaires: 21,
    id_cours: 301,
    code_cours: "ADM450",
    nom_cours:
      "Architecture organisationnelle et transformation numerique des services academiques internationaux",
    nom_professeur: "De La Roche-Lambert",
    prenom_professeur: "Alexandrine Maximilienne",
    code_salle: "PAV-401",
    type_salle: "Classe",
    date: "2026-01-13",
    heure_debut: "09:00",
    heure_fin: "12:00",
    est_reprise: false,
    source_horaire: "individuelle",
    groupe_source: "GAD-E1-9",
  },
];

const horaireEtudiantWeekend = [
  {
    id_affectation_cours: 21,
    id_plage_horaires: 31,
    id_cours: 401,
    code_cours: "MAT410",
    nom_cours: "Methodes quantitatives appliquees a la reprise academique intensive",
    nom_professeur: "Beaulieu-Saint-Pierre",
    prenom_professeur: "Catherine Elisabeth",
    code_salle: "A-510",
    type_salle: "Classe",
    date: "2026-01-17",
    heure_debut: "09:00",
    heure_fin: "12:00",
    est_reprise: true,
    source_horaire: "reprise",
    groupe_source: "GAD-E1-4",
    statut_reprise: "planifie",
    note_echec: 58,
  },
  {
    id_affectation_cours: 22,
    id_plage_horaires: 32,
    id_cours: 402,
    code_cours: "COM510",
    nom_cours: "Communication professionnelle internationale",
    nom_professeur: "Lafleur",
    prenom_professeur: "Nadine",
    code_salle: "B-620",
    type_salle: "Classe",
    date: "2026-01-18",
    heure_debut: "13:00",
    heure_fin: "16:00",
    est_reprise: false,
    source_horaire: "individuelle",
    groupe_source: "GAD-E1-6",
  },
];

const horaireEtudiantWeekendReprises = horaireEtudiantWeekend.filter((seance) => seance.est_reprise);

function enHex(value) {
  return Buffer.from(String(value), "latin1").toString("hex");
}

async function chargerWorkbookExcelJs(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function trouverCelluleContenant(worksheet, texte) {
  for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    for (let columnIndex = 1; columnIndex <= worksheet.columnCount; columnIndex += 1) {
      const cell = row.getCell(columnIndex);
      const value = cell.value === null || cell.value === undefined ? "" : String(cell.value);
      if (value.includes(texte)) {
        return cell;
      }
    }
  }
  return null;
}

function contientTextePdf(contenu, texte) {
  return contenu.includes(texte) || contenu.includes(enHex(texte));
}

describe("ExportService", () => {
  test("genere un PDF groupe avec une vraie structure d'horaire", async () => {
    const buffer = await genererPDFGroupe({ groupe, horaire: horaireGroupe });
    const contenu = buffer.toString("latin1");

    expect(buffer.length).toBeGreaterThan(4500);
    expect(contenu).toContain("HORAIRE 5");
    expect(contenu).toContain("Horaire du groupe");
    expect(contenu).toContain(enHex("INF101"));
  });

  test("genere un PDF professeur avec les groupes et cours attendus", async () => {
    const buffer = await genererPDFProfesseur({
      professeur,
      horaire: horaireProfesseur,
    });
    const contenu = buffer.toString("latin1");

    expect(buffer.length).toBeGreaterThan(4500);
    expect(contenu).toContain("Horaire du professeur");
    expect(contenu).toContain(enHex("GAD-E1-1"));
    expect(contenu).toContain(enHex("INF220"));
  });

  test("genere un PDF etudiant avec reprises et grille hebdomadaire", async () => {
    const buffer = await genererPDFEtudiant({
      etudiant,
      horaire: horaireEtudiantFusionne,
      horaire_reprises: horaireEtudiantReprises,
      reprises,
      resume: { charge_cible: 5 },
    });
    const contenu = buffer.toString("latin1");

    expect(buffer.length).toBeGreaterThan(5500);
    expect(contenu).toContain("Horaire de l'etudiant");
    expect(contenu).toContain(enHex("Statistiques"));
    expect(contenu).toContain(enHex("GAD-E1-2"));
    expect(contenu).toContain(enHex("GAD-E1-3"));
  });

  test("genere un PDF etudiant robuste avec des libelles longs", async () => {
    const buffer = await genererPDFEtudiant({
      etudiant,
      horaire: horaireEtudiantLong,
      horaire_reprises: [],
      reprises: [],
      resume: { charge_cible: 5 },
    });
    const contenu = buffer.toString("latin1");

    expect(buffer.length).toBeGreaterThan(4500);
    expect(contenu).toContain("Horaire de l'etudiant");
    expect(contenu).toContain(enHex("ADM450"));
  });

  test("genere un PDF etudiant avec les sept jours et des seances sur le week-end", async () => {
    const buffer = await genererPDFEtudiant({
      etudiant,
      horaire: horaireEtudiantWeekend,
      horaire_reprises: horaireEtudiantWeekendReprises,
      reprises,
      resume: { charge_cible: 5 },
    });
    const contenu = buffer.toString("latin1");

    expect(buffer.length).toBeGreaterThan(5000);
    expect(contientTextePdf(contenu, "Samedi")).toBe(true);
    expect(contientTextePdf(contenu, "COM510")).toBe(true);
  });

  test("genere un Excel groupe avec fusion verticale et style d'entete", async () => {
    const buffer = await genererExcelGroupe({ groupe, horaire: horaireGroupe });
    const workbookSheetJs = XLSX.read(buffer, { type: "buffer" });
    const workbookExcelJs = await chargerWorkbookExcelJs(buffer);
    const detailRows = XLSX.utils.sheet_to_json(workbookSheetJs.Sheets["Seances detaillees"], {
      range: 3,
    });
    const vueHebdo = workbookExcelJs.getWorksheet("Vue hebdo");
    const details = workbookExcelJs.getWorksheet("Seances detaillees");

    expect(workbookSheetJs.SheetNames).toEqual(
      expect.arrayContaining(["Vue hebdo", "Seances detaillees"])
    );
    expect(detailRows[0]["Code cours"]).toBe("INF101");
    expect(detailRows[1]["Professeur"]).toContain("Anne");
    expect(vueHebdo.columnCount).toBe(8);
    expect(vueHebdo.model.merges).toEqual(expect.arrayContaining(["B7:B10"]));
    expect(vueHebdo.getCell("B7").value).toContain("INF101");
    expect(vueHebdo.getCell("G6").value).toContain("Samedi");
    expect(vueHebdo.getCell("H6").value).toContain("Dimanche");
    expect(details.getCell("A4").fill.fgColor.argb).toBe("FF0F3D2E");
  });

  test("genere un Excel professeur avec vue hebdo et detail lisible", async () => {
    const buffer = await genererExcelProfesseur({
      professeur,
      horaire: horaireProfesseur,
    });
    const workbookSheetJs = XLSX.read(buffer, { type: "buffer" });
    const workbookExcelJs = await chargerWorkbookExcelJs(buffer);
    const detailRows = XLSX.utils.sheet_to_json(workbookSheetJs.Sheets["Seances detaillees"], {
      range: 3,
    });
    const vueHebdo = workbookExcelJs.getWorksheet("Vue hebdo");

    expect(workbookSheetJs.SheetNames).toEqual(
      expect.arrayContaining(["Vue hebdo", "Seances detaillees"])
    );
    expect(detailRows.some((row) => row.Groupes === "GAD-E1-1")).toBe(true);
    expect(detailRows.some((row) => row["Code cours"] === "INF220")).toBe(true);
    expect(vueHebdo.columnCount).toBe(8);
    expect(vueHebdo.getCell("B7").value).toContain("INF101");
    expect(vueHebdo.getCell("D11").value).toContain("INF220");
    expect(vueHebdo.getCell("G6").value).toContain("Samedi");
    expect(vueHebdo.getCell("H6").value).toContain("Dimanche");
  });

  test("genere un Excel etudiant avec orange reserve aux reprises et feuille de suivi coherente", async () => {
    const buffer = await genererExcelEtudiant({
      etudiant,
      horaire: horaireEtudiantFusionne,
      horaire_reprises: horaireEtudiantReprises,
      reprises,
      resume: { charge_cible: 5 },
    });
    const workbookSheetJs = XLSX.read(buffer, { type: "buffer" });
    const workbookExcelJs = await chargerWorkbookExcelJs(buffer);
    const detailRows = XLSX.utils.sheet_to_json(workbookSheetJs.Sheets["Seances detaillees"], {
      range: 3,
    });
    const repriseRows = XLSX.utils.sheet_to_json(workbookSheetJs.Sheets.Reprises, {
      range: 3,
    });
    const vueHebdo = workbookExcelJs.getWorksheet("Vue hebdo");
    const reprisesSheet = workbookExcelJs.getWorksheet("Reprises");
    const celluleReprise = trouverCelluleContenant(vueHebdo, "MAT201");

    expect(workbookSheetJs.SheetNames).toEqual(
      expect.arrayContaining(["Vue hebdo", "Seances detaillees", "Reprises"])
    );
    expect(detailRows.some((row) => row.Reprise === "Oui")).toBe(true);
    expect(detailRows.some((row) => row["Groupe suivi"] === "GAD-E1-2")).toBe(true);
    expect(
      detailRows.some(
        (row) => row.Type === "Exception individuelle" && row["Groupe suivi"] === "GAD-E1-3"
      )
    ).toBe(true);
    expect(vueHebdo.columnCount).toBe(8);
    expect(repriseRows).toHaveLength(1);
    expect(repriseRows[0]["Code cours"]).toBe("COM300");
    expect(celluleReprise).not.toBeNull();
    expect(celluleReprise.fill.fgColor.argb).toBe("FFFFF1E6");
    expect(vueHebdo.getCell("G6").value).toContain("Samedi");
    expect(vueHebdo.getCell("H6").value).toContain("Dimanche");
    expect(reprisesSheet.getCell("A4").fill.fgColor.argb).toBe("FF0F3D2E");
    expect(reprisesSheet.getCell("A5").fill.fgColor.argb).toBe("FFFFF1E6");
  });

  test("genere un Excel etudiant robuste avec contenu long sans lignes ecrasees", async () => {
    const buffer = await genererExcelEtudiant({
      etudiant,
      horaire: horaireEtudiantLong,
      horaire_reprises: [],
      reprises: [],
      resume: { charge_cible: 5 },
    });
    const workbook = await chargerWorkbookExcelJs(buffer);
    const detailSheet = workbook.getWorksheet("Seances detaillees");
    const vueHebdo = workbook.getWorksheet("Vue hebdo");
    const detailRow = detailSheet.getRow(5);
    const celluleLongue = trouverCelluleContenant(vueHebdo, "ADM450");

    expect(detailSheet.getCell("F5").value).toContain("Architecture organisationnelle");
    expect(detailRow.height).toBeGreaterThan(22);
    expect(celluleLongue).not.toBeNull();
    expect(String(celluleLongue.value)).toContain("Alexandrine Maximilienne");
  });

  test("genere un Excel etudiant avec samedi et dimanche utilises sans ecraser le contenu", async () => {
    const buffer = await genererExcelEtudiant({
      etudiant,
      horaire: horaireEtudiantWeekend,
      horaire_reprises: horaireEtudiantWeekendReprises,
      reprises,
      resume: { charge_cible: 5 },
    });
    const workbook = await chargerWorkbookExcelJs(buffer);
    const vueHebdo = workbook.getWorksheet("Vue hebdo");
    const celluleSamedi = trouverCelluleContenant(vueHebdo, "MAT410");
    const celluleDimanche = trouverCelluleContenant(vueHebdo, "COM510");

    expect(vueHebdo.columnCount).toBe(8);
    expect(vueHebdo.getCell("G6").value).toContain("Samedi");
    expect(vueHebdo.getCell("H6").value).toContain("Dimanche");
    expect(celluleSamedi).not.toBeNull();
    expect(String(celluleSamedi.value)).toContain("Groupe principal : GAD-E1-1");
    expect(String(celluleSamedi.value)).toContain("Groupe suivi : GAD-E1-4");
    expect(String(celluleSamedi.value)).toContain("Statut : REPRISE");
    expect(String(celluleSamedi.value)).toContain("Professeur : Catherine Elisabeth");
    expect(celluleSamedi.fill.fgColor.argb).toBe("FFFFF1E6");
    expect(celluleDimanche).not.toBeNull();
    expect(String(celluleDimanche.value)).toContain("COM510");
    expect(String(celluleDimanche.value)).toContain("Groupe suivi : GAD-E1-6");
  });
});
