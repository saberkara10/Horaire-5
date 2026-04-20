import pool from "../../db.js";
import { assurerProgrammeReference } from "./programmes.model.js";
import { normaliserNomProgramme } from "../utils/programmes.js";

export const DUREE_COURS_FIXE = 3;
export const MODES_COURS = ["Presentiel", "En ligne"];

const SELECTION_COURS_SQL = `SELECT c.id_cours,
        c.code,
        c.nom,
        c.duree,
        c.programme,
        c.etape_etude,
        c.type_salle,
        c.id_salle_reference,
        COALESCE(c.est_en_ligne, 0) AS est_en_ligne,
        CASE
          WHEN COALESCE(c.est_en_ligne, 0) = 1 THEN 'En ligne'
          ELSE 'Presentiel'
        END AS mode_cours,
        s.code AS salle_code,
        s.type AS salle_type
 FROM cours c
 LEFT JOIN salles s
   ON s.id_salle = c.id_salle_reference`;

function normaliserCodeCours(codeCours) {
  return String(codeCours || "").trim().toUpperCase();
}

function normaliserTypeSalle(typeSalle) {
  return String(typeSalle || "").trim();
}

function normaliserModeCours(modeCours, estEnLigne) {
  if (typeof modeCours === "string" && modeCours.trim() !== "") {
    return modeCours.trim() === "En ligne" ? "En ligne" : "Presentiel";
  }

  return Boolean(Number(estEnLigne || 0)) ? "En ligne" : "Presentiel";
}

function determinerEstEnLigne(modeCours, estEnLigne) {
  return normaliserModeCours(modeCours, estEnLigne) === "En ligne";
}

async function recupererSalleParId(idSalle, executor = pool) {
  const [salles] = await executor.query(
    `SELECT id_salle, code, type, capacite
     FROM salles
     WHERE id_salle = ?
     LIMIT 1`,
    [idSalle]
  );

  return salles[0] || null;
}

export async function recupererTousLesCours() {
  const [listeCours] = await pool.query(`${SELECTION_COURS_SQL}
     ORDER BY c.code ASC`);

  return listeCours;
}

export async function recupererCoursParId(idCours) {
  const [coursTrouve] = await pool.query(
    `${SELECTION_COURS_SQL}
     WHERE c.id_cours = ?
     LIMIT 1`,
    [idCours]
  );

  return coursTrouve[0] || null;
}

export async function recupererTypesSalleDisponibles() {
  const [typesSalle] = await pool.query(
    `SELECT DISTINCT type
     FROM salles
     WHERE type IS NOT NULL
       AND TRIM(type) <> ''
     ORDER BY type ASC`
  );

  return typesSalle.map(({ type }) => type);
}

export async function recupererCoursParCode(codeCours) {
  const [coursTrouve] = await pool.query(
    `${SELECTION_COURS_SQL}
     WHERE UPPER(TRIM(c.code)) = ?
     LIMIT 1`,
    [normaliserCodeCours(codeCours)]
  );

  return coursTrouve[0] || null;
}

function resoudreTypeSallePresentiel(typeSalle, salleReference) {
  return salleReference?.type || normaliserTypeSalle(typeSalle);
}

