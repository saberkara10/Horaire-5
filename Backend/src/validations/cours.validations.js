/**
 * Middlewares de validation pour les opérations CRUD sur les cours.
 *
 * Ce module applique toutes les règles de validation sur les données de cours
 * avant qu'elles n'atteignent les handlers de routes. Il garantit :
 *  - La présence et le format des champs obligatoires
 *  - Le respect des contraintes métier (unicité du code, existence des entités référencées)
 *  - L'intégrité référentielle (salle de référence existante)
 *  - La protection contre la modification de champs sensibles (archive)
 *
 * Règles notables :
 *  - etape_etude doit être un entier entre 1 et 8 (niveaux académiques)
 *  - Un nom composé uniquement de chiffres est rejeté (ex: "123" est invalide)
 *  - La salle de référence doit exister en BDD avant la création
 *
 * @module src/validations/cours.validations
 */

import {
  recupererCoursParId,
  recupererCoursParCode,
  coursEstDejaAffecte,
  salleExisteParId,
} from "../model/cours.model.js";

/**
 * Envoie une réponse d'erreur HTTP et termine le pipeline middleware.
 *
 * @param {import("express").Response} response
 * @param {number} status - Code HTTP (400, 404, 409...)
 * @param {string} message - Message d'erreur lisible
 */
function envoyerErreur(response, status, message) {
  response.status(status).json({ message });
}

/**
 * Middleware — Valide que le paramètre URL :id est un entier positif.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export function validerIdCours(request, response, next) {
  const id = Number(request.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return envoyerErreur(response, 400, "Identifiant invalide.");
  }

  next();
}

/**
 * Middleware — Charge le cours depuis la BDD et l'attache à request.cours.
 *
 * Doit être utilisé APRÈS validerIdCours.
 * Retourne 404 si le cours n'existe pas, évitant un crash dans le handler.
 *
 * @param {import("express").Request} request - request.cours sera défini si le cours existe
 * @param {import("express").Response} response
 * @param {Function} next
 */
export async function verifierCoursExiste(request, response, next) {
  const idCours = Number(request.params.id);
  const cours = await recupererCoursParId(idCours);

  if (!cours) {
    return envoyerErreur(response, 404, "Cours introuvable.");
  }

  // Attacher le cours pour éviter un second appel BDD dans le handler
  request.cours = cours;
  next();
}

