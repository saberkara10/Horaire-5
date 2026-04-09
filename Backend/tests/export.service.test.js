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
];

const horaireEtudiantReprises = horaireEtudiantFusionne.filter(
  (seance) => seance.est_reprise
);

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

function enHex(value) {
  return Buffer.from(String(value), "latin1").toString("hex");
}

describe("ExportService", () => {
  test("genere un PDF groupe avec une vraie structure d'horaire", async () => {
    const buffer = await genererPDFGroupe({ groupe, horaire: horaireGroupe });
    const contenu = buffer.toString("latin1");

    expect(buffer.length).toBeGreaterThan(4000);
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

    expect(buffer.length).toBeGreaterThan(4000);
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

    expect(buffer.length).toBeGreaterThan(5000);
    expect(contenu).toContain("Horaire de l'etudiant");
    expect(contenu).toContain(enHex("Statistiques"));
    expect(contenu).toContain(enHex("GAD-E1-2"));
  });

  test("genere un Excel groupe avec vue hebdo et detail", () => {
    const buffer = genererExcelGroupe({ groupe, horaire: horaireGroupe });
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const detailRows = XLSX.utils.sheet_to_json(
      workbook.Sheets["Seances detaillees"],
      { range: 3 }
    );

    expect(workbook.SheetNames).toEqual(
      expect.arrayContaining(["Vue hebdo", "Seances detaillees"])
    );
    expect(detailRows[0]["Code cours"]).toBe("INF101");
    expect(detailRows[1]["Professeur"]).toContain("Anne");
  });

  test("genere un Excel professeur avec vue hebdo et detail", () => {
    const buffer = genererExcelProfesseur({
      professeur,
      horaire: horaireProfesseur,
    });
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const detailRows = XLSX.utils.sheet_to_json(
      workbook.Sheets["Seances detaillees"],
      { range: 3 }
    );

    expect(workbook.SheetNames).toEqual(
      expect.arrayContaining(["Vue hebdo", "Seances detaillees"])
    );
    expect(detailRows.some((row) => row["Groupes"] === "GAD-E1-1")).toBe(true);
    expect(detailRows.some((row) => row["Code cours"] === "INF220")).toBe(true);
  });

  test("genere un Excel etudiant avec vue hebdo, detail et reprises", () => {
    const buffer = genererExcelEtudiant({
      etudiant,
      horaire: horaireEtudiantFusionne,
      horaire_reprises: horaireEtudiantReprises,
      reprises,
      resume: { charge_cible: 5 },
    });
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const detailRows = XLSX.utils.sheet_to_json(
      workbook.Sheets["Seances detaillees"],
      { range: 3 }
    );
    const repriseRows = XLSX.utils.sheet_to_json(workbook.Sheets.Reprises, {
      range: 3,
    });

    expect(workbook.SheetNames).toEqual(
      expect.arrayContaining(["Vue hebdo", "Seances detaillees", "Reprises"])
    );
    expect(detailRows.some((row) => row.Reprise === "Oui")).toBe(true);
    expect(detailRows.some((row) => row["Groupe suivi"] === "GAD-E1-2")).toBe(true);
    expect(repriseRows.some((row) => row["Code cours"] === "COM300")).toBe(true);
  });
});
