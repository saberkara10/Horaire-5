import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import pool from "../db.js";
import { devinerNomSession, normaliserNomSession } from "../src/utils/sessions.js";
import {
  calculerTaillesGroupesEquilibres,
  calculerTaillesGroupesEquilibresPourNombreGroupes,
  determinerCapaciteMaximaleGroupeCohorte,
} from "../src/utils/groupes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const racineProjet = path.resolve(__dirname, "..", "..");
const dossierSortie = path.join(racineProjet, "documents");

const PROGRAMMES_CIBLES = [
  "Analyse de donnees",
  "Gestion des services de restauration",
  "Intelligence artificielle appliquee",
  "Programmation informatique",
  "Soins infirmiers auxiliaires",
  "Techniques en administration des affaires",
  "Technologie des systemes informatiques - cybersecurite et reseautique",
  "Travail social",
];

const CONFIGURATION_ETAPES = {
  1: { effectif: 95, groupes_cibles: 4, reprises: [] },
  2: { effectif: 95, groupes_cibles: 4, reprises: [{ nb_etudiants: 2, etapes_sources: [1] }] },
  3: { effectif: 66, groupes_cibles: 3, reprises: [{ nb_etudiants: 5, etapes_sources: [1, 2] }] },
  4: { effectif: 50, groupes_cibles: 2, reprises: [{ nb_etudiants: 2, etapes_sources: [1, 2, 3] }] },
};

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
      .slice(0, 4)
      .map((mot) => mot[0])
      .join("")
      .toUpperCase() || "GEN"
  );
}

function definirLargeursColonnes(feuille, largeurs) {
  feuille["!cols"] = largeurs.map((wch) => ({ wch }));
}

function construireCleCohorte(programme, etape) {
  return `${programme}|${String(etape)}`;
}

function grouperCoursParProgrammeEtEtape(cours) {
  const map = new Map();

  for (const coursItem of cours) {
    const cle = construireCleCohorte(coursItem.programme, coursItem.etape_etude);

    if (!map.has(cle)) {
      map.set(cle, []);
    }

    map.get(cle).push(coursItem);
  }

  for (const [cle, valeurs] of map.entries()) {
    map.set(
      cle,
      [...valeurs].sort((coursA, coursB) =>
        String(coursA.code).localeCompare(String(coursB.code), "fr")
      )
    );
  }

  return map;
}

function grouperEffectifsExistantsParCohorte(rows = []) {
  return rows.reduce((map, row) => {
    map.set(construireCleCohorte(row.programme, row.etape), Number(row.nb_groupes || 0));
    return map;
  }, new Map());
}

function construireMatricule(programme, etape, index, tagExecution) {
  const codeProgramme = creerCodeProgramme(programme).slice(0, 4);
  return `USR${tagExecution.replace("-", "")}${codeProgramme}E${etape}${String(
    index + 1
  ).padStart(3, "0")}`;
}

function construireCohorteLogique(programme, etape, session, annee) {
  return `${programme} - E${etape} - ${session} ${annee}`;
}