/**
 * Middleware — Valide toutes les données pour la création d'un cours.
 *
 * Validations effectuées :
 *  1. code     : obligatoire, non vide
 *  2. nom      : obligatoire, non vide, ne doit pas être purement numérique
 *  3. programme : obligatoire, non vide
 *  4. id_salle_reference : entier positif + vérification que la salle existe
 *  5. duree    : entier strictement positif (en heures)
 *  6. etape_etude : entier entre 1 et 8 inclus
 *  7. code     : unicité vérifiée en BDD
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export async function validerCreateCours(request, response, next) {
  const { code, nom, duree, programme, etape_etude, id_salle_reference } =
    request.body;

  if (!code || String(code).trim() === "") {
    return envoyerErreur(response, 400, "Code obligatoire.");
  }

  // Rejet des noms purement numériques (ex: "123") qui ne sont pas des noms de cours valides
  if (!nom || String(nom).trim() === "" || /^\d+$/.test(String(nom).trim())) {
    return envoyerErreur(response, 400, "Nom invalide.");
  }

  if (!programme || String(programme).trim() === "") {
    return envoyerErreur(response, 400, "Programme obligatoire.");
  }

  if (!Number.isInteger(Number(id_salle_reference)) || Number(id_salle_reference) <= 0) {
    return envoyerErreur(response, 400, "Salle de reference obligatoire.");
  }

  const dureeInt = Number(duree);
  if (!Number.isInteger(dureeInt) || dureeInt <= 0) {
    return envoyerErreur(response, 400, "Duree invalide (> 0).");
  }

  // etape_etude : 1 = L1, 2 = L2, ..., 8 = Master 2 (structure académique standard)
  const etapeInt = Number(etape_etude);
  if (!Number.isInteger(etapeInt) || etapeInt < 1 || etapeInt > 8) {
    return envoyerErreur(response, 400, "Etape invalide (1 a 8).");
  }

  // Vérifier l'unicité du code avant insertion (plus clair qu'une erreur MySQL ER_DUP_ENTRY)
  const dejaExiste = await recupererCoursParCode(String(code).trim());
  if (dejaExiste) {
    return envoyerErreur(response, 409, "Code deja utilise.");
  }

  // Vérifier que la salle de référence existe réellement en BDD
  const salleExiste = await salleExisteParId(Number(id_salle_reference));
  if (!salleExiste) {
    return envoyerErreur(response, 400, "Salle de reference inexistante.");
  }

  next();
}

/**
 * Middleware — Valide les données pour la modification d'un cours (PATCH-like).
 *
 * Tous les champs sont optionnels. Chaque champ fourni est validé individuellement.
 * Le champ `archive` est explicitement interdit : l'archivage suit un workflow séparé.
 *
 * En cas de modification du code, vérifie l'unicité en excluant le cours courant.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export async function validerUpdateCours(request, response, next) {
  const { code, nom, duree, programme, etape_etude, id_salle_reference, archive } =
    request.body;

  // L'archivage ne passe pas par cet endpoint — endpoint séparé pour traçabilité
  if (archive !== undefined) {
    return envoyerErreur(response, 400, "Champ archive non autorise.");
  }

  // Refuser si aucun champ modifiable n'est fourni
  if (
    code === undefined &&
    nom === undefined &&
    duree === undefined &&
    programme === undefined &&
    etape_etude === undefined &&
    id_salle_reference === undefined
  ) {
    return envoyerErreur(response, 400, "Aucun champ a modifier.");
  }

  if (code !== undefined) {
    if (!code || String(code).trim() === "") {
      return envoyerErreur(response, 400, "Code invalide.");
    }

    const idCours = Number(request.params.id);
    const dejaExiste = await recupererCoursParCode(String(code).trim());

    // Autoriser si c'est le même cours qui garde son code actuel
    if (dejaExiste && dejaExiste.id_cours !== idCours) {
      return envoyerErreur(response, 409, "Code deja utilise.");
    }
  }

  if (nom !== undefined) {
    if (!nom || String(nom).trim() === "" || /^\d+$/.test(String(nom).trim())) {
      return envoyerErreur(response, 400, "Nom invalide.");
    }
  }

  if (duree !== undefined) {
    const dureeInt = Number(duree);
    if (!Number.isInteger(dureeInt) || dureeInt <= 0) {
      return envoyerErreur(response, 400, "Duree invalide (> 0).");
    }
  }

  if (programme !== undefined && String(programme).trim() === "") {
    return envoyerErreur(response, 400, "Programme invalide.");
  }

  if (etape_etude !== undefined) {
    const etapeInt = Number(etape_etude);
    if (!Number.isInteger(etapeInt) || etapeInt < 1 || etapeInt > 8) {
      return envoyerErreur(response, 400, "Etape invalide (1 a 8).");
    }
  }

  if (id_salle_reference !== undefined) {
    if (!Number.isInteger(Number(id_salle_reference)) || Number(id_salle_reference) <= 0) {
      return envoyerErreur(response, 400, "Salle de reference invalide.");
    }

    const salleExiste = await salleExisteParId(Number(id_salle_reference));
    if (!salleExiste) {
      return envoyerErreur(response, 400, "Salle de reference inexistante.");
    }
  }

  next();
}

/**
 * Middleware — Vérifie que le cours peut être supprimé sans rompre l'intégrité.
 *
 * Un cours affecté à des groupes ou des séances planifiées ne peut pas être supprimé.
 * Cette vérification proactive évite une erreur MySQL ER_ROW_IS_REFERENCED_2 opaque.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export async function validerDeleteCours(request, response, next) {
  const idCours = Number(request.params.id);
  const estAffecte = await coursEstDejaAffecte(idCours);

  if (estAffecte) {
    return envoyerErreur(
      response,
      400,
      "Suppression impossible : cours deja affecte."
    );
  }

  next();
}
