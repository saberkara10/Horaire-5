/**
 * Configuration principale de l'application Express.
 */

import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import coursRoutes from "../routes/cours.routes.js";
import professeursRoutes from "../routes/professeurs.routes.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

coursRoutes(app);
professeursRoutes(app);

app.use((request, response) => {
  response.status(404).json({
    message: `Route introuvable: ${request.method} ${request.originalUrl}`,
  });
});

export default app;