function construireEtudiantsPourCohorte({
  programme,
  etape,
  session,
  anneeReference,
  coursNormaux,
  effectif,
  tagExecution,
}) {
  const codesCoursNormaux = coursNormaux.map((cours) => cours.code);
  const libellesCoursNormaux = coursNormaux.map((cours) => `${cours.code} - ${cours.nom}`);

  return Array.from({ length: effectif }, (_, index) => ({
    matricule: construireMatricule(programme, etape, index, tagExecution),
    nom: NOMS[(index + Number(etape) * 3) % NOMS.length],
    prenom: PRENOMS[(index * 2 + Number(etape)) % PRENOMS.length],
    programme,
    etape: Number(etape),
    session,
    cohorte_logique: construireCohorteLogique(programme, etape, session, anneeReference),
    nb_cours_normaux: codesCoursNormaux.length,
    nb_reprises: 0,
    nb_cours_total: codesCoursNormaux.length,
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

function calculerSessionSource(sessionCible, anneeReference, etapeActuelle, etapeSource) {
  const session = String(sessionCible || "").trim();
  const diffEtapes = Math.max(1, Number(etapeActuelle) - Number(etapeSource));
  let sessionCourante = session;
  let anneeCourante = Number(anneeReference) || new Date().getFullYear();

  // On remonte les sessions academiques principales Automne/Hiver.
  for (let index = 0; index < diffEtapes; index += 1) {
    if (sessionCourante === "Hiver") {
      sessionCourante = "Automne";
      anneeCourante -= 1;
      continue;
    }

    if (sessionCourante === "Automne") {
      sessionCourante = "Hiver";
      continue;
    }

    if (sessionCourante === "Printemps") {
      sessionCourante = "Hiver";
      continue;
    }

    if (sessionCourante === "Ete") {
      sessionCourante = "Printemps";
      continue;
    }

    sessionCourante = "Automne";
    anneeCourante -= 1;
  }

  return `${sessionCourante} ${anneeCourante}`;
}

function determinerNombreGroupesCible(
  effectifTotal,
  nombreGroupesExistants,
  capaciteCible,
  capaciteMaximaleReelle
) {
  const effectif = Number(effectifTotal) || 0;
  const groupesExistants = Number(nombreGroupesExistants) || 0;
  const capaciteSoft = Math.max(1, Number(capaciteCible) || 1);
  const capaciteHard = Math.max(capaciteSoft, Number(capaciteMaximaleReelle) || capaciteSoft);
  const nombreGroupesMinimal = Math.max(1, Math.ceil(effectif / capaciteSoft));

  if (groupesExistants === 0) {
    return nombreGroupesMinimal;
  }

  if (effectif <= groupesExistants * capaciteSoft) {
    return groupesExistants;
  }

  const surplusRepartissable = effectif - groupesExistants * capaciteSoft;

  if (
    surplusRepartissable > 0 &&
    surplusRepartissable <= 5 &&
    effectif <= groupesExistants * capaciteHard
  ) {
    return groupesExistants;
  }

  if (
    groupesExistants >= nombreGroupesMinimal &&
    effectif <= groupesExistants * capaciteHard
  ) {
    return groupesExistants;
  }

  return Math.max(groupesExistants, nombreGroupesMinimal);
}

function estimerRepartitionBackend({
  effectif,
  groupesExistants,
  coursCohorte,
  salles,
}) {
  const capaciteCible = determinerCapaciteMaximaleGroupeCohorte(coursCohorte, salles, 30);
  const capaciteMaximaleReelle = determinerCapaciteMaximaleGroupeCohorte(
    coursCohorte,
    salles,
    Number.MAX_SAFE_INTEGER
  );
  const groupesCibles = determinerNombreGroupesCible(
    effectif,
    groupesExistants,
    capaciteCible,
    capaciteMaximaleReelle
  );
  let tailles = calculerTaillesGroupesEquilibresPourNombreGroupes(
    effectif,
    groupesCibles,
    capaciteMaximaleReelle
  );

  if (tailles.length === 0) {
    tailles = calculerTaillesGroupesEquilibres(effectif, capaciteCible);
  }

  return {
    capacite_cible: capaciteCible,
    capacite_maximale_reelle: capaciteMaximaleReelle,
    groupes_backend_estimes: groupesCibles,
    tailles_backend_estimees: tailles.join(" / "),
  };
}

function choisirCoursEchoue(coursParProgrammeEtEtape, programme, etapeSource, curseur) {
  const coursDisponibles = coursParProgrammeEtEtape.get(
    construireCleCohorte(programme, etapeSource)
  );

  if (!Array.isArray(coursDisponibles) || coursDisponibles.length === 0) {
    throw new Error(
      `Aucun cours disponible pour ${programme} etape ${etapeSource}.`
    );
  }

  return coursDisponibles[curseur % coursDisponibles.length];
}

function appliquerReprisesSurEtudiants({
  etudiantsCohorte,
  programme,
  etape,
  session,
  anneeReference,
  coursParProgrammeEtEtape,
}) {
  const configuration = CONFIGURATION_ETAPES[Number(etape)];
  const reprises = [];

  if (!configuration || !Array.isArray(configuration.reprises)) {
    return reprises;
  }

  let curseurGlobal = 0;

  for (const bloc of configuration.reprises) {
    for (let indexEtudiant = 0; indexEtudiant < bloc.nb_etudiants; indexEtudiant += 1) {
      const etudiant = etudiantsCohorte[indexEtudiant];

      if (!etudiant) {
        continue;
      }

      const reprisesEtudiant = bloc.etapes_sources.map((etapeSource, positionReprise) => {
        const coursEchoue = choisirCoursEchoue(
          coursParProgrammeEtEtape,
          programme,
          etapeSource,
          curseurGlobal + positionReprise
        );
        const noteEchec = 43 + ((indexEtudiant + positionReprise + Number(etape)) % 12);

        return {
          matricule: etudiant.matricule,
          code_cours: coursEchoue.code,
          session_cible: session,
          note_echec: noteEchec,
          statut: "a_reprendre",
          programme_etudiant: programme,
          etape_actuelle: Number(etape),
          etape_cours_echoue: Number(etapeSource),
          session_source_reprise: calculerSessionSource(
            session,
            anneeReference,
            etape,
            etapeSource
          ),
          cours_echoue_detail: `${coursEchoue.code} - ${coursEchoue.nom}`,
        };
      });

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
      curseurGlobal += reprisesEtudiant.length;
    }
  }

  return reprises;
}

async function chargerContexte() {
  const [[sessions], [cours], [salles], [groupes]] = await Promise.all([
    pool.query(
      `SELECT id_session, nom, date_debut, active
       FROM sessions
       WHERE active = TRUE
       ORDER BY id_session DESC
       LIMIT 1`
    ),
    pool.query(
      `SELECT id_cours, code, nom, programme, etape_etude, type_salle
       FROM cours
       WHERE archive = 0
       ORDER BY programme ASC, CAST(etape_etude AS UNSIGNED) ASC, code ASC`
    ),
    pool.query(
      `SELECT id_salle, type, capacite
       FROM salles
       ORDER BY type ASC, capacite ASC`
    ),
    pool.query(
      `SELECT ge.programme, ge.etape, COUNT(*) AS nb_groupes
       FROM groupes_etudiants ge
       WHERE ge.id_session = (
         SELECT id_session
         FROM sessions
         WHERE active = TRUE
         ORDER BY id_session DESC
         LIMIT 1
       )
       GROUP BY ge.programme, ge.etape`
    ),
  ]);

  const sessionActive = sessions[0];

  if (!sessionActive) {
    throw new Error("Aucune session active n'est disponible pour generer le fichier.");
  }

  return {
    sessionActive,
    cours,
    salles,
    groupes,
  };
}

async function genererFichier() {
  const { sessionActive, cours, salles, groupes } = await chargerContexte();
  const tagExecution = creerTagExecution();
  const sessionCourante =
    normaliserNomSession(sessionActive.nom) ||
    devinerNomSession(sessionActive.nom, sessionActive.date_debut) ||
    "Hiver";
  const anneeReference = new Date(sessionActive.date_debut || Date.now()).getFullYear();
  const coursParProgrammeEtEtape = grouperCoursParProgrammeEtEtape(cours);
  const groupesExistantsParCohorte = grouperEffectifsExistantsParCohorte(groupes);
  const etudiants = [];
  const coursEchoues = [];
  const chargeAcademique = [];
  const resumeCohortes = [];

  for (const programme of PROGRAMMES_CIBLES) {
    for (const etape of [1, 2, 3, 4]) {
      const configurationEtape = CONFIGURATION_ETAPES[etape];
      const coursNormaux = coursParProgrammeEtEtape.get(
        construireCleCohorte(programme, etape)
      );

      if (!Array.isArray(coursNormaux) || coursNormaux.length === 0) {
        throw new Error(
          `Le catalogue actif ne contient pas de cours pour ${programme} etape ${etape}.`
        );
      }

      const etudiantsCohorte = construireEtudiantsPourCohorte({
        programme,
        etape,
        session: sessionCourante,
        anneeReference,
        coursNormaux,
        effectif: configurationEtape.effectif,
        tagExecution,
      });
      const reprisesCohorte = appliquerReprisesSurEtudiants({
        etudiantsCohorte,
        programme,
        etape,
        session: sessionCourante,
        anneeReference,
        coursParProgrammeEtEtape,
      });
      const estimationBackend = estimerRepartitionBackend({
        effectif: configurationEtape.effectif,
        groupesExistants:
          groupesExistantsParCohorte.get(construireCleCohorte(programme, etape)) || 0,
        coursCohorte: coursNormaux,
        salles,
      });

      etudiants.push(...etudiantsCohorte);
      coursEchoues.push(...reprisesCohorte);
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
        programme,
        etape,
        session: sessionCourante,
        effectif: configurationEtape.effectif,
        groupes_demandes: configurationEtape.groupes_cibles,
        groupes_existants_avant_import:
          groupesExistantsParCohorte.get(construireCleCohorte(programme, etape)) || 0,
        groupes_backend_estimes: estimationBackend.groupes_backend_estimes,
        tailles_backend_estimees: estimationBackend.tailles_backend_estimees,
        capacite_cible: estimationBackend.capacite_cible,
        reprises_generees: reprisesCohorte.length,
        etudiants_avec_reprise: etudiantsCohorte.filter(
          (etudiant) => Number(etudiant.nb_reprises || 0) > 0
        ).length,
      });
    }
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
  definirLargeursColonnes(
    feuilleEtudiants,
    [26, 18, 18, 58, 8, 12, 66, 18, 12, 16, 12, 70, 120, 18, 26, 22, 34, 12, 20]
  );

  const feuilleCoursEchoues = XLSX.utils.json_to_sheet(coursEchoues, {
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
  definirLargeursColonnes(feuilleCoursEchoues, [26, 14, 16, 12, 18, 58, 16, 18, 22, 60]);

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
  definirLargeursColonnes(feuilleCharge, [26, 58, 8, 12, 66, 18, 12, 16, 70, 18, 28, 22, 34, 12, 20]);

  const feuilleResume = XLSX.utils.json_to_sheet(resumeCohortes, {
    header: [
      "programme",
      "etape",
      "session",
      "effectif",
      "groupes_demandes",
      "groupes_existants_avant_import",
      "groupes_backend_estimes",
      "tailles_backend_estimees",
      "capacite_cible",
      "reprises_generees",
      "etudiants_avec_reprise",
    ],
  });
  definirLargeursColonnes(feuilleResume, [58, 8, 12, 12, 18, 28, 22, 26, 14, 16, 20]);

  XLSX.utils.book_append_sheet(workbook, feuilleEtudiants, "Etudiants");
  XLSX.utils.book_append_sheet(workbook, feuilleCoursEchoues, "CoursEchoues");
  XLSX.utils.book_append_sheet(workbook, feuilleCharge, "ChargeAcademique");
  XLSX.utils.book_append_sheet(workbook, feuilleResume, "ResumeCohortes");

  fs.mkdirSync(dossierSortie, { recursive: true });

  const fichierSortie = path.join(
    dossierSortie,
    `import-etudiants-8-programmes-95-95-66-50-${sessionCourante.toLowerCase()}-${anneeReference}-${tagExecution}.xlsx`
  );

  XLSX.writeFile(workbook, fichierSortie);

  console.log(fichierSortie);
  console.log(`Session active source: ${sessionActive.nom}`);
  console.log(`Session cible importee: ${sessionCourante}`);
  console.log(`Etudiants generes: ${etudiants.length}`);
  console.log(`Cours echoues generes: ${coursEchoues.length}`);
  console.log(`Cohortes generees: ${resumeCohortes.length}`);
}

try {
  await genererFichier();
} finally {
  await pool.end();
}
