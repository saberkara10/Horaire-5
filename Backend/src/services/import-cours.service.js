/**
 * Import Excel/CSV pour le module Cours.
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
  ajouterCours,
  modifierCours,
  recupererCoursParCode,
} from "../model/cours.model.js";
import { getSalleByCode } from "../model/salle.js";
import { normaliserNomProgramme } from "../utils/programmes.js";
import { normaliserTypeSalle } from "../validations/salles.validation.js";

const DEFINITION = recupererDefinitionImportExcel("cours");

function normaliserCodeCoursImport(codeCours) {
  return String(codeCours || "").trim().toUpperCase();
}

function transformerLigneCours(brut, { numeroLigne }) {
  return {
    numeroLigne,
    code: normaliserCodeCoursImport(brut.code),
    nom: normaliserValeurTexte(brut.nom),
    dureeBrute: normaliserValeurTexte(brut.duree),
    duree: Number(normaliserValeurTexte(brut.duree)),
    programme: normaliserValeurTexte(brut.programme),
    etapeBrute: normaliserValeurTexte(brut.etape_etude),
    etape_etude: Number(normaliserValeurTexte(brut.etape_etude)),
    salle_reference_code: normaliserValeurTexte(brut.salle_reference_code),
    type_salle: normaliserTypeSalle(brut.type_salle),
  };
}

function validerLigneCours(ligne) {
  const erreurs = [];

  if (!ligne.code) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : code obligatoire.`);
  } else if (ligne.code.length > 50) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : code trop long (max 50).`);
  }

  if (!ligne.nom || /^\d+$/.test(ligne.nom)) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : nom invalide.`);
  } else if (ligne.nom.length > 150) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : nom trop long (max 150).`);
  }

  if (!ligne.programme) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : programme obligatoire.`);
  } else if (ligne.programme.length > 150) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : programme trop long (max 150).`);
  }

  if (!Number.isInteger(ligne.duree) || ligne.duree < 1 || ligne.duree > 4) {
    erreurs.push(
      `Ligne ${ligne.numeroLigne} : duree invalide (${ligne.dureeBrute || "vide"}). Les valeurs attendues vont de 1 a 4 heures.`
    );
  }

  if (
    !Number.isInteger(ligne.etape_etude) ||
    ligne.etape_etude < 1 ||
    ligne.etape_etude > 8
  ) {
    erreurs.push(
      `Ligne ${ligne.numeroLigne} : etape invalide (${ligne.etapeBrute || "vide"}).`
    );
  }

  if (!ligne.salle_reference_code) {
    erreurs.push(
      `Ligne ${ligne.numeroLigne} : salle_reference_code obligatoire.`
    );
  } else if (ligne.salle_reference_code.length > 50) {
    erreurs.push(
      `Ligne ${ligne.numeroLigne} : salle_reference_code trop long (max 50).`
    );
  }

  if (ligne.type_salle && ligne.type_salle.length > 50) {
    erreurs.push(`Ligne ${ligne.numeroLigne} : type_salle trop long (max 50).`);
  }

  return erreurs;
}

function construireCleDoublonCours(ligne) {
  return String(ligne.code || "").toUpperCase();
}

function coursEstIdentique(coursExistant, payload) {
  return (
    normaliserCodeCoursImport(coursExistant?.code) ===
      normaliserCodeCoursImport(payload.code) &&
    String(coursExistant?.nom || "").trim() === String(payload.nom || "").trim() &&
    Number(coursExistant?.duree || 0) === Number(payload.duree || 0) &&
    normaliserNomProgramme(coursExistant?.programme) ===
      normaliserNomProgramme(payload.programme) &&
    String(coursExistant?.etape_etude || "").trim() ===
      String(payload.etape_etude || "").trim() &&
    Number(coursExistant?.id_salle_reference || 0) ===
      Number(payload.id_salle_reference || 0)
  );
}

async function traiterLigneCours(ligne, connection) {
  const salleReference = await getSalleByCode(ligne.salle_reference_code, connection);

  if (!salleReference) {
    throw new Error(
      `la salle de reference ${ligne.salle_reference_code} est introuvable.`
    );
  }

  if (
    ligne.type_salle &&
    normaliserTypeSalle(salleReference.type) !== ligne.type_salle
  ) {
    throw new Error(
      `le type_salle ${ligne.type_salle} ne correspond pas a la salle ${ligne.salle_reference_code} (${salleReference.type}).`
    );
  }

  const payload = {
    code: ligne.code,
    nom: ligne.nom,
    duree: ligne.duree,
    programme: ligne.programme,
    etape_etude: String(ligne.etape_etude),
    id_salle_reference: Number(salleReference.id_salle),
  };
  const coursExistant = await recupererCoursParCode(ligne.code, connection);

  if (!coursExistant) {
    await ajouterCours(payload, connection);
    return { statut: "cree" };
  }

  if (coursEstIdentique(coursExistant, payload)) {
    return {
      statut: "ignore",
      message: `Ligne ${ligne.numeroLigne} : aucune mise a jour necessaire pour le cours ${ligne.code}.`,
    };
  }

  await modifierCours(Number(coursExistant.id_cours), payload, connection);
  return { statut: "mis_a_jour" };
}

export async function importerCoursDepuisFichier(fichier) {
  const workbook = lireWorkbookImport(fichier);
  const nomFeuille = resoudreNomFeuilleImport(workbook, DEFINITION.preferredSheetNames);
  const lignes = convertirFeuilleImportEnLignes(workbook, nomFeuille);
  const analyse = parserLignesImport(lignes, DEFINITION, {
    transformerLigne: transformerLigneCours,
    validerLigne: validerLigneCours,
    construireCleDoublon: construireCleDoublonCours,
    messageDoublon: (ligne) =>
      `Ligne ${ligne.numeroLigne} : le code ${ligne.code} est duplique dans le fichier.`,
  });
  const resume = creerResumeImport("cours", analyse.totalLignesLues, analyse.erreurs);

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
      traiterLigneCours
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
