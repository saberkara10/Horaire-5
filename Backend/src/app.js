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

// Route santé serveur
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

// Initialiser routes
coursRoutes(app);
authRoutes(app);
professeursRoutes(app);
sallesRoutes(app);
etudiantsRoutes(app);

export default app;