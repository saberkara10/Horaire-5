/**
 * Outils partages pour les imports Excel/CSV des modules CRUD.
 */

import path from "node:path";
import XLSX from "xlsx";

export const EXTENSIONS_IMPORT_EXCEL = [".xlsx", ".xls", ".csv"];

function normaliserTexteSimple(valeur) {
  return String(valeur ?? "").trim();
}

export function normaliserValeurTexte(valeur) {
  return normaliserTexteSimple(valeur);
}

export function normaliserEnteteImport(valeur) {
  return normaliserTexteSimple(valeur)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export class ImportExcelError extends Error {
  constructor(message, { status = 400, erreurs = [] } = {}) {
    super(message);
    this.name = "ImportExcelError";
    this.status = status;
    this.erreurs = erreurs;
  }
}

export function creerErreurImportExcel(message, erreurs = [], status = 400) {
  return new ImportExcelError(message, { status, erreurs });
}

export function extensionImportExcelValide(nomFichier) {
  const extension = path.extname(String(nomFichier || "")).toLowerCase();
  return EXTENSIONS_IMPORT_EXCEL.includes(extension);
}

function extraireWorkbookDepuisFichier(fichier) {
  const extension = path.extname(String(fichier?.originalname || "")).toLowerCase();

  if (extension === ".csv") {
    return XLSX.read(fichier.buffer.toString("utf8"), { type: "string" });
  }

  return XLSX.read(fichier.buffer, { type: "buffer" });
}

export function lireWorkbookImport(fichier) {
  if (!fichier) {
    throw creerErreurImportExcel("Aucun fichier fourni.", [
      "Veuillez selectionner un fichier .xlsx, .xls ou .csv avant de lancer l'import.",
    ]);
  }

  try {
    return extraireWorkbookDepuisFichier(fichier);
  } catch (error) {
    throw creerErreurImportExcel("Impossible de lire le fichier.", [
      "Le fichier envoye ne peut pas etre lu comme un document Excel ou CSV valide.",
    ]);
  }
}

export function resoudreNomFeuilleImport(
  workbook,
  nomsPreferes = [],
  { fallbackToFirst = true } = {}
) {
  const nomsFeuilles = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];

  for (const nomPrefere of nomsPreferes) {
    const nomTrouve = nomsFeuilles.find(
      (nomFeuille) =>
        normaliserEnteteImport(nomFeuille) === normaliserEnteteImport(nomPrefere)
    );

    if (nomTrouve) {
      return nomTrouve;
    }
  }

  return fallbackToFirst ? nomsFeuilles[0] || null : null;
}

export function convertirFeuilleImportEnLignes(workbook, nomFeuille) {
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

function listerAliasColonne(colonne) {
  return [colonne.key, ...(Array.isArray(colonne.aliases) ? colonne.aliases : [])]
    .map(normaliserEnteteImport)
    .filter(Boolean);
}

function determinerIndexColonnes(entetes, columns = []) {
  const entetesNormalisees = entetes.map(normaliserEnteteImport);
  const indexParColonne = {};
  const colonnesManquantes = [];
  const colonnesPresentes = new Set();

  for (const colonne of columns) {
    const alias = listerAliasColonne(colonne);
    const index = entetesNormalisees.findIndex((entete) => alias.includes(entete));

    if (index < 0) {
      if (colonne.required) {
        colonnesManquantes.push(colonne.key);
      }
      continue;
    }

    indexParColonne[colonne.key] = index;
    colonnesPresentes.add(colonne.key);
  }

  return {
    indexParColonne,
    colonnesManquantes,
    colonnesPresentes,
  };
}

function lireCellule(ligne = [], index) {
  if (!Number.isInteger(index) || index < 0) {
    return "";
  }

  return normaliserTexteSimple(ligne[index]);
}

export function decouperValeursMultiples(valeur) {
  const valeurs = String(valeur ?? "")
    .split(/[;,\n\r]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(valeurs)];
}

export function parserLignesImport(lignes, definition, options = {}) {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw creerErreurImportExcel("Fichier vide.", [
      "Le fichier ne contient aucune ligne exploitable.",
    ]);
  }

  const entetes = Array.isArray(lignes[0]) ? lignes[0] : [];
  const { indexParColonne, colonnesManquantes, colonnesPresentes } =
    determinerIndexColonnes(entetes, definition.columns);

  if (colonnesManquantes.length > 0) {
    throw creerErreurImportExcel(
      "Colonnes obligatoires manquantes.",
      colonnesManquantes.map(
        (colonne) => `La colonne obligatoire ${colonne} est absente du fichier.`
      )
    );
  }

  const lignesValides = [];
  const erreurs = [];
  const clesVues = new Set();
  let totalLignesLues = 0;

  for (let indexLigne = 1; indexLigne < lignes.length; indexLigne += 1) {
    const ligneSource = Array.isArray(lignes[indexLigne]) ? lignes[indexLigne] : [];
    const numeroLigne = indexLigne + 1;
    const brut = {};

    for (const colonne of definition.columns) {
      brut[colonne.key] = lireCellule(ligneSource, indexParColonne[colonne.key]);
    }

    const ligneVide = definition.columns.every((colonne) => !brut[colonne.key]);

    if (ligneVide) {
      continue;
    }

    totalLignesLues += 1;

    const ligneTransformee = options.transformerLigne
      ? options.transformerLigne(brut, {
          numeroLigne,
          colonnesPresentes,
        })
      : {
          ...brut,
          numeroLigne,
        };

    const erreursLigne = options.validerLigne
      ? options.validerLigne(ligneTransformee, {
          numeroLigne,
          brut,
          colonnesPresentes,
        })
      : [];

    if (typeof options.construireCleDoublon === "function") {
      const cleDoublon = options.construireCleDoublon(ligneTransformee, {
        numeroLigne,
        brut,
        colonnesPresentes,
      });

      if (cleDoublon) {
        if (clesVues.has(cleDoublon)) {
          erreursLigne.push(
            typeof options.messageDoublon === "function"
              ? options.messageDoublon(ligneTransformee, {
                  numeroLigne,
                  brut,
                  colonnesPresentes,
                })
              : `Ligne ${numeroLigne} : doublon detecte dans le fichier.`
          );
        } else {
          clesVues.add(cleDoublon);
        }
      }
    }

    if (erreursLigne.length > 0) {
      erreurs.push(...erreursLigne);
      continue;
    }

    lignesValides.push(ligneTransformee);
  }

  if (totalLignesLues === 0) {
    throw creerErreurImportExcel("Fichier vide.", [
      "Le fichier contient uniquement l'en-tete ou des lignes vides.",
    ]);
  }

  return {
    colonnesPresentes,
    erreurs,
    lignesValides,
    totalLignesLues,
  };
}

