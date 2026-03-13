/**
 * Configuration principale de l'application Express.
 */

import express from "express";
import dotenv from "dotenv";
import sallesRoutes from "../routes/salles.routes.js";
import coursRoutes from "../routes/cours.routes.js";
import "../auth.js"
import {userAuth, userAdmin, userResponsable} from "../middlewares/auth.js"
import authRoutes from "../routes/auth.routes.js";
import professeursRoutes from "../routes/professeurs.routes.js";

dotenv.config();

const app = express();

app.use(express.json());

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

// Initialiser routes cours
coursRoutes(app);
authRoutes(app);

// initialiser routes professeurs
professeursRoutes(app);

//initialiser routes salles
sallesRoutes(app);

export default app;