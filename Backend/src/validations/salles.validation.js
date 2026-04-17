/**
 * Middlewares de validation pour les opérations CRUD sur les salles.
 *
 * Ce module centralise toutes les validations appliquées aux données de salles
 * avant qu'elles n'atteignent les handlers des routes. Chaque middleware :
 *  1. Valide la cohérence des données entrantes (format, présence, logique)
 *  2. Peut enrichir request.body (ex: normaliser le type)
 *  3. Peut enrichir request.salle (objet salle chargé depuis la BDD)
 *  4. Appelle next() si tout est valide, ou renvoie une erreur HTTP sinon
 *
 * Normalisation du type de salle :
 * Le type est normalisé pour éviter les doublons logiques ("laboratoire" vs "Laboratoire").
 * La forme canonique : première lettre majuscule, reste en minuscules, espaces supprimés.
 *
 * @module src/validations/salles.validation
 */
import {
  getSalleByCode,
  getSalleById,
  salleEstDejaAffectee,
} from "../model/salle.js";

/**
 * Envoie une réponse d'erreur HTTP avec le statut et message donnés.
 *
 * @param {import("express").Response} response - L'objet réponse Express
 * @param {number} status - Le code statut HTTP (400, 404, 409...)
 * @param {string} message - Le message d'erreur à retourner
 */
function envoyerErreur(response, status, message) {
  response.status(status).json({ message });
}

/**
 * Normalise un type de salle : supprime les espaces et met la première lettre en majuscule.
 *
 * Exemples :
 *  - "laboratoire"   → "Laboratoire"
 *  - "LABORATOIRE"   → "Laboratoire"  (seule la 1ère lettre est en majuscule)
 *  - " salle de cours " → "Salle de cours"
 *  - ""              → ""
 *
 * @param {string} valeur - La valeur brute du type saisie dans le formulaire
 * @returns {string} Le type normalisé
 */
