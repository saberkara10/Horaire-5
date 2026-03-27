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
import pool from "../db.js";
import { PROGRAMMES_REFERENCE } from "./utils/programmes.js";

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

app.get("/api/groupes", async (request, response) => {
  try {
    const detailsDemandes = request.query.details === "1";
    const [groupes] = detailsDemandes
      ? await pool.query(
          `SELECT ge.id_groupes_etudiants,
                  ge.nom_groupe,
                  e.programme,
                  e.etape,
                  COUNT(e.id_etudiant) AS effectif
           FROM groupes_etudiants ge
           LEFT JOIN etudiants e
             ON e.id_groupes_etudiants = ge.id_groupes_etudiants
           GROUP BY ge.id_groupes_etudiants, ge.nom_groupe, e.programme, e.etape
           ORDER BY ge.nom_groupe ASC`
        )
      : await pool.query(
          "SELECT id_groupes_etudiants, nom_groupe FROM groupes_etudiants ORDER BY nom_groupe ASC"
        );

    response.status(200).json(groupes);
  } catch (error) {
    response
      .status(500)
      .json({ message: "Erreur lors de la recuperation des groupes." });
  }
});

app.get("/api/programmes", async (request, response) => {
  try {
    const [programmes] = await pool.query(
      `SELECT DISTINCT programme
       FROM (
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

    const programmesDisponibles = [
      ...new Set([
        ...PROGRAMMES_REFERENCE,
        ...programmes
          .map((programme) => String(programme.programme || "").trim())
          .filter(Boolean),
      ]),
    ].sort((programmeA, programmeB) => programmeA.localeCompare(programmeB, "fr"));

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
