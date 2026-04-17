import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import pool from "../db.js";
import { devinerNomSession, normaliserNomSession } from "../src/utils/sessions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const racineProjet = path.resolve(__dirname, "..", "..");
const dossierSortie = path.join(racineProjet, "documents");

const EFFECTIF_PAR_COHORTE = 50;
const GROUPES_ATTENDUS_PAR_COHORTE = 2;

const NOMS = [
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
  "Lavoie",
  "Pelletier",
  "Rahmani",
  "Garneau",
];

const PRENOMS = [
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
  "Hamza",
  "Farah",
  "Nadia",
  "Lea",
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

function grouperCoursParProgrammeEtEtape(cours) {
  const map = new Map();

  for (const coursItem of cours) {
    const cle = `${coursItem.programme}|${String(coursItem.etape_etude)}`;

    if (!map.has(cle)) {
      map.set(cle, []);
    }

    map.get(cle).push(coursItem);
  }

  for (const [cle, valeurs] of map) {
    map.set(
      cle,
      [...valeurs].sort((coursA, coursB) =>
        String(coursA.code).localeCompare(String(coursB.code), "fr")
      )
    );
  }

  return map;
}

function construireMatricule(programme, etape, index, tagExecution) {
  const codeProgramme = creerCodeProgramme(programme).slice(0, 4);
  return `RPT${tagExecution.replace("-", "")}${codeProgramme}E${etape}${String(
    index + 1
  ).padStart(3, "0")}`;
}

function construireCohorteLogique(programme, etape, session) {
  return `${programme} - E${etape} - ${session}`;
}

function construireEtudiantsPourCohorte({
  programme,
  etape,
  session,
  coursNormaux,
  tagExecution,
}) {
  const effectif = EFFECTIF_PAR_COHORTE;
  const codesCoursNormaux = coursNormaux.map((cours) => cours.code);
  const libellesCoursNormaux = coursNormaux.map((cours) => `${cours.code} - ${cours.nom}`);

  return Array.from({ length: effectif }, (_, index) => ({
    matricule: construireMatricule(programme, etape, index, tagExecution),
    nom: NOMS[(index + Number(etape) * 3) % NOMS.length],
    prenom: PRENOMS[(index * 2 + Number(etape)) % PRENOMS.length],
    programme,
    etape: Number(etape),
    session,
    cohorte_logique: construireCohorteLogique(programme, etape, session),
    nb_cours_normaux: codesCoursNormaux.length,
    nb_cours_total: codesCoursNormaux.length,
    nb_reprises: 0,
    a_reprise: "Non",
    codes_cours_normaux: codesCoursNormaux.join(", "),
    cours_normaux_detail: libellesCoursNormaux.join(" | "),
    code_cours_reprise: "",
    codes_cours_reprises: "",
    session_source_reprise: "",
    sessions_sources_reprises: "",
    note_echec: "",
    notes_echec_reprises: "",
  }));
}

function determinerSessionSource(sessionCible, etapeSource, anneeReference) {
  const anneeCourante = Number(anneeReference) || new Date().getFullYear();
  const session = String(sessionCible || "").trim();

  if (session === "Automne") {
    return etapeSource >= 2 ? `Hiver ${anneeCourante}` : `Automne ${anneeCourante - 1}`;
  }

  if (session === "Hiver") {
    return `Automne ${anneeCourante - 1}`;
  }

  if (session === "Printemps") {
    return `Hiver ${anneeCourante}`;
  }

  return `Printemps ${anneeCourante}`;
}

function determinerNombreReprises(etapeActuelle, index, effectif) {
  const etape = Number(etapeActuelle);
  const rang = index + 1;

  if (etape <= 1) {
    return 0;
  }

  if (etape === 2) {
    return rang <= Math.ceil(effectif * 0.22) ? 1 : 0;
  }

  if (etape === 3) {
    if (rang <= Math.ceil(effectif * 0.15)) {
      return 2;
    }

    return rang <= Math.ceil(effectif * 0.38) ? 1 : 0;
  }

  if (rang <= Math.ceil(effectif * 0.12)) {
    return 3;
  }

  if (rang <= Math.ceil(effectif * 0.3)) {
    return 2;
  }

  return rang <= Math.ceil(effectif * 0.5) ? 1 : 0;
}

function choisirEtapesSources(etapeActuelle, index, nbReprises) {
  const etape = Number(etapeActuelle);
  const etapesPossibles = Array.from({ length: Math.max(0, etape - 1) }, (_, offset) => offset + 1);

  if (etapesPossibles.length === 0 || nbReprises <= 0) {
    return [];
  }

  const maximum = Math.min(nbReprises, etapesPossibles.length);

  if (maximum === etapesPossibles.length) {
    return etapesPossibles;
  }

  const depart = index % etapesPossibles.length;
  const sequence = [];

  for (let offset = 0; offset < maximum; offset += 1) {
    sequence.push(etapesPossibles[(depart + offset) % etapesPossibles.length]);
  }

  return [...new Set(sequence)].sort((a, b) => a - b);
}

function creerReprisesPourCohorte({
  etudiantsCohorte,
  coursParProgrammeEtEtape,
  programme,
  etape,
  session,
  anneeReference,
}) {
  const reprises = [];

  for (let index = 0; index < etudiantsCohorte.length; index += 1) {
    const etudiant = etudiantsCohorte[index];
    const nombreReprises = determinerNombreReprises(etape, index, etudiantsCohorte.length);

    if (nombreReprises <= 0) {
      continue;
    }

    const etapesSources = choisirEtapesSources(etape, index, nombreReprises);
    const reprisesEtudiant = [];

    for (const [positionReprise, etapeSource] of etapesSources.entries()) {
      const coursSource =
        coursParProgrammeEtEtape.get(`${programme}|${String(etapeSource)}`) || [];

      if (coursSource.length === 0) {
        continue;
      }

      const curseurCours = (index + positionReprise * 3) % coursSource.length;
      const coursEchoue = coursSource[curseurCours];
      const noteEchec = 41 + ((index + positionReprise + Number(etape)) % 18);
      const sessionSource = determinerSessionSource(session, etapeSource, anneeReference);

      reprisesEtudiant.push({
        matricule: etudiant.matricule,
        code_cours: coursEchoue.code,
        session_cible: session,
        note_echec: noteEchec,
        statut: "a_reprendre",
        programme_etudiant: programme,
        etape_actuelle: Number(etape),
        etape_cours_echoue: etapeSource,
        session_source_reprise: sessionSource,
        cours_echoue_detail: `${coursEchoue.code} - ${coursEchoue.nom}`,
      });
    }

    if (reprisesEtudiant.length === 0) {
      continue;
    }

    etudiant.nb_reprises = reprisesEtudiant.length;
    etudiant.nb_cours_total = Number(etudiant.nb_cours_normaux) + reprisesEtudiant.length;
    etudiant.a_reprise = "Oui";
    etudiant.code_cours_reprise = reprisesEtudiant[0]?.code_cours || "";
    etudiant.codes_cours_reprises = reprisesEtudiant
      .map((reprise) => reprise.code_cours)
      .join(", ");
    etudiant.session_source_reprise = reprisesEtudiant[0]?.session_source_reprise || "";
    etudiant.sessions_sources_reprises = reprisesEtudiant
      .map((reprise) => reprise.session_source_reprise)
      .join(" | ");
    etudiant.note_echec = reprisesEtudiant[0]?.note_echec || "";
    etudiant.notes_echec_reprises = reprisesEtudiant
      .map((reprise) => String(reprise.note_echec))
      .join(", ");

    reprises.push(...reprisesEtudiant);
  }

  return reprises;
}

function definirLargeursColonnes(feuille, largeurs) {
  feuille["!cols"] = largeurs.map((wch) => ({ wch }));
}

function calculerCapaciteParTypeSalle(salles) {
  return salles.reduce((map, salle) => {
    const type = String(salle.type || "").trim();
    const capacite = Number(salle.capacite);

    if (!type || !Number.isFinite(capacite) || capacite <= 0) {
      return map;
    }

    const maximumActuel = map.get(type) || 0;

    if (capacite > maximumActuel) {
      map.set(type, capacite);
    }

    return map;
  }, new Map());
}

function determinerCapaciteCohorte(coursNormaux, capaciteParTypeSalle) {
  const capacitesCompatibles = coursNormaux
    .map((cours) => capaciteParTypeSalle.get(String(cours.type_salle || "").trim()) || 0)
    .filter((capacite) => capacite > 0);

  if (capacitesCompatibles.length === 0) {
    return 30;
  }

  return Math.min(...capacitesCompatibles, 30);
}

function verifierDimensionnementCohortes(cohortes, coursParProgrammeEtEtape, salles) {
  const capaciteParTypeSalle = calculerCapaciteParTypeSalle(salles);

  for (const cohorte of cohortes) {
    const coursNormaux =
      coursParProgrammeEtEtape.get(`${cohorte.programme}|${cohorte.etape}`) || [];
    const capaciteCohorte = determinerCapaciteCohorte(coursNormaux, capaciteParTypeSalle);
    const groupesTheoriques = Math.ceil(EFFECTIF_PAR_COHORTE / Math.max(1, capaciteCohorte));

    if (groupesTheoriques !== GROUPES_ATTENDUS_PAR_COHORTE) {
      throw new Error(
        [
          `Le dimensionnement ne garantit plus ${GROUPES_ATTENDUS_PAR_COHORTE} groupes `,
          `pour ${cohorte.programme} E${cohorte.etape}.`,
          ` Effectif configure: ${EFFECTIF_PAR_COHORTE}.`,
          ` Capacite cohorte calculee: ${capaciteCohorte}.`,
          ` Groupes theoriques: ${groupesTheoriques}.`,
        ].join("")
      );
    }
  }
}

async function chargerContexte() {
  const [[sessionActive], [cours], [salles]] = await Promise.all([
    pool.query(
      `SELECT id_session, nom, date_debut, date_fin, active
       FROM sessions
       WHERE active = TRUE
       ORDER BY id_session DESC
       LIMIT 1`
    ),
    pool.query(
      `SELECT id_cours, code, nom, programme, etape_etude
       FROM cours
       WHERE archive = 0
       ORDER BY programme ASC, CAST(etape_etude AS UNSIGNED) ASC, code ASC`
    ),
    pool.query(
      `SELECT type, capacite
       FROM salles
       ORDER BY type ASC, capacite ASC`
    ),
  ]);

  if (!sessionActive[0]) {
    throw new Error("Aucune session active n'est disponible pour generer le fichier.");
  }

  return {
    sessionActive: sessionActive[0],
    cours,
    salles,
  };
}

async function genererFichier() {
  const { sessionActive, cours, salles } = await chargerContexte();
  const tagExecution = creerTagExecution();
  const sessionCourante =
    normaliserNomSession(sessionActive.nom) ||
    devinerNomSession(sessionActive.nom, sessionActive.date_debut) ||
    "Automne";
  const anneeReference = new Date(sessionActive.date_debut || Date.now()).getFullYear();
  const coursParProgrammeEtEtape = grouperCoursParProgrammeEtEtape(cours);
  const cohortes = [...coursParProgrammeEtEtape.keys()]
    .map((cle) => {
      const [programme, etape] = cle.split("|");
      return { programme, etape };
    })
    .filter((cohorte) => ["1", "2", "3", "4"].includes(String(cohorte.etape)))
    .sort((cohorteA, cohorteB) => {
      const comparaisonProgramme = cohorteA.programme.localeCompare(
        cohorteB.programme,
        "fr"
      );

      if (comparaisonProgramme !== 0) {
        return comparaisonProgramme;
      }

      return Number(cohorteA.etape) - Number(cohorteB.etape);
    });
  verifierDimensionnementCohortes(cohortes, coursParProgrammeEtEtape, salles);
  const etudiants = [];
  const reprises = [];
  const chargeAcademique = [];
  const resumeCohortes = [];

  for (const cohorte of cohortes) {
    const coursNormaux = coursParProgrammeEtEtape.get(
      `${cohorte.programme}|${cohorte.etape}`
    );

    if (!Array.isArray(coursNormaux) || coursNormaux.length === 0) {
      continue;
    }

    const etudiantsCohorte = construireEtudiantsPourCohorte({
      programme: cohorte.programme,
      etape: cohorte.etape,
      session: sessionCourante,
      coursNormaux,
      tagExecution,
    });
    const reprisesCohorte = creerReprisesPourCohorte({
      etudiantsCohorte,
      coursParProgrammeEtEtape,
      programme: cohorte.programme,
      etape: cohorte.etape,
      session: sessionCourante,
      anneeReference,
    });

    etudiants.push(...etudiantsCohorte);
    reprises.push(...reprisesCohorte);
    chargeAcademique.push(
      ...etudiantsCohorte.map((etudiant) => ({
        matricule: etudiant.matricule,
        programme: etudiant.programme,
        etape: etudiant.etape,
        session: etudiant.session,
        cohorte_logique: etudiant.cohorte_logique,
        nb_cours_normaux: etudiant.nb_cours_normaux,
        nb_reprises: etudiant.nb_reprises,
        nb_cours_total: etudiant.nb_cours_total,
        codes_cours_normaux: etudiant.codes_cours_normaux,
        code_cours_reprise: etudiant.code_cours_reprise,
        codes_cours_reprises: etudiant.codes_cours_reprises,
        session_source_reprise: etudiant.session_source_reprise,
        sessions_sources_reprises: etudiant.sessions_sources_reprises,
        note_echec: etudiant.note_echec,
        notes_echec_reprises: etudiant.notes_echec_reprises,
      }))
    );
    resumeCohortes.push({
      programme: cohorte.programme,
      etape: Number(cohorte.etape),
      session: sessionCourante,
      effectif: etudiantsCohorte.length,
      nb_reprises: reprisesCohorte.length,
      nb_cours_normaux_par_etudiant: coursNormaux.length,
      etudiants_avec_reprise: etudiantsCohorte.filter(
        (etudiant) => Number(etudiant.nb_reprises || 0) > 0
      ).length,
      groupes_attendus: GROUPES_ATTENDUS_PAR_COHORTE,
      etudiants_a_8_cours: etudiantsCohorte.filter(
        (etudiant) => Number(etudiant.nb_cours_total || 0) === 8
      ).length,
      etudiants_a_9_cours: etudiantsCohorte.filter(
        (etudiant) => Number(etudiant.nb_cours_total || 0) === 9
      ).length,
      etudiants_a_10_cours_ou_plus: etudiantsCohorte.filter(
        (etudiant) => Number(etudiant.nb_cours_total || 0) >= 10
      ).length,
      charge_maximale: Math.max(
        ...etudiantsCohorte.map((etudiant) => Number(etudiant.nb_cours_total || 0)),
        coursNormaux.length
      ),
    });
  }

  const workbook = XLSX.utils.book_new();
  const feuilleEtudiants = XLSX.utils.json_to_sheet(etudiants, {
    header: [
      "matricule",
      "nom",
      "prenom",
      "programme",
      "etape",
      "session",
      "cohorte_logique",
      "nb_cours_normaux",
      "nb_reprises",
      "nb_cours_total",
      "a_reprise",
      "codes_cours_normaux",
      "cours_normaux_detail",
      "code_cours_reprise",
      "codes_cours_reprises",
      "session_source_reprise",
      "sessions_sources_reprises",
      "note_echec",
      "notes_echec_reprises",
    ],
  });
  definirLargeursColonnes(feuilleEtudiants, [24, 18, 18, 55, 8, 12, 64, 18, 12, 16, 12, 70, 120, 18, 26, 22, 32, 12, 20]);

  const feuilleCoursEchoues = XLSX.utils.json_to_sheet(reprises, {
    header: [
      "matricule",
      "code_cours",
      "session_cible",
      "note_echec",
      "statut",
      "programme_etudiant",
      "etape_actuelle",
      "etape_cours_echoue",
      "session_source_reprise",
      "cours_echoue_detail",
    ],
  });
  definirLargeursColonnes(feuilleCoursEchoues, [24, 14, 16, 12, 18, 55, 16, 18, 22, 60]);

  const feuilleCharge = XLSX.utils.json_to_sheet(chargeAcademique, {
    header: [
      "matricule",
      "programme",
      "etape",
      "session",
      "cohorte_logique",
      "nb_cours_normaux",
      "nb_reprises",
      "nb_cours_total",
      "codes_cours_normaux",
      "code_cours_reprise",
      "codes_cours_reprises",
      "session_source_reprise",
      "sessions_sources_reprises",
      "note_echec",
      "notes_echec_reprises",
    ],
  });
  definirLargeursColonnes(feuilleCharge, [24, 55, 8, 12, 64, 18, 12, 16, 70, 18, 28, 22, 34, 12, 20]);

  const feuilleResume = XLSX.utils.json_to_sheet(resumeCohortes, {
    header: [
      "programme",
      "etape",
      "session",
      "effectif",
      "nb_reprises",
      "etudiants_avec_reprise",
      "groupes_attendus",
      "nb_cours_normaux_par_etudiant",
      "etudiants_a_8_cours",
      "etudiants_a_9_cours",
      "etudiants_a_10_cours_ou_plus",
      "charge_maximale",
    ],
  });
  definirLargeursColonnes(feuilleResume, [55, 8, 12, 12, 14, 20, 28, 18, 18, 18, 24, 18]);

  XLSX.utils.book_append_sheet(workbook, feuilleEtudiants, "Etudiants");
  XLSX.utils.book_append_sheet(workbook, feuilleCoursEchoues, "CoursEchoues");
  XLSX.utils.book_append_sheet(workbook, feuilleCharge, "ChargeAcademique");
  XLSX.utils.book_append_sheet(workbook, feuilleResume, "ResumeCohortes");

  fs.mkdirSync(dossierSortie, { recursive: true });

  const fichierSortie = path.join(
    dossierSortie,
    `import-etudiants-reprises-compatible-1600-${sessionCourante.toLowerCase()}-${tagExecution}.xlsx`
  );

  XLSX.writeFile(workbook, fichierSortie);

  console.log(fichierSortie);
  console.log(`Session active source: ${sessionActive.nom}`);
  console.log(`Session cible importee: ${sessionCourante}`);
  console.log(`Etudiants generes: ${etudiants.length}`);
  console.log(`Cours echoues generes: ${reprises.length}`);
  console.log(`Cohortes couvertes: ${resumeCohortes.length}`);
  console.log(`Effectif par cohorte: ${EFFECTIF_PAR_COHORTE}`);
  console.log(`Groupes attendus par cohorte: ${GROUPES_ATTENDUS_PAR_COHORTE}`);
}

try {
  await genererFichier();
} finally {
  await pool.end();
}
