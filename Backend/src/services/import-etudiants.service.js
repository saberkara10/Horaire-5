/**
 * Service dedie a l'import des etudiants depuis un fichier Excel ou CSV.
 *
 * Responsabilites de ce module :
 * - lire le fichier transmis par le frontend ;
 * - normaliser les entetes et les cellules ;
 * - valider les colonnes attendues ;
 * - transformer chaque ligne en objet etudiant exploitable ;
 * - importer optionnellement un onglet de cours echoues/reprises ;
 * - produire des messages d'erreur explicites avant toute ecriture SQL.
 */

import path from "node:path";
import XLSX from "xlsx";
import { enregistrerEtudiantsImportes } from "../model/import-etudiants.model.js";
import { normaliserNomSession } from "../utils/sessions.js";
import { normaliserNomProgramme } from "../utils/programmes.js";

const COLONNES_ETUDIANTS_OBLIGATOIRES = [
  "matricule",
  "nom",
  "prenom",
  "programme",
  "etape",
];

const COLONNES_COURS_ECHOUES_OBLIGATOIRES = [
  "matricule",
  "code_cours",
];

const STATUTS_COURS_ECHOUES = new Set([
  "a_reprendre",
  "planifie",
  "reussi",
  "en_ligne",
  "groupe_special",
  "resolution_manuelle",
]);

const FEUILLES_ETUDIANTS = ["Etudiants"];
const FEUILLES_COURS_ECHOUES = ["CoursEchoues", "Cours Echoues", "Reprises"];

function normaliserValeurTexte(valeur) {
  return String(valeur ?? "").trim();
}

function normaliserEntete(valeur) {
  return normaliserValeurTexte(valeur).toLowerCase();
}

function creerErreurImport(message, erreurs = [], status = 400) {
  return new ImportEtudiantsError(message, { status, erreurs });
}

function extraireWorkbookDepuisFichier(fichier) {
  const extension = path.extname(fichier.originalname || "").toLowerCase();

  if (extension === ".csv") {
    return XLSX.read(fichier.buffer.toString("utf8"), { type: "string" });
  }

  return XLSX.read(fichier.buffer, { type: "buffer" });
}

function convertirFeuilleEnLignes(workbook, nomFeuille) {
  const feuille = workbook?.Sheets?.[nomFeuille];

  if (!feuille) {
    return [];
  }

  return XLSX.utils.sheet_to_json(feuille, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
}

function resoudreNomFeuille(workbook, nomsPreferes = [], { fallbackToFirst = true } = {}) {
  const nomsFeuilles = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];

  for (const nomPrefere of nomsPreferes) {
    const nomTrouve = nomsFeuilles.find(
      (nomFeuille) => normaliserEntete(nomFeuille) === normaliserEntete(nomPrefere)
    );

    if (nomTrouve) {
      return nomTrouve;
    }
  }

  return fallbackToFirst ? nomsFeuilles[0] || null : null;
}

function lireWorkbook(fichier) {
  try {
    return extraireWorkbookDepuisFichier(fichier);
  } catch (error) {
    throw creerErreurImport("Impossible de lire le fichier.", [
      "Le fichier envoye ne peut pas etre lu comme un document Excel ou CSV valide.",
    ]);
  }
}

function validerStructureFichier(
  lignes,
  colonnesObligatoires,
  {
    messageFichierVide = "Fichier vide.",
    erreurFichierVide = "Le fichier ne contient aucune ligne exploitable.",
  } = {}
) {
  if (lignes.length === 0) {
    return {
      message: messageFichierVide,
      erreurs: [erreurFichierVide],
    };
  }

  const entetes = lignes[0].map(normaliserEntete);
  const colonnesManquantes = colonnesObligatoires.filter(
    (colonne) => !entetes.includes(colonne)
  );

  if (colonnesManquantes.length > 0) {
    return {
      message: "Colonnes obligatoires manquantes.",
      erreurs: colonnesManquantes.map(
        (colonne) => `La colonne obligatoire ${colonne} est absente du fichier.`
      ),
    };
  }

  return null;
}

