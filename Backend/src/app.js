const express = require("express");
require("dotenv").config();

const app = express();
app.use(express.json());

// Route de vérification du serveur
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Le serveur fonctionne correctement"
  });
});

// Route de test API
app.get("/api/test", (req, res) => {
  res.status(200).json({
    message: "La route de test fonctionne correctement"
  });
});
module.exports =app;