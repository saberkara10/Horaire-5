import express from "express";
import "dotenv/config";


const app = express();
app.use(express.json());

// Route de vérification du serveur
app.get("/api/health", (request, response) => {
  response.status(200).json({
    status: "OK",
    message: "Le serveur fonctionne correctement"
  });
});

// Route de test API
app.get("/api/test", (request, response) => {
  response.status(200).json({
    message: "La route de test fonctionne correctement"
  });
});


// route racine 
app.get("/", (request, response) => {
  response.send ("bienvenue sur L'api de Gestion horaire-5")
});
export default app;