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
import affectationsRoutes from "../routes/affectations.routes.js";
import pool from "../db.js";

dotenv.config();

const SESSION_SECRET = process.env.SESSION_SECRET || "gdh_secret_dev";

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

app.use("/auth", authRoutes);
sallesRoutes(app);
coursRoutes(app);
professeursRoutes(app);
horaireRoutes(app);
etudiantsRoutes(app);
affectationsRoutes(app);

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
