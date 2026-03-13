/**
 * Point d'entrée du serveur backend (API).
 *
 * Initialise Express, sessions, parsing JSON, CORS, sécurité.
 * Monte les routes (auth, salles, modules métier).
 * Protège les routes sensibles via les middlewares d'authentification
 * et d'autorisation.
 */

import express, { json } from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import passport from "passport";
import "dotenv/config";
import "./auth.js";
import { userAuth, userAdmin, userResponsable } from "./middlewares/auth.js";
import authRoutes from "./routes/auth.routes.js";
import sallesRoutes from "./routes/salles.routes.js";
import coursRoutes from "./routes/cours.routes.js";
import professeursRoutes from "./routes/professeurs.routes.js";



// Validation des variables d'environnement
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET manquant dans .env");
}

const PORT = process.env.PORT || 3000;

// Création du serveur
const app = express();

// Ajout des middlewares
app.use(helmet());
app.use(compression());
app.use(json());
app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true
}));
app.use(session({
    name: "sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    }
}));
app.use(passport.initialize());
app.use(passport.session());


// Programmation des routes
authRoutes(app);
sallesRoutes(app);
coursRoutes(app);
professeursRoutes(app);


// Route réservée aux administrateurs
app.get("/admin-only", userAuth, userAdmin, (request, response) => {
    response.status(200).json({ message: "OK ADMIN", user: request.user });
});

// Route réservée aux responsables
app.get("/responsable-only", userAuth, userResponsable, (request, response) => {
    response.status(200).json({ message: "OK RESPONSABLE", user: request.user });
});

export default app;
