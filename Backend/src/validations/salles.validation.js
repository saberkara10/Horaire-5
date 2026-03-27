import {
  getSalleByCode,
  getSalleById,
  salleEstDejaAffectee,
} from "../model/salle.js";

function envoyerErreur(response, status, message) {
  response.status(status).json({ message });
}

export function codeSalleIsValide(request, response, next) {
  const code = String(request.body?.code || "").trim();

  if (!code) {
    return envoyerErreur(response, 400, "Code de salle invalide.");
  }

  next();
}

export function typeSalleIsValide(request, response, next) {
  const type = String(request.body?.type || "").trim();

  if (!type) {
    return envoyerErreur(response, 400, "Type de salle invalide.");
  }

  next();
}

export function capaciteSalleIsValide(request, response, next) {
  const capacite = Number(request.body?.capacite);

  if (!Number.isInteger(capacite) || capacite <= 0) {
    return envoyerErreur(response, 400, "Capacite de salle invalide.");
  }

  next();
}

export function validerIdSalle(request, response, next) {
  const idSalle = Number(request.params.id);

  if (!Number.isInteger(idSalle) || idSalle <= 0) {
    return envoyerErreur(response, 400, "Identifiant invalide.");
  }

  next();
}

export async function verifierSalleExiste(request, response, next) {
  const idSalle = Number(request.params.id);
  const salle = await getSalleById(idSalle);

  if (!salle) {
    return envoyerErreur(response, 404, "Salle introuvable.");
  }

  request.salle = salle;
  next();
}

export async function validerCreateSalle(request, response, next) {
  const code = String(request.body?.code || "").trim();
  const type = String(request.body?.type || "").trim();
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

  const salleExistante = await getSalleByCode(code);
  if (salleExistante) {
    return envoyerErreur(response, 409, "Code deja utilise.");
  }

  next();
}

export async function validerUpdateSalle(request, response, next) {
  const { type, capacite } = request.body || {};

  if (type === undefined && capacite === undefined) {
    return envoyerErreur(response, 400, "Aucun champ a modifier.");
  }

  if (type !== undefined && !String(type).trim()) {
    return envoyerErreur(response, 400, "Type invalide.");
  }

  if (capacite !== undefined) {
    const capaciteNumerique = Number(capacite);

    if (!Number.isInteger(capaciteNumerique) || capaciteNumerique <= 0) {
      return envoyerErreur(response, 400, "Capacite invalide (> 0).");
    }
  }

  next();
}

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
