/**
 * Configuration principale de l'application Express.
 */

import express from "express";
import dotenv from "dotenv";

import coursRoutes from "../routes/cours.routes.js";
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

// initialiser routes professeurs
professeursRoutes(app);

export default app;
