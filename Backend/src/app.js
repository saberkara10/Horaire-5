/**
 * Configuration principale de l'application Express.
 */

import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";

import sallesRoutes from "../routes/salles.routes.js";
import coursRoutes from "../routes/cours.routes.js";
import "../auth.js";
import authRoutes from "../routes/auth.routes.js";
import professeursRoutes from "../routes/professeurs.routes.js";
import etudiantsRoutes from "../routes/etudiants.routes.js";
import affectationsRoutes from "../routes/affectations.routes.js";
import pool from "../db.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "gdh_secret_dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Route sante serveur
app.get("/api/health", (request, response) => {
  response.status(200).json({
    status: "OK",
    message: "Le serveur fonctionne correctement",
  });
});

// Route test
app.get("/api/test", (request, response) => {
  response.status(200).json({
    message: "La route de test fonctionne correctement",
  });
});

// Route groupes
app.get("/api/groupes", async (request, response) => {
  try {
    const [groupes] = await pool.query(
      "SELECT id_groupes_etudiants, nom_groupe FROM groupes_etudiants ORDER BY nom_groupe ASC"
    );
    response.status(200).json(groupes);
  } catch (error) {
    response.status(500).json({ message: "Erreur lors de la recuperation des groupes." });
  }
});

// Initialiser routes
coursRoutes(app);
app.use("/auth", authRoutes);
professeursRoutes(app);
sallesRoutes(app);
etudiantsRoutes(app);
affectationsRoutes(app);

export default app;