function validerEtudiantLigne(etudiant) {
  const erreurs = [];

  if (!etudiant.matricule) {
    erreurs.push(`Ligne ${etudiant.numeroLigne} : matricule obligatoire.`);
  } else if (etudiant.matricule.length > 50) {
    erreurs.push(
      `Ligne ${etudiant.numeroLigne} : le matricule ${etudiant.matricule} depasse la longueur maximale autorisee.`
    );
  }

  if (!etudiant.nom) {
    erreurs.push(`Ligne ${etudiant.numeroLigne} : nom obligatoire.`);
  } else if (etudiant.nom.length > 100) {
    erreurs.push(
      `Ligne ${etudiant.numeroLigne} : le nom ${etudiant.nom} depasse la longueur maximale autorisee.`
    );
  }

  if (!etudiant.prenom) {
    erreurs.push(`Ligne ${etudiant.numeroLigne} : prenom obligatoire.`);
  } else if (etudiant.prenom.length > 100) {
    erreurs.push(
      `Ligne ${etudiant.numeroLigne} : le prenom ${etudiant.prenom} depasse la longueur maximale autorisee.`
    );
  }

  if (!etudiant.programme) {
    erreurs.push(`Ligne ${etudiant.numeroLigne} : programme obligatoire.`);
  } else if (etudiant.programme.length > 150) {
    erreurs.push(
      `Ligne ${etudiant.numeroLigne} : le programme ${etudiant.programme} depasse la longueur maximale autorisee.`
    );
  }

  if (!Number.isInteger(etudiant.etape) || etudiant.etape < 1 || etudiant.etape > 8) {
    erreurs.push(
      `Ligne ${etudiant.numeroLigne} : etape invalide (${normaliserValeurTexte(
        etudiant.etapeBrute
      ) || "vide"}). La valeur attendue doit etre un entier entre 1 et 8.`
    );
  }

  if (etudiant.session && !normaliserNomSession(etudiant.session)) {
    erreurs.push(
      `Ligne ${etudiant.numeroLigne} : session invalide (${etudiant.session}). Les valeurs acceptees sont Automne, Hiver, Printemps ou Ete.`
    );
  }

  return erreurs;
}

function validerCoursEchoueLigne(coursEchoue) {
  const erreurs = [];

  if (!coursEchoue.matricule) {
    erreurs.push(`Ligne ${coursEchoue.numeroLigne} : matricule obligatoire.`);
  } else if (coursEchoue.matricule.length > 50) {
    erreurs.push(
      `Ligne ${coursEchoue.numeroLigne} : le matricule ${coursEchoue.matricule} depasse la longueur maximale autorisee.`
    );
  }

  if (!coursEchoue.code_cours) {
    erreurs.push(`Ligne ${coursEchoue.numeroLigne} : code_cours obligatoire.`);
  } else if (coursEchoue.code_cours.length > 50) {
    erreurs.push(
      `Ligne ${coursEchoue.numeroLigne} : le code de cours ${coursEchoue.code_cours} depasse la longueur maximale autorisee.`
    );
  }

  if (coursEchoue.session && !normaliserNomSession(coursEchoue.session)) {
    erreurs.push(
      `Ligne ${coursEchoue.numeroLigne} : session cible invalide (${coursEchoue.session}). Les valeurs acceptees sont Automne, Hiver, Printemps ou Ete.`
    );
  }

  if (coursEchoue.noteBrute) {
    const note = Number(String(coursEchoue.noteBrute).replace(",", "."));

    if (!Number.isFinite(note)) {
      erreurs.push(
        `Ligne ${coursEchoue.numeroLigne} : note_echec invalide (${coursEchoue.noteBrute}).`
      );
    } else if (note < 0 || note >= 60) {
      erreurs.push(
        `Ligne ${coursEchoue.numeroLigne} : note_echec doit etre comprise entre 0 et 59.99.`
      );
    }
  }

  if (
    coursEchoue.statut &&
    !STATUTS_COURS_ECHOUES.has(coursEchoue.statut)
  ) {
    erreurs.push(
      `Ligne ${coursEchoue.numeroLigne} : statut invalide (${coursEchoue.statut}).`
    );
  }

  return erreurs;
}

