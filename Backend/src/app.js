/**
 * Configuration principale de l'application Express.
 *
 * Initialise Express, securite, sessions, Passport et les routes metier.
 */

import express from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import passport from "passport";
import dotenv from "dotenv";

import "../auth.js";
import { userAuth, userAdmin, userResponsable } from "../middlewares/auth.js";
import authRoutes from "../routes/auth.routes.js";
import sallesRoutes from "../routes/salles.routes.js";
import coursRoutes from "../routes/cours.routes.js";
import horaireRoutes from "../routes/horaire.routes.js";
import professeursRoutes from "../routes/professeurs.routes.js";
import etudiantsRoutes from "../routes/etudiants.routes.js";
import groupesRoutes from "../routes/groupes.routes.js";
import adminsRoutes from "../routes/admins.routes.js";
import pool from "../db.js";

dotenv.config();

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET manquant dans .env");
}

const app = express();

app.use(helmet());
app.use(compression());
app.use(express.json());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use(
  session({
    name: "sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/api/health", (request, response) => {
  response.status(200).json({
    status: "OK",
    message: "Le serveur fonctionne correctement",
  });
});

app.get("/api/test", (request, response) => {
  response.status(200).json({
    message: "La route de test fonctionne correctement",
  });
});

app.get("/api/programmes", async (request, response) => {
  try {
    const [programmes] = await pool.query(
      `SELECT DISTINCT programme
       FROM (
         SELECT nom_programme AS programme
         FROM programmes_reference
         WHERE nom_programme IS NOT NULL AND TRIM(nom_programme) <> ''
         UNION
         SELECT programme
         FROM cours
         WHERE programme IS NOT NULL AND TRIM(programme) <> ''
         UNION
         SELECT programme
         FROM etudiants
         WHERE programme IS NOT NULL AND TRIM(programme) <> ''
         UNION
         SELECT specialite AS programme
         FROM professeurs
         WHERE specialite IS NOT NULL AND TRIM(specialite) <> ''
       ) AS programmes_uniques
       ORDER BY programme ASC`
    );

    const programmesDisponibles = programmes
      .map((programme) => String(programme.programme || "").trim())
      .filter(Boolean)
      .sort((programmeA, programmeB) => programmeA.localeCompare(programmeB, "fr"));

    response.status(200).json(programmesDisponibles);
  } catch (error) {
    response
      .status(500)
      .json({ message: "Erreur lors de la recuperation des programmes." });
  }
});

authRoutes(app);
sallesRoutes(app);
coursRoutes(app);
professeursRoutes(app);
horaireRoutes(app);
etudiantsRoutes(app);
groupesRoutes(app);
adminsRoutes(app);

app.get("/admin-only", userAuth, userAdmin, (request, response) => {
  response.status(200).json({
    message: "OK ADMIN",
    user: request.user,
  });
});

app.get("/responsable-only", userAuth, userResponsable, (request, response) => {
  response.status(200).json({
    message: "OK RESPONSABLE",
    user: request.user,
  });
});

export default app;
