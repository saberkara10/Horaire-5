/**
 * ROUTES - Module Étudiants
 *
 * Ce module définit les routes HTTP liées aux étudiants :
 * - consultation de la liste
 * - consultation d'un étudiant
 * - import par fichier
 */

import multer from "multer";
import xlsx from "xlsx";
import {
  recupererTousLesEtudiants,
  recupererEtudiantParId,
  importerEtudiants,
} from "../src/model/etudiants.model.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (request, file, callback) => {
    const extensionsAutorisees = [".xlsx", ".xls", ".csv"];
    const nomFichier = file.originalname.toLowerCase();

    const extensionValide = extensionsAutorisees.some((extension) =>
      nomFichier.endsWith(extension)
    );

    if (!extensionValide) {
      return callback(
        new Error("Format invalide. Utilisez un fichier Excel ou CSV.")
      );
    }

    callback(null, true);
  },
});

/**
 * Convertir un buffer CSV en objets JS.
 *
 * @param {Buffer} buffer
 * @returns {Array<Object>}
 */
function parserCsv(buffer) {
  const contenu = buffer.toString("utf-8").trim();

  if (!contenu) {
    return [];
  }

  const lignes = contenu
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter(Boolean);

  if (lignes.length === 0) {
    return [];
  }

  const enTetes = lignes[0].split(",").map((colonne) => colonne.trim());

  return lignes.slice(1).map((ligne) => {
    const valeurs = ligne.split(",").map((valeur) => valeur.trim());
    const objet = {};

    enTetes.forEach((entete, index) => {
      objet[entete] = valeurs[index] ?? "";
    });

    return objet;
  });
}

/**
 * Convertir un buffer Excel en objets JS.
 *
 * @param {Buffer} buffer
 * @returns {Array<Object>}
 */
function parserExcel(buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const nomPremiereFeuille = workbook.SheetNames[0];
  const feuille = workbook.Sheets[nomPremiereFeuille];

  if (!feuille) {
    return [];
  }

  return xlsx.utils.sheet_to_json(feuille, {
    defval: "",
    raw: false,
  });
}

/**
 * Vérifier que les colonnes obligatoires existent.
 *
 * @param {Array<Object>} lignes
 * @returns {Array<string>}
 */
function verifierColonnesObligatoires(lignes) {
  const colonnesObligatoires = [
    "matricule",
    "nom",
    "prenom",
    "groupe",
    "programme",
    "etape",
  ];

  if (!lignes.length) {
    return colonnesObligatoires;
  }

  const colonnesDisponibles = Object.keys(lignes[0]).map((colonne) =>
    colonne.trim().toLowerCase()
  );

  return colonnesObligatoires.filter(
    (colonne) => !colonnesDisponibles.includes(colonne)
  );
}

/**
 * Normaliser les lignes importées.
 *
 * @param {Array<Object>} lignes
 * @returns {Array<Object>}
 */
function normaliserEtudiants(lignes) {
  return lignes.map((ligne) => ({
    matricule: String(ligne.matricule ?? "").trim(),
    nom: String(ligne.nom ?? "").trim(),
    prenom: String(ligne.prenom ?? "").trim(),
    groupe: String(ligne.groupe ?? "").trim(),
    programme: String(ligne.programme ?? "").trim(),
    etape: Number(ligne.etape),
  }));
}

/**
 * Initialiser les routes des étudiants.
 *
 * @param {import("express").Express} app
 */
export default function etudiantsRoutes(app) {
  /**
   * GET /api/etudiants
   * Récupérer tous les étudiants.
   */
  app.get("/api/etudiants", async (request, response) => {
    try {
      const etudiants = await recupererTousLesEtudiants();
      response.status(200).json(etudiants);
    } catch (error) {
      response.status(500).json({
        message: "Erreur lors de la récupération des étudiants.",
      });
    }
  });

  /**
   * GET /api/etudiants/:id
   * Récupérer un étudiant par son identifiant.
   */
  app.get("/api/etudiants/:id", async (request, response) => {
    try {
      const etudiant = await recupererEtudiantParId(Number(request.params.id));

      if (!etudiant) {
        return response.status(404).json({
          message: "Étudiant introuvable.",
        });
      }

      response.status(200).json(etudiant);
    } catch (error) {
      response.status(500).json({
        message: "Erreur lors de la récupération de l'étudiant.",
      });
    }
  });

  /**
   * POST /api/etudiants/import
   * Importer une liste d'étudiants depuis un fichier Excel/CSV.
   */
  app.post(
    "/api/etudiants/import",
    upload.single("fichier"),
    async (request, response) => {
      try {
        if (!request.file) {
          return response.status(400).json({
            message: "Aucun fichier reçu.",
          });
        }

        const nomFichier = request.file.originalname.toLowerCase();

        let lignes = [];

        if (nomFichier.endsWith(".csv")) {
          lignes = parserCsv(request.file.buffer);
        } else {
          lignes = parserExcel(request.file.buffer);
        }

        if (!lignes.length) {
          return response.status(400).json({
            message: "Le fichier est vide ou invalide.",
          });
        }

        const colonnesManquantes = verifierColonnesObligatoires(lignes);

        if (colonnesManquantes.length > 0) {
          return response.status(400).json({
            message: `Colonnes obligatoires manquantes: ${colonnesManquantes.join(", ")}`,
          });
        }

        const etudiantsAImporter = normaliserEtudiants(lignes);
        const resultat = await importerEtudiants(etudiantsAImporter);

        if (!resultat.succes) {
          return response.status(400).json(resultat);
        }

        response.status(200).json(resultat);
      } catch (error) {
        response.status(500).json({
          message: error.message || "Erreur lors de l'import des étudiants.",
        });
      }
    }
  );
}