function parserFeuilleEtudiants(lignes) {
  const erreurStructure = validerStructureFichier(lignes, COLONNES_ETUDIANTS_OBLIGATOIRES, {
    erreurFichierVide: "Le fichier ne contient aucune ligne etudiant a importer.",
  });

  if (erreurStructure) {
    throw creerErreurImport(erreurStructure.message, erreurStructure.erreurs);
  }

  const entetes = lignes[0].map(normaliserEntete);
  const indexColonnes = Object.fromEntries(
    entetes.map((colonne, index) => [colonne, index])
  );
  const etudiants = [];
  const erreurs = [];
  const matriculesVus = new Set();

  for (let index = 1; index < lignes.length; index += 1) {
    const ligne = lignes[index];
    const numeroLigne = index + 1;
    const etapeBrute = normaliserValeurTexte(ligne[indexColonnes.etape]);
    const sessionBrute =
      indexColonnes.session !== undefined
        ? normaliserValeurTexte(ligne[indexColonnes.session])
        : "";

    const etudiant = {
      numeroLigne,
      matricule: normaliserValeurTexte(ligne[indexColonnes.matricule]),
      nom: normaliserValeurTexte(ligne[indexColonnes.nom]),
      prenom: normaliserValeurTexte(ligne[indexColonnes.prenom]),
      programme: normaliserNomProgramme(
        normaliserValeurTexte(ligne[indexColonnes.programme])
      ),
      etapeBrute,
      etape: Number(etapeBrute),
      session: sessionBrute,
    };

    const ligneEstVide =
      !etudiant.matricule &&
      !etudiant.nom &&
      !etudiant.prenom &&
      !etudiant.programme &&
      !etapeBrute &&
      !sessionBrute;

    if (ligneEstVide) {
      continue;
    }

    erreurs.push(...validerEtudiantLigne(etudiant));

    if (etudiant.matricule) {
      if (matriculesVus.has(etudiant.matricule)) {
        erreurs.push(
          `Ligne ${numeroLigne} : le matricule ${etudiant.matricule} est duplique dans le fichier.`
        );
      } else {
        matriculesVus.add(etudiant.matricule);
      }
    }

    etudiants.push(etudiant);
  }

  if (etudiants.length === 0) {
    throw creerErreurImport("Fichier vide.", [
      "Le fichier contient uniquement l'en-tete ou des lignes vides.",
    ]);
  }

  if (erreurs.length > 0) {
    throw creerErreurImport("Import impossible.", erreurs);
  }

  return etudiants;
}

function parserFeuilleCoursEchoues(lignes) {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return [];
  }

  const erreurStructure = validerStructureFichier(
    lignes,
    COLONNES_COURS_ECHOUES_OBLIGATOIRES,
    {
      erreurFichierVide:
        "L'onglet des cours echoues ne contient aucune ligne exploitable.",
    }
  );

  if (erreurStructure) {
    throw creerErreurImport(erreurStructure.message, erreurStructure.erreurs);
  }

  const entetes = lignes[0].map(normaliserEntete);
  const indexColonnes = Object.fromEntries(
    entetes.map((colonne, index) => [colonne, index])
  );
  const coursEchoues = [];
  const erreurs = [];
  const signaturesVues = new Set();

  for (let index = 1; index < lignes.length; index += 1) {
    const ligne = lignes[index];
    const numeroLigne = index + 1;
    const sessionBrute =
      indexColonnes.session !== undefined
        ? normaliserValeurTexte(ligne[indexColonnes.session])
        : indexColonnes.session_cible !== undefined
          ? normaliserValeurTexte(ligne[indexColonnes.session_cible])
          : "";
    const noteBrute =
      indexColonnes.note_echec !== undefined
        ? normaliserValeurTexte(ligne[indexColonnes.note_echec])
        : "";
    const statutBrut =
      indexColonnes.statut !== undefined
        ? normaliserValeurTexte(ligne[indexColonnes.statut]).toLowerCase()
        : "";

    const coursEchoue = {
      numeroLigne,
      matricule: normaliserValeurTexte(ligne[indexColonnes.matricule]),
      code_cours: normaliserValeurTexte(ligne[indexColonnes.code_cours]).toUpperCase(),
      session: sessionBrute,
      noteBrute,
      statut: statutBrut || "a_reprendre",
      note_echec:
        noteBrute === ""
          ? null
          : Number(String(noteBrute).replace(",", ".")),
    };

    const ligneEstVide =
      !coursEchoue.matricule &&
      !coursEchoue.code_cours &&
      !sessionBrute &&
      !noteBrute &&
      !statutBrut;

    if (ligneEstVide) {
      continue;
    }

    erreurs.push(...validerCoursEchoueLigne(coursEchoue));

    if (coursEchoue.matricule && coursEchoue.code_cours) {
      const signature = [
        coursEchoue.matricule,
        coursEchoue.code_cours,
        normaliserNomSession(coursEchoue.session) || "",
      ].join("|");

      if (signaturesVues.has(signature)) {
        erreurs.push(
          `Ligne ${numeroLigne} : la reprise ${coursEchoue.code_cours} pour ${coursEchoue.matricule} est dupliquee dans le fichier.`
        );
      } else {
        signaturesVues.add(signature);
      }
    }

    coursEchoues.push(coursEchoue);
  }

  if (erreurs.length > 0) {
    throw creerErreurImport("Import impossible.", erreurs);
  }

  return coursEchoues;
}

