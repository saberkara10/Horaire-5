/**
 * ROUTES - Module Admins
 *
 * Ce module definit les routes HTTP liees
 * a la gestion des sous-admins.
 */
import {
  userAuth,
  userResponsable,
} from "../middlewares/auth.js";
import {
  creerSousAdmin,
  mettreAJourSousAdmin,
  recupererSousAdmins,
  supprimerSousAdmin,
} from "../src/model/utilisateur.js";

function normaliserTexte(value) {
  return String(value || "").trim();
}

function emailValide(email) {
  return normaliserTexte(email).length > 0;
}

function validerSousAdmin(body, options = {}) {
  const nom = normaliserTexte(body.nom);
  const prenom = normaliserTexte(body.prenom);
  const email = normaliserTexte(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!nom) {
    return { message: "Nom invalide." };
  }

  if (!prenom) {
    return { message: "Prenom invalide." };
  }

  if (!emailValide(email)) {
    return { message: "Courriel invalide." };
  }

  if (!options.passwordOptionnel && password.length < 6) {
    return { message: "Mot de passe invalide." };
  }

  if (options.passwordOptionnel && password && password.length < 6) {
    return { message: "Mot de passe invalide." };
  }

  return {
    donnees: {
      nom,
      prenom,
      email,
      ...(password ? { password } : {}),
    },
  };
}

function estConflitUnicite(error) {
  return error?.code === "ER_DUP_ENTRY";
}

export default function adminsRoutes(app) {
  const accesGestionAdmins = [userAuth, userResponsable];

  app.get("/api/admins", ...accesGestionAdmins, async (request, response) => {
    try {
      const admins = await recupererSousAdmins();
      response.status(200).json(admins);
    } catch {
      response
        .status(500)
        .json({ message: "Erreur lors de la recuperation des admins." });
    }
  });

  app.post("/api/admins", ...accesGestionAdmins, async (request, response) => {
    const validation = validerSousAdmin(request.body);

    if (!validation.donnees) {
      return response.status(400).json({ message: validation.message });
    }

    try {
      const admin = await creerSousAdmin(validation.donnees);
      return response.status(201).json(admin);
    } catch (error) {
      if (estConflitUnicite(error)) {
        return response.status(409).json({ message: "Ce courriel est deja utilise." });
      }

      return response
        .status(500)
        .json({ message: error.message || "Erreur lors de la creation de l'admin." });
    }
  });

  app.put("/api/admins/:id", ...accesGestionAdmins, async (request, response) => {
    const idAdmin = Number(request.params.id);

    if (!Number.isInteger(idAdmin) || idAdmin <= 0) {
      return response.status(400).json({ message: "Identifiant invalide." });
    }

    const validation = validerSousAdmin(request.body, { passwordOptionnel: true });

    if (!validation.donnees) {
      return response.status(400).json({ message: validation.message });
    }

    try {
      const admin = await mettreAJourSousAdmin(idAdmin, validation.donnees);

      if (!admin) {
        return response.status(404).json({ message: "Admin introuvable." });
      }

      return response.status(200).json(admin);
    } catch (error) {
      if (estConflitUnicite(error)) {
        return response.status(409).json({ message: "Ce courriel est deja utilise." });
      }

      return response
        .status(500)
        .json({ message: error.message || "Erreur lors de la mise a jour de l'admin." });
    }
  });

  app.delete("/api/admins/:id", ...accesGestionAdmins, async (request, response) => {
    const idAdmin = Number(request.params.id);

    if (!Number.isInteger(idAdmin) || idAdmin <= 0) {
      return response.status(400).json({ message: "Identifiant invalide." });
    }

    try {
      const supprime = await supprimerSousAdmin(idAdmin);

      if (!supprime) {
        return response.status(404).json({ message: "Admin introuvable." });
      }

      return response.status(200).json({ message: "Admin supprime." });
    } catch {
      return response
        .status(500)
        .json({ message: "Erreur lors de la suppression de l'admin." });
    }
  });
}
