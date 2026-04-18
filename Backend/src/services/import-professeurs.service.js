/**
 * Import Excel/CSV pour le module Professeurs.
 */

import pool from "../../db.js";
import {
  creerResumeImport,
  decouperValeursMultiples,
  executerImportParLigne,
  finaliserResumeImport,
  lireWorkbookImport,
  normaliserValeurTexte,
  parserLignesImport,
  resoudreNomFeuilleImport,
  convertirFeuilleImportEnLignes,
} from "./import-excel.shared.js";
import { recupererDefinitionImportExcel } from "./import-excel.definitions.js";
import {
  ajouterProfesseur,
  modifierProfesseur,
  recupererProfesseurParMatricule,
  recupererProfesseurParNomPrenom,
  validerContrainteCoursProfesseur,
} from "../model/professeurs.model.js";

const DEFINITION = recupererDefinitionImportExcel("professeurs");

function extraireCoursIdsDepuisValeur(valeur) {
  if (Array.isArray(valeur)) {
    return valeur
      .map((idCours) => Number(idCours))
      .filter((idCours) => Number.isInteger(idCours) && idCours > 0);
  }

  return String(valeur || "")
    .split(",")
    .map((idCours) => Number(idCours.trim()))
    .filter((idCours) => Number.isInteger(idCours) && idCours > 0);
}

function normaliserIdentite(valeur) {
  return String(valeur || "")
    .trim()
    .replace(/\s+/g, " ");
}

function transformerLigneProfesseur(brut, { numeroLigne }) {
  return {
    numeroLigne,
    matricule: normaliserValeurTexte(brut.matricule),
    nom: normaliserIdentite(brut.nom),
    prenom: normaliserIdentite(brut.prenom),
    specialite: normaliserValeurTexte(brut.specialite),
    cours_codes: decouperValeursMultiples(brut.cours_codes).map((code) =>
      String(code || "").trim().toUpperCase()
    ),
  };
}

