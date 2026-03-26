/**
 * Routes d'authentification de l'application.
 */

import { Router } from "express";
import bcrypt from "bcrypt";
import {
  findByEmail,
  findRolesByUserId,
} from "../src/model/utilisateur.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email et mot de passe requis" });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const user = await findByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const passwordOk = await bcrypt.compare(password, user.mot_de_passe_hash);

    if (!passwordOk) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const roles = await findRolesByUserId(user.id);

    req.session.user = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      roles,
    };

    return res.json({
      message: "Connexion reussie",
      user: req.session.user,
    });
  } catch (error) {
    console.error("Erreur login :", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/logout", (req, res) => {
  if (!req.session) {
    return res.json({ message: "Aucune session active" });
  }

  req.session.destroy(() => {
    res.clearCookie("sid");
    res.json({ message: "Deconnexion reussie" });
  });
});

router.get("/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Authentification requise" });
  }

  return res.json(req.session.user);
});

export default router;
