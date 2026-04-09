import pool from "../../db.js";
import {
  normaliserNomProgramme,
  normaliserTexte,
} from "../utils/programmes.js";

export function normaliserEtDedupliquerProgrammes(programmes) {
  const programmesParCle = new Map();

  for (const programme of programmes) {
    const valeurBrute = String(programme || "").trim();

    if (!valeurBrute) {
      continue;
    }

    const valeurNormalisee = normaliserNomProgramme(valeurBrute) || valeurBrute;
    const cle = normaliserTexte(valeurNormalisee);

    if (!cle || programmesParCle.has(cle)) {
      continue;
    }

    programmesParCle.set(cle, valeurNormalisee);
  }

  return [...programmesParCle.values()].sort((programmeA, programmeB) =>
    programmeA.localeCompare(programmeB, "fr")
  );
}

export async function assurerProgrammeReference(programme, executor = pool) {
  const programmeNormalise = normaliserNomProgramme(programme);

  if (!programmeNormalise) {
    return "";
  }

  await executor.query(
    `INSERT IGNORE INTO programmes_reference (nom_programme)
     VALUES (?)`,
    [programmeNormalise]
  );

  return programmeNormalise;
}

export async function recupererProgrammesDisponibles(executor = pool) {
  const [programmes] = await executor.query(
    `SELECT DISTINCT programme
     FROM (
       SELECT nom_programme AS programme
       FROM programmes_reference
       WHERE nom_programme IS NOT NULL AND TRIM(nom_programme) <> ''
       UNION
       SELECT programme
       FROM cours
       WHERE programme IS NOT NULL AND TRIM(programme) <> ''
       UNION
       SELECT programme
       FROM etudiants
       WHERE programme IS NOT NULL AND TRIM(programme) <> ''
       UNION
       SELECT specialite AS programme
       FROM professeurs
       WHERE specialite IS NOT NULL AND TRIM(specialite) <> ''
     ) AS programmes_uniques`
  );

  return normaliserEtDedupliquerProgrammes(
    programmes.map((programme) => programme.programme)
  );
}
