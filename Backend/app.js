/**
 * Configuration principale de l'application Express.
 *
 * Initialise Express, sécurité, sessions, Passport et les routes métier.
 */

import express from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import passport from "passport";
import dotenv from "dotenv";

import "./auth.js";
import { userAuth, userAdmin, userResponsable } from "./middlewares/auth.js";
import authRoutes from "./routes/auth.routes.js";
import sallesRoutes from "./routes/salles.routes.js";
// import coursRoutes from "./routes/cours.routes.js";
// import professeursRoutes from "./routes/professeurs.routes.js";

dotenv.config();

// Validation des variables d'environnement
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET manquant dans .env");
}

// Création de l'application
const app = express();

// Middlewares globaux
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

// Routes utilitaires
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

// Routes métier
authRoutes(app);
sallesRoutes(app);
coursRoutes(app);
professeursRoutes(app);

// Routes protégées
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