/**
 * Configuration principale de l'application Express.
 */

import express from "express";
import dotenv from "dotenv";
import sallesRoutes from "../routes/salles.routes.js";
import coursRoutes from "../routes/cours.routes.js";
import "../auth.js"
import authRoutes from "../routes/auth.routes.js";
import professeursRoutes from "../routes/professeurs.routes.js";
import etudiantsRoutes from "../routes/etudiants.routes.js";

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
professeursRoutes(app);
etudiantsRoutes(app);
sallesRoutes(app);

export default app;
