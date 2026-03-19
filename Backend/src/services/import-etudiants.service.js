/**
 * Service dedie a l'import des etudiants depuis un fichier Excel ou CSV.
 *
 * Responsabilites de ce module :
 * - lire le fichier transmis par le frontend ;
 * - normaliser les entetes et les cellules ;
 * - valider les colonnes attendues ;
 * - transformer chaque ligne en objet etudiant exploitable ;
 * - produire des messages d'erreur explicites avant toute ecriture SQL.
 */

import path from "node:path";
import XLSX from "xlsx";
import { enregistrerEtudiantsImportes } from "../model/import-etudiants.model.js";

const COLONNES_OBLIGATOIRES = [
  "matricule",
  "nom",
  "prenom",
  "groupe",
  "programme",
  "etape",
];

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

function convertirFichierEnLignes(fichier) {
  try {
    const workbook = extraireWorkbookDepuisFichier(fichier);
    const premierNomFeuille = workbook.SheetNames[0];

    if (!premierNomFeuille) {
      return [];
    }

    const feuille = workbook.Sheets[premierNomFeuille];

    return XLSX.utils.sheet_to_json(feuille, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
  } catch (error) {
    throw creerErreurImport("Impossible de lire le fichier.", [
      "Le fichier envoye ne peut pas etre lu comme un document Excel ou CSV valide.",
    ]);
  }
}

/**
 * Valider la structure minimale du fichier avant d'analyser les lignes.
 *
 * La premiere ligne doit contenir l'entete. On normalise les intitulés pour
 * tolerer les differences de casse et les espaces residuels.
 *
 * @param {Array<Array<string>>} lignes Contenu brut du fichier.
 * @returns {{message: string, erreurs: string[]} | null}
 */
function validerStructureFichier(lignes) {
  if (lignes.length === 0) {
    return {
      message: "Fichier vide.",
      erreurs: ["Le fichier ne contient aucune ligne etudiant a importer."],
    };
  }

  const entetes = lignes[0].map(normaliserEntete);
  const colonnesManquantes = COLONNES_OBLIGATOIRES.filter(
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

/**
 * Valider une ligne deja transformee en objet metier.
 *
 * La validation se limite volontairement a des regles deterministes :
 * presence des champs requis, tailles raisonnables et etape numerique.
 * Les controles dependants de la base sont delegues au modele SQL.
 *
 * @param {Object} etudiant Donnees candidates a l'import.
 * @returns {string[]} Liste des erreurs pour cette ligne.
 */
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

  if (!etudiant.groupe) {
    erreurs.push(`Ligne ${etudiant.numeroLigne} : groupe obligatoire.`);
  } else if (etudiant.groupe.length > 100) {
    erreurs.push(
      `Ligne ${etudiant.numeroLigne} : le groupe ${etudiant.groupe} depasse la longueur maximale autorisee.`
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

  return erreurs;
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
      "Veuillez selectionner un fichier .xlsx ou .csv avant de lancer l'import.",
    ]);
  }

  const lignes = convertirFichierEnLignes(fichier);
  const erreurStructure = validerStructureFichier(lignes);

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

    const etudiant = {
      numeroLigne,
      matricule: normaliserValeurTexte(ligne[indexColonnes.matricule]),
      nom: normaliserValeurTexte(ligne[indexColonnes.nom]),
      prenom: normaliserValeurTexte(ligne[indexColonnes.prenom]),
      groupe: normaliserValeurTexte(ligne[indexColonnes.groupe]),
      programme: normaliserValeurTexte(ligne[indexColonnes.programme]),
      etapeBrute,
      etape: Number(etapeBrute),
    };

    const ligneEstVide =
      !etudiant.matricule &&
      !etudiant.nom &&
      !etudiant.prenom &&
      !etudiant.groupe &&
      !etudiant.programme &&
      !etapeBrute;

    if (ligneEstVide) {
      // Les lignes totalement vides sont ignorees pour permettre l'usage
      // de fichiers exportes qui contiennent des sauts ou separations visuelles.
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

  const resultat = await enregistrerEtudiantsImportes(etudiants);

  if (resultat.erreurs?.length) {
    throw creerErreurImport("Import impossible.", resultat.erreurs, 409);
  }

  return {
    message: "Import termine avec succes.",
    nombre_importes: resultat.nombreImportes,
  };
}
