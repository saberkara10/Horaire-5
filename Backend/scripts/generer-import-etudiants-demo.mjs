import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import {
  ACADEMIC_PROGRAM_CATALOG,
  TARGET_STUDENTS_PER_PROGRAM,
} from "../src/services/scheduler/AcademicCatalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const racineProjet = path.resolve(__dirname, "..", "..");
const dossierSortie = path.join(racineProjet, "documents");

const noms = [
  "Tremblay",
  "Gagnon",
  "Roy",
  "Cote",
  "Bouchard",
  "Morin",
  "Lefebvre",
  "Simard",
  "Parent",
  "Nguyen",
  "Benali",
  "Garcia",
  "Park",
  "Ahmed",
  "Liu",
  "Chen",
  "Traore",
  "Yilmaz",
  "Ali",
  "Benoit",
];

const prenoms = [
  "Adam",
  "Mia",
  "Nora",
  "Liam",
  "Sara",
  "Noah",
  "Lina",
  "Samir",
  "Yasmine",
  "Zoe",
  "Ethan",
  "Aya",
  "Karim",
  "Emma",
  "Anaya",
  "Ilyes",
  "Camille",
  "Rayan",
  "Jade",
  "Luca",
];

function creerTagExecution() {
  const maintenant = new Date();
  const annee = String(maintenant.getFullYear());
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  const heures = String(maintenant.getHours()).padStart(2, "0");
  const minutes = String(maintenant.getMinutes()).padStart(2, "0");
  const secondes = String(maintenant.getSeconds()).padStart(2, "0");

  return `${annee}${mois}${jour}-${heures}${minutes}${secondes}`;
}

function creerCodeProgramme(programme) {
  return (
    String(programme || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((mot) => mot[0])
      .join("")
      .toUpperCase() || "GEN"
  );
}

function creerCohorte({ programme, etape, session, effectif, tagExecution }) {
  const codeProgramme = creerCodeProgramme(programme);

  return Array.from({ length: effectif }, (_, index) => ({
    matricule: `${codeProgramme}${tagExecution.replace("-", "")}${String(
      index + 1
    ).padStart(4, "0")}`,
    nom: noms[index % noms.length],
    prenom: prenoms[(index * 3) % prenoms.length],
    programme,
    etape,
    session,
  }));
}

function melangerParRoundRobin(listes) {
  const resultat = [];
  let position = 0;

  while (listes.some((liste) => position < liste.length)) {
    for (const liste of listes) {
      if (position < liste.length) {
        resultat.push(liste[position]);
      }
    }
    position += 1;
  }

  return resultat;
}

const tagExecution = creerTagExecution();
const sessionUnique = process.argv[2] || "Automne";

const cohortes = ACADEMIC_PROGRAM_CATALOG.map((programme) =>
  creerCohorte({
    programme: programme.programme,
    etape: Number(programme.etape),
    session: sessionUnique,
    effectif: TARGET_STUDENTS_PER_PROGRAM,
    tagExecution,
  })
);

const lignes = melangerParRoundRobin(cohortes);
const feuille = XLSX.utils.json_to_sheet(lignes, {
  header: ["matricule", "nom", "prenom", "programme", "etape", "session"],
});
const classeur = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(classeur, feuille, "Etudiants");

fs.mkdirSync(dossierSortie, { recursive: true });

const fichierSortie = path.join(
  dossierSortie,
  `import-etudiants-demo-${sessionUnique.toLowerCase()}-${tagExecution}.xlsx`
);

XLSX.writeFile(classeur, fichierSortie);

console.log(fichierSortie);
console.log(`Nombre total d'etudiants: ${lignes.length}`);
console.log(
  `Programmes: ${ACADEMIC_PROGRAM_CATALOG.length} | Etudiants par programme: ${TARGET_STUDENTS_PER_PROGRAM}`
);