function validerLigneProfesseur(ligne) {
  const erreurs = [];

  if (!ligne.matricule) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : matricule obligatoire.`);
  } else if (ligne.matricule.length > 50) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : matricule trop long (max 50).`);
  }

  if (!ligne.nom || /^\d+$/.test(ligne.nom)) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : nom invalide.`);
  } else if (ligne.nom.length > 100) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : nom trop long (max 100).`);
  }

  if (!ligne.prenom || /^\d+$/.test(ligne.prenom)) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : prenom invalide.`);
  } else if (ligne.prenom.length > 100) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : prenom trop long (max 100).`);
  }

  if (ligne.specialite && ligne.specialite.length > 150) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : specialite trop longue (max 150).`);
  }

  const coursDupliques = new Set();
  const coursVus = new Set();

  for (const codeCours of ligne.cours_codes) {
    if (codeCours.length > 50) {
      erreurs.push(
        `Ligne ${ligne.numeroLigne} : code cours trop long (${codeCours}).`
      );
      continue;
    }

    if (coursVus.has(codeCours)) {
      coursDupliques.add(codeCours);
    } else {
      coursVus.add(codeCours);
    }
  }

  for (const codeCours of coursDupliques) {
    erreurs.push(
      `Ligne ${ligne.numeroLigne} : le code cours ${codeCours} est duplique dans la meme ligne.`
    );
  }

  return erreurs;
}

function construireCleDoublonProfesseur(ligne) {
  return String(ligne.matricule || "").toLowerCase();
}

function recupererCoursIdsOrdreStable(coursIds = []) {
  return [...new Set(
    coursIds
      .map((idCours) => Number(idCours))
      .filter((idCours) => Number.isInteger(idCours) && idCours > 0)
  )].sort((idCoursA, idCoursB) => idCoursA - idCoursB);
}

function professeurEstIdentique(
  professeurExistant,
  payload,
  options = {}
) {
  const inclureSpecialite = Boolean(options.inclureSpecialite);
  const inclureCours = Boolean(options.inclureCours);
  const coursActuels = recupererCoursIdsOrdreStable(
    extraireCoursIdsDepuisValeur(professeurExistant?.cours_ids)
  );
  const coursImportes = recupererCoursIdsOrdreStable(payload?.cours_ids || []);
  const specialiteActuelle = String(professeurExistant?.specialite || "").trim() || null;
  const specialiteImportee = String(payload?.specialite || "").trim() || null;

  if (String(professeurExistant?.matricule || "").trim() !== payload.matricule) {
    return false;
  }

  if (normaliserIdentite(professeurExistant?.nom) !== payload.nom) {
    return false;
  }

  if (normaliserIdentite(professeurExistant?.prenom) !== payload.prenom) {
    return false;
  }

  if (inclureSpecialite && specialiteActuelle !== specialiteImportee) {
    return false;
  }

  if (inclureCours && JSON.stringify(coursActuels) !== JSON.stringify(coursImportes)) {
    return false;
  }

  return true;
}

async function recupererCoursParCodes(coursCodes, executor) {
  const codesNormalises = [...new Set(
    (Array.isArray(coursCodes) ? coursCodes : [])
      .map((codeCours) => String(codeCours || "").trim().toUpperCase())
      .filter(Boolean)
  )];

  if (codesNormalises.length === 0) {
    return [];
  }

  const placeholders = codesNormalises.map(() => "?").join(", ");
  const [cours] = await executor.query(
    `SELECT id_cours, code, archive
     FROM cours
     WHERE UPPER(TRIM(code)) IN (${placeholders})`,
    codesNormalises
  );

  const coursParCode = new Map(
    cours.map((coursItem) => [
      String(coursItem.code || "").trim().toUpperCase(),
      coursItem,
    ])
  );

  return codesNormalises.map((codeCours) => coursParCode.get(codeCours)).filter(Boolean);
}

async function resoudreCoursIdsProfesseur(ligne, executor) {
  const cours = await recupererCoursParCodes(ligne.cours_codes, executor);

  if (cours.length !== ligne.cours_codes.length) {
    const codesTrouves = new Set(
      cours.map((coursItem) => String(coursItem.code || "").trim().toUpperCase())
    );
    const codesAbsents = ligne.cours_codes.filter((codeCours) => !codesTrouves.has(codeCours));

    throw new Error(
      `les cours ${codesAbsents.join(", ")} sont introuvables.`
    );
  }

  if (cours.some((coursItem) => Number(coursItem.archive || 0) === 1)) {
    const codesArchives = cours
      .filter((coursItem) => Number(coursItem.archive || 0) === 1)
      .map((coursItem) => coursItem.code)
      .join(", ");
    throw new Error(`les cours ${codesArchives} sont archives.`);
  }

  return cours.map((coursItem) => Number(coursItem.id_cours));
}

async function traiterLigneProfesseur(ligne, connection, options = {}) {
  const coursIds = options.inclureCours
    ? await resoudreCoursIdsProfesseur(ligne, connection)
    : [];
  const payload = {
    matricule: ligne.matricule,
    nom: ligne.nom,
    prenom: ligne.prenom,
    ...(options.inclureSpecialite ? { specialite: ligne.specialite || null } : {}),
    ...(options.inclureCours ? { cours_ids: coursIds } : {}),
  };
  const professeurParMatricule = await recupererProfesseurParMatricule(
    ligne.matricule,
    connection
  );
  const professeurParNom = await recupererProfesseurParNomPrenom(
    ligne.nom,
    ligne.prenom,
    connection
  );

  if (
    professeurParMatricule &&
    professeurParNom &&
    Number(professeurParMatricule.id_professeur) !==
      Number(professeurParNom.id_professeur)
  ) {
    throw new Error(
      `conflit detecte : le matricule ${ligne.matricule} et l'identite ${ligne.prenom} ${ligne.nom} pointent vers deux professeurs differents.`
    );
  }

  if (options.inclureCours) {
    const messageErreurContrainte = await validerContrainteCoursProfesseur(
      coursIds,
      connection
    );

    if (messageErreurContrainte) {
      throw new Error(messageErreurContrainte);
    }
  }

  const professeurExistant = professeurParMatricule || professeurParNom || null;

  if (!professeurExistant) {
    await ajouterProfesseur(payload, connection);
    return { statut: "cree" };
  }

  if (
    professeurEstIdentique(professeurExistant, payload, {
      inclureSpecialite: options.inclureSpecialite,
      inclureCours: options.inclureCours,
    })
  ) {
    return {
      statut: "ignore",
      message: `Ligne ${ligne.numeroLigne} : aucune mise a jour necessaire pour le professeur ${ligne.matricule}.`,
    };
  }

  await modifierProfesseur(
    Number(professeurExistant.id_professeur),
    payload,
    connection
  );

  return { statut: "mis_a_jour" };
}

export async function importerProfesseursDepuisFichier(fichier) {
  const workbook = lireWorkbookImport(fichier);
  const nomFeuille = resoudreNomFeuilleImport(workbook, DEFINITION.preferredSheetNames);
  const lignes = convertirFeuilleImportEnLignes(workbook, nomFeuille);
  const analyse = parserLignesImport(lignes, DEFINITION, {
    transformerLigne: transformerLigneProfesseur,
    validerLigne: validerLigneProfesseur,
    construireCleDoublon: construireCleDoublonProfesseur,
    messageDoublon: (ligne) =>
      `Ligne ${ligne.numeroLigne} : le matricule ${ligne.matricule} est duplique dans le fichier.`,
  });
  const resume = creerResumeImport(
    "professeurs",
    analyse.totalLignesLues,
    analyse.erreurs
  );
  const optionsTraitement = {
    inclureSpecialite: analyse.colonnesPresentes.has("specialite"),
    inclureCours: analyse.colonnesPresentes.has("cours_codes"),
  };

  if (analyse.lignesValides.length === 0) {
    return finaliserResumeImport(resume);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await executerImportParLigne(connection, analyse.lignesValides, resume, (ligne) =>
      traiterLigneProfesseur(ligne, connection, optionsTraitement)
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return finaliserResumeImport(resume);
}
