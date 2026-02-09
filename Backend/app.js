/**
 * Point d'entrée du serveur backend (API).
 *
 * - Initialise Express, sessions, CORS
 * - Monte les routes (auth, modules métier)
 * - Protège les routes sensibles via authRequired + authorize
 */

import express from "express";
import session from "express-session";
import cors from "cors";
import "dotenv/config";
import authorize from "./Middlewares/authorize.js";
import authRoutes from "./routes/auth.routes.js";
import authRequired from "./Middlewares/auth.middlewares.js";

// Validation des variables d'environnement 

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET manquant dans .env");
}

const PORT = process.env.PORT || 3000;

//App 

const app = express();

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
      maxAge: 1000 * 60 * 60, // 1 heure
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

//  Routes 

app.use("/auth", authRoutes);

app.get("/protected", authRequired, (req, res) => {
  res.json({ message: `Bienvenue, ${req.session.user.prenom} !` });
});

app.get("/admin-only", authRequired, authorize(["ADMIN"]), (req, res) => {
  res.json({ message: "OK ADMIN", user: req.session.user });
});

app.get("/responsable-only", authRequired, authorize(["RESPONSABLE"]), (req, res) => {
  res.json({ message: "OK RESPONSABLE", user: req.session.user });
});

// Démarrage du serveur

app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