export async function ajouterCours(nouveauCours) {
  const {
    code,
    nom,
    duree,
    programme,
    etape_etude,
    id_salle_reference,
    type_salle,
    mode_cours,
    est_en_ligne,
  } = nouveauCours;

  const codeNormalise = normaliserCodeCours(code);
  const estEnLigne = determinerEstEnLigne(mode_cours, est_en_ligne);
  const idSalleReference =
    id_salle_reference === null || id_salle_reference === undefined
      ? null
      : Number(id_salle_reference);
  const salleReference =
    !estEnLigne && Number.isInteger(idSalleReference) && idSalleReference > 0
      ? await recupererSalleParId(idSalleReference)
      : null;
  const typeSalleFinal = estEnLigne
    ? "En ligne"
    : resoudreTypeSallePresentiel(type_salle, salleReference);
  const programmeNormalise = await assurerProgrammeReference(programme);

  if (!estEnLigne && idSalleReference && !salleReference) {
    throw new Error("Salle de reference introuvable.");
  }

  if (!estEnLigne && (!typeSalleFinal || typeSalleFinal === "En ligne")) {
    throw new Error("Type de salle obligatoire.");
  }

  const [resultatInsertion] = await pool.query(
    `INSERT INTO cours (
      code,
      nom,
      duree,
      programme,
      etape_etude,
      type_salle,
      id_salle_reference,
      est_en_ligne
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      codeNormalise,
      String(nom || "").trim(),
      duree,
      programmeNormalise || normaliserNomProgramme(programme),
      String(etape_etude).trim(),
      typeSalleFinal,
      salleReference?.id_salle || null,
      estEnLigne ? 1 : 0,
    ]
  );

  return recupererCoursParId(resultatInsertion.insertId);
}

export async function modifierCours(idCours, donneesModification) {
  const coursActuel = await recupererCoursParId(idCours);

  if (!coursActuel) {
    return null;
  }

  const {
    code,
    nom,
    duree,
    programme,
    etape_etude,
    id_salle_reference,
    type_salle,
    mode_cours,
    est_en_ligne,
  } = donneesModification;
  const modeFourni = mode_cours !== undefined || est_en_ligne !== undefined;
  const salleFournie = Object.prototype.hasOwnProperty.call(
    donneesModification,
    "id_salle_reference"
  );
  const typeFourni = Object.prototype.hasOwnProperty.call(
    donneesModification,
    "type_salle"
  );
  const estEnLigneFinal = modeFourni
    ? determinerEstEnLigne(mode_cours, est_en_ligne)
    : Boolean(Number(coursActuel.est_en_ligne || 0));
  let idSalleFinal = coursActuel.id_salle_reference ?? null;
  let typeSalleFinal = normaliserTypeSalle(coursActuel.type_salle);
  let salleReference = null;

  if (estEnLigneFinal) {
    idSalleFinal = null;
    typeSalleFinal = "En ligne";
  } else {
    if (salleFournie) {
      if (id_salle_reference === null || id_salle_reference === undefined || id_salle_reference === "") {
        idSalleFinal = null;
      } else {
        const idSalleReference = Number(id_salle_reference);
        salleReference = await recupererSalleParId(idSalleReference);

        if (!salleReference) {
          throw new Error("Salle de reference introuvable.");
        }

        idSalleFinal = salleReference.id_salle;
        typeSalleFinal = salleReference.type;
      }
    }

    if (typeFourni) {
      typeSalleFinal = normaliserTypeSalle(type_salle);
    }

    if (salleReference) {
      typeSalleFinal = salleReference.type;
    }

    if (!typeSalleFinal || typeSalleFinal === "En ligne") {
      throw new Error("Type de salle obligatoire.");
    }
  }

  const champsAModifier = [];
  const valeurs = [];

  if (code !== undefined) {
    champsAModifier.push("code = ?");
    valeurs.push(normaliserCodeCours(code));
  }

  if (nom !== undefined) {
    champsAModifier.push("nom = ?");
    valeurs.push(String(nom || "").trim());
  }

  if (duree !== undefined) {
    champsAModifier.push("duree = ?");
    valeurs.push(duree);
  }

  if (programme !== undefined) {
    const programmeNormalise = await assurerProgrammeReference(programme);
    champsAModifier.push("programme = ?");
    valeurs.push(
      programmeNormalise || normaliserNomProgramme(programme)
    );
  }

  if (etape_etude !== undefined) {
    champsAModifier.push("etape_etude = ?");
    valeurs.push(String(etape_etude).trim());
  }

  if (modeFourni) {
    champsAModifier.push("est_en_ligne = ?");
    valeurs.push(estEnLigneFinal ? 1 : 0);
  }

  if (typeFourni || salleFournie || modeFourni) {
    champsAModifier.push("type_salle = ?");
    valeurs.push(typeSalleFinal);
  }

  if (salleFournie || modeFourni) {
    champsAModifier.push("id_salle_reference = ?");
    valeurs.push(idSalleFinal);
  }

  if (champsAModifier.length === 0) {
    return coursActuel;
  }

  valeurs.push(idCours);

  const [resultatModification] = await pool.query(
    `UPDATE cours
     SET ${champsAModifier.join(", ")}
     WHERE id_cours = ?
     LIMIT 1`,
    valeurs
  );

  if (resultatModification.affectedRows === 0) {
    return null;
  }

  return recupererCoursParId(idCours);
}

export async function coursEstDejaAffecte(idCours) {
  const [affectations] = await pool.query(
    `SELECT 1
     FROM affectation_cours
     WHERE id_cours = ?
     LIMIT 1`,
    [idCours]
  );

  return affectations.length > 0;
}

export async function supprimerCours(idCours) {
  const [resultatSuppression] = await pool.query(
    `DELETE FROM cours
     WHERE id_cours = ?
     LIMIT 1`,
    [idCours]
  );

  return resultatSuppression.affectedRows > 0;
}

export async function salleExisteParId(idSalle) {
  const salle = await recupererSalleParId(idSalle);
  return Boolean(salle);
}
