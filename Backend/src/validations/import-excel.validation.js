/**
 * Middleware generique de televersement pour les imports Excel/CSV.
 */

import multer from "multer";
import {
  EXTENSIONS_IMPORT_EXCEL,
  extensionImportExcelValide,
} from "../services/import-excel.shared.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024,
  },
});

function reponseErreur(response, message, erreurs = []) {
  return response.status(400).json({
    message,
    ...(erreurs.length > 0 ? { erreurs } : {}),
  });
}

export function televerserFichierImportExcel(request, response, next) {
  upload.any()(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return reponseErreur(response, "Fichier trop volumineux.", [
          "La taille maximale autorisee pour le fichier d'import est de 5 Mo.",
        ]);
      }

      return reponseErreur(response, "Fichier invalide.", [
        "Le televersement du fichier a echoue avant le debut de l'import.",
      ]);
    }

    if (error) {
      return reponseErreur(response, "Impossible de lire le fichier.", [
        "Le serveur n'a pas reussi a recevoir correctement le fichier envoye.",
      ]);
    }

    if (!request.files || request.files.length === 0) {
      return reponseErreur(response, "Aucun fichier fourni.", [
        `Veuillez selectionner un fichier ${EXTENSIONS_IMPORT_EXCEL.join(", ")} avant de lancer l'import.`,
      ]);
    }

    request.file = request.files[0];

    if (!extensionImportExcelValide(request.file.originalname)) {
      return reponseErreur(response, "Format de fichier non supporte.", [
        "Le fichier doit etre au format .xlsx, .xls ou .csv.",
      ]);
    }

    return next();
  });
}
