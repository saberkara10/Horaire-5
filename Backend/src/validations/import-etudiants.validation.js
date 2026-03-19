/**
 * Middlewares de validation pour l'import des etudiants.
 *
 * Cette couche filtre les erreurs de televersement avant d'atteindre le
 * service metier : absence de fichier, taille excessive ou extension invalide.
 */

import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024,
  },
});

function extensionFichierValide(nomFichier) {
  const nom = String(nomFichier ?? "").toLowerCase();
  return nom.endsWith(".xlsx") || nom.endsWith(".csv");
}

function reponseErreur(response, message, erreurs = []) {
  return response.status(400).json({
    message,
    ...(erreurs.length > 0 ? { erreurs } : {}),
  });
}

/**
 * Middleware Express de reception du fichier d'import.
 *
 * Le backend utilise `multer` en memoire car le fichier est traite
 * immediatement puis jete. Aucun stockage temporaire sur disque n'est requis.
 */
export function televerserFichierImportEtudiants(request, response, next) {
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
        "Veuillez selectionner un fichier .xlsx ou .csv avant de lancer l'import.",
      ]);
    }

    request.file = request.files[0];

    if (!extensionFichierValide(request.file.originalname)) {
      return reponseErreur(response, "Format de fichier non supporte.", [
        "Le fichier doit etre au format .xlsx ou .csv.",
      ]);
    }

    return next();
  });
}