export class ImportEtudiantsError extends Error {
  constructor(message, { status = 400, erreurs = [] } = {}) {
    super(message);
    this.name = "ImportEtudiantsError";
    this.status = status;
    this.erreurs = erreurs;
  }
}

/**
 * Point d'entree principal de l'import.
 *
 * Tant qu'une erreur de structure ou de validation existe, aucune ecriture SQL
 * n'est tentee. Cela permet de renvoyer un diagnostic complet a l'interface
 * avant de toucher a la base de donnees.
 *
 * @param {import("multer").File | undefined} fichier Fichier televerse.
 * @returns {Promise<{message: string, nombre_importes: number}>}
 */
export async function importerEtudiantsDepuisFichier(fichier) {
  if (!fichier) {
    throw creerErreurImport("Aucun fichier fourni.", [
      "Veuillez selectionner un fichier .xlsx, .xls ou .csv avant de lancer l'import.",
    ]);
  }

  const workbook = lireWorkbook(fichier);
  const nomFeuilleEtudiants = resoudreNomFeuille(workbook, FEUILLES_ETUDIANTS);
  const lignesEtudiants = convertirFeuilleEnLignes(workbook, nomFeuilleEtudiants);
  const nomFeuilleCoursEchoues = resoudreNomFeuille(
    workbook,
    FEUILLES_COURS_ECHOUES,
    { fallbackToFirst: false }
  );
  const lignesCoursEchoues = nomFeuilleCoursEchoues
    ? convertirFeuilleEnLignes(workbook, nomFeuilleCoursEchoues)
    : [];
  const etudiants = parserFeuilleEtudiants(lignesEtudiants);
  const coursEchoues = parserFeuilleCoursEchoues(lignesCoursEchoues);
  const resultat = await enregistrerEtudiantsImportes(etudiants, {
    coursEchoues,
  });

  if (resultat.erreurs?.length) {
    throw creerErreurImport("Import impossible.", resultat.erreurs, 409);
  }

  return {
    message:
      coursEchoues.length > 0
        ? "Import des etudiants et des cours echoues termine avec succes."
        : "Import termine avec succes.",
    nombre_importes: resultat.nombreImportes,
    ...(resultat.nombreMisAJour
      ? { nombre_mis_a_jour: resultat.nombreMisAJour }
      : {}),
    ...(resultat.nombreCoursEchouesImportes
      ? {
          nombre_cours_echoues_importes:
            resultat.nombreCoursEchouesImportes,
        }
      : {}),
    ...(resultat.nombreEtudiantsIgnores
      ? { nombre_etudiants_ignores: resultat.nombreEtudiantsIgnores }
      : {}),
    ...(resultat.nombreCohortesIgnorees
      ? { nombre_cohortes_ignorees: resultat.nombreCohortesIgnorees }
      : {}),
    ...(resultat.cohortesIgnorees?.length
      ? { cohortes_ignorees: resultat.cohortesIgnorees }
      : {}),
    ...(resultat.cohorteUtilisee
      ? { cohorte_utilisee: resultat.cohorteUtilisee }
      : {}),
  };
}