export function creerResumeImport(moduleKey, totalLignesLues, erreursInitiales = []) {
  return {
    module: moduleKey,
    strategie: "partielle",
    total_lignes_lues: Number(totalLignesLues || 0),
    lignes_creees: 0,
    lignes_mises_a_jour: 0,
    lignes_ignorees: 0,
    lignes_en_erreur: Array.isArray(erreursInitiales) ? erreursInitiales.length : 0,
    erreurs: Array.isArray(erreursInitiales) ? [...erreursInitiales] : [],
    ignores: [],
  };
}

export function enregistrerSuccesImport(resume, resultat = {}) {
  const statut = String(resultat?.statut || "").trim().toLowerCase();

  if (statut === "cree") {
    resume.lignes_creees += 1;
    return;
  }

  if (statut === "mis_a_jour") {
    resume.lignes_mises_a_jour += 1;
    return;
  }

  if (statut === "ignore") {
    resume.lignes_ignorees += 1;

    if (resultat.message) {
      resume.ignores.push(resultat.message);
    }
  }
}

export function enregistrerErreurImport(resume, message) {
  resume.lignes_en_erreur += 1;
  resume.erreurs.push(message);
}

export function finaliserResumeImport(resume) {
  const lignesImportees =
    Number(resume.lignes_creees || 0) + Number(resume.lignes_mises_a_jour || 0);
  const lignesEnErreur = Number(resume.lignes_en_erreur || 0);
  const lignesIgnorees = Number(resume.lignes_ignorees || 0);

  let statut = "success";
  let message = "Import termine avec succes.";

  if (lignesImportees === 0 && (lignesEnErreur > 0 || lignesIgnorees > 0)) {
    statut = "warning";
    message = "Aucune ligne n'a pu etre importee.";
  } else if (lignesEnErreur > 0) {
    statut = "partial";
    message = "Import termine partiellement.";
  } else if (lignesIgnorees > 0) {
    statut = "warning";
    message = "Import termine. Certaines lignes etaient deja a jour.";
  }

  return {
    ...resume,
    statut,
    message,
    lignes_importees: lignesImportees,
  };
}

export async function executerImportParLigne(connection, lignes, resume, handler) {
  for (let indexLigne = 0; indexLigne < lignes.length; indexLigne += 1) {
    const ligne = lignes[indexLigne];
    const savepoint = `import_row_${indexLigne + 1}`;

    await connection.query(`SAVEPOINT ${savepoint}`);

    try {
      const resultat = await handler(ligne, connection);
      enregistrerSuccesImport(resume, resultat);
    } catch (error) {
      await connection.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      enregistrerErreurImport(
        resume,
        `Ligne ${ligne.numeroLigne} : ${error.message || "Erreur lors du traitement de la ligne."}`
      );
    } finally {
      try {
        await connection.query(`RELEASE SAVEPOINT ${savepoint}`);
      } catch {
        // Certains environnements de test ne simulent pas RELEASE SAVEPOINT.
      }
    }
  }
}
