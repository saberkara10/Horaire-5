/**
 * ROUTES - Module Etudiants
 *
 * Ce module expose les routes de consultation et d'import des etudiants.
 * La logique d'import reste separee de la logique de consultation d'horaire.
 * Les erreurs metier d'import sont renvoyees avec un message principal et,
 * si necessaire, une liste detaillee exploitable par le frontend.
 */

import {
  recupererTousLesEtudiants,
  recupererEtudiantParId,
  recupererHoraireCompletEtudiant,
} from "../src/model/etudiants.model.js";
import {
  ImportEtudiantsError,
  importerEtudiantsDepuisFichier,
} from "../src/services/import-etudiants.service.js";
import {
  validerIdEtudiant,
  verifierEtudiantExiste,
} from "../src/validations/etudiants.validations.js";
import { televerserFichierImportEtudiants } from "../src/validations/import-etudiants.validation.js";

/**
 * Initialiser les routes des etudiants.
 *
 * @param {import("express").Express} app Application Express.
 */
export default function etudiantsRoutes(app) {
  /**
   * GET /api/etudiants
   * Recuperer la liste des etudiants importes.
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
   * Importer un fichier Excel ou CSV d'etudiants.
   */
  app.post(
    "/api/etudiants/import",
    televerserFichierImportEtudiants,
    async (request, response) => {
      try {
        const resultatImport = await importerEtudiantsDepuisFichier(request.file);
        response.status(201).json(resultatImport);
      } catch (error) {
        if (error instanceof ImportEtudiantsError) {
          // Les erreurs d'import sont attendues et deja normalisees par le
          // service. On preserve donc leur niveau de detail pour l'interface.
          return response.status(error.status).json({
            message: error.message,
            ...(error.erreurs.length > 0 ? { erreurs: error.erreurs } : {}),
          });
        }

        return response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * GET /api/etudiants/:id
   * Recuperer la fiche detaillee d'un etudiant.
   */
  app.get(
    "/api/etudiants/:id",
    validerIdEtudiant,
    verifierEtudiantExiste,
    async (request, response) => {
      try {
        const etudiant = await recupererEtudiantParId(Number(request.params.id));
        response.status(200).json(etudiant);
      } catch (error) {
        response.status(500).json({ message: "Erreur serveur." });
      }
    }
  );

  /**
   * GET /api/etudiants/:id/horaire
   * Recuperer les informations d'un etudiant avec son horaire.
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
}