function normaliserType(valeur) {
  const trimmed = String(valeur || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Middleware — Valide que le code de salle est présent dans le body.
 *
 * Utilisé pour les routes qui nécessitent un code de salle dans le body.
 * (Distinct de validerIdSalle qui valide le paramètre URL :id)
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export function codeSalleIsValide(request, response, next) {
  const code = String(request.body?.code || "").trim();

  if (!code) {
    return envoyerErreur(response, 400, "Code de salle invalide.");
  }

  next();
}

/**
 * Middleware — Valide que le type de salle est présent et non vide dans le body.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export function typeSalleIsValide(request, response, next) {
  const type = String(request.body?.type || "").trim();

  if (!type) {
    return envoyerErreur(response, 400, "Type de salle invalide.");
  }

  next();
}

/**
 * Middleware — Valide que la capacité est un entier strictement positif.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export function capaciteSalleIsValide(request, response, next) {
  const capacite = Number(request.body?.capacite);

  if (!Number.isInteger(capacite) || capacite <= 0) {
    return envoyerErreur(response, 400, "Capacite de salle invalide.");
  }

  next();
}

/**
 * Middleware — Valide que le paramètre URL :id est un entier positif valide.
 *
 * Toutes les routes /api/salles/:id utilisent ce middleware en premier
 * pour écarter les requêtes avec un ID malformé avant toute requête BDD.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export function validerIdSalle(request, response, next) {
  const idSalle = Number(request.params.id);

  if (!Number.isInteger(idSalle) || idSalle <= 0) {
    return envoyerErreur(response, 400, "Identifiant invalide.");
  }

  next();
}

/**
 * Middleware — Vérifie que la salle identifiée par :id existe en base.
 *
 * Si la salle existe, elle est attachée à request.salle pour être réutilisée
 * par les middlewares et handlers suivants sans refaire de requête BDD.
 * Si la salle n'existe pas, retourne 404 immédiatement.
 *
 * Doit être utilisé APRÈS validerIdSalle.
 *
 * @param {import("express").Request} request - request.salle est défini si la salle existe
 * @param {import("express").Response} response
 * @param {Function} next
 */
export async function verifierSalleExiste(request, response, next) {
  const idSalle = Number(request.params.id);
  const salle = await getSalleById(idSalle);

  if (!salle) {
    return envoyerErreur(response, 404, "Salle introuvable.");
  }

  // Attacher la salle à la requête pour éviter un second appel BDD dans le handler
  request.salle = salle;
  next();
}

/**
 * Middleware — Valide et normalise les données pour la création d'une salle.
 *
 * Validations effectuées :
 *  1. Code présent et non vide
 *  2. Type présent et non vide
 *  3. Capacité entière et strictement positive
 *  4. Code non déjà utilisé par une autre salle (unicité)
 *
 * Si tout est valide, normalise request.body.type avant de passer au handler.
 * La normalization est faite ici pour que le handler reçoive directement
 * la forme canonique sans avoir à la recalculer.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export async function validerCreateSalle(request, response, next) {
  const code = String(request.body?.code || "").trim();
  const type = normaliserType(request.body?.type);
  const capacite = Number(request.body?.capacite);

  if (!code) {
    return envoyerErreur(response, 400, "Code obligatoire.");
  }

  if (!type) {
    return envoyerErreur(response, 400, "Type obligatoire.");
  }

  if (!Number.isInteger(capacite) || capacite <= 0) {
    return envoyerErreur(response, 400, "Capacite invalide (> 0).");
  }

  // Vérifier l'unicité du code → éviter un ER_DUP_ENTRY plus tard
  const salleExistante = await getSalleByCode(code);
  if (salleExistante) {
    return envoyerErreur(response, 409, "Code deja utilise.");
  }

  // Injecter le type normalisé dans le body pour que le handler l'utilise directement
  request.body.type = type;

  next();
}

/**
 * Middleware — Valide les données pour la modification d'une salle.
 *
 * Ce middleware accepte une mise à jour partielle (PATCH-like) :
 *  - Si type est absent du body → on ne le valide pas (il sera conservé)
 *  - Si capacite est absente → conservée également
 *  - Si les deux sont absents → erreur 400 (rien à modifier)
 *
 * Le type est normalisé si fourni, pour garantir la cohérence en BDD.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export async function validerUpdateSalle(request, response, next) {
  const { type, capacite } = request.body || {};

  // On refuse si le client envoie un body complètement vide
  if (type === undefined && capacite === undefined) {
    return envoyerErreur(response, 400, "Aucun champ a modifier.");
  }

  if (type !== undefined) {
    const typeNormalise = normaliserType(type);
    if (!typeNormalise) {
      return envoyerErreur(response, 400, "Type invalide.");
    }
    // Injecter le type normalisé pour que le handler l'utilise sans retraitement
    request.body.type = typeNormalise;
  }

  if (capacite !== undefined) {
    const capaciteNumerique = Number(capacite);

    if (!Number.isInteger(capaciteNumerique) || capaciteNumerique <= 0) {
      return envoyerErreur(response, 400, "Capacite invalide (> 0).");
    }
  }

  next();
}

/**
 * Middleware — Vérifie qu'une salle peut être supprimée.
 *
 * Refuse la suppression si la salle est déjà affectée à un cours planifié.
 * Cette vérification est plus précise que l'erreur MySQL ER_ROW_IS_REFERENCED_2 :
 * elle retourne un message d'erreur clair avant même d'essayer la suppression.
 *
 * Doit être utilisé APRÈS verifierSalleExiste (la salle doit exister).
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {Function} next
 */
export async function validerDeleteSalle(request, response, next) {
  const idSalle = Number(request.params.id);
  const estAffectee = await salleEstDejaAffectee(idSalle);

  if (estAffectee) {
    return envoyerErreur(
      response,
      400,
      "Suppression impossible : salle deja affectee."
    );
  }

  next();
}
