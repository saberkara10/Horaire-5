/**
 * ROUTES - Module Etudiants
 */

import multer from "multer";
import xlsx from "xlsx";
import {
  recupererTousLesEtudiants,
  recupererEtudiantParId,
  importerEtudiants,
  supprimerTousLesEtudiants,
} from "../src/model/etudiants.model.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (request, file, callback) => {
    const extensionsAutorisees = [".xlsx", ".xls", ".csv"];
    const nomFichier = file.originalname.toLowerCase();
    const extensionValide = extensionsAutorisees.some((extension) =>
      nomFichier.endsWith(extension)
    );
    if (!extensionValide) {
      return callback(new Error("Format invalide. Utilisez un fichier Excel ou CSV."));
    }
    callback(null, true);
  },
});

function parserCsv(buffer) {
  const contenu = buffer.toString("utf-8").trim();
  if (!contenu) return [];
  const lignes = contenu.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lignes.length === 0) return [];
  const enTetes = lignes[0].split(",").map((c) => c.trim());
  return lignes.slice(1).map((ligne) => {
    const valeurs = ligne.split(",").map((v) => v.trim());
    const objet = {};
    enTetes.forEach((entete, index) => {
      objet[entete] = valeurs[index] ?? "";
    });
    return objet;
  });
}

function parserExcel(buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const nomPremiereFeuille = workbook.SheetNames[0];
  const feuille = workbook.Sheets[nomPremiereFeuille];
  if (!feuille) return [];
  return xlsx.utils.sheet_to_json(feuille, { defval: "", raw: false });
}

function verifierColonnesObligatoires(lignes) {
  const colonnesObligatoires = [
    "matricule",
    "nom",
    "prenom",
    "programme",
    "etape",
    "session",
    "annee",
  ];
  if (!lignes.length) return colonnesObligatoires;
  const colonnesDisponibles = Object.keys(lignes[0]).map((c) => c.trim().toLowerCase());
  return colonnesObligatoires.filter((c) => !colonnesDisponibles.includes(c));
}

function normaliserEtudiants(lignes) {
  return lignes.map((ligne) => ({
    matricule: String(ligne.matricule ?? "").trim(),
    nom: String(ligne.nom ?? "").trim(),
    prenom: String(ligne.prenom ?? "").trim(),
    programme: String(ligne.programme ?? "").trim(),
    etape: Number(ligne.etape),
    session: String(ligne.session ?? "").trim(),
    annee: Number(ligne.annee),
  }));
}

export default function etudiantsRoutes(app) {
  app.get("/api/etudiants", async (request, response) => {
    try {
      const etudiants = await recupererTousLesEtudiants();
      response.status(200).json(etudiants);
    } catch (error) {
      response.status(500).json({ message: "Erreur lors de la recuperation des etudiants." });
    }
  });

  app.get("/api/etudiants/:id", async (request, response) => {
    try {
      const etudiant = await recupererEtudiantParId(Number(request.params.id));
      if (!etudiant) {
        return response.status(404).json({ message: "Etudiant introuvable." });
      }
      response.status(200).json(etudiant);
    } catch (error) {
      response.status(500).json({ message: "Erreur lors de la recuperation de l'etudiant." });
    }
  });

  app.post("/api/etudiants/import", upload.single("fichier"), async (request, response) => {
    try {
      if (!request.file) {
        return response.status(400).json({ message: "Aucun fichier recu." });
      }
      const nomFichier = request.file.originalname.toLowerCase();
      let lignes = [];
      if (nomFichier.endsWith(".csv")) {
        lignes = parserCsv(request.file.buffer);
      } else {
        lignes = parserExcel(request.file.buffer);
      }
      if (!lignes.length) {
        return response.status(400).json({ message: "Le fichier est vide ou invalide." });
      }
      const colonnesManquantes = verifierColonnesObligatoires(lignes);
      if (colonnesManquantes.length > 0) {
        return response.status(400).json({
          message: "Colonnes obligatoires manquantes: " + colonnesManquantes.join(", "),
        });
      }
      const etudiantsAImporter = normaliserEtudiants(lignes);
      const resultat = await importerEtudiants(etudiantsAImporter);
      if (!resultat.succes) {
        return response.status(400).json(resultat);
      }
      response.status(200).json(resultat);
    } catch (error) {
      response.status(500).json({ message: error.message || "Erreur lors de l'import des etudiants." });
    }
  });

  app.delete("/api/etudiants", async (request, response) => {
    try {
      await supprimerTousLesEtudiants();
      response
        .status(200)
        .json({ message: "Tous les etudiants et groupes generes ont ete supprimes." });
    } catch (error) {
      response.status(500).json({ message: "Erreur lors de la suppression des etudiants." });
    }
  });
}
