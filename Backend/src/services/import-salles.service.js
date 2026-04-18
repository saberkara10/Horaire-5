/**
 * Import Excel/CSV pour le module Salles.
 */

import pool from "../../db.js";
import {
  creerResumeImport,
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
  addSalle,
  getSalleByCode,
  modifySalle,
} from "../model/salle.js";
import { normaliserTypeSalle } from "../validations/salles.validation.js";

const DEFINITION = recupererDefinitionImportExcel("salles");

function transformerLigneSalle(brut, { numeroLigne }) {
  return {
    numeroLigne,
    code: normaliserValeurTexte(brut.code),
    type: normaliserTypeSalle(brut.type),
    capaciteBrute: normaliserValeurTexte(brut.capacite),
    capacite: Number(normaliserValeurTexte(brut.capacite)),
  };
}

function validerLigneSalle(ligne) {
  const erreurs = [];

  if (!ligne.code) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : code obligatoire.`);
  } else if (ligne.code.length > 50) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : code trop long (max 50).`);
  }

  if (!ligne.type) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : type obligatoire.`);
  } else if (ligne.type.length > 50) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : type trop long (max 50).`);
  }

  if (!Number.isInteger(ligne.capacite) || ligne.capacite <= 0) {
    erreurs.push(
      `Ligne ${ligne.numeroLigne} : capacite invalide (${ligne.capaciteBrute || "vide"}).`
    );
  }

  return erreurs;
}

function construireCleDoublonSalle(ligne) {
  return String(ligne.code || "").toLowerCase();
}

function salleEstIdentique(salleExistante, ligne) {
  return (
    String(salleExistante?.type || "").trim() === ligne.type &&
    Number(salleExistante?.capacite || 0) === Number(ligne.capacite || 0)
  );
}

async function traiterLigneSalle(ligne, connection) {
  const salleExistante = await getSalleByCode(ligne.code, connection);

  if (!salleExistante) {
    await addSalle(ligne.code, ligne.type, ligne.capacite, connection);
    return { statut: "cree" };
  }

  if (salleEstIdentique(salleExistante, ligne)) {
    return {
      statut: "ignore",
      message: `Ligne ${ligne.numeroLigne} : aucune mise a jour necessaire pour la salle ${ligne.code}.`,
    };
  }

  await modifySalle(
    Number(salleExistante.id_salle),
    ligne.type,
    ligne.capacite,
    connection
  );

  return { statut: "mis_a_jour" };
}

export async function importerSallesDepuisFichier(fichier) {
  const workbook = lireWorkbookImport(fichier);
  const nomFeuille = resoudreNomFeuilleImport(workbook, DEFINITION.preferredSheetNames);
  const lignes = convertirFeuilleImportEnLignes(workbook, nomFeuille);
  const analyse = parserLignesImport(lignes, DEFINITION, {
    transformerLigne: transformerLigneSalle,
    validerLigne: validerLigneSalle,
    construireCleDoublon: construireCleDoublonSalle,
    messageDoublon: (ligne) =>
      `Ligne ${ligne.numeroLigne} : le code ${ligne.code} est duplique dans le fichier.`,
  });
  const resume = creerResumeImport(
    "salles",
    analyse.totalLignesLues,
    analyse.erreurs
  );

  if (analyse.lignesValides.length === 0) {
    return finaliserResumeImport(resume);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await executerImportParLigne(
      connection,
      analyse.lignesValides,
      resume,
      traiterLigneSalle
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
