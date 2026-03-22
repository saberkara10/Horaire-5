/**
 * ROUTES — Module Étudiants
 *
 * Ce module définit les routes HTTP liées aux étudiants.
 * Ici, on gère la consultation de l'horaire d'un étudiant et l'import.
 */

import multer from "multer";
import xlsx from "xlsx";
import {
  recupererTousLesEtudiants,
  recupererHoraireCompletEtudiant,
  importerEtudiants,
} from "../src/model/etudiants.model.js";

import {
  validerIdEtudiant,
  verifierEtudiantExiste,
} from "../src/validations/etudiants.validation.js";

// Configuration de multer pour l'upload de fichiers
const stockage = multer.memoryStorage();
const upload = multer({
  storage: stockage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (request, file, callback) => {
    // Accepter seulement .xlsx et .csv
    const typesAcceptes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'text/csv', // .csv
      'application/vnd.ms-excel', // .xls (au cas où)
    ];

    if (typesAcceptes.includes(file.mimetype) ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.csv')) {
      callback(null, true);
    } else {
      callback(new Error('Format de fichier non supporté. Utilisez .xlsx ou .csv'));
    }
  }
});

/**
 * Initialiser les routes des étudiants.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function etudiantsRoutes(app) {
  /**
   * GET /api/etudiants/:id/horaire
   * Récupérer les informations d'un étudiant avec son horaire.
   */
  app.get(
    "/api/etudiants/:id/horaire",
    validerIdEtudiant,
    verifierEtudiantExiste,
    async (request, response) => {
      try {
        const horaireEtudiant = await recupererHoraireCompletEtudiant(
          Number(request.params.id)
        );

        response.status(200).json(horaireEtudiant);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * GET /api/etudiants
   * Récupérer tous les étudiants.
   */
  app.get("/api/etudiants", async (request, response) => {
    try {
      const etudiants = await recupererTousLesEtudiants();
      response.status(200).json(etudiants);
    } catch (error) {
      response.status(500).json({ message: "Erreur serveur." });
    }
  });

  /**
   * POST /api/etudiants/import
   * Importer des étudiants depuis un fichier Excel ou CSV.
   */
  app.post(
    "/api/etudiants/import",
    upload.single('fichier'),
    async (request, response) => {
      try {
        if (!request.file) {
          return response.status(400).json({
            message: "Import impossible.",
            erreurs: ["Aucun fichier fourni."]
          });
        }

        // Lire le fichier selon son type
        let donneesBrutes;
        try {
          if (request.file.originalname.endsWith('.csv')) {
            // Pour CSV, convertir en workbook
            const csvTexte = request.file.buffer.toString('utf-8');
            const lignes = csvTexte.split('\n').filter(ligne => ligne.trim());
            if (lignes.length < 2) {
              return response.status(400).json({
                message: "Import impossible.",
                erreurs: ["Fichier vide ou ne contient pas d'en-tête."]
              });
            }

            // Parser l'en-tête
            const enTete = lignes[0].split(',').map(col => col.trim().toLowerCase());
            const donnees = lignes.slice(1).map(ligne => {
              const valeurs = ligne.split(',');
              const objet = {};
              enTete.forEach((col, index) => {
                objet[col] = valeurs[index] ? valeurs[index].trim() : '';
              });
              return objet;
            });

            donneesBrutes = donnees;
          } else {
            // Pour Excel
            const workbook = xlsx.read(request.file.buffer, { type: 'buffer' });
            const feuille = workbook.Sheets[workbook.SheetNames[0]];
            donneesBrutes = xlsx.utils.sheet_to_json(feuille, { header: 1 });

            if (donneesBrutes.length < 2) {
              return response.status(400).json({
                message: "Import impossible.",
                erreurs: ["Fichier vide ou ne contient pas d'en-tête."]
              });
            }

            // Convertir en objets avec les noms de colonnes
            const enTete = donneesBrutes[0].map(col => col.toLowerCase().trim());
            const donnees = donneesBrutes.slice(1).map(ligne => {
              const objet = {};
              enTete.forEach((col, index) => {
                objet[col] = ligne[index] ? String(ligne[index]).trim() : '';
              });
              return objet;
            });

            donneesBrutes = donnees;
          }
        } catch (erreur) {
          return response.status(400).json({
            message: "Import impossible.",
            erreurs: ["Impossible de lire le fichier."]
          });
        }

        // Vérifier les colonnes obligatoires
        const colonnesAttendues = ['matricule', 'nom', 'prenom', 'groupe', 'programme', 'etape'];
        const premiereLigne = donneesBrutes[0];
        const colonnesPresentes = Object.keys(premiereLigne);

        const colonnesManquantes = colonnesAttendues.filter(col =>
          !colonnesPresentes.includes(col)
        );

        if (colonnesManquantes.length > 0) {
          return response.status(400).json({
            message: "Import impossible.",
            erreurs: [`Colonnes obligatoires manquantes: ${colonnesManquantes.join(', ')}`]
          });
        }

        // Convertir les données et valider
        const etudiantsAImporter = donneesBrutes.map(ligne => ({
          matricule: ligne.matricule,
          nom: ligne.nom,
          prenom: ligne.prenom,
          groupe: ligne.groupe,
          programme: ligne.programme,
          etape: parseInt(ligne.etape, 10)
        }));

        // Importer les étudiants
        const resultat = await importerEtudiants(etudiantsAImporter);

        if (resultat.succes) {
          response.status(200).json(resultat);
        } else {
          response.status(400).json(resultat);
        }

      } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        response.status(500).json({
          message: "Import impossible.",
          erreurs: ["Erreur serveur lors de l'import."]
        });
      }
    }
  );
}